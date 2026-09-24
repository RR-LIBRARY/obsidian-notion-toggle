import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/factcheck — verdict + sources for a claim. */
export const Route = createFileRoute("/api/public/research/factcheck")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { factCheckRequestSchema } = await import("@/lib/research/schemas");
        const { runFactCheck } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) =>
          runFactCheck(caller, await parseBody(request, factCheckRequestSchema)),
        )(ctx);
      },
    },
  },
});
