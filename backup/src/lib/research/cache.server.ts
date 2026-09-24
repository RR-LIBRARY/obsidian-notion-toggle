/**
 * Two-tier result cache: a small in-process LRU for hot repeats within one
 * worker, backed by the shared `research_cache` table so identical queries
 * from any user do not spend provider credits twice inside the TTL window.
 */

const MEMORY_MAX = 200;
const memory = new Map<string, { expiresAt: number; payload: unknown }>();

export const CACHE_TTL_MS = {
  search: 6 * 60 * 60 * 1000,
  perplexity: 6 * 60 * 60 * 1000,
  extract: 24 * 60 * 60 * 1000,
} as const;

export async function cacheKey(kind: string, input: unknown): Promise<string> {
  const raw = `${kind}:${JSON.stringify(input)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const hot = memory.get(key);
  if (hot) {
    if (hot.expiresAt > now) return hot.payload as T;
    memory.delete(key);
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("research_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .gt("expires_at", new Date(now).toISOString())
      .maybeSingle();
    if (!data) return null;
    remember(key, data.payload, new Date(data.expires_at).getTime());
    return data.payload as T;
  } catch (err) {
    console.error("[bridge] cache read failed", err);
    return null;
  }
}

export async function cacheSet(key: string, kind: string, payload: unknown, ttlMs: number): Promise<void> {
  const expiresAt = Date.now() + ttlMs;
  remember(key, payload, expiresAt);
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("research_cache").upsert(
      {
        cache_key: key,
        kind,
        payload: payload as never,
        expires_at: new Date(expiresAt).toISOString(),
      },
      { onConflict: "cache_key" },
    );
    // Opportunistic sweep so the table does not grow without bound.
    if (Math.random() < 0.05) {
      await supabaseAdmin.from("research_cache").delete().lt("expires_at", new Date().toISOString());
    }
  } catch (err) {
    console.error("[bridge] cache write failed", err);
  }
}

function remember(key: string, payload: unknown, expiresAt: number) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value;
    if (oldest) memory.delete(oldest);
  }
  memory.set(key, { payload, expiresAt });
}
