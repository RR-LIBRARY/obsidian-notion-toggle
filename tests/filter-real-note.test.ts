/**
 * v1.4.11 — deep verification of the red / yellow / green filter and of a quiz
 * run over a *filtered* deck, using a real 71-question NEET recall note
 * (`tests/fixtures/zoology-recall.md`) instead of synthetic strings.
 *
 * Covers: per-colour counts, every filter permutation, document order,
 * plain (`!note` / `!tip`) toggles staying out of graded runs, deep-link round
 * trips, colour cycling over the note's own header lines, and a quiz that
 * visits only matching questions and reveals each answer exactly once.
 */
import { beforeEach, describe, expect, it } from "bun:test";

import {
  CALLOUT_KINDS,
  COLOR_ICON,
  COLOR_ORDER,
  KIND_ORDER,
  UNGRADED_COLORS,
  isUngraded,
  kindOf,
  colorCounts,
  colorOf,
  filterLabel,
  matchesFilter,
  normalizeFilter,
  planStops,
  sameFilter,
  type RecallColor,
} from "../src/autoscroll";
import { collectToggleEls, collectToggleElsFiltered, toggleTitleOf, toggleTypeOf } from "../src/toggle-dom";
import { parseDeepLink, parseFilterParam } from "../src/deeplink";
import { QUIZ_FILTER_OPTIONS } from "../src/modals";
import { calloutTypeOfLine, nextTrafficColor, recolorHeaderLine } from "../src/recolor";
import { QuizHarness, ensureDom } from "./e2e/harness";
import { parseNoteToggles, readFixture, renderNoteMarkdown } from "./fixtures/note-parser";

ensureDom();

const MARKDOWN = readFixture("zoology-recall.md");
const PARSED = parseNoteToggles(MARKDOWN);

/** Expected, straight from the markdown source — not from the DOM path. */
const EXPECTED: Record<RecallColor, string[]> = {
  red: [],
  yellow: [],
  green: [],
  other: [],
};
for (const t of PARSED) EXPECTED[colorOf(t.type)].push(t.title);

const GRADED: RecallColor[] = ["red", "yellow", "green"];
const COMBOS: RecallColor[][] = [
  ["red"],
  ["yellow"],
  ["green"],
  ["red", "yellow"],
  ["red", "green"],
  ["yellow", "green"],
  ["red", "yellow", "green"],
];

let note: HTMLElement;
beforeEach(() => {
  const { html } = renderNoteMarkdown(MARKDOWN);
  document.body.innerHTML = `<div class="markdown-preview-view" id="note">${html}</div>`;
  note = document.getElementById("note") as HTMLElement;
});

const keepFor = (filter: RecallColor[]) => (el: HTMLElement) =>
  matchesFilter(colorOf(toggleTypeOf(el)), filter);

const titlesFor = (filter: RecallColor[]) =>
  (filter.length ? collectToggleElsFiltered(note, keepFor(filter)) : collectToggleEls(note)).map((el) =>
    toggleTitleOf(el)
  );

describe("real note — the fixture itself is what the note claims", () => {
  it("parses every toggle, graded and plain", () => {
    expect(PARSED.length).toBe(73);
    expect(EXPECTED.red.length).toBe(14);
    expect(EXPECTED.yellow.length).toBe(37);
    expect(EXPECTED.green.length).toBe(20);
    expect(EXPECTED.other.length).toBe(2); // the !tip legend + the !note preface
  });

  it("renders collapsed callouts, the way Obsidian folds `]-` toggles", () => {
    const graded = [...note.querySelectorAll('[data-callout^="recall-"]')] as HTMLElement[];
    expect(graded.length).toBe(71);
    expect(graded.every((el) => el.classList.contains("is-collapsed"))).toBe(true);
  });
});

describe("real note — colour read through the DOM path matches the source", () => {
  it("counts each colour exactly once, nothing dropped or doubled", () => {
    const colors = collectToggleEls(note).map((el) => colorOf(toggleTypeOf(el)));
    expect(colors.length).toBe(73);
    expect(colorCounts(colors)).toEqual({ red: 14, yellow: 37, green: 20, other: 2 });
  });

  it("keeps document order for an unfiltered collect", () => {
    expect(titlesFor([])).toEqual(PARSED.map((t) => t.title));
  });
});

