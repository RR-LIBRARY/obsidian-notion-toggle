/**
 * v1.8.0 — clean editing planner (src/clean-toggles.ts).
 *
 * Pure string-in / plan-out tests. The scenarios mirror what a writer does:
 * put the caret on a title, into an answer, click the arrow, press Home,
 * paste a <details> block, type `>` + space.
 */
import { describe, expect, test } from "bun:test";
import {
  BOLD_WRAP_RE,
  CLEAN_HEADER_RE,
  blocksTouching,
  convertPastedText,
  detailsBlockCount,
  findBlockAt,
  flipFoldMarker,
  insideFence,
  isShortcutTrigger,
  nudgeCaret,
  openWithoutCaret,
  planClean,
  redirectCaret,
  textDoc,
  typeSlug,
  type CleanPlan,
} from "../src/clean-toggles";
import { convertDetailsToCallouts } from "../src/editor-blocks";

const NOTE = [
  "# Biology",
  "> [!question]- **Q7. Nematode-resistant plant?**",
  "> **Answer:** Tobacco.",
  "> Second answer line.",
  "",
  "Plain paragraph.",
  "> [!recall-red]+ Open by default",
  "> body",
  "> plain quote that is not a toggle",
].join("\n");

const doc = textDoc(NOTE);
const line = (n: number) => doc.line(n);
const caretAt = (pos: number) => [{ from: pos, to: pos, head: pos }];
const kinds = (plans: CleanPlan[]) => plans.map((p) => p.kind);

describe("v1.8.0 clean toggles — block detection", () => {
  test("header regex accepts - and +, any type, optional space; rejects plain callouts and quotes", () => {
    expect(CLEAN_HEADER_RE.test("> [!question]- Title")).toBe(true);
    expect(CLEAN_HEADER_RE.test(">[!recall-red]+")).toBe(true);
    expect(CLEAN_HEADER_RE.test("> [!note] not foldable")).toBe(false);
    expect(CLEAN_HEADER_RE.test("> just a quote")).toBe(false);
    expect(CLEAN_HEADER_RE.test("  > [!q]- indented is not a block start")).toBe(false);
  });

  test("finds the block from the header, the body, and the last body line", () => {
    for (const n of [2, 3, 4]) {
      const b = findBlockAt(doc, n);
      expect(b?.headerLine).toBe(2);
      expect(b?.lastLine).toBe(4);
      expect(b?.type).toBe("question");
      expect(b?.marker).toBe("-");
    }
  });

  test("prefixEnd sits right before the visible title", () => {
    const b = findBlockAt(doc, 2)!;
    expect(NOTE.slice(b.prefixEnd, b.headerTo)).toBe("**Q7. Nematode-resistant plant?**");
    expect(b.bodyPrefixes.map((p) => NOTE.slice(p.from, p.to))).toEqual(["> ", "> "]);
  });

  test("a heading, a blank line and a plain paragraph are not toggles", () => {
    expect(findBlockAt(doc, 1)).toBeNull();
    expect(findBlockAt(doc, 5)).toBeNull();
    expect(findBlockAt(doc, 6)).toBeNull();
  });

  test("a `>` line after the body still belongs to the toggle (Obsidian keeps quoting)", () => {
    const b = findBlockAt(doc, 9)!;
    expect(b.headerLine).toBe(7);
    expect(b.lastLine).toBe(9);
    expect(b.marker).toBe("+");
  });

  test("a second header ends the previous block", () => {
    const two = textDoc("> [!q]- one\n> a\n> [!q]- two\n> b");
    expect(findBlockAt(two, 2)?.lastLine).toBe(2);
    expect(findBlockAt(two, 3)?.headerLine).toBe(3);
    expect(findBlockAt(two, 4)?.headerLine).toBe(3);
  });

  test("documented examples inside code fences are left alone", () => {
    const fenced = textDoc("```md\n> [!q]- example\n> body\n```\n> [!q]- real");
    expect(insideFence(fenced, 2)).toBe(true);
    expect(findBlockAt(fenced, 2)).toBeNull();
    expect(findBlockAt(fenced, 5)?.headerLine).toBe(5);
  });

  test("blocksTouching dedupes and orders blocks for a multi-block selection", () => {
    const sel = [{ from: line(3).from, to: line(8).to }];
    expect(blocksTouching(doc, sel).map((b) => b.headerLine)).toEqual([2, 7]);
  });

  test("typeSlug is CSS-safe", () => {
    expect(typeSlug("recall-red")).toBe("recall-red");
    expect(typeSlug("Note")).toBe("note");
    expect(typeSlug("weird type!")).toBe("weird-type");
    expect(typeSlug("")).toBe("toggle");
  });
});

