import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  answerRequestSchema,
  extractRequestSchema,
  factCheckRequestSchema,
  perplexityRequestSchema,
  recallRequestSchema,
  searchRequestSchema,
  taskCreateRequestSchema,
  type AnswerResponse,
  type ExtractResponse,
  type FactCheckResponse,
  type PerplexityResponse,
  type RecallResponse,
  type SearchResponse,
  type TaskListResponse,
  type TaskRun,
} from "@/lib/research/schemas";

/**
 * Dashboard playground: the same research operations the plugin uses, but
 * authenticated with the signed-in web session instead of a plugin key.
 */

async function core() {
  const [coreMod, authMod] = await Promise.all([
    import("@/lib/research/core.server"),
    import("@/lib/research/auth.server"),
  ]);
  return { ...coreMod, dashboardCaller: authMod.dashboardCaller };
}

function rethrow(err: unknown): never {
  if (err && typeof err === "object" && "message" in err) throw new Error(String((err as { message: unknown }).message));
  throw err;
}

export const playgroundSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => searchRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<SearchResponse> => {
    const c = await core();
    return c.runSearch(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundPerplexity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => perplexityRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<PerplexityResponse> => {
    const c = await core();
    return c.runPerplexity(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundExtract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => extractRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<ExtractResponse> => {
    const c = await core();
    return c.runExtract(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => answerRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<AnswerResponse> => {
    const c = await core();
    return c.runAnswer(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundFactCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => factCheckRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<FactCheckResponse> => {
    const c = await core();
    return c.runFactCheck(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundRecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => recallRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<RecallResponse> => {
    const c = await core();
    return c.runRecall(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundCreateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => taskCreateRequestSchema.parse(data))
  .handler(async ({ data, context }): Promise<TaskRun> => {
    const c = await core();
    return c.createDeepResearch(c.dashboardCaller(context.userId), data).catch(rethrow);
  });

export const playgroundPollTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ runId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }): Promise<TaskRun> => {
    const c = await core();
    return c.pollDeepResearch(c.dashboardCaller(context.userId), data.runId).catch(rethrow);
  });

export const listResearchRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaskListResponse> => {
    const c = await core();
    return c.listDeepResearch(c.dashboardCaller(context.userId), { limit: 20, includeResult: true }).catch(rethrow);
  });
