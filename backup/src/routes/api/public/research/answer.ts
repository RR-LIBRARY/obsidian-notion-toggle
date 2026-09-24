import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/answer — cited answer (multi-turn via previousResponseId). */
export const Route = createFileRoute("/api/public/research/answer")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { answerRequestSchema } = await import("@/lib/research/schemas");
        const { runAnswer } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) => runAnswer(caller, await parseBody(request, answerRequestSchema)))(
          ctx,
        );
      },
    },
  },
});
