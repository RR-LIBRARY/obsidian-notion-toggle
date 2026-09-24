import { createFileRoute } from "@tanstack/react-router";

/** GET /api/public/research/tasks/:runId — poll a deep-research run (returns at once). */
export const Route = createFileRoute("/api/public/research/tasks/$runId")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      GET: async (ctx) => {
        const { bridgeHandler } = await import("@/lib/research/http.server");
        const { pollDeepResearch } = await import("@/lib/research/core.server");
        const { BridgeError } = await import("@/lib/research/errors.server");
        return bridgeHandler(async ({ caller, params }) => {
          const runId = params["runId"]?.trim();
          if (!runId) throw new BridgeError("invalid_request", "Missing run id");
          return pollDeepResearch(caller, runId);
        })(ctx);
      },
    },
  },
});
