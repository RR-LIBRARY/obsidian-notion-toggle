/**
 * v1.8.0 — the CodeMirror side of clean editing, run against the real
 * @codemirror/state machinery (no editor DOM needed: decorations, the caret
 * filter, effects and input handlers all live in EditorState).
 */
import { describe, expect, test } from "bun:test";
import { EditorSelection, EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, keymap, type Decoration, type DecorationSet } from "@codemirror/view";
import { applyToggle, cleanTogglesExtension, decorationsFor, setToggleOpen } from "../src/clean-toggles-view";
import { findBlockAt, planClean, textDoc } from "../src/clean-toggles";
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
  flags: { enabled: boolean; shortcut: boolean };
  inserted: number;
}

function harness(doc: string, pos: number, extra: Extension[] = []): Harness {
  const h: Harness = { state: EditorState.create({ doc }), flags: { enabled: true, shortcut: true }, inserted: 0 };
  const ext = cleanTogglesExtension({
    livePreviewField: livePreview,
    enabled: () => h.flags.enabled,
    shortcutEnabled: () => h.flags.shortcut,
    insertToggleFromShortcut: () => {
      h.inserted++;
      return true;
    },
  });
  h.state = EditorState.create({ doc, selection: EditorSelection.cursor(pos), extensions: [livePreview, ext, ...extra] });
  return h;
}

interface Seen {
  from: number;
  to: number;
  cls?: string;
  widget?: string;
  open?: boolean;
}

/** Every decoration the extension currently provides, flattened. */
function seen(state: EditorState): Seen[] {
  const out: Seen[] = [];
  for (const d of state.facet(EditorView.decorations)) {
    if (typeof d === "function") continue;
    (d as DecorationSet).between(0, state.doc.length, (from, to, value: Decoration) => {
      const spec = value.spec as { class?: string; widget?: { constructor: { name: string }; open?: boolean } };
      out.push({ from, to, cls: spec.class, widget: spec.widget?.constructor.name, open: spec.widget?.open });
    });
  }
  return out;
}

const moveTo = (state: EditorState, pos: number) => state.update({ selection: EditorSelection.cursor(pos) }).state;
const line = (state: EditorState, n: number) => state.doc.line(n);

/** Minimal stand-in for the bits of EditorView the widgets touch. */
function fakeView(h: Harness) {
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

describe("v1.8.0 clean editing — decorations from the real StateField", () => {
  test("caret on the title: arrow widget replaces the prefix, body is folded behind a chip", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const d = seen(h.state);
    const arrow = d.find((x) => x.widget === "ArrowWidget")!;
    expect(NOTE.slice(arrow.from, arrow.to)).toBe("> [!question]- ");
    expect(arrow.open).toBe(false);
    const more = d.find((x) => x.widget === "MoreWidget")!;
    expect(more.from).toBe(line(h.state, 2).to);
    expect(more.to).toBe(line(h.state, 4).to);
    expect(d.some((x) => x.cls?.includes("ntt-clean-header"))).toBe(true);
  });

  test("moving the caret into the answer opens it: `> ` prefixes vanish, body lines get their class", () => {
    const h = harness(NOTE, 0);
    expect(seen(h.state)).toEqual([]); // caret on the heading: nothing to hide
    const s = moveTo(h.state, line(h.state, 3).to);
    const d = seen(s);
    expect(d.find((x) => x.widget === "ArrowWidget")?.open).toBe(true);
    expect(d.some((x) => x.widget === "MoreWidget")).toBe(false);
    const hidden = d.filter((x) => !x.cls && !x.widget && x.to > x.from);
    expect(hidden.map((x) => NOTE.slice(x.from, x.to))).toEqual(["> ", "> "]);
    expect(d.filter((x) => x.cls?.includes("ntt-clean-body")).length).toBe(2);
  });

  test("leaving the toggle removes every decoration again", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 3).to);
    expect(seen(h.state).length).toBeGreaterThan(0);
    expect(seen(moveTo(h.state, NOTE.length))).toEqual([]);
  });

  test("setting off / source mode → no decorations, and a settings flip is picked up on the next move", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    h.flags.enabled = false;
    expect(seen(moveTo(h.state, line(h.state, 3).to))).toEqual([]);
    h.flags.enabled = true;
    expect(seen(moveTo(h.state, line(h.state, 3).to)).length).toBeGreaterThan(0);
    const source = h.state.update({ effects: setLivePreview.of(false), selection: EditorSelection.cursor(line(h.state, 3).to) }).state;
    expect(seen(source)).toEqual([]);
  });

  test("the arrow's choice is an effect that survives typing (positions are mapped)", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const key = findBlockAt(textDoc(NOTE), 2)!.key;
    let s = h.state.update({ effects: setToggleOpen.of({ key, open: true }) }).state;
    expect(seen(s).find((x) => x.widget === "ArrowWidget")?.open).toBe(true);
    // Type at the end of the title — the block key is before the change, so it stays put.
    s = s.update({ changes: { from: line(s, 2).to, insert: "!" }, selection: EditorSelection.cursor(line(s, 2).to + 1) }).state;
    expect(seen(s).find((x) => x.widget === "ArrowWidget")?.open).toBe(true);
    // Insert a heading line above — the key moves with the text.
    s = s.update({ changes: { from: 0, insert: "## New\n" }, selection: EditorSelection.cursor(line(s, 2).to + 7) }).state;
    const d = seen(s);
    expect(d.find((x) => x.widget === "ArrowWidget")?.open).toBe(true);
    expect(d.some((x) => x.widget === "MoreWidget")).toBe(false);
  });

  test("decorationsFor builds one range per plan, sorted set accepts them", () => {
    const doc = textDoc(NOTE);
    const l2 = doc.line(2);
    const { plans } = planClean(doc, [{ from: l2.to, to: l2.to, head: l2.to }], new Map());
    const ranges = decorationsFor(plans);
    expect(ranges.length).toBe(plans.length);
    expect(ranges.map((r) => r.from <= r.to).every(Boolean)).toBe(true);
  });
});