describe("real note — every filter permutation", () => {
  for (const filter of COMBOS) {
    it(`${filterLabel(filter)} returns exactly the matching questions, in order`, () => {
      const expected = PARSED.filter((t) => filter.includes(colorOf(t.type))).map((t) => t.title);
      const got = titlesFor(filter);
      expect(got).toEqual(expected);
      expect(got.length).toBe(filter.reduce((n, c) => n + EXPECTED[c].length, 0));
    });
  }

  it("an empty filter means all — graded plus plain", () => {
    expect(titlesFor([]).length).toBe(73);
  });

  it("all graded (red+yellow+green) leaves the plain !note / !tip toggles out", () => {
    const got = titlesFor(GRADED);
    expect(got.length).toBe(71);
    for (const title of EXPECTED.other) expect(got).not.toContain(title);
  });

  it("each permutation is a distinct selection", () => {
    for (let i = 0; i < COMBOS.length; i++)
      for (let j = i + 1; j < COMBOS.length; j++)
        expect(sameFilter(COMBOS[i]!, COMBOS[j]!)).toBe(false);
  });

  it("a colour with no questions yields an empty plan, never a silent full run", () => {
    const only = renderNoteMarkdown(
      PARSED.filter((t) => colorOf(t.type) === "green")
        .map((t) => `> [!${t.type}]- ${t.title}`)
        .join("\n\n")
    );
    document.body.innerHTML = `<div class="markdown-preview-view" id="only">${only.html}</div>`;
    const root = document.getElementById("only") as HTMLElement;
    expect(collectToggleElsFiltered(root, keepFor(["red"]))).toEqual([]);
    expect(planStops([], ["red"], false)).toEqual([]);
  });
});

describe("real note — filtered stops travel in order", () => {
  for (const filter of COMBOS) {
    it(`plans ${filterLabel(filter)} stops top-to-bottom`, () => {
      const els = collectToggleElsFiltered(note, keepFor(filter));
      const stops = els.map((el, index) => ({
        index,
        top: index * 120,
        color: colorOf(toggleTypeOf(el)),
      }));
      const planned = planStops(stops, filter, false);
      expect(planned.map((s) => s.top)).toEqual(stops.map((s) => s.top));
      expect(new Set(planned.map((s) => s.color)).size).toBeLessThanOrEqual(filter.length);
      for (const s of planned) expect(filter).toContain(s.color);
    });
  }
});

describe("real note — filters round-trip through deep links and the picker", () => {
  for (const filter of COMBOS) {
    it(`filter=${filter.join(",")} survives the URL`, () => {
      const link = parseDeepLink({ action: "quiz", file: "Zoology/Recall.md", filter: filter.join(",") });
      expect(sameFilter(link?.filter ?? [], filter)).toBe(true);
      expect(sameFilter(normalizeFilter([...filter].reverse()), filter)).toBe(true);
    });
  }

  it("`graded` and `all` mean all three colours / everything", () => {
    expect(parseFilterParam("graded")?.sort()).toEqual(["green", "red", "yellow"]);
    expect(parseFilterParam("all") ?? []).toEqual([]);
  });

  it("labels are order-independent and non-empty for every permutation", () => {
    for (const filter of COMBOS) {
      expect(filterLabel(filter)).toBe(filterLabel([...filter].reverse()));
      expect(filterLabel(filter).length).toBeGreaterThan(0);
    }
    expect(COLOR_ORDER).toEqual(["red", "yellow", "green", "other"]);
  });
});

describe("real note — colour cycling over the note's own header lines", () => {
  it("red → yellow → green → red without corrupting titles", () => {
    const headers = MARKDOWN.split(/\r?\n/).filter((l) => /^>\s*\[!recall-/.test(l));
    expect(headers.length).toBe(71);
    for (const line of headers) {
      const title = line.replace(/^>\s*\[![^\]]+\][+-]?\s*/, "");
      let cur = line;
      for (let i = 0; i < 3; i++)
        cur = recolorHeaderLine(cur, nextTrafficColor(calloutTypeOfLine(cur)));
      expect(cur.replace(/^>\s*\[![^\]]+\][+-]?\s*/, "")).toBe(title);
      expect(calloutTypeOfLine(cur)).toBe(calloutTypeOfLine(line));
      expect(cur.includes("]-")).toBe(line.includes("]-"));
    }
  });
});