describe("v1.8.0 clean toggles — plans", () => {
  test("caret on the title of a closed toggle: arrow + folded body, no raw `>` anywhere", () => {
    const { plans } = planClean(doc, caretAt(line(2).to), new Map());
    expect(kinds(plans)).toEqual(["line", "arrow", "hide", "fold"]);
    const arrow = plans[1] as Extract<CleanPlan, { kind: "arrow" }>;
    expect(NOTE.slice(arrow.from, arrow.to)).toBe("> [!question]- **"); // v1.8.2: the opening ** hides with the prefix
    expect(arrow.open).toBe(false);
    expect(NOTE.slice((plans[2] as { from: number }).from, (plans[2] as { to: number }).to)).toBe("**");
    const fold = plans[3] as Extract<CleanPlan, { kind: "fold" }>;
    expect(fold.from).toBe(line(2).to);
    expect(fold.to).toBe(line(4).to);
    const lineDeco = plans[0] as Extract<CleanPlan, { kind: "line" }>;
    expect(lineDeco.cls).toContain("ntt-clean-header");
    expect(lineDeco.cls).toContain("ntt-clean-t-question");
    expect(lineDeco.cls).toContain("ntt-clean-closed");
    expect(lineDeco.cls).toContain("ntt-clean-bold");
  });

  test("caret in the answer: toggle opens, every `> ` prefix is hidden, body lines get the indent class", () => {
    const { plans } = planClean(doc, caretAt(line(3).to), new Map());
    expect(kinds(plans)).toEqual(["line", "arrow", "hide", "line", "hide", "line", "hide"]);
    const hides = plans.filter((p) => p.kind === "hide") as Extract<CleanPlan, { kind: "hide" }>[];
    expect(hides.map((h) => NOTE.slice(h.from, h.to))).toEqual(["**", "> ", "> "]);
    expect((plans[3] as Extract<CleanPlan, { kind: "line" }>).cls).toContain("ntt-clean-body");
  });

  test("a `+` toggle is open even with the caret on its title", () => {
    const { plans } = planClean(doc, caretAt(line(7).to), new Map());
    expect((plans[1] as Extract<CleanPlan, { kind: "arrow" }>).open).toBe(true);
    expect(kinds(plans)).not.toContain("fold");
  });

  test("arrow click is sticky: override opens a closed toggle and closes an open one", () => {
    const closedKey = findBlockAt(doc, 2)!.key;
    const openKey = findBlockAt(doc, 7)!.key;
    const a = planClean(doc, caretAt(line(2).to), new Map([[closedKey, true]]));
    expect((a.plans[1] as Extract<CleanPlan, { kind: "arrow" }>).open).toBe(true);
    const b = planClean(doc, caretAt(line(7).to), new Map([[openKey, false]]));
    expect((b.plans[1] as Extract<CleanPlan, { kind: "arrow" }>).open).toBe(false);
    expect(kinds(b.plans)).toContain("fold");
  });

  test("visiting the body makes the toggle sticky-open, so going back to the title does not snap it shut", () => {
    const key = findBlockAt(doc, 2)!.key;
    const inBody = planClean(doc, caretAt(line(3).to), new Map());
    expect(inBody.overrides.get(key)).toBe(true);
    const backOnTitle = planClean(doc, caretAt(line(2).to), inBody.overrides);
    expect((backOnTitle.plans[1] as Extract<CleanPlan, { kind: "arrow" }>).open).toBe(true);
  });

  test("arrow choices for other blocks are remembered, so an opened toggle stays open when the caret wanders off", () => {
    const other = findBlockAt(doc, 7)!.key;
    const { overrides } = planClean(doc, caretAt(line(2).to), new Map([[other, false]]));
    expect(overrides.get(other)).toBe(false);
    const back = planClean(doc, caretAt(line(7).to), overrides);
    expect((back.plans[1] as Extract<CleanPlan, { kind: "arrow" }>).open).toBe(false);
  });

  test("blocks the caret is not in get no plans (Obsidian renders them itself)", () => {
    const { plans } = planClean(doc, caretAt(line(6).from), new Map());
    expect(plans).toEqual([]);
  });

  test("a body-less toggle gets just the line class and the arrow", () => {
    const solo = textDoc("> [!q]- alone");
    const { plans } = planClean(solo, caretAt(5), new Map());
    expect(kinds(plans)).toEqual(["line", "arrow"]);
  });

  test("a freshly inserted toggle with an empty title still gets its arrow", () => {
    const fresh = textDoc("> [!question]- \n> \n");
    const { plans } = planClean(fresh, caretAt(15), new Map());
    expect(kinds(plans)[0]).toBe("line");
    expect(kinds(plans)[1]).toBe("arrow");
    const arrow = plans[1] as Extract<CleanPlan, { kind: "arrow" }>;
    expect(arrow.to).toBe(15);
  });
});

