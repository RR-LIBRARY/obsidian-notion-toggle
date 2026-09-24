import { z } from "zod";

/**
 * Wire contract shared by the bridge API (/api/public/research/*), the
 * dashboard playground, and the Obsidian plugin's research client.
 * Keep this file browser-safe: no secrets, no server imports.
 */

export const BRIDGE_VERSION = "1.0.0";

export const searchModeSchema = z.enum(["turbo", "fast", "basic", "advanced"]);
export type SearchMode = z.infer<typeof searchModeSchema>;

const domainList = z.array(z.string().trim().min(1).max(120)).max(20);

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1).max(300),
  objective: z.string().trim().max(600).optional(),
  mode: searchModeSchema.default("fast"),
  maxResults: z.number().int().min(1).max(20).default(8),
  maxChars: z.number().int().min(200).max(6000).default(1500),
  includeDomains: domainList.optional(),
  afterDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "afterDate must be YYYY-MM-DD")
    .optional(),
});
export type SearchRequest = z.infer<typeof searchRequestSchema>;

export const searchResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  publishDate: z.string().nullable(),
  excerpts: z.array(z.string()),
});
export type SearchResult = z.infer<typeof searchResultSchema>;

export const searchResponseSchema = z.object({
  provider: z.literal("parallel"),
  query: z.string(),
  results: z.array(searchResultSchema),
  warnings: z.array(z.string()).optional(),
  cached: z.boolean(),
  latencyMs: z.number(),
});
export type SearchResponse = z.infer<typeof searchResponseSchema>;

export const perplexityRequestSchema = z.object({
  query: z.union([z.string().trim().min(1).max(300), z.array(z.string().trim().min(1).max(300)).min(1).max(5)]),
  maxResults: z.number().int().min(1).max(20).default(8),
  recency: z.enum(["day", "week", "month", "year"]).optional(),
  includeDomains: domainList.optional(),
});
export type PerplexityRequest = z.infer<typeof perplexityRequestSchema>;

export const perplexityResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
  date: z.string().nullable(),
});
export type PerplexityResult = z.infer<typeof perplexityResultSchema>;

export const perplexityResponseSchema = z.object({
  provider: z.literal("perplexity"),
  query: z.string(),
  results: z.array(perplexityResultSchema),
  cached: z.boolean(),
  latencyMs: z.number(),
});
export type PerplexityResponse = z.infer<typeof perplexityResponseSchema>;

export const extractRequestSchema = z.object({
  urls: z.array(z.string().trim().url()).min(1).max(20),
  objective: z.string().trim().max(600).optional(),
  fullContent: z.boolean().default(false),
  maxChars: z.number().int().min(500).max(40000).default(6000),
});
export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const extractResultSchema = z.object({
  url: z.string(),
  title: z.string(),
  publishDate: z.string().nullable(),
  excerpts: z.array(z.string()),
  fullContent: z.string().nullable(),
});
export type ExtractResult = z.infer<typeof extractResultSchema>;

export const extractResponseSchema = z.object({
  provider: z.literal("parallel"),
  results: z.array(extractResultSchema),
  errors: z.array(z.object({ url: z.string(), errorType: z.string(), httpStatus: z.number().nullable() })),
  latencyMs: z.number(),
});
export type ExtractResponse = z.infer<typeof extractResponseSchema>;

export const effortSchema = z.enum(["low", "medium", "high"]);
export type Effort = z.infer<typeof effortSchema>;

export const answerRequestSchema = z.object({
  question: z.string().trim().min(1).max(4000),
  effort: effortSchema.default("low"),
  previousResponseId: z.string().trim().min(1).max(200).optional(),
  includeDomains: domainList.optional(),
  /** Extra guidance prepended to the question (tone, language, length). */
  instructions: z.string().trim().max(1000).optional(),
});
export type AnswerRequest = z.infer<typeof answerRequestSchema>;

export const citationSchema = z.object({
  url: z.string(),
  title: z.string(),
  startIndex: z.number().nullable(),
  endIndex: z.number().nullable(),
});
export type Citation = z.infer<typeof citationSchema>;

export const sourceSchema = z.object({ url: z.string(), title: z.string() });
export type Source = z.infer<typeof sourceSchema>;

export const answerResponseSchema = z.object({
  provider: z.literal("parallel"),
  responseId: z.string(),
  question: z.string(),
  answer: z.string(),
  citations: z.array(citationSchema),
  sources: z.array(sourceSchema),
  searches: z.array(z.string()),
  latencyMs: z.number(),
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

export const recallStyleSchema = z.enum(["qa", "mcq", "cloze"]);
export type RecallStyle = z.infer<typeof recallStyleSchema>;

export const recallRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(60000).optional(),
    url: z.string().trim().url().optional(),
    topic: z.string().trim().min(1).max(400).optional(),
    count: z.number().int().min(3).max(20).default(8),
    style: recallStyleSchema.default("qa"),
    language: z.string().trim().max(40).optional(),
    difficulty: z.enum(["mixed", "easy", "hard"]).default("mixed"),
  })
  .refine((v) => Boolean(v.text || v.url || v.topic), {
    message: "Provide text, url, or topic",
  });
export type RecallRequest = z.infer<typeof recallRequestSchema>;

