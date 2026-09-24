import { createFileRoute } from "@tanstack/react-router";

/** POST /api/public/research/extract — clean markdown from public URLs and PDFs. */
export const Route = createFileRoute("/api/public/research/extract")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      POST: async (ctx) => {
        const { bridgeHandler, parseBody } = await import("@/lib/research/http.server");
        const { extractRequestSchema } = await import("@/lib/research/schemas");
        const { runExtract } = await import("@/lib/research/core.server");
        return bridgeHandler(async ({ request, caller }) => runExtract(caller, await parseBody(request, extractRequestSchema)))(
          ctx,
        );
      },
    },
  },
});