describe("v1.8.0 clean toggles — caret never hides inside a marker", () => {
  test("Home on the title line lands after the hidden prefix", () => {
    const target = nudgeCaret(doc, line(2).from, new Map());
    expect(target).toBe(findBlockAt(doc, 2)!.titleFrom);
  });

  test("a caret already on visible title text is left alone; behind the hidden closing ** it is pulled back", () => {
    const b = findBlockAt(doc, 2)!;
    expect(nudgeCaret(doc, b.titleTo - 3, new Map())).toBeNull();
    expect(nudgeCaret(doc, b.titleTo, new Map())).toBeNull();
    expect(nudgeCaret(doc, line(2).to, new Map())).toBe(b.titleTo);
  });

  test("column 0 of an open body line moves past the `> `", () => {
    const key = findBlockAt(doc, 2)!.key;
    expect(nudgeCaret(doc, line(3).from, new Map([[key, true]]))).toBe(line(3).from + 2);
    expect(nudgeCaret(doc, line(3).from + 5, new Map([[key, true]]))).toBeNull();
  });

  test("a caret inside a folded body is parked at the end of the title", () => {
    // Caret in the body normally opens the toggle; a sticky-closed override keeps it folded.
    const key = findBlockAt(doc, 2)!.key;
    // isOpen() gives a caret-in-body precedence, so a folded body can only be
    // reached by a programmatic selection; the nudge still returns a visible spot.
    const t = nudgeCaret(doc, line(3).from, new Map([[key, false]]));
    expect(t === line(3).from + 2 || t === findBlockAt(doc, 2)!.titleTo).toBe(true);
  });

  test("outside a toggle nothing happens", () => {
    expect(nudgeCaret(doc, line(6).from, new Map())).toBeNull();
  });

  test("openWithoutCaret: override, then marker", () => {
    const closed = findBlockAt(doc, 2)!;
    const open = findBlockAt(doc, 7)!;
    expect(openWithoutCaret(closed, new Map())).toBe(false);
    expect(openWithoutCaret(open, new Map())).toBe(true);
    expect(openWithoutCaret(closed, new Map([[closed.key, true]]))).toBe(true);
    expect(openWithoutCaret(open, new Map([[open.key, false]]))).toBe(false);
  });

  test("redirectCaret on a closed toggle: forward from the title skips the body, anything else parks on the title", () => {
    const b = findBlockAt(doc, 2)!;
    const none = new Map();
    // Right / End from the title → the line after the block
    expect(redirectCaret(doc, { anchor: b.bodyTo, head: b.bodyTo, prevHead: b.headerTo }, none)).toBe(line(5).from);
    // Up from below into the body → end of the title
    expect(redirectCaret(doc, { anchor: line(3).from + 4, head: line(3).from + 4, prevHead: line(6).from }, none)).toBe(b.titleTo);
    // No history (a click past the chip) → end of the title
    expect(redirectCaret(doc, { anchor: b.bodyTo, head: b.bodyTo }, none)).toBe(b.titleTo);
    // A tap past the title never skips forward, even with history (v1.8.2 pointer flag)
    expect(redirectCaret(doc, { anchor: b.bodyTo, head: b.bodyTo, prevHead: b.titleTo, pointer: true }, none)).toBe(b.titleTo);
    // Selection anchored on the title reaching into the body → clamp head to the title
    expect(redirectCaret(doc, { anchor: b.headerFrom + 20, head: b.bodyTo, prevHead: b.headerTo }, none)).toBe(b.titleTo);
    // Selection anchored above the block → untouched (whole-block selection)
    expect(redirectCaret(doc, { anchor: 0, head: b.bodyTo, prevHead: 0 }, none)).toBeNull();
  });

  test("redirectCaret on an open toggle only guards the hidden `> ` prefixes", () => {
    const b = findBlockAt(doc, 7)!; // `+` block
    expect(redirectCaret(doc, { anchor: line(8).from, head: line(8).from, prevHead: line(7).to }, new Map())).toBe(line(8).from + 2);
    expect(redirectCaret(doc, { anchor: line(8).to, head: line(8).to, prevHead: line(7).to }, new Map())).toBeNull();
    // selections inside an open body are left alone
    expect(redirectCaret(doc, { anchor: b.headerTo, head: line(8).from, prevHead: b.headerTo }, new Map())).toBeNull();
  });

  test("forward skip stays put when the toggle is the last thing in the note", () => {
    const tail = textDoc("> [!q]- last\n> body");
    const b = findBlockAt(tail, 1)!;
    expect(redirectCaret(tail, { anchor: b.bodyTo, head: b.bodyTo, prevHead: b.headerTo }, new Map())).toBe(b.headerTo);
  });
});

