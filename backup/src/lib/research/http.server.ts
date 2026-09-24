import type { ZodTypeAny, z } from "zod";
import { BridgeError, asBridgeError } from "./errors.server";
import { resolveCaller, type Caller } from "./auth.server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Plugin-Key, X-Plugin-Version",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...(init.headers ?? {}),
    },
  });
}

export function errorResponse(err: unknown): Response {
  const bridgeErr = asBridgeError(err);
  if (bridgeErr.code === "internal") console.error("[bridge] internal error", err);
  const headers: Record<string, string> = {};
  if (bridgeErr.retryAfter) headers["Retry-After"] = String(bridgeErr.retryAfter);
  return json(bridgeErr.toBody(), { status: bridgeErr.status, headers });
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function parseBody<S extends ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    const text = await request.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new BridgeError("invalid_request", "Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw asBridgeError(result.error);
  return result.data;
}

/**
 * Wrap a public bridge handler: authenticates the plugin key, runs the work,
 * and converts every failure into a JSON error body with CORS headers.
 */
export function bridgeHandler(work: (ctx: { request: Request; caller: Caller; params: Record<string, string> }) => Promise<unknown>) {
  return async ({ request, params }: { request: Request; params?: Record<string, string> }): Promise<Response> => {
    try {
      const caller = await resolveCaller(request);
      const body = await work({ request, caller, params: params ?? {} });
      return json(body);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
