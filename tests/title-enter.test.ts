/**
 * v1.8.22 — Enter at the end of a toggle title follows list logic:
 *   title + Enter  → a new sibling toggle at the same depth
 *   empty title    → back to a plain line (inside the parent when nested)
 *   Tab/Shift+Tab  → the only operations that change depth
 * Plus the hand-off rule the older main.ts Enter handler asks before acting,
 * and the grey "Toggle" placeholder plan for an empty title.
 */
import { describe, expect, test } from "bun:test";
import { cleanOwnsEnter, emptyTitle, findBlockAt, planClean, planTitleEnter, textDoc, type ToggleBlock } from "../src/clean-toggles";

function block(text: string, line = 1): { doc: ReturnType<typeof textDoc>; b: ToggleBlock } {
  const doc = textDoc(text);
  const b = findBlockAt(doc, line);
  if (!b) throw new Error(`no toggle on line ${line} of ${JSON.stringify(text)}`);
  return { doc, b };
}

/** Apply a plan to the text and return the result plus the caret's line/column. */
function apply(text: string, line: number, isOpen: boolean, opts: { fold: "+" | "-" }) {
  const { doc, b } = block(text, line);
  const p = planTitleEnter(doc, b, isOpen, opts);
  const after = text.slice(0, p.from) + p.insert + text.slice(p.to);
  const before = after.slice(0, p.caret);
  const caretLine = before.split("\n").length;
  const caretCol = before.length - before.lastIndexOf("\n") - 1;
  return { after, caretLine, caretCol, openKey: p.openKey, lines: after.split("\n") };
}

const CLOSED = { fold: "-" as const };

describe("v1.8.22 planTitleEnter — Enter keeps the current depth", () => {
  test("fresh top-level title: Enter creates a top-level sibling", () => {
    const r = apply("> [!question]- Plants", 1, false, CLOSED);
    expect(r.lines).toEqual(["> [!question]- Plants", "", "> [!question]- "]);
    expect(r.caretLine).toBe(3);
    expect(r.caretCol).toBe("> [!question]- ".length);
    expect(r.openKey).toBeUndefined();
  });

  test("open toggle with a body: Enter creates a sibling after the complete block", () => {
    const r = apply("> [!question]- Plants\n> Chlorophyll.", 1, true, CLOSED);
    expect(r.lines).toEqual(["> [!question]- Plants", "> Chlorophyll.", "", "> [!question]- "]);
    expect(r.caretLine).toBe(4);
    expect(r.openKey).toBeUndefined();
  });

  test("closed toggle with a body: Enter makes a sibling after it (nothing inside is disturbed)", () => {
    const r = apply("> [!question]- Plants\n> Chlorophyll.\n> More.\n\nAfter", 1, false, CLOSED);
    expect(r.lines).toEqual(["> [!question]- Plants", "> Chlorophyll.", "> More.", "", "> [!question]- ", "", "After"]);
    expect(r.caretLine).toBe(5);
    expect(r.caretCol).toBe("> [!question]- ".length);
    expect(r.openKey).toBeUndefined();
  });

  test("nested title: Enter creates a sibling at the same nested depth, never a deeper child", () => {
    const text = "> [!question]- Outer\n> > [!question]- Inner";
    const r = apply(text, 2, false, CLOSED);
    expect(r.lines).toEqual(["> [!question]- Outer", "> > [!question]- Inner", ">", "> > [!question]- "]);
    expect(r.caretLine).toBe(4);
    expect(r.openKey).toBeUndefined();
  });

  test("bold titles stay bold: the new toggle gets an empty `****` pair with the caret in the middle", () => {
    const r = apply("> [!question]- **Plants**", 1, false, CLOSED);
    expect(r.lines[2]).toBe("> [!question]- ****");
    expect(r.caretCol).toBe("> [!question]- **".length);
    const sib = apply("> [!question]- **Plants**\n> body", 1, false, CLOSED);
    expect(sib.lines).toEqual(["> [!question]- **Plants**", "> body", "", "> [!question]- ****"]);
    expect(sib.caretCol).toBe("> [!question]- **".length);
  });

  test("the callout type and the 'start open' marker are carried over", () => {
    expect(apply("> [!note]- Tip", 1, false, { fold: "+" }).lines[2]).toBe("> [!note]+ ");
    expect(apply("> [!tip]+ Tip\n> b", 1, false, { fold: "+" }).lines[3]).toBe("> [!tip]+ ");
  });

  test("empty title: the toggle turns back into a plain line — inside the parent when nested", () => {
    const top = apply("> [!question]- ", 1, false, CLOSED);
    expect(top.after).toBe("");
    expect(top.caretLine).toBe(1);
    expect(top.openKey).toBeUndefined();
    expect(apply("> [!question]- ****", 1, false, CLOSED).after).toBe(""); // the shortcut's bold-ready pair counts as empty
    const nested = apply("> [!question]- Outer\n> > [!question]- \n> tail", 2, false, CLOSED);
    expect(nested.lines).toEqual(["> [!question]- Outer", ">", "> tail"]);
    expect(nested.caretLine).toBe(2);
    expect(nested.caretCol).toBe(1);
  });
});

