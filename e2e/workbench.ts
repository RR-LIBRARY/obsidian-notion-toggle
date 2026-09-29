/**
 * Real-browser workbench: a CodeMirror editor running the plugin's own
 * clean-editing extension (same code main.js ships), so Playwright can drive
 * real keys, taps and layout. Built by e2e/build-workbench.mjs.
 */
import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { cleanTogglesExtension } from "../src/clean-toggles-view";
import { cleanOwnsEnter } from "../src/clean-toggles";
import { planEnter } from "../src/editor-blocks";
import { convertNotionPaste, onOwnLine } from "../src/notion-paste";

const params = new URLSearchParams(location.search);
const chip = params.get("chip") === "1";

export const SAMPLE = [
  "Intro line",
  "> [!question]- **Q1. Which plant was made nematode-resistant?**",
  "> **Answer:** Tobacco.",
  "> Second body line",
  "After toggle",
  "> [!question]+ Plain open title",
  "> open body",
  "",
  "> [!question]- **Q3. A very long bold title that has to wrap onto a second line on a narrow phone screen**",
  "> long body",
  "End",
].join("\n");

const doc = params.get("doc") ?? SAMPLE;
const nestedEnter = params.get("nested") !== "0";

/**
 * v1.8.13 — the same Enter order as the real plugin: main.ts's older handler
 * (`Prec.highest`, flat `> ` rules from src/editor-blocks.ts) runs first and
 * hands titles / nested toggles to the clean layer through `cleanOwnsEnter`.
 */
const legacyEnter = Prec.highest(
  keymap.of([
    {
      key: "Enter",
      run: (view) => {
        const sel = view.state.selection.main;
        if (!sel.empty) return false;
        const line = view.state.doc.lineAt(sel.head);
        if (cleanOwnsEnter(view.state.doc, line.number, sel.head)) return false;
        if (sel.head !== line.to) return false;
        const plan = planEnter(line.text, { calloutType: "question", collapsed: true, boldSummary: true, format: "callout", numbered: false });
        if (!plan) return false;
        const from = plan.from === "lineStart" ? line.from : sel.head;
        view.dispatch({ changes: { from, to: line.to, insert: plan.insert }, selection: { anchor: from + plan.cursorOffset }, userEvent: "input" });
        return true;
      },
    },
  ])
);

function insertToggleFromShortcut(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  if (line.text !== ">") return false;
  const block = "> [!question]- ****\n> ";
  view.dispatch({ changes: { from: line.from, to: line.to, insert: block }, selection: { anchor: line.from + 17 } });
  return true;
}

const view = new EditorView({
  parent: document.getElementById("editor")!,
  state: EditorState.create({
    doc,
    extensions: [
      drawSelection(),
      EditorView.lineWrapping,
      legacyEnter,
      cleanTogglesExtension({
        livePreviewField: null,
        enabled: () => true,
        shortcutEnabled: () => true,
        insertToggleFromShortcut,
        moreChip: () => chip,
        nestedEnter: () => nestedEnter,
        newToggleFold: () => "-",
      }),
      keymap.of([]),
      // Obsidian fires "editor-paste" outside CodeMirror; mirror the plugin's handler here
      // so the workbench converts Notion paste exactly like the plugin does.
      EditorView.domEventHandlers({
        paste: (evt, v) => {
          const text = evt.clipboardData?.getData("text/plain") ?? "";
          const out = convertNotionPaste(text, { calloutType: "question", collapsed: true, boldSummary: false });
          if (!out) return false;
          evt.preventDefault();
          const from = v.state.selection.main.from;
          const line = v.state.doc.lineAt(from);
          v.dispatch(v.state.replaceSelection(onOwnLine(out, line.text.slice(0, from - line.from))));
          return true;
        },
      }),
    ],
  }),
});

(window as unknown as { wb: unknown }).wb = {
  view,
  text: () => view.state.doc.toString(),
  head: () => view.state.selection.main.head,
  sel: () => ({ from: view.state.selection.main.from, to: view.state.selection.main.to }),
  set: (pos: number) => view.dispatch({ selection: { anchor: pos } }),
  lineText: (n: number) => view.state.doc.line(n).text,
  lineFrom: (n: number) => view.state.doc.line(n).from,
};
view.focus();
