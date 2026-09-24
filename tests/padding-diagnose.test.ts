import { describe, expect, it } from "bun:test";
import { analyzeTopGap, declaresTopGap, formatGapReport, px, topGapDeclarations, type GapInput } from "../src/padding-diagnose";

const base = (over: Partial<GapInput> = {}): GapInput => ({
  chain: [
    { label: "div.markdown-preview-view", paddingTop: 0, marginTop: 0, borderTop: 0 },
    { label: "div.view-content", paddingTop: 0, marginTop: 0, borderTop: 0 },
    { label: "body.is-mobile", paddingTop: 32, marginTop: 0, borderTop: 0 },
  ],
  safeAreaTop: 32, contentTop: 32, isMobile: true, focusRun: true, theme: "", snippets: [],
  ...over,
});

describe("v1.7.4 — top padding diagnostic", () => {
  it("parses px", () => {
    expect(px("24px")).toBe(24); expect(px("0")).toBe(0); expect(px("")).toBe(0); expect(px("2em")).toBe(0);
  });
  it("detects top-gap declarations only", () => {
    expect(declaresTopGap("padding-top: 4px")).toBe(true);
    expect(declaresTopGap("color: red; padding: 0 1px")).toBe(true);
    expect(declaresTopGap("padding-bottom: 4px")).toBe(false);
    expect(topGapDeclarations("color:red; margin-top: 2px; padding-left:1px")).toEqual(["margin-top: 2px"]);
  });
  it("Obsidian's own inset alone is OK", () => {
    const r = analyzeTopGap(base());
    expect(r.verdict).toBe("ok");
    expect(r.findings[0].owner).toBe("obsidian");
    expect(formatGapReport(base(), r)).toContain("Result: OK");
  });
  it("snippet padding is flagged and the snippet is named", () => {
    const input = base({ snippets: ["my-tweaks"], chain: [
      { label: "div.view-content", paddingTop: 24, marginTop: 0, borderTop: 0,
        rules: [{ selector: ".is-mobile .view-content", declaration: "padding-top: 24px", source: "snippet" }] },
      { label: "body.is-mobile", paddingTop: 32, marginTop: 0, borderTop: 0 },
    ] });
    const r = analyzeTopGap(input);
    expect(r.verdict).toBe("extra-gap");
    expect(r.extraPx).toBe(24);
    expect(r.suspects).toContain("Snippet: my-tweaks.css");
    const md = formatGapReport(input, r);
    expect(md).toContain("24px extra top gap");
    expect(md).toContain("[snippet] `.is-mobile .view-content`");
  });
  it("theme with unexplained margin is suspected", () => {
    const input = base({ theme: "Minimal", chain: [{ label: "div.workspace", paddingTop: 0, marginTop: 10, borderTop: 0 }] });
    const r = analyzeTopGap(input);
    expect(r.findings[0].owner).toBe("theme-or-snippet");
    expect(r.suspects).toEqual(["Theme: Minimal"]);
  });
  it("a leftover plugin rule is reported as a plugin bug", () => {
    const input = base({ chain: [{ label: "div.view-content", paddingTop: 32, marginTop: 0, borderTop: 0,
      rules: [{ selector: "body.ntt-focus-run .view-content", declaration: "padding-top: 32px", source: "plugin" }] }] });
    expect(analyzeTopGap(input).findings[0].owner).toBe("plugin");
  });
  it("body padding that does not match the inset is not blamed on Obsidian", () => {
    const input = base({ chain: [{ label: "body.is-mobile", paddingTop: 60, marginTop: 0, borderTop: 0 }] });
    expect(analyzeTopGap(input).verdict).toBe("extra-gap");
  });
});
