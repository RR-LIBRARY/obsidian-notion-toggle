import { gatewayFetch } from "./gateway.server";
import { BridgeError } from "./errors.server";
import type {
  AnswerRequest,
  BasisEntry,
  Citation,
  ExtractRequest,
  ExtractResult,
  Processor,
  SearchRequest,
  SearchResult,
  Source,
  TaskPreset,
} from "./schemas";

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

interface ParallelSearchResponse {
  search_id?: string;
  results?: Array<{ url: string; title?: string | null; publish_date?: string | null; excerpts?: string[] | null }>;
  warnings?: Array<string | { message?: string }> | null;
}

/** Split a natural-language query into 1–3 short keyword queries (≤200 chars each). */
export function toSearchQueries(query: string): string[] {
  const cleaned = query.replace(/\s+/g, " ").trim();
  const primary = cleaned.slice(0, 200);
  const queries = [primary];
  const words = cleaned.split(" ").filter((w) => w.length > 2);
  if (words.length > 6) {
    queries.push(words.slice(0, 6).join(" ").slice(0, 200));
  }
  return Array.from(new Set(queries)).slice(0, 3);
}

export async function parallelSearch(req: SearchRequest): Promise<{ results: SearchResult[]; warnings: string[] }> {
  const body: Record<string, unknown> = {
    objective: req.objective ?? `Find reliable, specific information about: ${req.query}`,
    search_queries: toSearchQueries(req.query),
    mode: req.mode,
    advanced_settings: {
      max_results: req.maxResults,
      excerpt_settings: { max_chars_per_result: req.maxChars },
      ...(req.includeDomains?.length || req.afterDate
        ? {
            source_policy: {
              ...(req.includeDomains?.length ? { include_domains: req.includeDomains } : {}),
              ...(req.afterDate ? { after_date: req.afterDate } : {}),
            },
          }
        : {}),
    },
  };
  const { data } = await gatewayFetch<ParallelSearchResponse>("parallel", "/v1/search", { body });
  const results: SearchResult[] = (data?.results ?? []).map((r) => ({
    url: r.url,
    title: (r.title ?? "").trim() || hostnameOf(r.url),
    publishDate: r.publish_date ?? null,
    excerpts: (r.excerpts ?? []).map((e) => e.trim()).filter(Boolean),
  }));
  const warnings = (data?.warnings ?? [])
    .map((w) => (typeof w === "string" ? w : (w?.message ?? "")))
    .filter(Boolean);
  return { results, warnings };
}

/* ------------------------------------------------------------------ */
/* Extract                                                             */
/* ------------------------------------------------------------------ */

interface ParallelExtractResponse {
  results?: Array<{
    url: string;
    title?: string | null;
    publish_date?: string | null;
    excerpts?: string[] | null;
    full_content?: string | null;
  }>;
  errors?: Array<{ url: string; error_type?: string; http_status_code?: number | null }>;
}

