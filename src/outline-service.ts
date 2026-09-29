/**
 * v1.8.23 — "Outline selection with AI".
 *
 * Sends the selected note text to the reader's own outline service (the
 * Lovable app that fronts the AI gateway) and turns the answer into
 * same-level Notion-style toggles. Pure: the HTTP transport is injected, so
 * every request/response shape is unit tested without a network.
 */

export interface OutlineTransportRequest {
  url: string;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}
export interface OutlineTransportResponse {
  status: number;
  text: string;
}
export type OutlineTransport = (req: OutlineTransportRequest) => Promise<OutlineTransportResponse>;

export const MAX_OUTLINE_INPUT_CHARS = 20_000;

export interface OutlineSettings {
  /** Base address of the outline service, e.g. https://my-app.lovable.app */
  outlineServiceUrl: string;
  /** Access key the service checks (x-outline-key). */
  outlineAccessKey: string;
  /** Upper bound on how many toggles one run may write. */
  outlineMaxToggles: number;
}

export const DEFAULT_OUTLINE_SETTINGS: OutlineSettings = {
  outlineServiceUrl: "",
  outlineAccessKey: "",
  outlineMaxToggles: 12,
};

export interface OutlineToggle {
  title: string;
  body: string;
}

export interface OutlineFormatOptions {
  format: "callout" | "details";
  calloutType: string;
  collapsed: boolean;
  boldTitle: boolean;
  maxToggles: number;
}

export class OutlineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
    public readonly retryAfterSec: number | null = null
  ) {
    super(message);
    this.name = "OutlineError";
  }
}

/** Normalise whatever the reader pasted into a clean origin (no trailing slash / path). */
export function normalizeServiceUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return withScheme.replace(/\/+$/, "");
  }
}

export function outlineEndpoint(baseUrl: string): string {
  return `${normalizeServiceUrl(baseUrl)}/api/public/outline`;
}

/** Text to outline: the selection, else the whole note. Trimmed to the service limit. */
export function outlineInput(selection: string, noteText: string): { text: string; fromSelection: boolean } {
  const sel = selection.trim();
  if (sel) return { text: sel.slice(0, MAX_OUTLINE_INPUT_CHARS), fromSelection: true };
  return { text: noteText.trim().slice(0, MAX_OUTLINE_INPUT_CHARS), fromSelection: false };
}

export function buildOutlineBody(text: string, opts: OutlineFormatOptions): string {
  return JSON.stringify({
    text,
    format: opts.format,
    calloutType: opts.calloutType || "note",
    collapsed: opts.collapsed,
    boldTitle: opts.boldTitle,
    maxToggles: Math.min(Math.max(Math.round(opts.maxToggles) || 12, 1), 40),
    language: "auto",
  });
}

/** Local renderer — used when the service answers with toggles but no markdown. */
export function togglesToMarkdown(toggles: OutlineToggle[], opts: OutlineFormatOptions): string {
  return toggles
    .map((t) => {
      if (opts.format === "details") {
        const open = opts.collapsed ? "" : " open";
        const title = opts.boldTitle ? `<b>${t.title}</b>` : t.title;
        const body = t.body ? `\n\n${t.body}\n` : "\n";
        return `<details${open}>\n<summary>${title}</summary>${body}\n</details>`;
      }
      const fold = opts.collapsed ? "-" : "+";
      const title = opts.boldTitle ? `**${t.title}**` : t.title;
      const head = `> [!${opts.calloutType || "note"}]${fold} ${title}`;
      if (!t.body) return head;
      return [head, ...t.body.split("\n").map((l) => (l ? `> ${l}` : ">"))].join("\n");
    })
    .join("\n\n");
}

interface ServiceError {
  code?: string;
  message?: string;
  retryAfterSec?: number | null;
}

export function parseOutlineResponse(res: OutlineTransportResponse, opts: OutlineFormatOptions): { markdown: string; toggles: OutlineToggle[] } {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(res.text);
  } catch {
    parsed = null;
  }
  if (res.status < 200 || res.status >= 300) {
    const err = (parsed as { error?: ServiceError } | null)?.error ?? {};
    throw new OutlineError(err.code ?? "provider_error", err.message ?? `The outline service answered ${res.status}.`, res.status, err.retryAfterSec ?? null);
  }
  const body = parsed as { toggles?: OutlineToggle[]; markdown?: string } | null;
  const toggles = Array.isArray(body?.toggles)
    ? body!.toggles.filter((t) => t && typeof t.title === "string").map((t) => ({ title: String(t.title).trim(), body: typeof t.body === "string" ? t.body : "" })).filter((t) => t.title)
    : [];
  if (!toggles.length) throw new OutlineError("empty", "The outline service found nothing to turn into toggles. Try a longer selection.", res.status);
  const markdown = typeof body?.markdown === "string" && body.markdown.trim() ? body.markdown.trimEnd() : togglesToMarkdown(toggles, opts);
  return { markdown, toggles };
}

/** One outline run. Throws OutlineError with a reader-friendly message. */
export async function requestOutline(
  transport: OutlineTransport,
  settings: OutlineSettings,
  text: string,
  opts: OutlineFormatOptions
): Promise<{ markdown: string; toggles: OutlineToggle[] }> {
  if (!settings.outlineServiceUrl.trim()) throw new OutlineError("not_configured", "Add your outline service address in the plugin settings first.");
  if (!settings.outlineAccessKey.trim()) throw new OutlineError("not_configured", "Add the outline access key in the plugin settings first.");
  if (!text.trim()) throw new OutlineError("invalid_request", "Select some text first.");
  let res: OutlineTransportResponse;
  try {
    res = await transport({
      url: outlineEndpoint(settings.outlineServiceUrl),
      method: "POST",
      headers: { "Content-Type": "application/json", "x-outline-key": settings.outlineAccessKey.trim() },
      body: buildOutlineBody(text, opts),
    });
  } catch (err) {
    throw new OutlineError("network", `Could not reach the outline service: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseOutlineResponse(res, opts);
}

/** Health check for the settings "Test" button. */
export async function testOutlineService(transport: OutlineTransport, settings: OutlineSettings): Promise<string> {
  if (!settings.outlineServiceUrl.trim()) throw new OutlineError("not_configured", "Add the service address first.");
  const res = await transport({ url: outlineEndpoint(settings.outlineServiceUrl), method: "GET", headers: {} });
  let body: { ok?: boolean; model?: string; configured?: boolean; version?: string } | null = null;
  try {
    body = JSON.parse(res.text);
  } catch {
    body = null;
  }
  if (res.status !== 200 || !body?.ok) throw new OutlineError("provider_error", `The service answered ${res.status}. Check the address.`, res.status);
  if (body.configured === false) throw new OutlineError("not_configured", "The service is up but its access key is not set yet.", res.status);
  return `Connected — ${body.model ?? "model ready"}${body.version ? ` (v${body.version})` : ""}.`;
}

export function describeOutlineError(err: unknown): string {
  if (err instanceof OutlineError) {
    if (err.code === "unauthorized") return "That access key was rejected. Check the key in the plugin settings.";
    if (err.code === "rate_limited") return `Too many requests. Try again${err.retryAfterSec ? ` in ${err.retryAfterSec}s` : " in a moment"}.`;
    if (err.code === "payment_required") return "The outline service is out of AI credits. Top up, then try again.";
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
