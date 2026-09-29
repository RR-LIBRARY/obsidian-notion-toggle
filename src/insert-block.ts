/**
 * v1.8.23 — writing a planned block (Toggle list / numbered toggle / MCQ /
 * Match) into the editor where Notion would put a new block.
 *
 * The pure planners in editor-blocks.ts describe *what* to write; this module
 * decides *where* (via placeNewBlock in block-move.ts) and performs the single
 * editor edit plus the caret move. It never imports Obsidian, so it is driven
 * by a tiny structural editor interface and unit-tested with a fake editor.
 */
import { insertionText, placeNewBlock } from "./block-move";
import type { NewTogglePlan } from "./editor-blocks";

export interface Pos {
  line: number;
  ch: number;
}

/** The slice of Obsidian's `Editor` this module needs (structurally typed). */
export interface BlockEditor {
  getValue(): string;
  getCursor(): Pos;
  getLine(n: number): string;
  replaceRange(text: string, from: Pos, to?: Pos): void;
  setCursor(pos: Pos): void;
}

/**
 * The line the new block lands after — auto-numbering continues from the last
 * numbered toggle above *that* line, not above the caret line (the caret may sit
 * on a title whose body holds numbered children).
 */
export function anchorLine(editor: BlockEditor, format: string): number {
  const at = editor.getCursor().line;
  if (format !== "callout") return at;
  return placeNewBlock(editor.getValue().split("\n"), at).line;
}

/**
 * Write a planned block and place the caret in its title.
 *
 * Callout format: the block goes after the whole toggle under the caret, at the
 * same depth, or becomes a child when the caret is in a toggle's body — with the
 * blank separator lines Obsidian needs (see placeNewBlock). A blank caret line
 * is taken over.
 *
 * `<details>` format keeps the classic behaviour: append right below the caret
 * line (the plan already carries the leading newline when the line has text).
 */
export function writePlannedBlock(editor: BlockEditor, plan: NewTogglePlan, format: string): void {
  const cursor = editor.getCursor();
  if (format !== "callout") {
    const cur = editor.getLine(cursor.line);
    editor.replaceRange(plan.block, { line: cursor.line, ch: cur.length });
    editor.setCursor({ line: cursor.line + plan.lineOffset, ch: plan.ch });
    return;
  }
  const lines = editor.getValue().split("\n");
  const place = placeNewBlock(lines, cursor.line);
  const block = plan.block.replace(/\n$/, "").split("\n");
  const ins = insertionText(lines, place, block);
  editor.replaceRange(ins.text, ins.from, ins.to);
  editor.setCursor({ line: ins.headerLine + plan.lineOffset, ch: ins.prefixLength + plan.ch });
}
