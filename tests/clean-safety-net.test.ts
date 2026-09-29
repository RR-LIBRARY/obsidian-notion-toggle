/**
 * v1.8.11 safety net, finally exercised (v1.8.13): when the toggle parser
 * throws on some text it has never seen, the editor must keep working —
 *  - the update goes through and shows plain markdown (no decorations),
 *  - the typed key is not lost,
 *  - every clean-layer key handler falls back to the editor's default,
 *  - a caret move is never blocked,
 *  - and the failure is logged once, not on every keystroke.
 *
 * The parser is wrapped (not replaced): it throws only for a document that
 * carries a sentinel no real note contains, and delegates otherwise.
 */
import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { EditorSelection, EditorState, StateField } from "@codemirror/state";
import { EditorView, keymap, type DecorationSet } from "@codemirror/view";
import * as parser from "../src/clean-toggles";
import { cleanTogglesExtension } from "../src/clean-toggles-view";
import { installObsidianDom } from "./research-dom";

installObsidianDom();

const SENTINEL = "\u0000never-in-a-real-note\u0000";
type Doc = Parameters<typeof parser.planClean>[0];
const poisoned = (doc: Doc) => String(doc).includes(SENTINEL);

const realPlan = parser.planClean;
const realFind = parser.findBlockAt;
const realCaret = parser.redirectCaret;
const spies: { mockRestore(): void }[] = [];

const errors: string[] = [];
const realError = console.error;

beforeAll(() => {
  spies.push(
    spyOn(parser, "planClean").mockImplementation((doc, sel, ov) => {
      if (poisoned(doc)) throw new Error("parser slipped (test)");
      return realPlan(doc, sel, ov);
    }),
    spyOn(parser, "findBlockAt").mockImplementation((doc, line) => {
      if (poisoned(doc)) throw new Error("parser slipped (test)");
      return realFind(doc, line);
    }),
    spyOn(parser, "redirectCaret").mockImplementation((doc, move, ov) => {
      if (poisoned(doc)) throw new Error("caret guard slipped (test)");
      return realCaret(doc, move, ov);
    })
  );
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };
});

afterAll(() => {
  for (const s of spies) s.mockRestore();
  console.error = realError;
});

const livePreview = StateField.define<boolean>({ create: () => true, update: (v) => v });
const GOOD = "> [!question]- **Q1**\n> Answer.\n";
const BAD = GOOD + SENTINEL;

function make(doc: string, pos: number): EditorState {
  const ext = cleanTogglesExtension({
    livePreviewField: livePreview,
    enabled: () => true,
    shortcutEnabled: () => true,
    insertToggleFromShortcut: () => true,
    moreChip: () => false,
  });
  return EditorState.create({ doc, selection: EditorSelection.cursor(pos), extensions: [livePreview, ext] });
}

function decorationCount(state: EditorState): number {
  let n = 0;
  for (const d of state.facet(EditorView.decorations)) {
    if (typeof d === "function") continue;
    (d as DecorationSet).between(0, state.doc.length, () => {
      n++;
    });
  }
  return n;
}

describe("v1.8.11 parser safety net", () => {
  test("sanity: the wrapped parser still decorates a normal note", () => {
    expect(decorationCount(make(GOOD, 20))).toBeGreaterThan(0);
  });

  test("a parser slip shows plain markdown for that update instead of failing the transaction, and logs once", () => {
    const before = errors.length;
    const state = make(BAD, 19); // create() runs compute → throws inside → caught
    expect(decorationCount(state)).toBe(0);
    expect(errors.length).toBe(before + 1);
    expect(errors[before]).toContain("[notion-toggle] clean toggles failed");
    // the typed key is not lost on the next update either (and nothing more is logged)
    const typed = state.update({ changes: { from: 19, insert: "x" }, selection: EditorSelection.cursor(20) }).state;
    expect(typed.doc.sliceString(15, 22)).toBe("**Q1x**");
    expect(decorationCount(typed)).toBe(0);
    expect(errors.length).toBe(before + 1);
  });

  test("every parser-backed key falls back to the editor's default (returns false, changes nothing)", () => {
    let state = make(BAD, 20);
    const view = {
      get state() {
        return state;
      },
      dispatch(spec: Parameters<EditorState["update"]>[0]) {
        state = state.update(spec).state;
      },
      focus() {},
    } as unknown as EditorView;
    const bindings = state.facet(keymap).flat();
    // The block-move keys (Tab, Shift-Tab, Mod/Alt-Shift-↑/↓) scan lines on their own and keep
    // working; these eight go through the parser and must give the key back to the editor.
    const keys = ["End", "Shift-End", "ArrowRight", "Backspace", "Delete", "Mod-Enter", "Enter", "Space"];
    const seen: string[] = [];
    for (const b of bindings) {
      if (!b.key || !keys.includes(b.key) || !b.run) continue;
      seen.push(b.key);
      expect(() => b.run!(view)).not.toThrow();
      expect(b.run!(view)).toBe(false);
    }
    expect(new Set(seen).size).toBe(keys.length); // all eight keys are wired through the guard
    expect(state.doc.toString()).toBe(BAD);
    expect(state.selection.main.head).toBe(20);
    // and the block-move keys are still there, guarded the same way (they just don't need the parser)
    for (const k of ["Tab", "Shift-Tab", "Mod-Shift-ArrowUp", "Mod-Shift-ArrowDown", "Alt-Shift-ArrowUp", "Alt-Shift-ArrowDown"]) {
      expect(bindings.some((b) => b.key === k)).toBe(true);
    }
  });

  test("a caret move is never blocked when the caret guard slips", () => {
    const state = make(BAD, 20);
    const moved = state.update({ selection: EditorSelection.cursor(5) }).state;
    expect(moved.selection.main.head).toBe(5);
  });
});
