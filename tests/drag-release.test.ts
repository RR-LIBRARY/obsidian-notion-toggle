/**
 * v1.8.11 unload hygiene, finally exercised (v1.8.13): the press-and-drag
 * handle lives on a module-level host. Installing the extension arms it,
 * `releaseCleanToggles()` (called from the plugin's onunload) disarms it, so a
 * disabled plugin never starts a drag or touches the document again.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { EditorSelection, EditorState, StateField } from "@codemirror/state";
import { EditorView, type Decoration, type DecorationSet, type WidgetType } from "@codemirror/view";
import { cleanTogglesExtension, releaseCleanToggles } from "../src/clean-toggles-view";
import { installObsidianDom } from "./research-dom";

installObsidianDom();

const NOTE = "> [!question]- **Q7. Plant?**\n> **Answer:** Tobacco.\n";
const livePreview = StateField.define<boolean>({ create: () => true, update: (v) => v });
const host = {
  livePreviewField: livePreview,
  enabled: () => true,
  shortcutEnabled: () => true,
  insertToggleFromShortcut: () => true,
  moreChip: () => false,
  blockMoves: () => true,
};

/** Arm the drag host and return a fake view plus the arrow element of the first toggle. */
function arm(): { view: EditorView; arrow: HTMLElement } {
  const ext = cleanTogglesExtension(host);
  let state = EditorState.create({ doc: NOTE, selection: EditorSelection.cursor(20), extensions: [livePreview, ext] });
  const dom = document.createElement("div");
  const view = {
    get state() {
      return state;
    },
    dispatch(spec: Parameters<EditorState["update"]>[0]) {
      state = state.update(spec).state;
    },
    focus() {},
    dom,
  } as unknown as EditorView;
  let widget: WidgetType | null = null;
  for (const d of state.facet(EditorView.decorations)) {
    if (typeof d === "function") continue;
    (d as DecorationSet).between(0, state.doc.length, (_f, _t, value: Decoration) => {
      const w = (value.spec as { widget?: WidgetType }).widget;
      if (w && w.constructor.name === "ArrowWidget") widget = w;
    });
  }
  if (!widget) throw new Error("no arrow widget");
  const arrow = (widget as WidgetType).toDOM(view);
  document.body.appendChild(arrow);
  return { view, arrow };
}

const hold = () => new Promise((r) => setTimeout(r, 480)); // > 450 ms mouse hold, > 400 ms touch hold
const pointer = (type: string, target: EventTarget) =>
  target.dispatchEvent(new MouseEvent(type, { button: 0, clientX: 12, clientY: 12, bubbles: true, cancelable: true }));
const dragging = () => document.body.classList.contains("ntt-no-select") || document.querySelector(".ntt-drag-ghost") !== null;

afterEach(() => {
  pointer("pointerup", window); // whatever a test left behind, end it
  document.body.innerHTML = "";
  cleanTogglesExtension(host); // leave the host armed for the other test files
});

describe("v1.8.11 drag host release on unload", () => {
  test("armed: holding the arrow starts a drag (ghost + no-select), letting go ends it", async () => {
    const { view, arrow } = arm();
    pointer("pointerdown", arrow);
    await hold();
    expect(dragging()).toBe(true);
    expect(view.dom.classList.contains("ntt-dragging")).toBe(true);
    pointer("pointerup", window);
    expect(dragging()).toBe(false);
    expect(view.dom.classList.contains("ntt-dragging")).toBe(false);
  });

  test("after releaseCleanToggles() the same hold does nothing at all", async () => {
    const { view, arrow } = arm();
    releaseCleanToggles();
    pointer("pointerdown", arrow);
    await hold();
    expect(dragging()).toBe(false);
    expect(view.dom.classList.contains("ntt-dragging")).toBe(false);
    expect(view.state.doc.toString()).toBe(NOTE);
  });

  test("re-installing the extension arms it again (plugin re-enabled)", async () => {
    releaseCleanToggles();
    const { arrow } = arm(); // arm() installs the extension → host set again
    pointer("pointerdown", arrow);
    await hold();
    expect(dragging()).toBe(true);
  });
});
