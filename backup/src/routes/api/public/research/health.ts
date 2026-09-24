import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/public/research/health
 * Works without a key (reports provider availability). With a valid plugin key
 * it also echoes the key name so the plugin can confirm the pairing.
 */
export const Route = createFileRoute("/api/public/research/health")({
  server: {
    handlers: {
      OPTIONS: async () => {
        const { preflight } = await import("@/lib/research/http.server");
        return preflight();
      },
      GET: async ({ request }) => {
        const { json, errorResponse } = await import("@/lib/research/http.server");
        const { readBearer, resolveCaller } = await import("@/lib/research/auth.server");
        const { health } = await import("@/lib/research/core.server");
        try {
          const caller = readBearer(request) ? await resolveCaller(request) : null;
          return json(health(caller));
        } catch (err) {
          return errorResponse(err);
        }
      },
    },
  },
});
