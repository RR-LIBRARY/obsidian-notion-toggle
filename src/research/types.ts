/**
 * v1.7.0 — wire contract for the Toggle Research bridge.
 *
 * Mirrors `src/lib/research/schemas.ts` in the bridge web app. Hand-written
 * (no zod) so the plugin bundle stays dependency-free. Pure: no Obsidian.
 */

export type SearchMode = "turbo" | "fast" | "basic" | "advanced";
export type Effort = "low" | "medium" | "high";
export type RecallStyle = "qa" | "mcq" | "cloze";
export type Verdict = "supported" | "partially_supported" | "contradicted" | "unverifiable";
export type TaskPreset = "report" | "key_facts" | "compare" | "timeline" | "literature";
export type Processor = "lite" | "base" | "core" | "pro";
export type TaskStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface SearchRequest {
  query: string;
  objective?: string;
  mode?: SearchMode;
  maxResults?: number;
  maxChars?: number;
  includeDomains?: string[];
  afterDate?: string;
}
export interface SearchResult {
  url: string;
  title: string;
  publishDate: string | null;
  excerpts: string[];
}
export interface SearchResponse {
  provider: "parallel";
  query: string;
  results: SearchResult[];
  warnings?: string[];
  cached: boolean;
  latencyMs: number;
}

export interface PerplexityRequest {
  query: string | string[];
  maxResults?: number;
  recency?: "day" | "week" | "month" | "year";
  includeDomains?: string[];
}
export interface PerplexityResult {
  title: string;
  url: string;
  snippet: string;
  date: string | null;
}
export interface PerplexityResponse {
  provider: "perplexity";
  query: string;
  results: PerplexityResult[];
  cached: boolean;
  latencyMs: number;
}

export interface ExtractRequest {
  urls: string[];
  objective?: string;
  fullContent?: boolean;
  maxChars?: number;
}
export interface ExtractResult {
  url: string;
  title: string;
  publishDate: string | null;
  excerpts: string[];
  fullContent: string | null;
}
export interface ExtractResponse {
  provider: "parallel";
  results: ExtractResult[];
  errors: Array<{ url: string; errorType: string; httpStatus: number | null }>;
  latencyMs: number;
}

export interface AnswerRequest {
  question: string;
  effort?: Effort;
  previousResponseId?: string;
  includeDomains?: string[];
  instructions?: string;
}
export interface Citation {
  url: string;
  title: string;
  startIndex: number | null;
  endIndex: number | null;
}
export interface Source {
  url: string;
  title: string;
}
export interface AnswerResponse {
  provider: "parallel";
  responseId: string;
  question: string;
  answer: string;
  citations: Citation[];
  sources: Source[];
  searches: string[];
  latencyMs: number;
}

export interface RecallRequest {
  text?: string;
  url?: string;
  topic?: string;
  count?: number;
  style?: RecallStyle;
  language?: string;
  difficulty?: "mixed" | "easy" | "hard";
}
export interface RecallCard {
  question: string;
  answer: string;
  options?: string[];
  correctIndex?: number;
  hint?: string;
}
export interface RecallResponse {
  title: string;
  style: RecallStyle;
  cards: RecallCard[];
  sources: Source[];
  latencyMs: number;
}

export interface FactCheckRequest {
  claim: string;
  context?: string;
  effort?: Effort;
}
export interface FactCheckResponse {
  provider: "parallel";
  responseId: string;
  claim: string;
  verdict: Verdict;
  confidence: "low" | "medium" | "high";
  summary: string;
  correction: string | null;
  sources: Array<{ url: string; title: string; quote: string | null }>;
  latencyMs: number;
}

export interface TaskCreateRequest {
  objective: string;
  preset?: TaskPreset;
  processor?: Processor;
  notePath?: string;
}
export interface BasisEntry {
  field: string;
  confidence: string | null;
  reasoning: string | null;
  citations: Array<{ url: string; title: string | null; excerpts: string[] }>;
}
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface TaskResult {
  markdown: string;
  content: JsonValue;
  basis: BasisEntry[];
  sources: Source[];
}
export interface TaskRun {
  runId: string;
  status: TaskStatus;
  objective: string;
  preset: TaskPreset;
  processor: Processor;
  notePath: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  error: string | null;
  result: TaskResult | null;
  estimate: string;
}
export interface TaskListResponse {
  runs: TaskRun[];
}

