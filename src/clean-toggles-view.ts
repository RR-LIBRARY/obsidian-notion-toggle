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
  isShortcutTrigger,
  nudgeCaret,
  planClean,
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
  path.setAttribute("d", "M5 3.5 L12 8 L5 12.5 Z");
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

  eq(other: ArrowWidget): boolean {
    return other.key === this.key && other.open === this.open && other.type === this.type;
  }

  toDOM(view: EditorView): HTMLElement {
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

  ignoreEvent(): boolean {
    return true;
  }
}

class MoreWidget extends WidgetType {
  constructor(readonly key: number) {
    super();
  }

  eq(other: MoreWidget): boolean {
    return other.key === this.key;
  }

  toDOM(view: EditorView): HTMLElement {
    const el = document.createElement("span");
    el.className = "ntt-clean-more";
    el.textContent = "…";
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Show toggle content");
    el.title = "Show toggle content";
    wireToggleClick(el, view, this.key, () => true);
    return el;
  }

  ignoreEvent(): boolean {
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
    const sel = view.state.selection.main;
    if (sel.head > line.to) spec.selection = EditorSelection.cursor(line.to);
  }
  view.dispatch(spec);
  view.focus();
}

/* ---------- plans → decorations ---------- */

/** Ranges (unsorted) for a list of plans — exported so tests can inspect them. */
export function decorationsFor(plans: CleanPlan[]): Range<Decoration>[] {
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
        out.push(Decoration.replace({ widget: new MoreWidget(p.key), inclusive: false }).range(p.from, p.to));
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
  return { decorations: Decoration.set(decorationsFor(result.plans), true), overrides: result.overrides };
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

  // A lone caret must never rest inside a hidden `> [!type]- ` or `> ` marker:
  // Home, a tap at the left edge or an Up/Down from column 0 would otherwise
  // type *before* the marker and quietly break the toggle.
  const keepCaretVisible = EditorState.transactionFilter.of((tr) => {
    if (!tr.selection || !host.enabled() || !livePreviewOn(host, tr.state)) return tr;
    if (tr.isUserEvent("input.type.compose") || tr.isUserEvent("select.pointer.drag")) return tr;
    const sel = tr.newSelection;
    if (sel.ranges.length !== 1 || !sel.main.empty) return tr;
    const target = nudgeCaret(tr.newDoc, sel.main.head, tr.startState.field(field, false)?.overrides ?? new Map());
    if (target === null || target === sel.main.head) return tr;
    return [tr, { selection: EditorSelection.cursor(target) }];
  });

  // `>` + space on an empty line → a toggle (Notion habit). Both paths are
  // needed: hardware keyboards arrive through the keymap, most phone keyboards
  // through the input handler.
  const shortcutFromKey = Prec.high(
    keymap.of([
      {
        key: "Space",
        run: (view) => tryShortcut(host, view),
      },
    ])
  );
  const shortcutFromInput = EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== " " || from !== to) return false;
    const line = view.state.doc.lineAt(from);
    if (!isShortcutTrigger(line.text, from - line.from)) return false;
    return tryShortcut(host, view);
  });

  return [field, keepCaretVisible, shortcutFromKey, shortcutFromInput];
}

function tryShortcut(host: CleanTogglesHost, view: EditorView): boolean {
  if (!host.shortcutEnabled()) return false;
  const sel = view.state.selection.main;
  if (!sel.empty) return false;
  const line = view.state.doc.lineAt(sel.head);
  if (!isShortcutTrigger(line.text, sel.head - line.from)) return false;
  return host.insertToggleFromShortcut(view);
}
