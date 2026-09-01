/**
 * v1.5.5 — the filter picker's counts must come from the note *source*.
 *
 * Bug: on a 71-toggle note the picker said "12 toggles · 🟢 6 · 🟡 5 · 🔴 1",
 * because the count was a scan of Obsidian's lazily rendered DOM. Only the
 * screenful around the reader exists in the DOM, so most filters looked empty.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { countKinds } from "../src/callout-stats";
import { scanSourceToggles, sourceKindCounts } from "../src/source-toggles";

const note = readFileSync("tests/fixtures/zoology-recall.md", "utf8");

describe("breakdown from note source", () => {
  test("the real note counts every graded toggle, not just the rendered ones", () => {
    const counts = sourceKindCounts(note);
    expect(counts["red"]).toBe(14);
    expect(counts["yellow"]).toBe(37);
    expect(counts["green"]).toBe(20);
  });

  test("countKinds over source kinds reports the same totals as the note legend", () => {
    const rows = countKinds(scanSourceToggles(note).kinds);
    const of = (kind: string) => rows.find((r) => r.kind === kind)?.count ?? 0;
    expect(of("red")).toBe(14);
    expect(of("yellow")).toBe(37);
    expect(of("green")).toBe(20);
    const graded = of("red") + of("yellow") + of("green");
    expect(graded).toBe(71);
    // Way more than the 12 the DOM scan used to report.
    expect(graded).toBeGreaterThan(12);
  });

  test("percentages are computed over the whole note", () => {
    const rows = countKinds(scanSourceToggles(note).kinds);
    const yellow = rows.find((r) => r.kind === "yellow");
    expect(yellow?.percent).toBeGreaterThan(45);
    expect(yellow?.percent).toBeLessThan(55);
  });

  test("no kind is reported as empty when the source has it", () => {
    const rows = countKinds(scanSourceToggles(note).kinds);
    for (const kind of ["red", "yellow", "green"]) {
      expect(rows.find((r) => r.kind === kind)?.count).toBeGreaterThan(0);
    }
  });

  test("an empty note yields zero counts instead of throwing", () => {
    expect(countKinds(scanSourceToggles("").kinds).every((r) => r.count === 0)).toBe(true);
  });
});
