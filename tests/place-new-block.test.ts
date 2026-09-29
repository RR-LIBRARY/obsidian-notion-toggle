/**
 * v1.8.23 — where the Toggle list / MCQ / Match buttons put a new block
 * (src/block-move.ts: placeNewBlock / prefixBlock / insertionText).
 *
 * Bug this guards: pressing "Toggle list" while the caret sat on a toggle's
 * title appended the new toggle right after the title line — between title and
 * body, with no blank line — so Obsidian rendered both as one callout and the
 * new toggle looked as if it had "moved inside" the old one.
 */
import { describe, expect, test } from "bun:test";
import { insertionText, placeNewBlock, prefixBlock } from "../src/block-move";

const TOGGLE = ["> [!q]- ", "> "];

function apply(lines: string[], n: number, block: string[] = TOGGLE): { out: string[]; headerLine: number } {
  const place = placeNewBlock(lines, n);
  const ins = insertionText(lines, place, block);
  const doc = lines.join("\n");
  const off = (p: { line: number; ch: number }) => lines.slice(0, p.line).reduce((a, l) => a + l.length + 1, 0) + p.ch;
  const text = doc.slice(0, off(ins.from)) + ins.text + doc.slice(off(ins.to));
  return { out: text.split("\n"), headerLine: ins.headerLine };
}

describe("placeNewBlock — after the whole block, same level", () => {
  test("on a toggle title: after title AND body, with a blank line between", () => {
    const L = ["> [!q]- Oxidizing agent", "> body line", "> more body", "After"];
    const r = apply(L, 0);
    expect(r.out).toEqual(["> [!q]- Oxidizing agent", "> body line", "> more body", "", "> [!q]- ", "> ", "", "After"]);
    expect(r.out[r.headerLine]).toBe("> [!q]- ");
  });

  test("on a toggle with nested toggles: the whole family is skipped", () => {
    const L = ["> [!q]- Parent", "> > [!q]- Child", "> > child body", "> tail"];
    const r = apply(L, 0);
    expect(r.out).toEqual(["> [!q]- Parent", "> > [!q]- Child", "> > child body", "> tail", "", "> [!q]- ", "> "]);
  });

  test("on a nested toggle's title: a nested sibling, still inside the parent", () => {
    const L = ["> [!q]- Parent", "> > [!q]- Child", "> > child body", "After"];
    const r = apply(L, 1);
    expect(r.out).toEqual(["> [!q]- Parent", "> > [!q]- Child", "> > child body", ">", "> > [!q]- ", "> > ", "", "After"]);
    expect(r.headerLine).toBe(4);
  });

  test("on a body line inside a toggle: a child toggle after that line", () => {
    const L = ["> [!q]- Parent", "> first", "> second"];
    const r = apply(L, 1);
    expect(r.out).toEqual(["> [!q]- Parent", "> first", "> > [!q]- ", "> > ", ">", "> second"]);
    expect(placeNewBlock(L, 1)).toMatchObject({ mode: "after", line: 1, cd: 1 });
  });

  test("on a plain line: directly after it (a callout may follow a paragraph), blank line before the next plain line", () => {
    const L = ["Intro", "Next"];
    expect(apply(L, 0).out).toEqual(["Intro", "> [!q]- ", "> ", "", "Next"]);
  });

  test("on an empty line: the empty line becomes the toggle (Notion turns the empty block into one)", () => {
    const L = ["Intro", "", "Next"];
    const r = apply(L, 1);
    expect(r.out).toEqual(["Intro", "> [!q]- ", "> ", "", "Next"]);
    expect(r.headerLine).toBe(1);
  });

  test("on the blank line between two toggles: both neighbours stay separated", () => {
    const L = ["> [!q]- A", "> a", "", "> [!q]- B"];
    expect(apply(L, 2).out).toEqual(["> [!q]- A", "> a", "", "> [!q]- ", "> ", "", "> [!q]- B"]);
  });

  test("on an empty `>` body line: a child toggle takes that line over", () => {
    const L = ["> [!q]- Parent", ">", "> tail"];
    expect(apply(L, 1).out).toEqual(["> [!q]- Parent", "> > [!q]- ", "> > ", ">", "> tail"]);
  });

  test("at the very end of the note: no trailing separator", () => {
    const L = ["> [!q]- Last", "> body"];
    expect(apply(L, 0).out).toEqual(["> [!q]- Last", "> body", "", "> [!q]- ", "> "]);
  });

  test("a title-only toggle (no body yet) still gets a same-level sibling after it", () => {
    const L = ["> [!q]- what is my name", "After"];
    expect(apply(L, 0).out).toEqual(["> [!q]- what is my name", "", "> [!q]- ", "> ", "", "After"]);
  });

  test("MCQ skeleton nests with every line re-prefixed", () => {
    const mcq = ["> [!q]- ", "> - [ ] ", "> - [ ] ", "> ", "> **Answer:** "];
    const L = ["> [!q]- Parent", "> body"];
    expect(apply(L, 1, mcq).out).toEqual([
      "> [!q]- Parent",
      "> body",
      "> > [!q]- ",
      "> > - [ ] ",
      "> > - [ ] ",
      "> > ",
      "> > **Answer:** ",
    ]);
  });

  test("caret past the end of the note is clamped", () => {
    expect(placeNewBlock(["only"], 9)).toMatchObject({ mode: "after", line: 0, cd: 0 });
    expect(placeNewBlock([], 0)).toMatchObject({ mode: "replace", line: 0, cd: 0 });
  });
});

describe("prefixBlock / insertionText", () => {
  test("prefixBlock adds one marker per depth and turns blank lines into `>` lines", () => {
    expect(prefixBlock(["> [!q]- T", "> a", ""], 2)).toEqual(["> > > [!q]- T", "> > > a", "> >"]);
    expect(prefixBlock(["x"], 0)).toEqual(["x"]);
  });

  test("insertionText reports the header line and the prefix length for caret placement", () => {
    const L = ["> [!q]- Parent", "> body"];
    const ins = insertionText(L, placeNewBlock(L, 1), TOGGLE);
    expect(ins.from).toEqual({ line: 1, ch: "> body".length });
    expect(ins.text).toBe("\n> > [!q]- \n> > ");
    expect(ins.headerLine).toBe(2);
    expect(ins.prefixLength).toBe(2);
  });
});
