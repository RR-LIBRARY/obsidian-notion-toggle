import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/perplexity — Perplexity Search API results. */
export const Route = createFileRoute("/api/public/research/perplexity")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { perplexityRequestSchema } = await import("@/lib/research/schemas");
        const { runPerplexity } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) =>
          runPerplexity(caller, await parseBody(request, perplexityRequestSchema)),
        )(ctx);
      },
    },
  },
});
