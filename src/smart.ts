/**
 * Context detection for the single "Toggle (smart add)" command — pure module.
 * One button decides what you actually meant, so the toolbar stays minimal.
 */

export type SmartAction =
  | "wrap-selection"
  | "mcq-option"
  | "match-row"
  | "answer-key"
  | "new-toggle";

export interface SmartContext {
  /** Text currently selected (may be empty). */
  selection: string;
  /** The line the cursor is on. */
  line: string;
  /** True when the cursor is inside a callout / details toggle. */
  insideToggle: boolean;
}

const MCQ_OPTION = /^>\s*-\s*\[[ xX]\]/;
const TABLE_ROW = /^>\s*\|.*\|/;
const ANSWER_LINE = /^>\s*(\*\*)?(Answer|Answers|Ans)\b/i;

/** What should the smart toggle command do here? */
export function smartAction(ctx: SmartContext): SmartAction {
  if (ctx.selection.trim().length > 0) return "wrap-selection";
  if (MCQ_OPTION.test(ctx.line)) return "mcq-option";
  if (TABLE_ROW.test(ctx.line)) return "match-row";
  if (ctx.insideToggle && ANSWER_LINE.test(ctx.line)) return "answer-key";
  return "new-toggle";
}

/** Human label used in the confirmation notice. */
export function smartActionLabel(action: SmartAction): string {
  switch (action) {
    case "wrap-selection":
      return "Selection wrapped as toggle";
    case "mcq-option":
      return "Option added";
    case "match-row":
      return "Row added";
    case "answer-key":
      return "Answer key line added";
    default:
      return "New toggle";
  }
}

/** A blank match-the-following row with the same column count as `line`. */
export function blankTableRow(line: string): string {
  const inner = line.replace(/^>\s*/, "").replace(/^\|/, "").replace(/\|\s*$/, "");
  const count = Math.max(2, inner.split("|").length);
  return `> | ${new Array(count).fill("  ").join("| ")}|`;
}

