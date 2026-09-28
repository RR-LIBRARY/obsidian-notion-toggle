/**
 * v1.8.0 — CodeMirror side of "clean editing".
 *
 * Turns the pure plans from `src/clean-toggles.ts` into decorations:
 *   - the `> [!type]- ` prefix of a toggle header becomes a clickable arrow,
 *   - `> ` prefixes of body lines are hidden and the lines get an indent class,
 *   - a closed toggle's body is replaced by a small "…" chip until opened.
 *
 * Only blocks the selection touches are decorated: Obsidian already renders the
 * others as callout widgets. Open/closed choices made with the arrow are kept in
 * a StateField and survive typing (positions are mapped through changes).
 */

import {
  EditorSelection,
  EditorState,
  Prec,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import { Decoration, EditorView, WidgetType, keymap, type DecorationSet } from "@codemirror/view";
import {
  afterTitle,
  findBlockAt,
  isOpen,
  isShortcutTrigger,
  openWithoutCaret,
  planClean,
  redirectCaret,
  type CleanPlan,
  type OverrideMap,
  type SelRange,
} from "./clean-toggles";

export interface CleanTogglesHost {
  /** Obsidian's `editorLivePreviewField` (null in tests / source-only hosts). */
  livePreviewField: StateField<boolean> | null;
  /** Setting: clean editing on? */
  enabled(): boolean;
  /** Setting: `>` + space starts a toggle? */
  shortcutEnabled(): boolean;
  /** Replace the `>` line with a fresh toggle. Returns true when handled. */
  insertToggleFromShortcut(view: EditorView): boolean;
  /** v1.8.2 setting: show a "…" chip after a closed title? (default off — Notion shows nothing). */
  moreChip?(): boolean;
  /** v1.8.7 setting: Notion-style Enter on toggles (default on). */
  autoContinue?(): boolean;
}

/** Click on the arrow / the "…" chip: remember the choice for this block. */
export const setToggleOpen = StateEffect.define<{ key: number; open: boolean }>({
  map: (v, mapping) => ({ key: mapping.mapPos(v.key, 1), open: v.open }),
});

interface CleanState {
  decorations: DecorationSet;
  overrides: Map<number, boolean>;
}

const EMPTY: CleanState = { decorations: Decoration.none, overrides: new Map() };

/* ---------- widgets ---------- */

function triangle(): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M4.5 2.5 L13 8 L4.5 13.5 Z");
  path.setAttribute("fill", "currentColor");
  svg.appendChild(path);
  return svg;
}

class ArrowWidget extends WidgetType {
  constructor(
    readonly key: number,
    readonly open: boolean,
    readonly type: string
  ) {
    super();
  }

  override eq(other: ArrowWidget): boolean {
    return other.key === this.key && other.open === this.open && other.type === this.type;
  }

  override toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = `ntt-clean-arrow${this.open ? " is-open" : ""}`;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "-1");
    el.setAttribute("aria-expanded", this.open ? "true" : "false");
    el.setAttribute("aria-label", this.open ? "Close toggle" : "Open toggle");
    el.title = this.open ? "Close toggle" : "Open toggle";
    el.appendChild(triangle());
    wireToggleClick(el, view, this.key, () => !this.open);
    return el;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

class MoreWidget extends WidgetType {
  constructor(readonly key: number) {
    super();
  }

  override eq(other: MoreWidget): boolean {
    return other.key === this.key;
  }

  override toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = "ntt-clean-more";
    el.textContent = "…";
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Show toggle content");
    el.title = "Show toggle content";
    wireToggleClick(el, view, this.key, () => true);
    return el;
  }

  override ignoreEvent(): boolean {
    return true;
  }
}

/**
 * Open / close a block from a widget. `mousedown` is swallowed so the caret and
 * focus stay where they are; the actual flip happens on click (works for taps).
 */
function wireToggleClick(el: HTMLElement, view: EditorView, key: number, nextOpen: () => boolean): void {
  el.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    applyToggle(view, key, nextOpen());
  });
}

