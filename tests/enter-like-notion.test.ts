/**
 * v1.8.13 — Enter like the Notion app, pressed through the real CodeMirror
 * keymap (EditorState only, no DOM), including the production order of the two
 * Enter handlers: main.ts's older `Prec.highest` one in front of the clean layer.
 */
import { describe, expect, test } from "bun:test";
import { EditorSelection, EditorState, Prec, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, keymap, type Decoration, type DecorationSet } from "@codemirror/view";
import { cleanTogglesExtension, setToggleOpen } from "../src/clean-toggles-view";
import { cleanOwnsEnter } from "../src/clean-toggles";
import { planEnter } from "../src/editor-blocks";
import { installObsidianDom } from "./research-dom";

installObsidianDom();

const NOTE = ["# Bio", "> [!question]- **Q7. Plant?**", "> **Answer:** Tobacco.", "> More.", "", "Plain."].join("\n");

const setLivePreview = StateEffect.define<boolean>();
const livePreview = StateField.define<boolean>({
  create: () => true,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setLivePreview)) return e.value;
    return value;
  },
});

interface Harness {
  state: EditorState;
  flags: { enabled: boolean; fold: "+" | "-" };
}

function harness(doc: string, pos: number, extra: Extension[] = []): Harness {
  const h: Harness = { state: EditorState.create({ doc }), flags: { enabled: true, fold: "-" } };
  const ext = cleanTogglesExtension({
    livePreviewField: livePreview,
    enabled: () => h.flags.enabled,
    shortcutEnabled: () => true,
    insertToggleFromShortcut: () => true,
    moreChip: () => true,
    newToggleFold: () => h.flags.fold,
  });
  h.state = EditorState.create({ doc, selection: EditorSelection.cursor(pos), extensions: [livePreview, ext, ...extra] });
  return h;
}

function fakeView(h: Harness): EditorView {
  return {
    get state() {
      return h.state;
    },
    dispatch(spec: Parameters<EditorState["update"]>[0]) {
      h.state = h.state.update(spec).state;
    },
    focus() {},
  } as unknown as EditorView;
}

/** Widgets currently shown, in document order: [name, open?] */
function widgets(state: EditorState): { name: string; open?: boolean; from: number }[] {
  const out: { name: string; open?: boolean; from: number }[] = [];
  for (const d of state.facet(EditorView.decorations)) {
    if (typeof d === "function") continue;
    (d as DecorationSet).between(0, state.doc.length, (from, _to, value: Decoration) => {
      const w = (value.spec as { widget?: { constructor: { name: string }; open?: boolean } }).widget;
      if (w) out.push({ name: w.constructor.name, open: w.open, from });
    });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Press a key the way CodeMirror does: every binding in precedence order until one handles it. */
function press(h: Harness, key: string): boolean {
  for (const b of h.state.facet(keymap).flat()) {
    if (b.key === key && b.run && b.run(fakeView(h))) return true;
  }
  return false;
}

const moveTo = (h: Harness, pos: number) => {
  h.state = h.state.update({ selection: EditorSelection.cursor(pos) }).state;
};
const caretLine = (h: Harness) => h.state.doc.lineAt(h.state.selection.main.head);
const doc = (h: Harness) => h.state.doc.toString();

/**
 * Stand-in for main.ts's `Prec.highest` Enter handler: the same hand-off
 * question in front of the same pure planner (`planEnter`), so these tests
 * exercise the real production order of the two handlers.
 */
function legacyEnter(ref: { h?: Harness }): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: "Enter",
        run: (view) => {
          const sel = view.state.selection.main;
          const line = view.state.doc.lineAt(sel.head);
          const cleanOn = ref.h?.flags.enabled ?? true; // main.ts checks the "Clean editing" setting first
          if (cleanOn && cleanOwnsEnter(view.state.doc, line.number, sel.head)) return false;
          if (sel.head !== line.to) return false;
          const plan = planEnter(line.text, { calloutType: "question", collapsed: true, boldSummary: false, format: "callout", numbered: false });
          if (!plan) return false;
          const from = plan.from === "lineStart" ? line.from : sel.head;
          view.dispatch({ changes: { from, to: line.to, insert: plan.insert }, selection: { anchor: from + plan.cursorOffset } });
          return true;
        },
      },
    ])
  );
}

/** A harness with main.ts's older Enter handler in front of the clean layer (production order). */
function withLegacy(text: string, pos: number): Harness {
  const ref: { h?: Harness } = {};
  const h = harness(text, pos, [legacyEnter(ref)]);
  ref.h = h;
  return h;
}

