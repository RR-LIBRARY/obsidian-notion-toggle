import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/research/tasks — start a deep-research run (returns immediately).
 * GET  /api/public/research/tasks — list this key owner's recent runs (no result payloads).
 */
export const Route = createFileRoute("/api/public/research/tasks/")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { taskCreateRequestSchema } = await import("@/lib/research/schemas");
        const { createDeepResearch } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) =>
          createDeepResearch(caller, await parseBody(request, taskCreateRequestSchema)),
        )(ctx);
      },
      GET: async (ctx) => {
        const { bridgeHandler } = await import("@/lib/research/http.server");
        const { listDeepResearch } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) => {
          const url = new URL(request.url);
          const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
          return listDeepResearch(caller, { limit, includeResult: url.searchParams.get("include") === "result" });
        })(ctx);
      },
    },
  },
});