/** Dispatch the open/closed choice; closing parks the caret on the title so it never hides inside the body. */
export function applyToggle(view: EditorView, key: number, open: boolean): void {
  const spec: TransactionSpec = { effects: setToggleOpen.of({ key, open }) };
  if (!open) {
    const line = view.state.doc.lineAt(Math.min(key, view.state.doc.length));
    const parkAt = findBlockAt(view.state.doc, line.number)?.titleTo ?? line.to;
    const sel = view.state.selection.main;
    if (sel.head > parkAt) spec.selection = EditorSelection.cursor(parkAt);
  }
  view.dispatch(spec);
  view.focus();
}

/* ---------- plans → decorations ---------- */

/** Ranges (unsorted) for a list of plans — exported so tests can inspect them. */
export function decorationsFor(plans: CleanPlan[], moreChip = true): Range<Decoration>[] {
  const out: Range<Decoration>[] = [];
  for (const p of plans) {
    switch (p.kind) {
      case "line":
        out.push(Decoration.line({ class: p.cls }).range(p.pos));
        break;
      case "arrow":
        out.push(
          Decoration.replace({
            widget: new ArrowWidget(p.key, p.open, p.type),
            inclusive: false,
          }).range(p.from, p.to)
        );
        break;
      case "hide":
        out.push(Decoration.replace({ inclusive: false }).range(p.from, p.to));
        break;
      case "fold":
        out.push(
          Decoration.replace(moreChip ? { widget: new MoreWidget(p.key), inclusive: false } : { inclusive: false }).range(p.from, p.to)
        );
        break;
    }
  }
  return out;
}

function selRanges(state: EditorState): SelRange[] {
  return state.selection.ranges.map((r) => ({ from: r.from, to: r.to, head: r.head }));
}

function livePreviewOn(host: CleanTogglesHost, state: EditorState): boolean {
  if (!host.livePreviewField) return true;
  const value = state.field(host.livePreviewField, false);
  return value !== false;
}

function compute(host: CleanTogglesHost, state: EditorState, overrides: OverrideMap): CleanState {
  if (!host.enabled() || !livePreviewOn(host, state)) return EMPTY;
  const result = planClean(state.doc, selRanges(state), overrides);
  if (result.plans.length === 0) return { decorations: Decoration.none, overrides: result.overrides };
  const chip = host.moreChip ? host.moreChip() : false;
  return { decorations: Decoration.set(decorationsFor(result.plans, chip), true), overrides: result.overrides };
}

/* ---------- the extension ---------- */

