import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/recall — turn text / a URL / a topic into recall cards. */
export const Route = createFileRoute("/api/public/research/recall")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { recallRequestSchema } = await import("@/lib/research/schemas");
        const { runRecall } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) => runRecall(caller, await parseBody(request, recallRequestSchema)))(
          ctx,
        );
      },
    },
  },
});
