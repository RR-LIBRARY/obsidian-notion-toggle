/**
 * v1.8.23 — src/insert-block.ts: the Toggle list / MCQ / Match buttons write
 * their block where Notion would, driven through a fake editor that mirrors
 * the slice of Obsidian's Editor the module uses.
 */
import { describe, expect, test } from "bun:test";
import { newTogglePlan, questionBlockPlan } from "../src/editor-blocks";
import { anchorLine, writePlannedBlock, type BlockEditor, type Pos } from "../src/insert-block";

class FakeEditor implements BlockEditor {
  lines: string[];
  cursor: Pos;
  constructor(text: string, cursor: Pos) {
    this.lines = text.split("\n");
    this.cursor = cursor;
  }
  getValue() {
    return this.lines.join("\n");
  }
  getCursor() {
    return this.cursor;
  }
  getLine(n: number) {
    return this.lines[n] ?? "";
  }
  replaceRange(text: string, from: Pos, to: Pos = from) {
    const doc = this.getValue();
    const off = (p: Pos) => this.lines.slice(0, p.line).reduce((a, l) => a + l.length + 1, 0) + p.ch;
    this.lines = (doc.slice(0, off(from)) + text + doc.slice(off(to))).split("\n");
  }
  setCursor(pos: Pos) {
    this.cursor = pos;
  }
}

const plainToggle = (opts: Partial<Parameters<typeof newTogglePlan>[0]> = {}) =>
  newTogglePlan({
    header: "> [!question]- ",
    format: "callout",
    lineHasText: false,
    collapsed: true,
    boldSummary: false,
    numbered: false,
    nextNumber: 1,
    ...opts,
  });

describe("writePlannedBlock — callout format (Notion placement)", () => {
  test("the video bug: Toggle list on a title lands AFTER the body, not between title and body", () => {
    const ed = new FakeEditor("> [!question]- Oxidizing agent\n> loses electrons\nNext para", { line: 0, ch: 20 });
    writePlannedBlock(ed, plainToggle(), "callout");
    expect(ed.lines).toEqual([
      "> [!question]- Oxidizing agent",
      "> loses electrons",
      "",
      "> [!question]- ",
      "> ",
      "",
      "Next para",
    ]);
    // caret sits at the end of the new title, ready to type
    expect(ed.cursor).toEqual({ line: 3, ch: "> [!question]- ".length });
  });

  test("on a body line: the new toggle nests inside, caret after the nested marker", () => {
    const ed = new FakeEditor("> [!question]- Parent\n> body", { line: 1, ch: 3 });
    writePlannedBlock(ed, plainToggle(), "callout");
    expect(ed.lines).toEqual(["> [!question]- Parent", "> body", "> > [!question]- ", "> > "]);
    expect(ed.cursor).toEqual({ line: 2, ch: "> > [!question]- ".length });
  });

  test("on an empty line the empty line becomes the toggle", () => {
    const ed = new FakeEditor("Intro\n\nOutro", { line: 1, ch: 0 });
    writePlannedBlock(ed, plainToggle(), "callout");
    expect(ed.lines).toEqual(["Intro", "> [!question]- ", "> ", "", "Outro"]);
    expect(ed.cursor).toEqual({ line: 1, ch: "> [!question]- ".length });
  });

  test("bold + numbered title keeps the caret between the number and the closing **", () => {
    const ed = new FakeEditor("> [!question]- **1. First**\n> a", { line: 0, ch: 5 });
    writePlannedBlock(ed, plainToggle({ boldSummary: true, numbered: true, nextNumber: 2 }), "callout");
    expect(ed.lines).toEqual(["> [!question]- **1. First**", "> a", "", "> [!question]- **2. **", "> "]);
    expect(ed.cursor).toEqual({ line: 3, ch: "> [!question]- **2. ".length });
  });

  test("MCQ skeleton after a toggle keeps every option line and the answer line", () => {
    const ed = new FakeEditor("> [!question]- Q1\n> - [x] a\n> - [ ] b\nAfter", { line: 0, ch: 3 });
    const plan = questionBlockPlan(
      "mcq",
      { calloutType: "question", collapsed: true, boldSummary: false, format: "callout", count: 2, addAnswerLine: true },
      false
    );
    writePlannedBlock(ed, plan, "callout");
    expect(ed.lines).toEqual([
      "> [!question]- Q1",
      "> - [x] a",
      "> - [ ] b",
      "",
      "> [!question]- ",
      "> - [ ] ",
      "> - [ ] ",
      "> ",
      "> **Answer:** ",
      "",
      "After",
    ]);
    expect(ed.cursor).toEqual({ line: 4, ch: "> [!question]- ".length });
  });

  test("Match skeleton nested in a body: its title caret lands after 'Match the following'", () => {
    const ed = new FakeEditor("> [!question]- P\n> body", { line: 1, ch: 1 });
    const plan = questionBlockPlan(
      "match",
      { calloutType: "question", collapsed: true, boldSummary: false, format: "callout", count: 2, addAnswerLine: false },
      false
    );
    writePlannedBlock(ed, plan, "callout");
    expect(ed.lines.slice(0, 4)).toEqual([
      "> [!question]- P",
      "> body",
      "> > [!question]- Match the following",
      "> > | # | Column A | Column B |",
    ]);
    expect(ed.cursor).toEqual({ line: 2, ch: "> > [!question]- Match the following".length });
  });
});

describe("writePlannedBlock — <details> format keeps the classic path", () => {
  test("appends right below the caret line, caret inside <summary>", () => {
    const ed = new FakeEditor("Intro\nNext", { line: 0, ch: 2 });
    const plan = newTogglePlan({
      header: "",
      format: "details",
      lineHasText: true,
      collapsed: true,
      boldSummary: false,
      numbered: false,
      nextNumber: 1,
    });
    writePlannedBlock(ed, plan, "details");
    expect(ed.lines.slice(0, 3)).toEqual(["Intro", "<details>", "<summary></summary>"]);
    expect(ed.cursor).toEqual({ line: 2, ch: "<summary>".length });
  });
});

describe("anchorLine — numbering continues from where the block lands", () => {
  test("caret on a parent title whose body has numbered children -> anchor is the body's last line", () => {
    const ed = new FakeEditor("> [!question]- P\n> > [!question]- 1. a\n> > [!question]- 2. b\nx", { line: 0, ch: 0 });
    expect(anchorLine(ed, "callout")).toBe(2);
    expect(anchorLine(ed, "details")).toBe(0);
  });
});
