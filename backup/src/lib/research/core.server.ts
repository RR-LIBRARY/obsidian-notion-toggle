import { aiChat, aiConfigured, providerConfigured } from "./gateway.server";
import { BridgeError, asBridgeError } from "./errors.server";
import { CACHE_TTL_MS, cacheGet, cacheKey, cacheSet } from "./cache.server";
import { logRequest, type Caller } from "./auth.server";
import {
  dedupeSources,
  hostnameOf,
  parallelAnswer,
  parallelCreateTask,
  parallelExtract,
  parallelPollTask,
  parallelSearch,
  parallelTaskStatus,
} from "./parallel.server";
import { perplexitySearch } from "./perplexity.server";
import {
  BRIDGE_VERSION,
  PRESET_META,
  PROCESSOR_ESTIMATES,
  type AnswerRequest,
  type AnswerResponse,
  type BasisEntry,
  type ExtractRequest,
  type ExtractResponse,
  type FactCheckRequest,
  type FactCheckResponse,
  type HealthResponse,
  type JsonValue,
  type PerplexityRequest,
  type PerplexityResponse,
  type RecallCard,
  type RecallRequest,
  type RecallResponse,
  type RequestKind,
  type SearchRequest,
  type SearchResponse,
  type Source,
  type TaskCreateRequest,
  type TaskPreset,
  type TaskResult,
  type TaskRun,
  type TaskStatus,
  type Processor,
} from "./schemas";

/* ------------------------------------------------------------------ */
/* Shared plumbing                                                     */
/* ------------------------------------------------------------------ */

async function timed<T>(
  caller: Caller,
  kind: RequestKind,
  provider: string,
  query: string,
  work: () => Promise<{ value: T; cached?: boolean }>,
): Promise<T> {
  const started = Date.now();
  try {
    const { value, cached } = await work();
    void logRequest({ caller, kind, provider, query, status: cached ? "cached" : "ok", latencyMs: Date.now() - started });
    return value;
  } catch (err) {
    const bridgeErr = asBridgeError(err);
    void logRequest({
      caller,
      kind,
      provider,
      query,
      status: "error",
      latencyMs: Date.now() - started,
      error: `${bridgeErr.code}: ${bridgeErr.message}`,
    });
    throw bridgeErr;
  }
}

