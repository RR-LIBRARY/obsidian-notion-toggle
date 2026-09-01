/**
 * v1.5.4 — the source is the truth. If the markdown says "14 red toggles", no
 * half-rendered DOM may talk the plugin into "no red toggles here".
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  isFullyRendered,
  scanSourceToggles,
  sourceKindCounts,
  sourceMatchCount,
} from "../src/source-toggles";

const NOTE = `# Zoology

> [!recall-red]- Q1
> answer
> [!recall-yellow]+ Q2
> answer
> [!recall-green]- Q3
> answer
> [!question]- Q4
> answer
> [!important] Keep
<details><summary>Legacy</summary>x</details>

\`\`\`md
> [!recall-red]- not a real toggle
\`\`\`
`;

describe("scanSourceToggles", () => {
  test("counts every callout + <details>, ignoring fenced examples", () => {
    const { kinds, total } = scanSourceToggles(NOTE);
    expect(total).toBe(6);
    expect(kinds).toEqual(["red", "yellow", "green", "question", "important", "other"]);
  });

  test("empty / missing source is zero, never a crash", () => {
    expect(scanSourceToggles("").total).toBe(0);
    expect(scanSourceToggles(null).total).toBe(0);
    expect(scanSourceToggles(undefined).total).toBe(0);
  });

  test("nested blockquote toggles still count", () => {
    expect(scanSourceToggles("> > [!recall-red]- deep").total).toBe(1);
  });
});

describe("sourceMatchCount", () => {
  test("no filter means every toggle", () => {
    expect(sourceMatchCount(NOTE)).toBe(6);
    expect(sourceMatchCount(NOTE, [])).toBe(6);
  });

  test("per-colour counts match the note", () => {
    expect(sourceMatchCount(NOTE, ["red"])).toBe(1);
    expect(sourceMatchCount(NOTE, ["red", "yellow"])).toBe(2);
    expect(sourceMatchCount(NOTE, ["question"])).toBe(1);
    expect(sourceMatchCount(NOTE, ["important"])).toBe(1);
  });

  test("`other` catches the ungraded kinds", () => {
    expect(sourceMatchCount(NOTE, ["other"])).toBe(3);
  });

  test("kind breakdown", () => {
    expect(sourceKindCounts(NOTE)).toEqual({
      red: 1,
      yellow: 1,
      green: 1,
      question: 1,
      important: 1,
      other: 1,
    });
  });
});

describe("isFullyRendered", () => {
  test("the DOM must have caught up with the source", () => {
    expect(isFullyRendered(3, 73)).toBe(false);
    expect(isFullyRendered(73, 73)).toBe(true);
    expect(isFullyRendered(74, 73)).toBe(true);
  });

  test("a note without toggles is trivially rendered", () => {
    expect(isFullyRendered(0, 0)).toBe(true);
  });
});

describe("the real note (zoology-recall.md)", () => {
  const src = readFileSync("tests/fixtures/zoology-recall.md", "utf8");

  test("source counts match the note's own legend", () => {
    const counts = sourceKindCounts(src);
    expect(counts.red).toBe(14);
    expect(counts.yellow).toBe(37);
    expect(counts.green).toBe(20);
  });

  test("a red-only run has work to do even before rendering finishes", () => {
    expect(sourceMatchCount(src, ["red"])).toBe(14);
    expect(isFullyRendered(4, scanSourceToggles(src).total)).toBe(false);
  });
});