export interface HealthResponse {
  ok: true;
  version: string;
  providers: { parallel: boolean; perplexity: boolean; ai: boolean };
  key: { name: string; prefix: string } | null;
  serverTime: string;
}

export type BridgeErrorCode =
  | "unauthorized"
  | "invalid_request"
  | "provider_error"
  | "rate_limited"
  | "payment_required"
  | "not_found"
  | "internal";

export interface BridgeErrorBody {
  error: { code: BridgeErrorCode; message: string; status: number; retryAfterSec?: number };
}

/* ---------- Plugin settings for the research feature ---------- */

export type InsertStyle = "toggle" | "markdown";

/** Where a research result goes when the reader presses Insert. */
export type InsertTarget = "cursor" | "end";

export interface ResearchSettings {
  /** Origin of the bridge web app, e.g. https://research.example.com */
  researchBridgeUrl: string;
  /** Plugin key created in the dashboard (`ntr_…`). Stored in data.json. */
  researchPluginKey: string;
  researchSearchMode: SearchMode;
  researchEffort: Effort;
  researchRecallCount: number;
  researchRecallStyle: RecallStyle;
  researchInsertStyle: InsertStyle;
  researchInsertTarget: InsertTarget;
  /** Append a "Sources" list under every inserted answer / fact-check. */
  researchIncludeSources: boolean;
  /** Cache identical searches for 15 minutes on the device. */
  researchCache: boolean;
  /** Default preset for background deep research. */
  researchDefaultPreset: TaskPreset;
  /** Background runs the plugin is tracking (bounded, newest last). */
  researchRuns: TrackedRun[];
  /** Answer language hint sent with recall / answer requests ("" = auto). */
  researchLanguage: string;
}

export interface TrackedRun {
  runId: string;
  objective: string;
  preset: TaskPreset;
  processor: Processor;
  notePath: string | null;
  status: TaskStatus;
  createdAt: string;
  /** Set once the run finished; the markdown is what gets inserted. */
  markdown: string | null;
  error: string | null;
  /** True once the reader inserted (or dismissed) the finished result. */
  consumed: boolean;
}

export const DEFAULT_RESEARCH_SETTINGS: ResearchSettings = {
  researchBridgeUrl: "",
  researchPluginKey: "",
  researchSearchMode: "fast",
  researchEffort: "low",
  researchRecallCount: 8,
  researchRecallStyle: "qa",
  researchInsertStyle: "toggle",
  researchInsertTarget: "cursor",
  researchIncludeSources: true,
  researchCache: true,
  researchDefaultPreset: "report",
  researchRuns: [],
  researchLanguage: "",
};

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  turbo: "Turbo — fastest",
  fast: "Fast — under a second (default)",
  basic: "Basic — richer excerpts",
  advanced: "Advanced — deepest, ~3 s",
};

export const EFFORT_LABELS: Record<Effort, string> = {
  low: "Low — quick lookup",
  medium: "Medium — balanced",
  high: "High — deep, slower",
};

export const RECALL_STYLE_LABELS: Record<RecallStyle, string> = {
  qa: "Question → answer",
  mcq: "Multiple choice",
  cloze: "Fill in the blank",
};

export const PRESET_LABELS: Record<TaskPreset, string> = {
  report: "Research report",
  key_facts: "Key facts",
  compare: "Compare options",
  timeline: "Timeline",
  literature: "Literature summary",
};

export const PRESET_DEFAULT_PROCESSOR: Record<TaskPreset, Processor> = {
  report: "core",
  key_facts: "base",
  compare: "core",
  timeline: "base",
  literature: "pro",
};

export const PROCESSOR_LABELS: Record<Processor, string> = {
  lite: "Lite — ~10–40 s",
  base: "Base — ~15–100 s",
  core: "Core — ~1–5 min",
  pro: "Pro — ~2–10 min",
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  supported: "Supported",
  partially_supported: "Partially supported",
  contradicted: "Contradicted",
  unverifiable: "Unverifiable",
};

/** Callout type used for each verdict so the colour tells the story at a glance. */
export const VERDICT_CALLOUT: Record<Verdict, string> = {
  supported: "success",
  partially_supported: "warning",
  contradicted: "danger",
  unverifiable: "question",
};