export function cleanTogglesExtension(host: CleanTogglesHost): Extension {
  const field = StateField.define<CleanState>({
    create(state) {
      return compute(host, state, new Map());
    },
    update(value, tr: Transaction) {
      let overrides = value.overrides;
      let dirty = tr.docChanged || !!tr.selection || tr.reconfigured;
      if (tr.docChanged && overrides.size) {
        const mapped = new Map<number, boolean>();
        for (const [key, open] of overrides) mapped.set(tr.changes.mapPos(key, 1), open);
        overrides = mapped;
      }
      for (const e of tr.effects) {
        if (e.is(setToggleOpen)) {
          overrides = new Map(overrides);
          overrides.set(e.value.key, e.value.open);
          dirty = true;
        }
      }
      // Live preview ↔ source switches arrive as reconfigurations; a settings
      // flip is picked up on the next selection move or keystroke.
      if (!dirty) return value;
      return compute(host, tr.state, overrides);
    },
    provide: (f) => [
      EditorView.decorations.from(f, (v) => v.decorations),
      EditorView.atomicRanges.of((view) => view.state.field(f).decorations),
    ],
  });

  // A caret must never rest inside a hidden `> [!type]- ` or `> ` marker, and
  // must not slip into the folded body of a closed toggle: Home, a tap at the
  // left edge, End / Right past the "…" chip or an Up from below would otherwise
  // type into hidden text and quietly break the toggle.
  const keepCaretVisible = EditorState.transactionFilter.of((tr) => {
    if (!tr.selection || !host.enabled() || !livePreviewOn(host, tr.state)) return tr;
    if (tr.docChanged) return tr; // typing / Enter may legitimately land in a body
    if (tr.isUserEvent("input.type.compose") || tr.isUserEvent("select.pointer.drag")) return tr;
    const sel = tr.newSelection;
    if (sel.ranges.length !== 1) return tr;
    const overrides = tr.startState.field(field, false)?.overrides ?? new Map();
    const target = redirectCaret(
      tr.newDoc,
      {
        anchor: sel.main.anchor,
        head: sel.main.head,
        prevHead: tr.startState.selection.main.head,
        pointer: tr.isUserEvent("select.pointer"),
      },
      overrides
    );
    if (target === null || target === sel.main.head) return tr;
    return [tr, { selection: EditorSelection.range(sel.main.empty ? target : sel.main.anchor, target) }];
  });

  // Keys that need to know about hidden text:
  //  - End / Shift-End on a title stop at the end of the visible title instead
  //    of jumping past the folded body or behind the hidden closing `**`,
  //  - Backspace at the very start of a title turns the toggle into plain text
  //    (prefix and bold markers go together — Notion does the same),
  //  - Delete at the end of a bold title is a no-op instead of eating the
  //    hidden `**` and leaving a stray pair in front,
  //  - Mod-Enter opens / closes the toggle under the caret (Notion's shortcut),
  //  - `>` + space on an empty line starts a toggle (Notion habit). Both paths
  //    are needed for that one: hardware keyboards arrive through the keymap,
  //    most phone keyboards through the input handler.
  const keys = Prec.high(
    keymap.of([
      { key: "End", run: (view) => endOfTitle(view, false) },
      { key: "Shift-End", run: (view) => endOfTitle(view, true) },
      { key: "ArrowRight", run: (view) => rightFromTitleEnd(view) },
      { key: "Backspace", run: (view) => backspaceAtTitleStart(view) },
      { key: "Delete", run: (view) => deleteAtTitleEnd(view) },
      { key: "Mod-Enter", run: (view) => toggleUnderCaret(view) },
      { key: "Enter", run: (view) => enterLikeNotion(view) },
      { key: "Space", run: (view) => tryShortcut(host, view) },
    ])
  );
  const shortcutFromInput = EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== " " || from !== to) return false;
    const line = view.state.doc.lineAt(from);
    if (!isShortcutTrigger(line.text, from - line.from)) return false;
    return tryShortcut(host, view);
  });

  /** The block whose header line holds `head`, or null (also null when the layer is off). */
  function blockOnHeader(view: EditorView, head: number) {
    if (!host.enabled() || !livePreviewOn(host, view.state)) return null;
    const line = view.state.doc.lineAt(head);
    const block = findBlockAt(view.state.doc, line.number);
    return block && block.headerLine === line.number ? block : null;
  }

  /**
   * v1.8.7 — Enter like Notion:
   *  - empty title            -> the toggle becomes a plain line
   *  - closed toggle title    -> a new closed toggle right after this one
   *  - open toggle title      -> a new line inside the toggle
   *  - empty last body line   -> leave the toggle (plain line)
   */
  function enterLikeNotion(view: EditorView): boolean {
    if (host.autoContinue && !host.autoContinue()) return false;
    if (!host.enabled() || !livePreviewOn(host, view.state)) return false;
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const doc = view.state.doc;
    const line = doc.lineAt(sel.head);
    const block = findBlockAt(doc, line.number);
    if (!block) return false;
    if (block.headerLine === line.number) {
      const titleText = doc.sliceString(block.titleFrom, block.titleTo).replace(/\*/g, "").trim();
      if (!titleText) {
        view.dispatch({ changes: { from: line.from, to: line.to, insert: "" }, selection: EditorSelection.cursor(line.from), userEvent: "input" });
        return true;
      }
      if (sel.head < block.titleTo) return false; // mid-title: default split
      const overrides = view.state.field(field, false)?.overrides ?? new Map();
      if (openWithoutCaret(block, overrides)) {
        view.dispatch({ changes: { from: block.headerTo, insert: "\n> " }, selection: EditorSelection.cursor(block.headerTo + 3), scrollIntoView: true, userEvent: "input" });
        return true;
      }
      const bold = block.boldWrap ? "**" : "";
      const head = `\n> [!${block.type}]- ${bold}`;
      const at = Math.max(block.bodyTo, block.headerTo);
      view.dispatch({ changes: { from: at, insert: head + bold }, selection: EditorSelection.cursor(at + head.length), scrollIntoView: true, userEvent: "input" });
      return true;
    }
    if (/^>\s*$/.test(line.text) && line.number === block.lastLine) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: "" }, selection: EditorSelection.cursor(line.from), userEvent: "input" });
      return true;
    }
    return false;
  }

  function endOfTitle(view: EditorView, extend: boolean): boolean {
    const sel = view.state.selection.main;
    const block = blockOnHeader(view, sel.head);
    if (!block) return false;
    const overrides = view.state.field(field, false)?.overrides ?? new Map();
    const foldedBody = !openWithoutCaret(block, overrides) && block.bodyTo > block.headerTo;
    if (!foldedBody && !block.boldWrap) return false; // nothing hidden after the title: default End is fine
    view.dispatch({
      selection: extend ? EditorSelection.range(sel.anchor, block.titleTo) : EditorSelection.cursor(block.titleTo),
      scrollIntoView: true,
      userEvent: "select",
    });
    return true;
  }

  /**
   * v1.8.3 — Right at the end of a title whose tail is hidden (closing `**` or a
   * folded body). Letting CodeMirror move by character here depends on DOM
   * measurement around the hidden range and sometimes leaves the caret stuck.
   */
  function rightFromTitleEnd(view: EditorView): boolean {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const block = blockOnHeader(view, sel.head);
    if (!block || sel.head !== block.titleTo) return false;
    const overrides = view.state.field(field, false)?.overrides ?? new Map();
    const folded = !openWithoutCaret(block, overrides) && block.bodyTo > block.headerTo;
    if (!folded && !block.boldWrap) return false;
    const target = afterTitle(view.state.doc, block, overrides);
    if (target === sel.head) return false;
    view.dispatch({ selection: EditorSelection.cursor(target), scrollIntoView: true, userEvent: "select" });
    return true;
  }

  function backspaceAtTitleStart(view: EditorView): boolean {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const block = blockOnHeader(view, sel.head);
    if (!block || sel.head !== block.titleFrom) return false;
    const changes = [{ from: block.headerFrom, to: block.titleFrom }];
    if (block.boldWrap) changes.push({ from: block.titleTo, to: block.headerTo });
    view.dispatch({ changes, selection: EditorSelection.cursor(block.headerFrom), userEvent: "delete" });
    return true;
  }

  function deleteAtTitleEnd(view: EditorView): boolean {
    const sel = view.state.selection.main;
    if (!sel.empty) return false;
    const block = blockOnHeader(view, sel.head);
    return !!block && block.boldWrap && sel.head === block.titleTo;
  }

  function toggleUnderCaret(view: EditorView): boolean {
    if (!host.enabled() || !livePreviewOn(host, view.state)) return false;
    const sel = view.state.selection.main;
    const block = findBlockAt(view.state.doc, view.state.doc.lineAt(sel.head).number);
    if (!block) return false;
    const overrides = view.state.field(field, false)?.overrides ?? new Map();
    const open = isOpen(block, [{ from: sel.from, to: sel.to, head: sel.head }], overrides);
    applyToggle(view, block.key, !open);
    return true;
  }

  return [field, keepCaretVisible, keys, shortcutFromInput];
}

function tryShortcut(host: CleanTogglesHost, view: EditorView): boolean {
  if (!host.shortcutEnabled()) return false;
  const sel = view.state.selection.main;
  if (!sel.empty) return false;
  const line = view.state.doc.lineAt(sel.head);
  if (!isShortcutTrigger(line.text, sel.head - line.from)) return false;
  return host.insertToggleFromShortcut(view);
}