function requireProvider(connector: "parallel" | "perplexity") {
  if (!providerConfigured(connector)) {
    throw new BridgeError(
      "internal",
      `${connector === "parallel" ? "Parallel" : "Perplexity"} is not connected to this bridge yet.`,
      { status: 503 },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

export function health(caller: Caller | null): HealthResponse {
  return {
    ok: true,
    version: BRIDGE_VERSION,
    providers: {
      parallel: providerConfigured("parallel"),
      perplexity: providerConfigured("perplexity"),
      ai: aiConfigured(),
    },
    key: caller && caller.via === "plugin" ? { name: caller.keyName, prefix: caller.keyPrefix } : null,
    serverTime: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

export function runSearch(caller: Caller, req: SearchRequest): Promise<SearchResponse> {
  requireProvider("parallel");
  return timed<SearchResponse>(caller, "search", "parallel", req.query, async () => {
    const started = Date.now();
    const key = await cacheKey("search", req);
    const hit = await cacheGet<Omit<SearchResponse, "cached" | "latencyMs">>(key);
    if (hit) return { value: { ...hit, cached: true, latencyMs: Date.now() - started }, cached: true };
    const { results, warnings } = await parallelSearch(req);
    const payload = { provider: "parallel" as const, query: req.query, results, warnings };
    if (results.length) await cacheSet(key, "search", payload, CACHE_TTL_MS.search);
    return { value: { ...payload, cached: false, latencyMs: Date.now() - started } };
  });
}

/* ------------------------------------------------------------------ */
/* Perplexity                                                          */
/* ------------------------------------------------------------------ */

export function runPerplexity(caller: Caller, req: PerplexityRequest): Promise<PerplexityResponse> {
  requireProvider("perplexity");
  const label = Array.isArray(req.query) ? req.query.join(" | ") : req.query;
  return timed<PerplexityResponse>(caller, "perplexity", "perplexity", label, async () => {
    const started = Date.now();
    const key = await cacheKey("perplexity", req);
    const hit = await cacheGet<Omit<PerplexityResponse, "cached" | "latencyMs">>(key);
    if (hit) return { value: { ...hit, cached: true, latencyMs: Date.now() - started }, cached: true };
    const results = await perplexitySearch(req);
    const payload = { provider: "perplexity" as const, query: label, results };
    if (results.length) await cacheSet(key, "perplexity", payload, CACHE_TTL_MS.perplexity);
    return { value: { ...payload, cached: false, latencyMs: Date.now() - started } };
  });
}

/* ------------------------------------------------------------------ */
/* Extract                                                             */
/* ------------------------------------------------------------------ */

export function runExtract(caller: Caller, req: ExtractRequest): Promise<ExtractResponse> {
  requireProvider("parallel");
  return timed<ExtractResponse>(caller, "extract", "parallel", req.urls.join(", "), async () => {
    const started = Date.now();
    const key = await cacheKey("extract", req);
    const hit = await cacheGet<Omit<ExtractResponse, "latencyMs">>(key);
    if (hit) return { value: { ...hit, latencyMs: Date.now() - started }, cached: true };
    const { results, errors } = await parallelExtract(req);
    const payload = { provider: "parallel" as const, results, errors };
    if (results.length) await cacheSet(key, "extract", payload, CACHE_TTL_MS.extract);
    return { value: { ...payload, latencyMs: Date.now() - started } };
  });
}

/* ------------------------------------------------------------------ */
/* Answer (cited, multi-turn)                                          */
/* ------------------------------------------------------------------ */

const ANSWER_STYLE =
  "Answer directly and concisely in well-formatted markdown. Prefer short paragraphs and bullet points. State numbers, dates and names precisely. If the evidence is thin or conflicting, say so explicitly.";

export function runAnswer(caller: Caller, req: AnswerRequest): Promise<AnswerResponse> {
  requireProvider("parallel");
  return timed<AnswerResponse>(caller, "answer", "parallel", req.question, async () => {
    const started = Date.now();
    const parsed = await parallelAnswer({
      ...req,
      instructions: [ANSWER_STYLE, req.instructions].filter(Boolean).join("\n\n"),
    });
    return {
      value: {
        provider: "parallel",
        responseId: parsed.responseId,
        question: req.question,
        answer: parsed.text,
        citations: parsed.citations,
        sources: parsed.sources,
        searches: parsed.searches,
        latencyMs: Date.now() - started,
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Fact check                                                          */
/* ------------------------------------------------------------------ */

const FACTCHECK_SCHEMA = {
  name: "fact_check",
  schema: {
    type: "object",
    properties: {
      verdict: { type: "string", enum: ["supported", "partially_supported", "contradicted", "unverifiable"] },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      summary: { type: "string", description: "Two to four sentences explaining the verdict with specifics." },
      correction: {
        type: ["string", "null"],
        description: "If the claim is wrong or incomplete, the corrected statement. Otherwise null.",
      },
      quotes: {
        type: "array",
        description: "Up to 3 short verbatim quotes from sources that decide the verdict.",
        items: { type: "string" },
      },
    },
    required: ["verdict", "confidence", "summary", "correction", "quotes"],
    additionalProperties: false,
  },
};

export function runFactCheck(caller: Caller, req: FactCheckRequest): Promise<FactCheckResponse> {
  requireProvider("parallel");
  return timed<FactCheckResponse>(caller, "factcheck", "parallel", req.claim, async () => {
    const started = Date.now();
    const question = [
      "Fact-check the following claim using current, authoritative web sources.",
      req.context ? `Context from the user's notes: ${req.context}` : null,
      `Claim: ${req.claim}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const parsed = await parallelAnswer({ question, effort: req.effort, jsonSchema: FACTCHECK_SCHEMA });
    let body: {
      verdict?: FactCheckResponse["verdict"];
      confidence?: FactCheckResponse["confidence"];
      summary?: string;
      correction?: string | null;
      quotes?: string[];
    } = {};
    try {
      body = JSON.parse(parsed.text);
    } catch {
      body = { verdict: "unverifiable", confidence: "low", summary: parsed.text || "No structured verdict returned." };
    }
    const quotes = Array.isArray(body.quotes) ? body.quotes : [];
    const sources = parsed.sources.map((s, i) => ({ ...s, quote: quotes[i] ?? null }));
    return {
      value: {
        provider: "parallel",
        responseId: parsed.responseId,
        claim: req.claim,
        verdict: body.verdict ?? "unverifiable",
        confidence: body.confidence ?? "low",
        summary: body.summary ?? "",
        correction: body.correction ?? null,
        sources,
        latencyMs: Date.now() - started,
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Recall cards (research → toggles)                                   */
/* ------------------------------------------------------------------ */

const RECALL_SYSTEM = `You write active-recall flashcards for a student's Obsidian notes.
Rules:
- Every card must be answerable from the supplied material only. Do not invent facts.
- Questions are specific and test one idea each. Avoid yes/no questions.
- Answers are complete but short (1–3 sentences, or a short list).
- For "mcq" style produce 4 options with exactly one correct answer; distractors must be plausible.
- For "cloze" style the question is a sentence with the key term replaced by "____" and the answer is that term.
- Keep the user's language. If the material is in Hinglish or Hindi, write cards in the same language.
- Return JSON only: {"title": string, "cards": [{"question": string, "answer": string, "options"?: string[], "correctIndex"?: number, "hint"?: string}]}`;

async function gatherRecallMaterial(
  req: RecallRequest,
): Promise<{ material: string; sources: Source[]; titleHint: string }> {
  if (req.text) {
    return { material: req.text.slice(0, 40000), sources: [], titleHint: req.topic ?? "Recall cards" };
  }
  if (req.url) {
    requireProvider("parallel");
    const { results, errors } = await parallelExtract({
      urls: [req.url],
      fullContent: true,
      maxChars: 30000,
      objective: req.topic,
    });
    const page = results[0];
    if (!page) {
      const reason = errors[0] ? `${errors[0].errorType}${errors[0].httpStatus ? ` (${errors[0].httpStatus})` : ""}` : "no content";
      throw new BridgeError("provider_error", `Could not read ${req.url}: ${reason}`, { status: 502 });
    }
    const material = page.fullContent || page.excerpts.join("\n\n");
    return { material, sources: [{ url: page.url, title: page.title }], titleHint: page.title };
  }
  requireProvider("parallel");
  const parsed = await parallelAnswer({
    question: `Write a thorough, factual study briefing on: ${req.topic}. Cover definitions, key facts, numbers, names, dates, mechanisms and common misconceptions. Use headings and bullets.`,
    effort: "medium",
  });
  return { material: parsed.text, sources: parsed.sources, titleHint: req.topic ?? "Recall cards" };
}

export function runRecall(caller: Caller, req: RecallRequest): Promise<RecallResponse> {
  if (!aiConfigured()) throw new BridgeError("internal", "AI is not configured on this bridge", { status: 503 });
  const label = req.topic ?? req.url ?? (req.text ? req.text.slice(0, 80) : "recall");
  return timed<RecallResponse>(caller, "recall", req.url || req.topic ? "parallel+ai" : "ai", label, async () => {
    const started = Date.now();
    const { material, sources, titleHint } = await gatherRecallMaterial(req);
    if (material.trim().length < 40) {
      throw new BridgeError("invalid_request", "Not enough material to write recall cards from.");
    }
    const user = [
      `Style: ${req.style}. Difficulty: ${req.difficulty}. Number of cards: exactly ${req.count}.`,
      req.language ? `Language: ${req.language}.` : null,
      `Suggested title: ${titleHint}`,
      "Material:",
      material,
    ]
      .filter(Boolean)
      .join("\n\n");
    const raw = await aiChat(
      [
        { role: "system", content: RECALL_SYSTEM },
        { role: "user", content: user },
      ],
      { json: true },
    );
    const cards = normaliseCards(raw, req);
    if (!cards.length) throw new BridgeError("provider_error", "The model returned no usable cards", { status: 502 });
    let title = titleHint;
    try {
      const parsed = JSON.parse(raw) as { title?: string };
      if (parsed.title && parsed.title.trim()) title = parsed.title.trim();
    } catch {
      /* keep hint */
    }
    return { value: { title, style: req.style, cards, sources, latencyMs: Date.now() - started } };
  });
}

interface RawCard {
  question?: unknown;
  answer?: unknown;
  options?: unknown;
  correctIndex?: unknown;
  hint?: unknown;
}

function normaliseCards(raw: string, req: RecallRequest): RecallCard[] {
  let parsed: { cards?: unknown } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        return [];
      }
    }
  }
  const list = Array.isArray(parsed.cards) ? parsed.cards : [];
  const cards: RecallCard[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as RawCard;
    const question = typeof c.question === "string" ? c.question.trim() : "";
    const answer = typeof c.answer === "string" ? c.answer.trim() : "";
    if (!question || !answer) continue;
    const card: RecallCard = { question, answer };
    if (typeof c.hint === "string" && c.hint.trim()) card.hint = c.hint.trim();
    if (req.style === "mcq" && Array.isArray(c.options)) {
      const options = c.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0).slice(0, 6);
      if (options.length >= 2) {
        card.options = options;
        const idx = typeof c.correctIndex === "number" ? c.correctIndex : options.findIndex((o) => o === answer);
        card.correctIndex = idx >= 0 && idx < options.length ? idx : 0;
      }
    }
    cards.push(card);
    if (cards.length >= req.count) break;
  }
  return cards;
}

/* ------------------------------------------------------------------ */
/* Deep research tasks                                                 */
/* ------------------------------------------------------------------ */

type RunRow = {
  run_id: string;
  status: string;
  objective: string;
  preset: string;
  processor: string;
  note_path: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  error: string | null;
  result: unknown;
  user_id: string;
};

function rowToRun(row: RunRow, includeResult = true): TaskRun {
  const preset = (row.preset in PRESET_META ? row.preset : "report") as TaskPreset;
  const processor = (["lite", "base", "core", "pro"].includes(row.processor) ? row.processor : "base") as Processor;
  return {
    runId: row.run_id,
    status: row.status as TaskStatus,
    objective: row.objective,
    preset,
    processor,
    notePath: row.note_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    error: row.error,
    result: includeResult && row.result ? (row.result as TaskResult) : null,
    estimate: PROCESSOR_ESTIMATES[processor],
  };
}

export function createDeepResearch(caller: Caller, req: TaskCreateRequest): Promise<TaskRun> {
  requireProvider("parallel");
  return timed<TaskRun>(caller, "task_create", "parallel", req.objective, async () => {
    const processor = req.processor ?? PRESET_META[req.preset].defaultProcessor;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("research_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", caller.userId)
      .in("status", ["queued", "running"]);
    if ((count ?? 0) >= 10) {
      throw new BridgeError("rate_limited", "You already have 10 deep-research runs in progress. Wait for one to finish.");
    }
    const created = await parallelCreateTask({ objective: req.objective, preset: req.preset, processor });
    const { data, error } = await supabaseAdmin
      .from("research_runs")
      .insert({
        user_id: caller.userId,
        key_id: caller.keyId,
        run_id: created.runId,
        objective: req.objective,
        processor,
        preset: req.preset,
        status: "queued",
        note_path: req.notePath ?? null,
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("[bridge] run insert failed", error);
      throw new BridgeError("internal", "Could not record the research run");
    }
    return { value: rowToRun(data as RunRow) };
  });
}

/** Refresh a run from Parallel if it is still in flight, then return it. */
export function pollDeepResearch(caller: Caller, runId: string): Promise<TaskRun> {
  return timed<TaskRun>(caller, "task_poll", "parallel", runId, async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("research_runs")
      .select("*")
      .eq("run_id", runId)
      .eq("user_id", caller.userId)
      .maybeSingle();
    if (error) throw new BridgeError("internal", "Run lookup failed");
    if (!row) throw new BridgeError("not_found", "No research run with that id belongs to this key");
    if (row.status === "completed" || row.status === "failed" || row.status === "cancelled") {
      return { value: rowToRun(row as RunRow), cached: true };
    }
    const polled = await parallelPollTask(runId);
    if (polled.state === "running") {
      let status: TaskStatus = "running";
      try {
        const live = await parallelTaskStatus(runId);
        if (live.status === "queued") status = "queued";
      } catch {
        /* status is best-effort */
      }
      if (status !== row.status) {
        await supabaseAdmin.from("research_runs").update({ status }).eq("run_id", runId);
      }
      return { value: rowToRun({ ...(row as RunRow), status }) };
    }
    if (polled.state === "failed") {
      const { data: updated } = await supabaseAdmin
        .from("research_runs")
        .update({ status: "failed", error: polled.error, completed_at: new Date().toISOString() })
        .eq("run_id", runId)
        .select("*")
        .single();
      return { value: rowToRun((updated ?? { ...row, status: "failed", error: polled.error }) as RunRow) };
    }
    const result: TaskResult = {
      markdown: renderTaskMarkdown(row.preset as TaskPreset, polled.type, polled.content, polled.basis),
      // Parallel output is parsed JSON, so it is always a plain JSON value.
      content: (polled.content ?? null) as JsonValue,
      basis: polled.basis,
      sources: dedupeSources(polled.basis.flatMap((b) => b.citations.map((c) => ({ url: c.url, title: c.title })))),
    };
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("research_runs")
      .update({ status: "completed", result: result as never, completed_at: new Date().toISOString() })
      .eq("run_id", runId)
      .select("*")
      .single();
    if (updateError) console.error("[bridge] run update failed", updateError);
    return { value: rowToRun((updated ?? { ...row, status: "completed", result }) as RunRow) };
  });
}

export async function listDeepResearch(caller: Caller, opts: { limit?: number; includeResult?: boolean } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("research_runs")
    .select("*")
    .eq("user_id", caller.userId)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (error) throw new BridgeError("internal", "Could not list research runs");
  return { runs: (data ?? []).map((r) => rowToRun(r as RunRow, opts.includeResult ?? false)) };
}

/* ------------------------------------------------------------------ */
/* Markdown rendering of task output                                   */
/* ------------------------------------------------------------------ */

function confidenceBadge(c: string | null): string {
  if (c === "high") return "🟢";
  if (c === "medium") return "🟡";
  if (c === "low") return "🔴";
  return "⚪";
}

interface CompareOption {
  name?: unknown;
  summary?: unknown;
  scores?: unknown;
  pros?: unknown;
  cons?: unknown;
}
interface TimelineEvent {
  date?: unknown;
  event?: unknown;
  significance?: unknown;
}
interface StructuredContent {
  title?: unknown;
  summary?: unknown;
  facts?: unknown;
  criteria?: unknown;
  options?: unknown;
  verdict?: unknown;
  events?: unknown;
}

export function renderTaskMarkdown(preset: TaskPreset, type: "text" | "json", content: unknown, basis: BasisEntry[]): string {
  const lines: string[] = [];
  if (type === "text" || typeof content === "string") {
    lines.push(String(content ?? "").trim());
  } else if (content && typeof content === "object") {
    const c = content as StructuredContent;
    if (typeof c.title === "string") lines.push(`## ${c.title}`);
    if (preset === "key_facts") {
      if (typeof c.summary === "string") lines.push("", c.summary);
      if (Array.isArray(c.facts)) {
        lines.push("");
        c.facts.forEach((f: unknown, i: number) => lines.push(`${i + 1}. ${String(f)}${basisMark(basis, `facts.${i}`)}`));
      }
    } else if (preset === "compare") {
      const criteria: string[] = Array.isArray(c.criteria) ? c.criteria.map((x: unknown) => String(x)) : [];
      const options = Array.isArray(c.options) ? (c.options as CompareOption[]) : [];
      if (criteria.length && options.length) {
        lines.push("", `| Criterion | ${options.map((o) => String(o.name ?? "")).join(" | ")} |`);
        lines.push(`|---|${options.map(() => "---").join("|")}|`);
        criteria.forEach((crit, i) => {
          lines.push(
            `| ${crit} | ${options.map((o) => (Array.isArray(o.scores) ? String(o.scores[i] ?? "") : "")).join(" | ")} |`,
          );
        });
      }
      for (const o of options) {
        lines.push("", `### ${String(o.name ?? "")}`, String(o.summary ?? ""));
        if (Array.isArray(o.pros) && o.pros.length) lines.push("", "**Pros**", ...o.pros.map((p: unknown) => `- ${String(p)}`));
        if (Array.isArray(o.cons) && o.cons.length) lines.push("", "**Cons**", ...o.cons.map((p: unknown) => `- ${String(p)}`));
      }
      if (typeof c.verdict === "string") lines.push("", "### Verdict", c.verdict);
    } else if (preset === "timeline") {
      const events = Array.isArray(c.events) ? (c.events as TimelineEvent[]) : [];
      lines.push("");
      events.forEach((e, i) =>
        lines.push(`- **${String(e.date ?? "")}** — ${String(e.event ?? "")}${e.significance ? ` _(${String(e.significance)})_` : ""}${basisMark(basis, `events.${i}`)}`),
      );
    } else {
      lines.push("", "```json", JSON.stringify(content, null, 2), "```");
    }
  }
  const sources = dedupeSources(basis.flatMap((b) => b.citations.map((ct) => ({ url: ct.url, title: ct.title }))));
  if (sources.length) {
    lines.push("", "### Sources");
    sources.slice(0, 40).forEach((s, i) => lines.push(`${i + 1}. [${s.title || hostnameOf(s.url)}](${s.url})`));
  }
  const graded = basis.filter((b) => b.confidence);
  if (graded.length) {
    const high = graded.filter((b) => b.confidence === "high").length;
    const medium = graded.filter((b) => b.confidence === "medium").length;
    const low = graded.filter((b) => b.confidence === "low").length;
    lines.push("", `> Confidence: 🟢 ${high} high · 🟡 ${medium} medium · 🔴 ${low} low (Parallel research basis)`);
  }
  return lines.join("\n").trim();
}

function basisMark(basis: BasisEntry[], field: string): string {
  const entry = basis.find((b) => b.field === field);
  if (!entry) return "";
  const first = entry.citations[0];
  const badge = confidenceBadge(entry.confidence);
  return first ? ` ${badge} [src](${first.url})` : ` ${badge}`;
}
