/**
 * v1.7.0 — HTTP client for the Toggle Research bridge.
 *
 * The transport is injected (Obsidian's `requestUrl` in the app, a stub in
 * tests), so this module stays pure and every request/response shape is unit
 * tested without a network. Errors surface as `ResearchError` with the
 * bridge's machine-readable code so the UI can say *why* something failed.
 */
import { ResearchCache, cacheKey } from "./cache";
import type {
  AnswerRequest,
  AnswerResponse,
  BridgeErrorBody,
  BridgeErrorCode,
  ExtractRequest,
  ExtractResponse,
  FactCheckRequest,
  FactCheckResponse,
  HealthResponse,
  PerplexityRequest,
  PerplexityResponse,
  RecallRequest,
  RecallResponse,
  SearchRequest,
  SearchResponse,
  TaskCreateRequest,
  TaskListResponse,
  TaskRun,
} from "./types";

export interface TransportRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}
export interface TransportResponse {
  status: number;
  text: string;
}
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export class ResearchError extends Error {
  constructor(
    public readonly code: BridgeErrorCode | "network" | "not_configured",
    message: string,
    public readonly status = 0,
    public readonly retryAfterSec: number | null = null
  ) {
    super(message);
    this.name = "ResearchError";
  }
}

export const PLUGIN_KEY_PATTERN = /^ntr_[A-Za-z0-9_-]{16,}$/;

/** Normalise whatever the reader pasted into a clean origin (no trailing slash / path). */
export function normalizeBridgeUrl(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    return s.replace(/\/+$/, "");
  }
}

export function bridgeConfigured(settings: { researchBridgeUrl: string; researchPluginKey: string }): boolean {
  return normalizeBridgeUrl(settings.researchBridgeUrl).length > 0 && settings.researchPluginKey.trim().length > 0;
}

/** Human message for a failure, with the fix the reader can act on. */
export function describeError(err: unknown): string {
  if (err instanceof ResearchError) {
    switch (err.code) {
      case "not_configured":
        return "Research is not set up yet — add the bridge URL and plugin key in Settings → Notion Toggle → Web research.";
      case "unauthorized":
        return "The plugin key was rejected. Create a new key in the research dashboard and paste it in settings.";
      case "rate_limited":
        return err.retryAfterSec
          ? `Too many requests — try again in ${err.retryAfterSec}s.`
          : "Too many requests — wait a moment and try again.";
      case "payment_required":
        return "The research workspace is out of credits. Top up in the dashboard, then try again.";
      case "network":
        return `Could not reach the research bridge: ${err.message}`;
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

export interface ResearchClientOptions {
  bridgeUrl: string;
  pluginKey: string;
  transport: Transport;
  cache?: ResearchCache | null;
  /** Sent as an X-Client hint so the dashboard can label requests. */
  clientVersion?: string;
}

export class ResearchClient {
  private readonly base: string;
  private readonly key: string;
  private readonly transport: Transport;
  private readonly cache: ResearchCache | null;
  private readonly clientVersion: string;

  constructor(opts: ResearchClientOptions) {
    this.base = normalizeBridgeUrl(opts.bridgeUrl);
    this.key = opts.pluginKey.trim();
    this.transport = opts.transport;
    this.cache = opts.cache ?? null;
    this.clientVersion = opts.clientVersion ?? "obsidian-notion-toggle";
  }

  get configured(): boolean {
    return this.base.length > 0 && this.key.length > 0;
  }

  endpoint(path: string): string {
    return `${this.base}/api/public/research${path.startsWith("/") ? path : `/${path}`}`;
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  search(req: SearchRequest): Promise<SearchResponse> {
    return this.cached("search", req, () => this.request<SearchResponse>("POST", "/search", req));
  }

  perplexity(req: PerplexityRequest): Promise<PerplexityResponse> {
    return this.cached("perplexity", req, () => this.request<PerplexityResponse>("POST", "/perplexity", req));
  }

  extract(req: ExtractRequest): Promise<ExtractResponse & { cached?: boolean }> {
    return this.cached("extract", req, () => this.request<ExtractResponse & { cached?: boolean }>("POST", "/extract", req));
  }

  answer(req: AnswerRequest): Promise<AnswerResponse> {
    return this.request<AnswerResponse>("POST", "/answer", req);
  }

  factCheck(req: FactCheckRequest): Promise<FactCheckResponse> {
    return this.request<FactCheckResponse>("POST", "/factcheck", req);
  }

  recall(req: RecallRequest): Promise<RecallResponse> {
    return this.request<RecallResponse>("POST", "/recall", req);
  }

  createTask(req: TaskCreateRequest): Promise<TaskRun> {
    return this.request<TaskRun>("POST", "/tasks", req);
  }

  pollTask(runId: string): Promise<TaskRun> {
    return this.request<TaskRun>("GET", `/tasks/${encodeURIComponent(runId)}`);
  }

  listTasks(opts: { limit?: number; includeResult?: boolean } = {}): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.includeResult) params.set("include", "result");
    const qs = params.toString();
    return this.request<TaskListResponse>("GET", `/tasks${qs ? `?${qs}` : ""}`);
  }

  private async cached<T extends { cached?: boolean }>(op: string, body: unknown, run: () => Promise<T>): Promise<T> {
    if (!this.cache) return run();
    const key = cacheKey(op, body);
    const hit = this.cache.get<T>(key);
    if (hit) return { ...hit, cached: true };
    const fresh = await run();
    this.cache.set(key, fresh);
    return fresh;
  }

  private async request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!this.configured) throw new ResearchError("not_configured", "Research bridge is not configured");
    let res: TransportResponse;
    try {
      res = await this.transport({
        url: this.endpoint(path),
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Client": this.clientVersion,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new ResearchError("network", err instanceof Error ? err.message : String(err));
    }
    const parsed = parseJson(res.text);
    if (res.status >= 200 && res.status < 300) {
      if (parsed === undefined) throw new ResearchError("internal", "The bridge returned an unreadable answer", res.status);
      return parsed as T;
    }
    const errBody = parsed as Partial<BridgeErrorBody> | undefined;
    const code = errBody?.error?.code ?? codeForStatus(res.status);
    const message = errBody?.error?.message ?? `Bridge request failed (${res.status})`;
    throw new ResearchError(code, message, res.status, errBody?.error?.retryAfterSec ?? null);
  }
}

export function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function codeForStatus(status: number): BridgeErrorCode {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 402) return "payment_required";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status === 502 || status === 503 || status === 504) return "provider_error";
  return "internal";
}

/* ---------- input helpers shared by commands and the panel ---------- */

const URL_RE = /https?:\/\/[^\s<>()\]"'`]+/g;

/** Every http(s) URL in a piece of text, deduplicated, trailing punctuation trimmed. */
export function extractUrls(text: string): string[] {
  const out: string[] = [];
  for (const m of text.match(URL_RE) ?? []) {
    const cleaned = m.replace(/[.,;:!?)]+$/, "");
    if (!out.includes(cleaned)) out.push(cleaned);
  }
  return out.slice(0, 20);
}

/** Strip YAML frontmatter so recall generation sees only the note body. */
export function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/** Clip long note text to the bridge's limit at a paragraph boundary. */
export function clipForRecall(text: string, max = 60_000): string {
  const t = stripFrontmatter(text).trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf("\n\n", max);
  return t.slice(0, cut > max * 0.6 ? cut : max);
}