describe("real note — a quiz run over a filtered deck", () => {
  const run = (filter: RecallColor[]) => {
    const h = new QuizHarness(note, { quizSeconds: 2, quizRevealSeconds: 1 }, filter);
    return h;
  };

  it("red-only quiz captures the 14 red questions, in order", () => {
    const h = run(["red"]);
    expect(h.titles).toEqual(EXPECTED.red);
    h.stop();
  });

  it("yellow+green quiz captures 57 questions and skips every red one", () => {
    const h = run(["yellow", "green"]);
    expect(h.titles.length).toBe(57);
    for (const title of EXPECTED.red) expect(h.titles).not.toContain(title);
    h.stop();
  });

  it("reveals land on natively collapsed callouts, one answer at a time", () => {
    const h = run(["red"]);
    h.revealNow();
    expect(h.visibleTitles()).toEqual([EXPECTED.red[0]!]);
    h.next();
    expect(h.visibleTitles()).toEqual([]);
    h.revealNow();
    expect(h.visibleTitles()).toEqual([EXPECTED.red[1]!]);
    h.stop();
  });

  it("walks the whole red deck and restores the note on teardown", () => {
    const h = run(["red"]);
    const before = h.els.map((el) => el!.className);
    h.run();
    expect(h.state.phase).toBe("done");
    expect(h.state.at).toBe(EXPECTED.red.length - 1);
    h.els.forEach((el, i) => {
      expect(el!.className).toBe(before[i]!);
      expect(el!.classList.contains("ntt-quiz-hidden")).toBe(false);
      expect(el!.classList.contains("ntt-quiz-shown")).toBe(false);
    });
  });

  it("heals after Obsidian re-renders the note mid-run, still on the filtered deck", () => {
    const h = run(["yellow"]);
    h.next();
    const { html } = renderNoteMarkdown(MARKDOWN);
    document.body.innerHTML = `<div class="markdown-preview-view" id="note">${html}</div>`;
    const fresh = document.getElementById("note") as HTMLElement;
    expect(h.els[1]!.isConnected).toBe(false);
    (h as unknown as { container: HTMLElement }).container = fresh;
    h.revealNow();
    expect(h.els[1]!.isConnected).toBe(true);
    expect(h.visibleTitles()).toEqual([EXPECTED.yellow[1]!]);
    h.stop();
  });
});

describe("real note — v1.4.11 notes-only filter (!note / !tip / ungraded)", () => {
  it("selects exactly the ungraded toggles, in document order", () => {
    const got = titlesFor(["other"]);
    expect(got).toEqual(EXPECTED.other);
    expect(got.length).toBe(2);
  });

  it("never contains a graded question", () => {
    const got = titlesFor(["other"]);
    for (const c of GRADED) for (const title of EXPECTED[c]) expect(got).not.toContain(title);
  });

  it("graded + notes covers the whole note with no duplicates", () => {
    const got = titlesFor(["red", "yellow", "green", "other"]);
    expect(got.length).toBe(73);
    expect(new Set(got).size).toBe(new Set(PARSED.map((t) => t.title)).size);
    expect(got).toEqual(titlesFor([]));
  });

  it("notes-only and graded are complementary halves", () => {
    expect(titlesFor(["other"]).length + titlesFor(GRADED).length).toBe(73);
    expect(sameFilter(["other"], GRADED)).toBe(false);
  });

  it("has a readable label of its own", () => {
    expect(filterLabel(["other"])).toContain("!note");
    expect(filterLabel(["red", "yellow", "green", "other"])).toBe("🔴 🟡 🟢 ⚪");
  });

  it("round-trips through every deep-link alias", () => {
    for (const alias of ["notes", "ungraded", "plain", "other", "NOTES", " Notes "])
      expect(parseFilterParam(alias)).toEqual(["other"]);
    expect(parseFilterParam("note")).toEqual(["note"]);
    expect(parseFilterParam("tip")).toEqual(["tip"]);
    expect(parseFilterParam("everything")).toEqual(COLOR_ORDER);
    expect(parseFilterParam("graded")).toEqual(GRADED);
    const link = parseDeepLink({ action: "quiz", filter: "notes" });
    expect(link?.filter).toEqual(["other"]);
  });

  it("keeps normalization canonical when notes are mixed in", () => {
    expect(normalizeFilter(["other", "green", "red"])).toEqual(["red", "green", "other"]);
  });

  it("runs a quiz over the notes-only deck", () => {
    const h = new QuizHarness(note, { quizSeconds: 2, quizRevealSeconds: 1 }, ["other"]);
    expect(h.titles).toEqual(EXPECTED.other);
    h.revealNow();
    expect(h.visibleTitles()).toEqual([EXPECTED.other[0]!]);
    h.run();
    expect(h.state.phase).toBe("done");
  });
});