describe("v1.8.13 emptyTitle", () => {
  test.each([
    ["> [!question]- ", true],
    ["> [!question]-", true],
    ["> [!question]-    ", true],
    ["> [!question]- ****", true],
    ["> [!question]- ** **", true],
    ["> [!question]- x", false],
    ["> [!question]- **x**", false],
    ["> [!question]- 1.", false],
  ])("%s → %s", (text, expected) => {
    const { doc, b } = block(text);
    expect(emptyTitle(doc, b)).toBe(expected);
  });
});

describe("v1.8.13 cleanOwnsEnter — when main.ts's Enter steps aside", () => {
  const NOTE = ["Plain", "> [!question]- **Q1**", "> body one", "> > [!question]- Inner", "> > deep", "", "Tail"].join("\n");
  const doc = textDoc(NOTE);
  const at = (line: number, col: number) => doc.line(line).from + col;

  test("outside any toggle: no", () => {
    expect(cleanOwnsEnter(doc, 1, at(1, 5))).toBe(false);
    expect(cleanOwnsEnter(doc, 7, at(7, 4))).toBe(false);
  });

  test("top-level title: yes at (or after) the end of the visible title, no in the middle", () => {
    const b = findBlockAt(doc, 2)!;
    expect(cleanOwnsEnter(doc, 2, b.titleTo)).toBe(true); // before the hidden closing `**`
    expect(cleanOwnsEnter(doc, 2, b.headerTo)).toBe(true); // hard line end
    expect(cleanOwnsEnter(doc, 2, b.titleFrom + 1)).toBe(false);
  });

  test("top-level body line: no (the older MCQ / answer-line rules still apply there)", () => {
    expect(cleanOwnsEnter(doc, 3, at(3, 10))).toBe(false);
  });

  test("anything inside a nested toggle: yes (flat `> ` insertion would break the nesting)", () => {
    expect(cleanOwnsEnter(doc, 4, doc.line(4).to)).toBe(true);
    expect(cleanOwnsEnter(doc, 4, at(4, 18))).toBe(true); // even mid-title
    expect(cleanOwnsEnter(doc, 5, doc.line(5).to)).toBe(true);
  });

  test("an empty title counts wherever the caret sits in it", () => {
    const d = textDoc("> [!question]- ****");
    expect(cleanOwnsEnter(d, 1, "> [!question]- **".length)).toBe(true);
  });
});

describe("v1.8.13 planClean — the grey 'Toggle' placeholder", () => {
  const plans = (text: string, head: number) => planClean(textDoc(text), [{ anchor: head, head }], new Map()).plans;

  test("an empty title gets one placeholder right where typing starts", () => {
    const p = plans("> [!question]- ", 15).filter((x) => x.kind === "placeholder");
    expect(p).toEqual([{ kind: "placeholder", pos: 15, key: 0 }]);
  });

  test("no placeholder once anything is typed, and none for the shortcut's `****` pair (its markers stay visible)", () => {
    expect(plans("> [!question]- P", 16).some((x) => x.kind === "placeholder")).toBe(false);
    expect(plans("> [!question]- ****", 17).some((x) => x.kind === "placeholder")).toBe(false);
  });

  test("a nested empty title shows it too, even when the caret is elsewhere in the open parent", () => {
    const text = "> [!question]+ Outer\n> > [!question]- \n> tail";
    const p = plans(text, text.length).filter((x) => x.kind === "placeholder");
    expect(p.length).toBe(1);
    expect(p[0]).toMatchObject({ pos: text.indexOf("\n> tail") });
  });
});