export async function parallelExtract(
  req: ExtractRequest,
): Promise<{ results: ExtractResult[]; errors: Array<{ url: string; errorType: string; httpStatus: number | null }> }> {
  const body: Record<string, unknown> = {
    urls: req.urls,
    ...(req.objective ? { objective: req.objective } : {}),
    excerpts: req.fullContent ? false : { max_chars_per_result: req.maxChars },
    full_content: req.fullContent ? { max_chars_per_result: req.maxChars } : false,
  };
  const { data } = await gatewayFetch<ParallelExtractResponse>("parallel", "/v1/extract", { body });
  return {
    results: (data?.results ?? []).map((r) => ({
      url: r.url,
      title: (r.title ?? "").trim() || hostnameOf(r.url),
      publishDate: r.publish_date ?? null,
      excerpts: (r.excerpts ?? []).map((e) => e.trim()).filter(Boolean),
      fullContent: r.full_content ?? null,
    })),
    errors: (data?.errors ?? []).map((e) => ({
      url: e.url,
      errorType: e.error_type ?? "fetch_failed",
      httpStatus: e.http_status_code ?? null,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* Responses (cited answers)                                           */
/* ------------------------------------------------------------------ */

interface ResponsesOutputItem {
  type: string;
  action?: { type?: string; query?: string; url?: string };
  content?: Array<{
    type: string;
    text?: string;
    annotations?: Array<{
      type: string;
      url?: string;
      title?: string;
      start_index?: number;
      end_index?: number;
    }>;
  }>;
}

interface ParallelResponsesResponse {
  id: string;
  output?: ResponsesOutputItem[];
  output_text?: string;
}

export interface ParsedAnswer {
  responseId: string;
  text: string;
  citations: Citation[];
  sources: Source[];
  searches: string[];
}

export function parseResponsesOutput(data: ParallelResponsesResponse): ParsedAnswer {
  const citations: Citation[] = [];
  const searches: string[] = [];
  let text = "";
  for (const item of data.output ?? []) {
    if (item.type === "web_search_call") {
      const q = item.action?.query;
      if (q) searches.push(q);
      continue;
    }
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      text += part.text ?? "";
      for (const a of part.annotations ?? []) {
        if (a.type !== "url_citation" || !a.url) continue;
        citations.push({
          url: a.url,
          title: (a.title ?? "").trim() || hostnameOf(a.url),
          startIndex: typeof a.start_index === "number" ? a.start_index : null,
          endIndex: typeof a.end_index === "number" ? a.end_index : null,
        });
      }
    }
  }
  if (!text && data.output_text) text = data.output_text;
  return { responseId: data.id, text: text.trim(), citations, sources: dedupeSources(citations), searches };
}

export async function parallelAnswer(
  req: AnswerRequest & { jsonSchema?: { name: string; schema: Record<string, unknown> } },
): Promise<ParsedAnswer> {
  const input = req.instructions ? `${req.instructions}\n\nQuestion: ${req.question}` : req.question;
  const body: Record<string, unknown> = {
    model: "parallel",
    input,
    reasoning: { effort: req.effort },
    ...(req.previousResponseId ? { previous_response_id: req.previousResponseId } : {}),
    ...(req.includeDomains?.length
      ? { tools: [{ type: "web_search", filters: { allowed_domains: req.includeDomains } }] }
      : {}),
    ...(req.jsonSchema
      ? { text: { format: { type: "json_schema", name: req.jsonSchema.name, schema: req.jsonSchema.schema } } }
      : {}),
  };
  const { data } = await gatewayFetch<ParallelResponsesResponse>("parallel", "/v1/responses", {
    body,
    timeoutMs: 58_000,
  });
  if (!data?.id) throw new BridgeError("provider_error", "Parallel returned no response id", { status: 502 });
  return parseResponsesOutput(data);
}

/* ------------------------------------------------------------------ */
/* Tasks (deep research)                                               */
/* ------------------------------------------------------------------ */

export function taskSpecForPreset(preset: TaskPreset): Record<string, unknown> {
  switch (preset) {
    case "key_facts":
      return {
        output_schema: {
          type: "json",
          json_schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Short title for the topic" },
              facts: {
                type: "array",
                description: "8-15 concise, verifiable facts. One sentence each. Include numbers and dates when known.",
                items: { type: "string" },
              },
              summary: { type: "string", description: "Two-sentence overview" },
            },
            required: ["title", "facts", "summary"],
            additionalProperties: false,
          },
        },
      };
    case "compare":
      return {
        output_schema: {
          type: "json",
          json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              criteria: { type: "array", description: "Comparison dimensions", items: { type: "string" } },
              options: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    summary: { type: "string" },
                    scores: {
                      type: "array",
                      description: "One short assessment per criterion, same order as criteria",
                      items: { type: "string" },
                    },
                    pros: { type: "array", items: { type: "string" } },
                    cons: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "summary", "scores", "pros", "cons"],
                  additionalProperties: false,
                },
              },
              verdict: { type: "string", description: "Which option fits which situation" },
            },
            required: ["title", "criteria", "options", "verdict"],
            additionalProperties: false,
          },
        },
      };
    case "timeline":
      return {
        output_schema: {
          type: "json",
          json_schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              events: {
                type: "array",
                description: "Chronological events, oldest first",
                items: {
                  type: "object",
                  properties: {
                    date: { type: "string", description: "ISO date or year" },
                    event: { type: "string" },
                    significance: { type: "string" },
                  },
                  required: ["date", "event", "significance"],
                  additionalProperties: false,
                },
              },
            },
            required: ["title", "events"],
            additionalProperties: false,
          },
        },
      };
    case "literature":
      return {
        output_schema: {
          type: "text",
          description:
            "A literature summary in markdown with these sections: ## Overview, ## Key papers (each with authors, year, venue, one-paragraph finding), ## Methods used, ## Points of agreement, ## Open questions, ## Suggested reading order. Use inline markdown links for citations.",
        },
      };
    case "report":
    default:
      return {
        output_schema: {
          type: "text",
          description:
            "A well-structured markdown research report: a two-sentence executive summary, then ## sections with clear headings, bullet points for facts, and inline markdown links to sources. End with ## Key takeaways (5 bullets) and ## Sources.",
        },
      };
  }
}