export const recallCardSchema = z.object({
  question: z.string(),
  answer: z.string(),
  options: z.array(z.string()).optional(),
  correctIndex: z.number().int().optional(),
  hint: z.string().optional(),
});
export type RecallCard = z.infer<typeof recallCardSchema>;

export const recallResponseSchema = z.object({
  title: z.string(),
  style: recallStyleSchema,
  cards: z.array(recallCardSchema),
  sources: z.array(sourceSchema),
  latencyMs: z.number(),
});
export type RecallResponse = z.infer<typeof recallResponseSchema>;

export const factCheckRequestSchema = z.object({
  claim: z.string().trim().min(1).max(4000),
  context: z.string().trim().max(4000).optional(),
  effort: effortSchema.default("low"),
});
export type FactCheckRequest = z.infer<typeof factCheckRequestSchema>;

export const verdictSchema = z.enum(["supported", "partially_supported", "contradicted", "unverifiable"]);
export type Verdict = z.infer<typeof verdictSchema>;

export const factCheckResponseSchema = z.object({
  provider: z.literal("parallel"),
  responseId: z.string(),
  claim: z.string(),
  verdict: verdictSchema,
  confidence: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  correction: z.string().nullable(),
  sources: z.array(z.object({ url: z.string(), title: z.string(), quote: z.string().nullable() })),
  latencyMs: z.number(),
});
export type FactCheckResponse = z.infer<typeof factCheckResponseSchema>;

export const taskPresetSchema = z.enum(["report", "key_facts", "compare", "timeline", "literature"]);
export type TaskPreset = z.infer<typeof taskPresetSchema>;

export const processorSchema = z.enum(["lite", "base", "core", "pro"]);
export type Processor = z.infer<typeof processorSchema>;

export const taskCreateRequestSchema = z.object({
  objective: z.string().trim().min(3).max(4000),
  preset: taskPresetSchema.default("report"),
  processor: processorSchema.optional(),
  notePath: z.string().trim().max(500).optional(),
});
export type TaskCreateRequest = z.infer<typeof taskCreateRequestSchema>;

export const taskStatusSchema = z.enum(["queued", "running", "completed", "failed", "cancelled"]);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const basisEntrySchema = z.object({
  field: z.string(),
  confidence: z.string().nullable(),
  reasoning: z.string().nullable(),
  citations: z.array(z.object({ url: z.string(), title: z.string().nullable(), excerpts: z.array(z.string()) })),
});
export type BasisEntry = z.infer<typeof basisEntrySchema>;

/** Plain JSON value — what Parallel task output content is made of. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

export const taskResultSchema = z.object({
  markdown: z.string(),
  content: jsonValueSchema,
  basis: z.array(basisEntrySchema),
  sources: z.array(sourceSchema),
});
export type TaskResult = z.infer<typeof taskResultSchema>;

export const taskRunSchema = z.object({
  runId: z.string(),
  status: taskStatusSchema,
  objective: z.string(),
  preset: taskPresetSchema,
  processor: processorSchema,
  notePath: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  error: z.string().nullable(),
  result: taskResultSchema.nullable(),
  estimate: z.string(),
});
export type TaskRun = z.infer<typeof taskRunSchema>;

export const taskListResponseSchema = z.object({ runs: z.array(taskRunSchema) });
export type TaskListResponse = z.infer<typeof taskListResponseSchema>;

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  providers: z.object({ parallel: z.boolean(), perplexity: z.boolean(), ai: z.boolean() }),
  key: z.object({ name: z.string(), prefix: z.string() }).nullable(),
  serverTime: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const bridgeErrorCodeSchema = z.enum([
  "unauthorized",
  "invalid_request",
  "provider_error",
  "rate_limited",
  "payment_required",
  "not_found",
  "internal",
]);
export type BridgeErrorCode = z.infer<typeof bridgeErrorCodeSchema>;

export const bridgeErrorSchema = z.object({
  error: z.object({
    code: bridgeErrorCodeSchema,
    message: z.string(),
    status: z.number(),
    retryAfterSec: z.number().optional(),
  }),
});
export type BridgeErrorBody = z.infer<typeof bridgeErrorSchema>;

export const PROCESSOR_ESTIMATES: Record<Processor, string> = {
  lite: "about 10–40 seconds",
  base: "about 15–100 seconds",
  core: "about 1–5 minutes",
  pro: "about 2–10 minutes",
};

export const PRESET_META: Record<TaskPreset, { label: string; description: string; defaultProcessor: Processor }> = {
  report: {
    label: "Research report",
    description: "A structured markdown report with inline citations.",
    defaultProcessor: "core",
  },
  key_facts: {
    label: "Key facts",
    description: "A compact list of verified facts with a source for each.",
    defaultProcessor: "base",
  },
  compare: {
    label: "Compare options",
    description: "Side-by-side comparison of the things named in the objective.",
    defaultProcessor: "core",
  },
  timeline: {
    label: "Timeline",
    description: "Dated events in order with sources.",
    defaultProcessor: "base",
  },
  literature: {
    label: "Literature summary",
    description: "Key papers, findings, methods and open questions.",
    defaultProcessor: "pro",
  },
};

export const REQUEST_KINDS = [
  "search",
  "perplexity",
  "extract",
  "answer",
  "recall",
  "factcheck",
  "task_create",
  "task_poll",
  "health",
] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];
