import { BridgeError, providerFailure } from "./errors.server";

export type GatewayConnector = "parallel" | "perplexity";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 55_000;

const CONNECTION_KEY_ENV: Record<GatewayConnector, string> = {
  parallel: "PARALLEL_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const PROVIDER_LABEL: Record<GatewayConnector, string> = {
  parallel: "Parallel",
  perplexity: "Perplexity",
};

export function providerConfigured(connector: GatewayConnector): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env[CONNECTION_KEY_ENV[connector]]);
}

export function aiConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new BridgeError("internal", `${name} is not configured on the bridge`);
  return value;
}

export interface GatewayResult<T> {
  status: number;
  data: T;
  headers: Headers;
}

/**
 * Call a connector-gateway endpoint. Throws BridgeError on non-2xx unless the
 * status is listed in `allowStatuses` (used for Parallel's 408 "still running").
 */
export async function gatewayFetch<T = unknown>(
  connector: GatewayConnector,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number; allowStatuses?: number[] } = {},
): Promise<GatewayResult<T>> {
  const lovableKey = requireEnv("LOVABLE_API_KEY");
  const connectionKey = requireEnv(CONNECTION_KEY_ENV[connector]);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const url = `${GATEWAY_BASE}/${connector}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: init.body === undefined ? null : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new BridgeError(
      "provider_error",
      aborted
        ? `${PROVIDER_LABEL[connector]} did not answer in time. Try a faster mode or a narrower question.`
        : `${PROVIDER_LABEL[connector]} is unreachable: ${err instanceof Error ? err.message : String(err)}`,
      { status: 504 },
    );
  }
  clearTimeout(timer);

  const text = await response.text();
  if (!response.ok && !(init.allowStatuses ?? []).includes(response.status)) {
    console.error(`[bridge] ${connector} ${path} failed [${response.status}]: ${text.slice(0, 800)}`);
    throw providerFailure(PROVIDER_LABEL[connector], response.status, text, response.headers.get("Retry-After"));
  }

  let data: T;
  try {
    data = (text ? JSON.parse(text) : null) as T;
  } catch {
    if (!response.ok) {
      // Allowed non-2xx statuses can legitimately have empty/non-JSON bodies.
      data = null as T;
    } else {
      throw new BridgeError("provider_error", `${PROVIDER_LABEL[connector]} returned a non-JSON body`, { status: 502 });
    }
  }
  return { status: response.status, data, headers: response.headers };
}

export interface AiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Call the Lovable AI gateway and return the assistant message text. */
export async function aiChat(
  messages: AiChatMessage[],
  opts: { model?: string; json?: boolean } = {},
): Promise<string> {
  const lovableKey = requireEnv("LOVABLE_API_KEY");
  let response: Response;
  try {
    // No artificial timeout: generation takes as long as the model needs; a
    // deadline here would discard work that still completes (and bills). The
    // plugin side keeps its own minutes-long ceiling purely so the panel can
    // stop spinning and say so.
    response = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: opts.model ?? "openai/gpt-6-astra",
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (err) {
    throw new BridgeError("provider_error", `AI gateway unreachable: ${err instanceof Error ? err.message : String(err)}`, {
      status: 504,
    });
  }
  const text = await response.text();
  if (!response.ok) {
    console.error(`[bridge] ai gateway failed [${response.status}]: ${text.slice(0, 800)}`);
    throw providerFailure("Lovable AI", response.status, text, response.headers.get("Retry-After"));
  }
  let parsed: { choices?: Array<{ message?: { content?: string } }> };
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    throw new BridgeError("provider_error", "The AI gateway returned a non-JSON body", { status: 502 });
  }
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new BridgeError("provider_error", "The AI model returned an empty answer", { status: 502 });
  return content;
}