describe("v1.8.0 clean editing — the caret never hides behind a marker", () => {
  test("Home on the title line lands after the hidden prefix", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const s = moveTo(h.state, line(h.state, 2).from);
    expect(s.selection.main.head).toBe(findBlockAt(textDoc(NOTE), 2)!.prefixEnd);
  });

  test("column 0 of an open body line moves past the `> `", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 3).to);
    const s = moveTo(h.state, line(h.state, 3).from);
    expect(s.selection.main.head).toBe(line(h.state, 3).from + 2);
  });

  test("a mouse drag selection is left alone (no nudging mid-drag)", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const s = h.state.update({ selection: EditorSelection.cursor(line(h.state, 2).from), userEvent: "select.pointer.drag" }).state;
    expect(s.selection.main.head).toBe(line(h.state, 2).from);
  });

  test("with the feature off the caret goes wherever it is sent", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    h.flags.enabled = false;
    const s = moveTo(h.state, line(h.state, 2).from);
    expect(s.selection.main.head).toBe(line(h.state, 2).from);
  });

  test("closing from the answer parks the caret on the title", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 3).to);
    const key = findBlockAt(textDoc(NOTE), 2)!.key;
    applyToggle(fakeView(h), key, false);
    expect(h.state.selection.main.head).toBe(line(h.state, 2).to);
    const d = seen(h.state);
    expect(d.find((x) => x.widget === "ArrowWidget")?.open).toBe(false);
    expect(d.some((x) => x.widget === "MoreWidget")).toBe(true);
  });
});

describe("v1.8.0 clean editing — arrow and chip are real buttons", () => {
  function widgetsOf(state: EditorState) {
    const found: Record<string, { toDOM(v: EditorView): HTMLElement }> = {};
    for (const d of state.facet(EditorView.decorations)) {
      if (typeof d === "function") continue;
      (d as DecorationSet).between(0, state.doc.length, (_f, _t, value: Decoration) => {
        const w = (value.spec as { widget?: { toDOM(v: EditorView): HTMLElement } }).widget;
        if (w) found[w.constructor.name] = w;
      });
    }
    return found;
  }

  test("clicking the closed arrow opens the toggle; clicking again closes it", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const view = fakeView(h);
    const arrow = widgetsOf(h.state)["ArrowWidget"].toDOM(view);
    expect(arrow.getAttribute("role")).toBe("button");
    expect(arrow.getAttribute("aria-expanded")).toBe("false");
    expect(arrow.querySelector("svg")).not.toBeNull();
    arrow.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    arrow.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(seen(h.state).find((x) => x.widget === "ArrowWidget")?.open).toBe(true);
    const openArrow = widgetsOf(h.state)["ArrowWidget"].toDOM(view);
    expect(openArrow.classList.contains("is-open")).toBe(true);
    expect(openArrow.getAttribute("aria-expanded")).toBe("true");
    openArrow.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(seen(h.state).find((x) => x.widget === "ArrowWidget")?.open).toBe(false);
  });

  test("the … chip opens the folded body", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const chip = widgetsOf(h.state)["MoreWidget"].toDOM(fakeView(h));
    expect(chip.textContent).toBe("…");
    chip.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(seen(h.state).some((x) => x.widget === "MoreWidget")).toBe(false);
  });

  test("mousedown on a widget is swallowed so the editor keeps its caret", () => {
    const h = harness(NOTE, line(EditorState.create({ doc: NOTE }), 2).to);
    const arrow = widgetsOf(h.state)["ArrowWidget"].toDOM(fakeView(h));
    const ev = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    arrow.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe("v1.8.0 clean editing — `>` + space shortcut", () => {
  function inputHandlers(state: EditorState) {
    return state.facet(EditorView.inputHandler);
  }

  test("a space typed after a lone `>` asks the host to insert a toggle", () => {
    const h = harness(">", 1);
    const handled = inputHandlers(h.state).some((f) => f(fakeView(h), 1, 1, " "));
    expect(handled).toBe(true);
    expect(h.inserted).toBe(1);
  });

  test("a space anywhere else is ordinary typing", () => {
    const h = harness("> text", 6);
    expect(inputHandlers(h.state).some((f) => f(fakeView(h), 6, 6, " "))).toBe(false);
    const h2 = harness("a>", 2);
    expect(inputHandlers(h2.state).some((f) => f(fakeView(h2), 2, 2, " "))).toBe(false);
    expect(h.inserted + h2.inserted).toBe(0);
  });

  test("the Space key binding does the same for hardware keyboards, and respects the setting", () => {
    const h = harness(">", 1);
    const space = h.state.facet(keymap).flat().find((b) => b.key === "Space")!;
    expect(space).toBeDefined();
    expect(space.run!(fakeView(h))).toBe(true);
    expect(h.inserted).toBe(1);
    h.flags.shortcut = false;
    expect(space.run!(fakeView(h))).toBe(false);
    expect(h.inserted).toBe(1);
  });
});
