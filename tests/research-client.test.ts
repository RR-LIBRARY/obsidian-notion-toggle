/**
 * v1.7.0 — bridge client, cache and input helpers (no network).
 */
import { describe, expect, test } from "bun:test";
import { ResearchCache, cacheKey, stableStringify } from "../src/research/cache";
import {
  PLUGIN_KEY_PATTERN,
  ResearchClient,
  ResearchError,
  bridgeConfigured,
  clipForRecall,
  codeForStatus,
  describeError,
  extractUrls,
  normalizeBridgeUrl,
  stripFrontmatter,
} from "../src/research/client";
import { answerResponse, scriptedTransport, searchResponse } from "./research-fixtures";

describe("bridge URL + key", () => {
  test("normalises whatever was pasted into an origin", () => {
    expect(normalizeBridgeUrl(" research.example.com/ ")).toBe("https://research.example.com");
    expect(normalizeBridgeUrl("https://x.lovable.app/dashboard?tab=keys")).toBe("https://x.lovable.app");
    expect(normalizeBridgeUrl("http://localhost:8080/")).toBe("http://localhost:8080");
    expect(normalizeBridgeUrl("")).toBe("");
  });

  test("configured only when both URL and key are present", () => {
    expect(bridgeConfigured({ researchBridgeUrl: "x.example", researchPluginKey: "ntr_abc" })).toBe(true);
    expect(bridgeConfigured({ researchBridgeUrl: "", researchPluginKey: "ntr_abc" })).toBe(false);
    expect(bridgeConfigured({ researchBridgeUrl: "x.example", researchPluginKey: "  " })).toBe(false);
  });

  test("plugin keys look like ntr_<16+ url-safe chars>", () => {
    expect(PLUGIN_KEY_PATTERN.test("ntr_0123456789abcdef")).toBe(true);
    expect(PLUGIN_KEY_PATTERN.test("ntr_short")).toBe(false);
    expect(PLUGIN_KEY_PATTERN.test("sk_0123456789abcdef")).toBe(false);
  });
});