/**
 * v1.4.13 — every remaining Obsidian built-in callout gets its own filter kind,
 * with the documented alias words resolving to it.
 */
describe("v1.4.13 — all built-in callout kinds", () => {
  const NEW_KINDS: RecallColor[] = [
    "todo",
    "important",
    "failure",
    "danger",
    "bug",
    "example",
    "quote",
  ];

  it("resolves each new callout type to its own kind", () => {
    for (const kind of NEW_KINDS) {
      expect(kindOf(`callout callout-${kind}`)).toBe(kind);
      expect(kindOf(kind)).toBe(kind);
    }
  });

  it("keeps every new kind ungraded and out of graded runs", () => {
    for (const kind of NEW_KINDS) {
      expect(isUngraded(kind)).toBe(true);
      expect(colorOf(`callout-${kind}`)).toBe("other");
      expect(matchesFilter(kind, ["red", "yellow", "green"])).toBe(false);
      expect(matchesFilter(kind, ["other"])).toBe(true);
      expect(matchesFilter(kind, [kind])).toBe(true);
      expect(matchesFilter(kind, [])).toBe(true);
    }
  });

  it("resolves Obsidian alias words to the canonical kind", () => {
    const aliases: Record<string, RecallColor> = {
      hint: "tip",
      summary: "abstract",
      tldr: "abstract",
      faq: "question",
      help: "question",
      check: "success",
      done: "success",
      caution: "warning",
      attention: "warning",
      fail: "failure",
      missing: "failure",
      error: "danger",
      cite: "quote",
    };
    for (const [word, kind] of Object.entries(aliases)) {
      expect(kindOf(`callout callout-${word}`)).toBe(kind);
      expect(parseFilterParam(word)).toEqual([kind]);
    }
  });

  it("exposes every new kind in CALLOUT_KINDS, order, and icons", () => {
    for (const kind of NEW_KINDS) {
      expect(CALLOUT_KINDS).toContain(kind);
      expect(KIND_ORDER).toContain(kind);
      expect(UNGRADED_COLORS).toContain(kind);
      expect(COLOR_ICON[kind].length).toBeGreaterThan(0);
    }
    expect(normalizeFilter(["quote", "red", "todo"])).toEqual(["red", "todo", "quote"]);
  });

  it("parses the new kinds from deep links, alone and combined", () => {
    expect(parseFilterParam("important")).toEqual(["important"]);
    expect(parseFilterParam("quote,bug")).toEqual(["bug", "quote"]);
    expect(parseFilterParam("callouts")).toEqual(UNGRADED_COLORS);
    expect(parseDeepLink({ action: "autoscroll", filter: "important" })?.filter).toEqual([
      "important",
    ]);
  });

  it("leaves the real note's counts untouched", () => {
    expect(titlesFor(["other"]).length).toBe(2);
    expect(titlesFor(GRADED).length).toBe(71);
    expect(titlesFor([]).length).toBe(73);
    for (const kind of NEW_KINDS) expect(titlesFor([kind]).length).toBe(0);
  });

  it("offers every new kind in both pickers", () => {
    for (const kind of NEW_KINDS) {
      expect(
        QUIZ_FILTER_OPTIONS.some((o) => o.filter.length === 1 && o.filter[0] === kind)
      ).toBe(true);
    }
    const all = QUIZ_FILTER_OPTIONS.find((o) => o.label.includes("All built-in callouts"));
    expect(all?.filter).toEqual(CALLOUT_KINDS);
  });
});
