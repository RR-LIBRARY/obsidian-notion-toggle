import type { BridgeErrorBody, BridgeErrorCode } from "./schemas";

const STATUS_BY_CODE: Record<BridgeErrorCode, number> = {
  unauthorized: 401,
  invalid_request: 400,
  provider_error: 502,
  rate_limited: 429,
  payment_required: 402,
  not_found: 404,
  internal: 500,
};

export class BridgeError extends Error {
  readonly code: BridgeErrorCode;
  readonly status: number;
  readonly retryAfter: number | null;

  constructor(code: BridgeErrorCode, message: string, opts: { status?: number; retryAfter?: number | null } = {}) {
    super(message);
    this.name = "BridgeError";
    this.code = code;
    this.status = opts.status ?? STATUS_BY_CODE[code];
    this.retryAfter = opts.retryAfter ?? null;
  }

  toBody(): BridgeErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        status: this.status,
        ...(this.retryAfter !== null ? { retryAfterSec: this.retryAfter } : {}),
      },
    };
  }
}

/** Map a provider/gateway HTTP failure to a BridgeError with a readable message. */
export function providerFailure(provider: string, status: number, body: string, retryAfter?: string | null): BridgeError {
  const trimmed = body.length > 600 ? `${body.slice(0, 600)}…` : body;
  const retry = retryAfter ? Number(retryAfter) : null;
  if (status === 401 || status === 403) {
    return new BridgeError("provider_error", `${provider} rejected the bridge credentials [${status}]: ${trimmed}`, {
      status: 502,
    });
  }
  if (status === 402) {
    return new BridgeError(
      "payment_required",
      `${provider} is out of credits. Top up the workspace to keep researching. [${status}] ${trimmed}`,
    );
  }
  if (status === 429) {
    return new BridgeError("rate_limited", `${provider} rate limit reached. Try again shortly. ${trimmed}`, {
      retryAfter: Number.isFinite(retry) ? retry : null,
    });
  }
  if (status === 422 || status === 400) {
    return new BridgeError("invalid_request", `${provider} rejected the request [${status}]: ${trimmed}`);
  }
  return new BridgeError("provider_error", `${provider} request failed [${status}]: ${trimmed}`, { status: 502 });
}

export function asBridgeError(err: unknown): BridgeError {
  if (err instanceof BridgeError) return err;
  if (err && typeof err === "object" && "issues" in err && Array.isArray((err as { issues: unknown[] }).issues)) {
    const issues = (err as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
    const detail = issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return new BridgeError("invalid_request", `Invalid request — ${detail}`);
  }
  const message = err instanceof Error ? err.message : String(err);
  return new BridgeError("internal", message || "Unexpected bridge error");
}
