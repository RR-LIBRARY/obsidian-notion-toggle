/**
 * v1.7.0 — research formatters: what the bridge answers become in the note.
 */
import { describe, expect, test } from "bun:test";
import {
  applyCitations,
  formatAnswer,
  formatExtract,
  formatFactCheck,
  formatPerplexity,
  formatRecall,
  formatRun,
  formatSearch,
  summarize,
  toggleBlock,
  type FormatOptions,
} from "../src/research/format";
import { answerResponse, factCheckResponse, recallResponse, searchResponse } from "./research-fixtures";

const style = { calloutType: "question", collapsed: true, boldSummary: true, format: "callout" as const };
const toggle: FormatOptions = { style, insertStyle: "toggle", includeSources: true };
const plain: FormatOptions = { style, insertStyle: "markdown", includeSources: true };

describe("citations", () => {
  test("numbers citations in reading order and lists sources once", () => {
    const { text, sources } = applyCitations(answerResponse.answer, answerResponse.citations);
    expect(text).toContain("short wavelengths.[1]");
    expect(text).toContain("scatters most.[2]");
    expect(sources.map((s) => s.url)).toEqual(["https://a.example/sky", "https://b.example/light"]);
  });

  test("citations without offsets still join the source list", () => {
    const { text, sources } = applyCitations("Plain answer.", [{ url: "https://x.example", title: "X", startIndex: null, endIndex: null }]);
    expect(text).toBe("Plain answer.");
    expect(sources).toHaveLength(1);
  });

  test("out-of-range offsets never corrupt the text", () => {
    const { text } = applyCitations("abc", [{ url: "https://x.example", title: "X", startIndex: 0, endIndex: 99 }]);
    expect(text).toBe("abc");
  });
});

describe("answer", () => {
  test("toggle form: question as title, numbered sources in the body", () => {
    const md = formatAnswer(answerResponse, toggle);
    expect(md.startsWith("> [!question]- **Why is the sky blue?**")).toBe(true);
    expect(md).toContain("> **Sources**");
    expect(md).toContain("[Sky colour](https://a.example/sky)");
    expect(md.endsWith("\n")).toBe(true);
  });

  test("markdown form has no callout prefix and can omit sources", () => {
    const md = formatAnswer(answerResponse, { ...plain, includeSources: false });
    expect(md).not.toContain("> [!");
    expect(md).not.toContain("Sources");
    expect(md).toContain("[1]");
  });

  test("details format wraps the body in a summary element", () => {
    const md = formatAnswer(answerResponse, { ...toggle, style: { ...style, format: "details" } });
    expect(md).toMatch(/^<details>\n<summary><b>Why is the sky blue\?<\/b><\/summary>/);
    expect(md.trimEnd().endsWith("</details>")).toBe(true);
  });
});

describe("fact-check", () => {
  test("verdict picks the callout colour and carries the correction", () => {
    const md = formatFactCheck(factCheckResponse, toggle);
    expect(md.startsWith("> [!danger]- **Fact-check: The Great Wall is visible from space**")).toBe(true);
    expect(md).toContain("**Verdict:** Contradicted (high confidence)");
    expect(md).toContain("**Correction:** It is not visible without aid.");
    expect(md).toContain("> not visible");
  });

  test("supported → success callout; unverifiable → question", () => {
    expect(formatFactCheck({ ...factCheckResponse, verdict: "supported" }, toggle)).toContain("[!success]");
    expect(formatFactCheck({ ...factCheckResponse, verdict: "unverifiable" }, toggle)).toContain("[!question]");
  });

  test("markdown form leads with the claim", () => {
    expect(formatFactCheck(factCheckResponse, plain).startsWith("**Claim:** The Great Wall")).toBe(true);
  });
});

describe("search", () => {
  test("toggle form makes one toggle per source with the link last", () => {
    const md = formatSearch(searchResponse, toggle);
    const toggles = md.split("\n").filter((l) => l.startsWith("> [!question]-"));
    expect(toggles).toHaveLength(2);
    expect(md).toContain("> Source: [Mitochondria](https://bio.example/mito) · 2024-03-01");
  });

  test("markdown form is a bullet list; empty results say so", () => {
    expect(formatSearch(searchResponse, plain)).toMatch(/^- \[Mitochondria\]/);
    expect(formatSearch({ ...searchResponse, results: [] }, plain)).toBe('_No results for "mitochondria"._\n');
  });

  test("quick search wraps the link list in a single toggle", () => {
    const md = formatPerplexity(
      { provider: "perplexity", query: "cells", results: [{ title: "A", url: "https://a.example", snippet: "s", date: null }], cached: true, latencyMs: 5 },
      toggle
    );
    expect(md).toContain("**Quick search: cells**");
    expect(md).toContain("> - [A](https://a.example) — s");
  });
});

describe("extract", () => {
  test("lists unreadable links after the readable ones", () => {
    const md = formatExtract(
      {
        provider: "parallel",
        results: [{ url: "https://ok.example", title: "OK", publishDate: null, excerpts: ["Para one."], fullContent: null }],
        errors: [{ url: "https://bad.example", errorType: "fetch_failed", httpStatus: 503 }],
        latencyMs: 1,
      },
      plain
    );
    expect(md).toContain("### OK");
    expect(md).toContain("- Could not read https://bad.example (fetch_failed 503)");
  });
});

describe("recall", () => {
  test("MCQ cards become checkbox toggles with an answer line and hint", () => {
    const md = formatRecall(recallResponse, { ...toggle, numbered: true, startNumber: 3 });
    expect(md).toContain("> [!question]- **3. Where does the Krebs cycle happen?**");
    expect(md).toContain("> - [ ] B. Mitochondrial matrix");
    expect(md).toContain("> **Answer:** B. Mitochondrial matrix");
    expect(md).toContain("> [!question]- **4. How many CO2 per turn?**");
    expect(md).toContain("_Hint: Count the decarboxylations_");
  });

  test("Q&A cards put the answer in the body, unnumbered by default", () => {
    const md = formatRecall({ ...recallResponse, style: "qa", cards: [{ question: "Q?", answer: "A." }] }, toggle);
    expect(md).toBe("> [!question]- **Q?**\n> A.\n");
  });

  test("appends sources when the bridge used the web", () => {
    const md = formatRecall({ ...recallResponse, sources: [{ url: "https://s.example", title: "S" }] }, toggle);
    expect(md).toContain("**Sources**");
    expect(md).toContain("[S](https://s.example)");
  });
});

describe("deep research report", () => {
  test("demotes headings so they nest under the toggle", () => {
    const md = formatRun({ objective: "Silk Road", preset: "report", markdown: "# Overview\n\nText.\n\n## Trade" }, toggle);
    expect(md).toContain("> ## Overview");
    expect(md).toContain("> ### Trade");
    expect(md.startsWith("> [!question]- **Silk Road**")).toBe(true);
  });

  test("empty report is labelled instead of inserting nothing", () => {
    expect(formatRun({ objective: "x", preset: "report", markdown: "" }, plain)).toBe("_The report is empty._\n");
  });
});

describe("helpers", () => {
  test("toggleBlock keeps blank body lines as bare quote markers", () => {
    expect(toggleBlock("T", ["a", "", "b"], style)).toBe("> [!question]- **T**\n> a\n>\n> b\n");
  });

  test("summarize collapses whitespace and clips with an ellipsis", () => {
    expect(summarize("  a   b ")).toBe("a b");
    expect(summarize("x".repeat(100), 10)).toBe("xxxxxxxxx…");
  });
});