describe("v1.8.0 clean toggles — `>` + space shortcut", () => {
  test("only a lone `>` with the caret right after it triggers", () => {
    expect(isShortcutTrigger(">", 1)).toBe(true);
    expect(isShortcutTrigger("> ", 2)).toBe(false);
    expect(isShortcutTrigger(">>", 2)).toBe(false);
    expect(isShortcutTrigger("text >", 6)).toBe(false);
    expect(isShortcutTrigger(">", 0)).toBe(false);
  });
});

describe("v1.8.0 clean toggles — <details> comfort", () => {
  test("counts <details> blocks but ignores fenced examples", () => {
    expect(detailsBlockCount("<details><summary>a</summary>b</details>")).toBe(1);
    expect(detailsBlockCount("<details open>\n<summary>a</summary>\nb\n</details>\n<details><summary>c</summary></details>")).toBe(2);
    expect(detailsBlockCount("```html\n<details><summary>x</summary></details>\n```")).toBe(0);
    expect(detailsBlockCount("")).toBe(0);
    expect(detailsBlockCount(null)).toBe(0);
  });

  test("pasted <details> becomes a toggle; anything else is left to the default paste", () => {
    const pasted = "<details>\n<summary>Q7. NCERT example ke hisaab se nematode-resistant plant kaunsa tha?</summary>\n\n**Answer:** **Tobacco plant** ko nematode-resistant banaya gaya tha.\n</details>";
    const out = convertPastedText(pasted, { calloutType: "question", collapsed: true, boldSummary: true });
    expect(out).toBe(
      "> [!question]- **Q7. NCERT example ke hisaab se nematode-resistant plant kaunsa tha?**\n> **Answer:** **Tobacco plant** ko nematode-resistant banaya gaya tha."
    );
    expect(out).not.toContain("<details");
    expect(out).not.toContain("<summary");
    expect(convertPastedText("plain text", { calloutType: "question", collapsed: true, boldSummary: true })).toBeNull();
  });

  test("<details open> stays open (+); nested details become nested callouts", () => {
    const open = convertDetailsToCallouts("<details open><summary>T</summary>x</details>", "question", true, false);
    expect(open).toBe("> [!question]+ T\n> x");
    const nested = convertDetailsToCallouts(
      "<details><summary>Outer</summary>\n<details><summary>Inner</summary>deep</details>\n</details>",
      "question",
      true,
      false
    );
    expect(nested).toBe("> [!question]- Outer\n> > [!question]- Inner\n> > deep");
  });

  test("flipFoldMarker toggles the default state and ignores non-headers", () => {
    expect(flipFoldMarker("> [!question]- Title")).toBe("> [!question]+ Title");
    expect(flipFoldMarker("> [!recall-red]+ Title")).toBe("> [!recall-red]- Title");
    expect(flipFoldMarker("> plain")).toBe("> plain");
    expect(flipFoldMarker("> [!note] not foldable")).toBe("> [!note] not foldable");
  });
});

