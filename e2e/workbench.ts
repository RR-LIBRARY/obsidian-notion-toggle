/**
 * Real-browser workbench: a CodeMirror editor running the plugin's own
 * clean-editing extension (same code main.js ships), so Playwright can drive
 * real keys, taps and layout. Built by e2e/build-workbench.mjs.
 */
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, drawSelection } from "@codemirror/view";
import { cleanTogglesExtension } from "../src/clean-toggles-view";

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
      cleanTogglesExtension({
        livePreviewField: null,
        enabled: () => true,
        shortcutEnabled: () => true,
        insertToggleFromShortcut,
        moreChip: () => chip,
      }),
      keymap.of([]),
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