interface TaskRunCreateResponse {
  run_id: string;
  status?: string;
}

export async function parallelCreateTask(input: {
  objective: string;
  preset: TaskPreset;
  processor: Processor;
}): Promise<{ runId: string; status: string }> {
  const { data } = await gatewayFetch<TaskRunCreateResponse>("parallel", "/v1/tasks/runs", {
    body: {
      input: input.objective,
      processor: input.processor,
      task_spec: taskSpecForPreset(input.preset),
      metadata: { preset: input.preset, source: "obsidian-notion-toggle" },
    },
  });
  if (!data?.run_id) throw new BridgeError("provider_error", "Parallel returned no run id", { status: 502 });
  return { runId: data.run_id, status: data.status ?? "queued" };
}

interface TaskRunResultResponse {
  run?: { run_id: string; status: string; error?: { message?: string } | string | null };
  output?: {
    type: "text" | "json";
    content: unknown;
    basis?: Array<{
      field?: string;
      confidence?: string | null;
      reasoning?: string | null;
      citations?: Array<{ url: string; title?: string | null; excerpts?: string[] | null }>;
    }>;
  } | null;
}

export type PolledRun =
  | { state: "running" }
  | { state: "failed"; error: string }
  | { state: "completed"; content: unknown; type: "text" | "json"; basis: BasisEntry[] };

export async function parallelPollTask(runId: string): Promise<PolledRun> {
  const { status, data } = await gatewayFetch<TaskRunResultResponse>(
    "parallel",
    `/v1/tasks/runs/${encodeURIComponent(runId)}/result?timeout=1`,
    { method: "GET", allowStatuses: [408], timeoutMs: 30_000 },
  );
  if (status === 408) return { state: "running" };
  const runStatus = data?.run?.status ?? "";
  if (runStatus === "failed" || runStatus === "cancelled") {
    const err = data?.run?.error;
    const message = typeof err === "string" ? err : (err?.message ?? `Run ${runStatus}`);
    return { state: "failed", error: message };
  }
  if (!data?.output) return { state: "running" };
  const basis: BasisEntry[] = (data.output.basis ?? []).map((b) => ({
    field: b.field ?? "output",
    confidence: b.confidence ?? null,
    reasoning: b.reasoning ?? null,
    citations: (b.citations ?? []).map((c) => ({
      url: c.url,
      title: c.title ?? null,
      excerpts: (c.excerpts ?? []).filter(Boolean),
    })),
  }));
  return { state: "completed", content: data.output.content, type: data.output.type, basis };
}

export async function parallelTaskStatus(runId: string): Promise<{ status: string; error: string | null }> {
  const { data } = await gatewayFetch<{ status?: string; error?: { message?: string } | string | null }>(
    "parallel",
    `/v1/tasks/runs/${encodeURIComponent(runId)}`,
    { method: "GET", timeoutMs: 20_000 },
  );
  const err = data?.error;
  return { status: data?.status ?? "running", error: typeof err === "string" ? err : (err?.message ?? null) };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function dedupeSources(items: Array<{ url: string; title?: string | null }>): Source[] {
  const seen = new Map<string, Source>();
  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    seen.set(item.url, { url: item.url, title: (item.title ?? "").trim() || hostnameOf(item.url) });
  }
  return Array.from(seen.values());
}