describe("requests", () => {
  const make = (routes: Parameters<typeof scriptedTransport>[0], cache: ResearchCache | null = null) => {
    const transport = scriptedTransport(routes);
    const client = new ResearchClient({ bridgeUrl: "bridge.example.com", pluginKey: "ntr_k", transport, cache, clientVersion: "t/1" });
    return { client, transport };
  };

  test("sends bearer key, JSON body and client hint to the public research path", async () => {
    const { client, transport } = make({ "POST /answer": () => ({ status: 200, body: answerResponse }) });
    const res = await client.answer({ question: "q" });
    expect(res.responseId).toBe("resp_1");
    const req = transport.calls[0];
    expect(req.url).toBe("https://bridge.example.com/api/public/research/answer");
    expect(req.headers.Authorization).toBe("Bearer ntr_k");
    expect(req.headers["X-Client"]).toBe("t/1");
    expect(JSON.parse(req.body ?? "{}")).toEqual({ question: "q" });
  });

  test("maps bridge error bodies to ResearchError with the code and retry hint", async () => {
    const { client } = make({
      "POST /search": () => ({ status: 429, body: { error: { code: "rate_limited", message: "slow down", retryAfterSec: 12 } } }),
    });
    const err = await client.search({ query: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(ResearchError);
    expect(err.code).toBe("rate_limited");
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(12);
    expect(describeError(err)).toContain("12s");
  });

  test("falls back to a status-derived code when the body is not JSON", async () => {
    const transport = (async () => ({ status: 502, text: "<html>bad gateway</html>" })) as never;
    const client = new ResearchClient({ bridgeUrl: "b.example", pluginKey: "k", transport });
    const err = await client.health().catch((e) => e);
    expect(err.code).toBe("provider_error");
    expect(codeForStatus(401)).toBe("unauthorized");
    expect(codeForStatus(402)).toBe("payment_required");
    expect(codeForStatus(404)).toBe("not_found");
    expect(codeForStatus(500)).toBe("internal");
  });

  test("network failures become a 'network' error with a readable message", async () => {
    const transport = (async () => {
      throw new Error("ECONNREFUSED");
    }) as never;
    const client = new ResearchClient({ bridgeUrl: "b.example", pluginKey: "k", transport });
    const err = await client.health().catch((e) => e);
    expect(err.code).toBe("network");
    expect(describeError(err)).toContain("Could not reach");
  });

  test("an unconfigured client never touches the transport", async () => {
    const { client, transport } = make({});
    const bare = new ResearchClient({ bridgeUrl: "", pluginKey: "", transport: (client as never as { transport: never }).transport ?? (async () => ({ status: 200, text: "{}" })) });
    const err = await bare.health().catch((e) => e);
    expect(err.code).toBe("not_configured");
    expect(transport.calls).toHaveLength(0);
    expect(describeError(err)).toContain("not set up");
  });

  test("search / extract / quick search are served from the device cache the second time", async () => {
    let hits = 0;
    const { client, transport } = make(
      {
        "POST /search": () => {
          hits++;
          return { status: 200, body: searchResponse };
        },
      },
      new ResearchCache()
    );
    const first = await client.search({ query: "mitochondria", mode: "fast" });
    const second = await client.search({ mode: "fast", query: "mitochondria" });
    expect(hits).toBe(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(transport.calls).toHaveLength(1);
  });

  test("task list builds the query string from options", async () => {
    const { client, transport } = make({ "GET /tasks": () => ({ status: 200, body: { runs: [] } }) });
    await client.listTasks({ limit: 5, includeResult: true });
    expect(transport.calls[0].url).toContain("/tasks?limit=5&include=result");
  });
});

describe("cache", () => {
  test("keys are independent of property order and drop undefined", () => {
    expect(cacheKey("s", { a: 1, b: undefined, c: [1, { z: 1, y: 2 }] })).toBe(cacheKey("s", { c: [1, { y: 2, z: 1 }], a: 1 }));
    expect(stableStringify(null)).toBe("null");
  });

  test("entries expire after the TTL and the oldest is evicted at capacity", () => {
    let now = 0;
    const cache = new ResearchCache(100, 2, () => now);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // touch → b is now oldest
    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("a")).toBe(1);
    now = 101;
    expect(cache.get("a")).toBeUndefined();
  });
});

describe("input helpers", () => {
  test("extractUrls dedupes and trims trailing punctuation", () => {
    expect(extractUrls("see https://a.example/x, and (https://b.example). Also https://a.example/x!")).toEqual([
      "https://a.example/x",
      "https://b.example",
    ]);
    expect(extractUrls("no links")).toEqual([]);
  });

  test("clipForRecall drops frontmatter and cuts at a paragraph boundary", () => {
    const body = `${"para one ".repeat(20)}\n\n${"para two ".repeat(20)}`;
    const text = `---\ntitle: x\n---\n${body}`;
    expect(stripFrontmatter(text)).toBe(body);
    const clipped = clipForRecall(text, 250);
    expect(clipped.length).toBeLessThanOrEqual(250);
    expect(clipped.trimEnd().endsWith("para one")).toBe(true);
  });
});

/* ---------- v1.7.1 — timeouts: a stalled bridge must fail loudly, not spin ---------- */
import { DEFAULT_TIMEOUTS_MS, timeoutMessage } from "../src/research/client";

function fakeTimers() {
  let now = 0;
  const queue: { at: number; fn: () => void; id: number }[] = [];
  let seq = 0;
  const cleared = new Set<number>();
  return {
    setTimeout: (fn: () => void, ms: number) => {
      const id = ++seq;
      queue.push({ at: now + ms, fn, id });
      queue.sort((a, b) => a.at - b.at);
      return id;
    },
    clearTimeout: (h: unknown) => {
      cleared.add(h as number);
    },
    cleared,
    async advance(ms: number) {
      const until = now + ms;
      while (queue.length && queue[0].at <= until) {
        const next = queue.shift()!;
        now = next.at;
        if (!cleared.has(next.id)) next.fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = until;
    },
  };
}

describe("request timeouts (v1.7.1)", () => {
  test("defaults are generous for answers and short for lookups", () => {
    expect(DEFAULT_TIMEOUTS_MS.health).toBeLessThan(DEFAULT_TIMEOUTS_MS.search);
    expect(DEFAULT_TIMEOUTS_MS.search).toBeLessThan(DEFAULT_TIMEOUTS_MS.answer);
    expect(DEFAULT_TIMEOUTS_MS.recall).toBeGreaterThanOrEqual(DEFAULT_TIMEOUTS_MS.answer);
    const client = new ResearchClient({ bridgeUrl: "b.example", pluginKey: "k", transport: async () => ({ status: 200, text: "{}" }) });
    expect(client.timeoutFor("search")).toBe(DEFAULT_TIMEOUTS_MS.search);
  });

  test("a transport that never answers becomes a 'timeout' error with a readable message", async () => {
    const timers = fakeTimers();
    const client = new ResearchClient({
      bridgeUrl: "b.example",
      pluginKey: "k",
      transport: () => new Promise(() => {}), // hangs forever, like a stalled mobile socket
      timeoutsMs: { search: 300 },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    });
    const pending = client.search({ query: "sickle cell" }).catch((e) => e);
    await timers.advance(299);
    await timers.advance(1);
    const err = await pending;
    expect(err).toBeInstanceOf(ResearchError);
    expect(err.code).toBe("timeout");
    expect(err.status).toBe(0);
    expect(err.message).toBe(timeoutMessage("search", 300));
    expect(describeError(err)).toContain("Web search timed out after 0s");
  });

  test("a response that arrives in time cancels the timer and is returned as-is", async () => {
    const timers = fakeTimers();
    const client = new ResearchClient({
      bridgeUrl: "b.example",
      pluginKey: "k",
      transport: async () => ({ status: 200, text: JSON.stringify({ ok: true, version: "1", providers: { parallel: true, perplexity: true, ai: true } }) }),
      timeoutsMs: { health: 1000 },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    });
    const res = await client.health();
    expect(res.ok).toBe(true);
    expect(timers.cleared.size).toBe(1);
  });

  test("a transport error that arrives before the ceiling still surfaces as 'network' (not timeout)", async () => {
    const timers = fakeTimers();
    const client = new ResearchClient({
      bridgeUrl: "b.example",
      pluginKey: "k",
      transport: async () => { throw new Error("ECONNRESET"); },
      timeoutsMs: { health: 1000 },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    });
    const err = await client.health().catch((e) => e);
    expect(err.code).toBe("network");
    expect(err.message).toBe("ECONNRESET");
  });

  test("every operation names itself in the timeout copy", () => {
    for (const op of Object.keys(DEFAULT_TIMEOUTS_MS) as Array<keyof typeof DEFAULT_TIMEOUTS_MS>) {
      const msg = timeoutMessage(op, DEFAULT_TIMEOUTS_MS[op]);
      expect(msg).toContain("timed out after");
      expect(msg).toContain("try again");
    }
    expect(timeoutMessage("answer", 300_000)).toContain("300s");
    // minutes, not seconds, for anything a model writes
    expect(DEFAULT_TIMEOUTS_MS.answer).toBeGreaterThanOrEqual(300_000);
    expect(DEFAULT_TIMEOUTS_MS.recall).toBeGreaterThanOrEqual(300_000);
  });

  test("a zero / non-finite ceiling disables the timer for that op", async () => {
    const timers = fakeTimers();
    const client = new ResearchClient({
      bridgeUrl: "b.example",
      pluginKey: "k",
      transport: async () => ({ status: 200, text: "{}" }),
      timeoutsMs: { health: 0 },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
    });
    await client.health();
    expect(timers.cleared.size).toBe(0);
  });
});
