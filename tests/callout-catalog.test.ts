/**
 * v1.5.0 — the picker must explain itself.
 *
 * These tests protect three promises the reader was given: every built-in
 * callout type is filterable, each picker row names the real callout words,
 * and the counts / percentages reported for a note add up.
 */
import { describe, expect, test } from "bun:test";
import { CALLOUT_KINDS, GRADED_COLORS, type RecallColor } from "../src/autoscroll";
import { CALLOUT_META, kindWords, metaOf } from "../src/callout-catalog";
import { breakdownSummary, breakdownTable, countKinds, presentKinds } from "../src/callout-stats";
import { playgroundMarkdown, playgroundPath } from "../src/callout-playground";
import { filterGroups, flatFilterOptions, isEmptyOption, optionCount } from "../src/filter-picker";

describe("callout catalog (v1.5.0)", () => {
  test("every built-in callout kind has an icon, a name and a real callout word", () => {
    for (const m of CALLOUT_META) {
      expect(m.icon.length).toBeGreaterThan(0);
      expect(m.name).not.toBe(m.kind === "other" ? "" : "");
      expect(m.word).toBe(`!${m.kind}`);
    }
    expect(CALLOUT_META.length).toBe(CALLOUT_KINDS.length);
  });

  test("the kinds the reader complained about are all present", () => {
    for (const kind of ["important", "todo", "failure", "danger", "bug", "example", "quote"]) {
      expect(CALLOUT_KINDS).toContain(kind as RecallColor);
    }
  });

  test("alias words are shown, so !fail and !error are not a surprise", () => {
    expect(kindWords("failure" as RecallColor)).toContain("!fail");
    expect(kindWords("danger" as RecallColor)).toContain("!error");
    expect(kindWords("abstract" as RecallColor)).toContain("!tldr");
  });

  test("graded kinds keep their recall- callout names", () => {
    for (const g of GRADED_COLORS) expect(metaOf(g).word).toBe(`!recall-${g}`);
  });
});

describe("picker groups (v1.5.0)", () => {
  test("rows are grouped, and the traffic lights stay open by default", () => {
    const groups = filterGroups();
    expect(groups.map((g) => g.id)).toEqual(["graded", "callouts", "everything"]);
    expect(groups[0].open).toBe(true);
    expect(groups[1].open).toBe(false);
  });

  test("every callout kind is one tap away inside its group", () => {
    const callouts = filterGroups().find((g) => g.id === "callouts")!;
    for (const kind of CALLOUT_KINDS) {
      expect(callouts.options.some((o) => o.kind === kind)).toBe(true);
    }
    // plus the "all built-in callouts" shortcut
    expect(callouts.options.at(-1)!.filter.length).toBe(CALLOUT_KINDS.length);
  });

  test("the flat list still covers no-filter, single kinds and everything", () => {
    const flat = flatFilterOptions();
    expect(flat[0].filter).toEqual([]);
    expect(flat.some((o) => o.filter.length === 4 && o.filter.includes("other" as RecallColor))).toBe(true);
  });

  test("rows carry the note's own count, and empty kinds are marked", () => {
    const rows = countKinds(["red", "red", "important"] as RecallColor[]);
    const red = flatFilterOptions().find((o) => o.kind === "red")!;
    const bug = flatFilterOptions().find((o) => o.kind === "bug")!;
    expect(optionCount(red, rows)).toBe("2 · 66.7%");
    expect(isEmptyOption(red, rows)).toBe(false);
    expect(isEmptyOption(bug, rows)).toBe(true);
  });
});

describe("note breakdown (v1.5.0)", () => {
  const kinds = ["red", "red", "yellow", "important", "todo", "quote"] as RecallColor[];

  test("counts and percentages describe the note, zeroes included", () => {
    const rows = countKinds(kinds);
    expect(rows.find((r) => r.kind === "red")!.count).toBe(2);
    expect(rows.find((r) => r.kind === "red")!.percent).toBe(33.3);
    expect(rows.find((r) => r.kind === "bug")!.count).toBe(0);
    expect(presentKinds(rows).length).toBe(5);
  });

  test("the markdown table only lists kinds the note has, with a total row", () => {
    const table = breakdownTable(countKinds(kinds), kinds.length);
    expect(table).toContain("`!important`");
    expect(table).not.toContain("`!bug`");
    expect(table).toContain("**6**");
  });

  test("an empty note says so instead of printing an empty table", () => {
    expect(breakdownTable(countKinds([]), 0)).toBe("No toggles found in this note.");
    expect(breakdownSummary(countKinds([]), 0)).toBe("no toggles");
  });
});

describe("playground note (v1.5.0)", () => {
  test("one example per kind, each with its filter deep link", () => {
    const md = playgroundMarkdown();
    for (const kind of [...GRADED_COLORS, ...CALLOUT_KINDS]) {
      expect(md).toContain(`filter=${kind}`);
    }
    expect(md).toContain("[!important]-");
    expect(md).toContain("[!recall-red]-");
  });

  test("a second playground never overwrites the first", () => {
    const existing = new Set(["Callout playground.md"]);
    expect(playgroundPath((p) => existing.has(p))).not.toBe("Callout playground.md");
  });
});
