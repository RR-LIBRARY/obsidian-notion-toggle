import { BridgeError } from "./errors.server";
import type { RequestKind } from "./schemas";

export const KEY_PREFIX = "ntr_";

/** The caller identity every bridge operation runs under. */
export interface Caller {
  userId: string;
  keyId: string | null;
  keyName: string;
  keyPrefix: string;
  /** "plugin" = authenticated with a plugin key; "dashboard" = signed-in web user. */
  via: "plugin" | "dashboard";
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashKey(plaintext: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plaintext));
  return toHex(digest);
}

/** Mint a fresh plugin key. The plaintext is shown to the user exactly once. */
export async function mintPluginKey(): Promise<{ plaintext: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const plaintext = `${KEY_PREFIX}${toBase64Url(bytes)}`;
  return { plaintext, hash: await hashKey(plaintext), prefix: plaintext.slice(0, KEY_PREFIX.length + 8) };
}

export function readBearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("x-plugin-key");
  if (!header) return null;
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  return token || null;
}

/** Resolve the plugin key on an incoming public request. Throws 401 when missing/invalid. */
export async function resolveCaller(request: Request): Promise<Caller> {
  const token = readBearer(request);
  if (!token) {
    throw new BridgeError("unauthorized", "Missing plugin key. Send it as `Authorization: Bearer ntr_…`.");
  }
  if (!token.startsWith(KEY_PREFIX) || token.length < 30) {
    throw new BridgeError("unauthorized", "That does not look like a plugin key (expected ntr_…).");
  }
  const hash = await hashKey(token);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("plugin_keys")
    .select("id, user_id, name, key_prefix, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error) {
    console.error("[bridge] key lookup failed", error);
    throw new BridgeError("internal", "Key lookup failed");
  }
  if (!data) throw new BridgeError("unauthorized", "Unknown plugin key. Create a new one in the dashboard.");
  if (data.revoked_at) throw new BridgeError("unauthorized", "This plugin key was revoked. Create a new one in the dashboard.");
  return { userId: data.user_id, keyId: data.id, keyName: data.name, keyPrefix: data.key_prefix, via: "plugin" };
}

export function dashboardCaller(userId: string): Caller {
  return { userId, keyId: null, keyName: "Dashboard", keyPrefix: "web", via: "dashboard" };
}

interface LogInput {
  caller: Caller;
  kind: RequestKind;
  provider: string;
  query: string;
  status: "ok" | "error" | "cached";
  latencyMs: number;
  error?: string | null;
}

/** Fire-and-forget usage logging. Never throws. */
export async function logRequest(input: LogInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("research_requests").insert({
      user_id: input.caller.userId,
      key_id: input.caller.keyId,
      kind: input.kind,
      provider: input.provider,
      query: input.query.slice(0, 500),
      status: input.status,
      latency_ms: Math.round(input.latencyMs),
      error: input.error ? input.error.slice(0, 1000) : null,
    });
    if (input.caller.keyId && input.status !== "error") {
      await supabaseAdmin.rpc("touch_plugin_key", { _key_id: input.caller.keyId });
    }
  } catch (err) {
    console.error("[bridge] usage log failed", err);
  }
}
