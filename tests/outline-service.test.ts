import { describe, expect, test } from "bun:test";
import {
  DEFAULT_OUTLINE_SETTINGS,
  OutlineError,
  buildOutlineBody,
  describeOutlineError,
  normalizeServiceUrl,
  outlineEndpoint,
  outlineInput,
  parseOutlineResponse,
  requestOutline,
  testOutlineService,
  togglesToMarkdown,
  type OutlineFormatOptions,
  type OutlineTransportRequest,
} from "../src/outline-service";

const opts: OutlineFormatOptions = { format: "callout", calloutType: "question", collapsed: true, boldTitle: true, maxToggles: 12 };
const settings = { ...DEFAULT_OUTLINE_SETTINGS, outlineServiceUrl: "https://svc.lovable.app", outlineAccessKey: "key-123" };

describe("outline service client", () => {
  test("normalises whatever the reader pastes", () => {
    expect(normalizeServiceUrl("svc.lovable.app/")).toBe("https://svc.lovable.app");
    expect(normalizeServiceUrl(" https://svc.lovable.app/api/x ")).toBe("https://svc.lovable.app");
    expect(outlineEndpoint("svc.lovable.app")).toBe("https://svc.lovable.app/api/public/outline");
  });

  test("selection wins over the whole note", () => {
    expect(outlineInput("  picked  ", "whole note")).toEqual({ text: "picked", fromSelection: true });
    expect(outlineInput("   ", " whole note ")).toEqual({ text: "whole note", fromSelection: false });
  });

  test("request body clamps the toggle count", () => {
    expect(JSON.parse(buildOutlineBody("t", { ...opts, maxToggles: 99 })).maxToggles).toBe(40);
    expect(JSON.parse(buildOutlineBody("t", { ...opts, maxToggles: 0 })).maxToggles).toBe(12);
  });

  test("renders same-level callout toggles", () => {
    const md = togglesToMarkdown([{ title: "A", body: "one\ntwo" }, { title: "B", body: "" }], opts);
    expect(md).toBe("> [!question]- **A**\n> one\n> two\n\n> [!question]- **B**");
    expect(md.includes(">>")).toBe(false);
  });

  test("renders details toggles", () => {
    const md = togglesToMarkdown([{ title: "A", body: "x" }], { ...opts, format: "details", collapsed: false });
    expect(md.startsWith("<details open>\n<summary><b>A</b></summary>")).toBe(true);
  });

  test("falls back to local markdown when the service sends none", () => {
    const out = parseOutlineResponse({ status: 200, text: JSON.stringify({ toggles: [{ title: "A", body: "" }] }) }, opts);
    expect(out.markdown).toBe("> [!question]- **A**");
  });

  test("surfaces the service error code", () => {
    try {
      parseOutlineResponse({ status: 429, text: JSON.stringify({ error: { code: "rate_limited", message: "slow down", retryAfterSec: 9 } }) }, opts);
      throw new Error("should throw");
    } catch (err) {
      expect(err).toBeInstanceOf(OutlineError);
      expect(describeOutlineError(err)).toContain("9s");
    }
  });

  test("empty answers do not write an empty block", () => {
    expect(() => parseOutlineResponse({ status: 200, text: JSON.stringify({ toggles: [] }) }, opts)).toThrow(OutlineError);
  });

  test("sends the access key and gets markdown back", async () => {
    const seen: OutlineTransportRequest[] = [];
    const out = await requestOutline(
      async (req) => {
        seen.push(req);
        return { status: 200, text: JSON.stringify({ toggles: [{ title: "A", body: "b" }], markdown: "> [!note]- **A**\n> b" }) };
      },
      settings,
      "long selected text",
      opts
    );
    expect(seen[0]!.headers["x-outline-key"]).toBe("key-123");
    expect(seen[0]!.url).toBe("https://svc.lovable.app/api/public/outline");
    expect(out.markdown).toContain("**A**");
  });

  test("refuses to call an unconfigured service", async () => {
    await expect(requestOutline(async () => ({ status: 200, text: "{}" }), DEFAULT_OUTLINE_SETTINGS, "x", opts)).rejects.toThrow(/settings/);
    await expect(requestOutline(async () => ({ status: 200, text: "{}" }), settings, "   ", opts)).rejects.toThrow(/Select some text/);
  });

  test("network failures read like advice, not a stack trace", async () => {
    const err = await requestOutline(async () => { throw new Error("offline"); }, settings, "x", opts).catch((e) => e);
    expect(describeOutlineError(err)).toContain("Could not reach");
  });

  test("health check reports the model and the missing key", async () => {
    const ok = await testOutlineService(async () => ({ status: 200, text: JSON.stringify({ ok: true, model: "m", configured: true, version: "1" }) }), settings);
    expect(ok).toContain("m");
    await expect(testOutlineService(async () => ({ status: 200, text: JSON.stringify({ ok: true, configured: false }) }), settings)).rejects.toThrow(/access key/);
  });
});