describe("v1.8.13 Enter like the Notion app — through the real keymap", () => {
  test("Enter at the end of a title: a new sibling waits at the same depth", () => {
    const h = harness("> [!question]- Plants\n\nAfter", "> [!question]- Plants".length);
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h)).toBe("> [!question]- Plants\n\n> [!question]- \n\nAfter");
    expect(caretLine(h).number).toBe(3);
    expect(h.state.selection.main.head).toBe(caretLine(h).to);
    const w = widgets(h.state);
    expect(w.filter((x) => x.name === "ArrowWidget").map((a) => a.open)).toEqual([false]);
    expect(w.some((x) => x.name === "PlaceholderWidget")).toBe(false); // 1.8.21: hint is a line class (IME-safe), never an inline widget
    expect(w.some((x) => x.name === "MoreWidget")).toBe(false);
  });

  test("typing into the new title removes the placeholder; Enter makes another sibling", () => {
    const h = harness("> [!question]- Plants", 21);
    press(h, "Enter");
    const at = h.state.selection.main.head;
    h.state = h.state.update({ changes: { from: at, insert: "Leaves" }, selection: EditorSelection.cursor(at + 6) }).state;
    expect(widgets(h.state).some((x) => x.name === "PlaceholderWidget")).toBe(false);
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h).split("\n")).toEqual(["> [!question]- Plants", "", "> [!question]- Leaves", "", "> [!question]- "]);
    expect(widgets(h.state).filter((x) => x.name === "ArrowWidget").map((a) => a.open)).toEqual([false]);
  });

  test("Enter on an empty new title removes that toggle and leaves a plain top-level line", () => {
    const h = harness("> [!question]- Plants", 21);
    press(h, "Enter");
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h)).toBe("> [!question]- Plants\n\n");
    expect(caretLine(h).number).toBe(3);
  });

  test("'start open' setting: the toggles Enter makes carry `+`", () => {
    const h = harness("> [!question]+ Plants", 21);
    h.flags.fold = "+";
    press(h, "Enter");
    expect(doc(h)).toBe("> [!question]+ Plants\n\n> [!question]+ ");
  });

  test("a closed toggle that already has an answer: Enter on its title starts the next toggle after it", () => {
    const h = harness(NOTE, EditorState.create({ doc: NOTE }).doc.line(2).from + 18);
    press(h, "End");
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h).split("\n")).toEqual([
      "# Bio",
      "> [!question]- **Q7. Plant?**",
      "> **Answer:** Tobacco.",
      "> More.",
      "",
      "> [!question]- ****",
      "",
      "Plain.",
    ]);
    expect(caretLine(h).number).toBe(6);
    expect(h.state.selection.main.head).toBe(caretLine(h).to - 2); // caret between the `**` pair
  });

  test("mid-title Enter is left to the editor (default split)", () => {
    const h = harness("> [!question]- Plants", 18);
    expect(press(h, "Enter")).toBe(false);
    expect(doc(h)).toBe("> [!question]- Plants");
  });

  test("with the older main.ts Enter handler in front (production order) the video flow still wins on titles", () => {
    const h = withLegacy("> [!question]- Plants\n> answer\n", 21);
    h.state = h.state.update({ effects: setToggleOpen.of({ key: 0, open: true }) }).state;
    // title: the older handler steps aside, the clean layer creates a sibling after the block
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h)).toBe("> [!question]- Plants\n> answer\n\n> [!question]- \n");
    // a top-level body line with text: still the older handler's `> ` continuation (MCQ / answer rules live there)
    moveTo(h, h.state.doc.line(2).to);
    expect(press(h, "Enter")).toBe(true);
    expect(h.state.doc.line(3).text).toBe("> ");
  });

  test("inside a nested toggle the older handler steps aside; a body line with text is left to the editor", () => {
    // both toggles open (`+`), otherwise the caret guard would park the caret on the closed inner title
    const h = withLegacy("> [!question]+ Plants\n> > [!question]+ In\n> > deep\n> answer", 0);
    moveTo(h, h.state.doc.line(3).to);
    expect(caretLine(h).number).toBe(3);
    const before = doc(h);
    expect(press(h, "Enter")).toBe(false); // nobody rewrites the line: Obsidian's own `>` continuation runs
    expect(doc(h)).toBe(before);
  });

  test("clean editing off: the older handler owns the title again (flat `> ` line)", () => {
    const h = withLegacy("> [!question]- Plants", 21);
    h.flags.enabled = false;
    expect(press(h, "Enter")).toBe(true);
    expect(doc(h)).toBe("> [!question]- Plants\n> ");
  });
});
