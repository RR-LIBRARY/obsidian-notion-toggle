/**
 * v1.7.0 — the one place the research client touches the network.
 *
 * Obsidian's `requestUrl` is preferred: it works on mobile, ignores CORS and
 * never throws on non-2xx when `throw: false`. When it is unavailable (unit
 * tests, very old builds) the standard `fetch` is used instead.
 */
import { requestUrl } from "obsidian";
import type { Transport } from "./client";

export function obsidianTransport(): Transport {
  return async (req) => {
    if (typeof requestUrl === "function") {
      const res = await requestUrl({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: req.body,
        contentType: req.body ? "application/json" : undefined,
        throw: false,
      });
      return { status: res.status, text: res.text ?? "" };
    }
    const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
    return { status: res.status, text: await res.text() };
  };
}