describe("v1.8.2 clean toggles — bold titles (`**Title**`)", () => {
  test("BOLD_WRAP_RE: a clean **…** pair only", () => {
    expect("**Q7. Plant?**".match(BOLD_WRAP_RE)?.[1]).toBe("Q7. Plant?");
    expect("**Q**".match(BOLD_WRAP_RE)?.[1]).toBe("Q");
    expect("**Q7. Plant?**  ".match(BOLD_WRAP_RE)?.[1]).toBe("Q7. Plant?");
    expect("**a*b**".match(BOLD_WRAP_RE)?.[1]).toBe("a*b");
    expect(BOLD_WRAP_RE.test("**Q** tail")).toBe(false);
    expect(BOLD_WRAP_RE.test("** Q **")).toBe(false);
    expect(BOLD_WRAP_RE.test("**Q** and **R**")).toBe(false);
    expect(BOLD_WRAP_RE.test("****")).toBe(false);
    expect(BOLD_WRAP_RE.test("plain")).toBe(false);
  });

  test("findBlockAt marks the visible title inside the markers", () => {
    const b = findBlockAt(doc, 2)!;
    expect(b.boldWrap).toBe(true);
    expect(NOTE.slice(b.titleFrom, b.titleTo)).toBe("Q7. Nematode-resistant plant?");
    expect(b.titleFrom).toBe(b.prefixEnd + 2);
    expect(b.titleTo).toBe(b.headerTo - 2);
    const plain = findBlockAt(doc, 7)!;
    expect(plain.boldWrap).toBe(false);
    expect(plain.titleFrom).toBe(plain.prefixEnd);
    expect(plain.titleTo).toBe(plain.headerTo);
  });

  test("a partly bold title is left alone (markers stay visible)", () => {
    const d = textDoc("> [!q]- **Bold** and more\n> body");
    const b = findBlockAt(d, 1)!;
    expect(b.boldWrap).toBe(false);
    const { plans } = planClean(d, caretAt(b.headerTo), new Map());
    expect(kinds(plans)).toEqual(["line", "arrow", "fold"]);
    expect((plans[0] as Extract<CleanPlan, { kind: "line" }>).cls).not.toContain("ntt-clean-bold");
  });

  test("a body-less bold title still hides both marker pairs", () => {
    const d = textDoc("> [!q]- **Solo**");
    const { plans } = planClean(d, caretAt(12), new Map());
    expect(kinds(plans)).toEqual(["line", "arrow", "hide"]);
    const hide = plans[2] as Extract<CleanPlan, { kind: "hide" }>;
    expect(hide.from).toBe(d.line(1).to - 2);
    expect(hide.to).toBe(d.line(1).to);
  });

  test("redirectCaret around the hidden closing **", () => {
    const b = findBlockAt(doc, 2)!;
    const none = new Map();
    // inside the opening ** → title start
    expect(redirectCaret(doc, { anchor: b.prefixEnd + 1, head: b.prefixEnd + 1 }, none)).toBe(b.titleFrom);
    // Up / a tap landing behind the closing ** → title end
    expect(redirectCaret(doc, { anchor: b.headerTo, head: b.headerTo, prevHead: line(6).from }, none)).toBe(b.titleTo);
    expect(redirectCaret(doc, { anchor: b.headerTo - 1, head: b.headerTo - 1, prevHead: b.titleTo, pointer: true }, none)).toBe(b.titleTo);
    // Right from the title end of a closed toggle → line after the block
    expect(redirectCaret(doc, { anchor: b.titleTo + 1, head: b.titleTo + 1, prevHead: b.titleTo }, none)).toBe(line(5).from);
    // Right from the title end of an open toggle → first body line, after its hidden `> `
    expect(redirectCaret(doc, { anchor: b.titleTo + 1, head: b.titleTo + 1, prevHead: b.titleTo }, new Map([[b.key, true]]))).toBe(line(3).from + 2);
    // Shift-Right from the title stops at the title end
    expect(redirectCaret(doc, { anchor: b.titleTo - 2, head: b.headerTo, prevHead: b.titleTo }, none)).toBe(b.titleTo);
    // a selection from above may run through the whole header line
    expect(redirectCaret(doc, { anchor: 0, head: b.headerTo, prevHead: 0 }, none)).toBeNull();
    // Right off a body-less bold title that ends the note stays on the title
    const tail = textDoc("> [!q]- **Last**");
    const t = findBlockAt(tail, 1)!;
    expect(redirectCaret(tail, { anchor: t.titleTo + 1, head: t.titleTo + 1, prevHead: t.titleTo }, none)).toBe(t.titleTo);
  });
});
