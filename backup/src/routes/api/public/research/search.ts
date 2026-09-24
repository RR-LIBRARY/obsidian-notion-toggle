import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/search — Parallel web search with LLM-ready excerpts. */
export const Route = createFileRoute("/api/public/research/search")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { searchRequestSchema } = await import("@/lib/research/schemas");
        const { runSearch } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) => runSearch(caller, await parseBody(request, searchRequestSchema)))(ctx);
      },
    },
  },
});
