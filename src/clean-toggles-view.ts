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
  emptyTitle,
  findBlockAt,
  isOpen,
  isShortcutTrigger,
  openWithoutCaret,
  planClean,
  planTitleEnter,
  redirectCaret,
  type CleanPlan,
  type OverrideMap,
  type SelRange,
  blankAt,
  markerDepth,
  markerEnd,
} from "./clean-toggles";
import { dropUnit, indentUnit, moveUnit, outdentUnit, unitAt, type DropMode, type MoveResult } from "./block-move";

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
  /** v1.8.9 setting: Tab / Shift+Tab / drag rearrange blocks and shove them into toggles (default on). */
  blockMoves?(): boolean;
  /** v1.8.13 setting: Enter at the end of a title opens the toggle with a new toggle inside (default on; off = a plain line inside). */
  nestedEnter?(): boolean;
  /** v1.8.13: fold marker for toggles made by Enter (`-` unless the "start open" setting is on). */
  newToggleFold?(): "+" | "-";
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
  path.setAttribute("d", "M4.4 1.6 L14.6 8 L4.4 14.4 Z");
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
    // v1.8.9 — the arrow doubles as Notion's drag handle
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || !dragHost || !dragAllowed(dragHost, view)) return;
      const line = view.state.doc.lineAt(Math.min(this.key, view.state.doc.length)).number - 1;
      startDrag(view, e, line, true);
    });
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

/** v1.8.13 — grey "Toggle" hint on an empty title, like Notion's placeholder. Not a target: taps go to the editor. */
class PlaceholderWidget extends WidgetType {
  constructor(readonly key: number) {
    super();
  }

  override eq(other: PlaceholderWidget): boolean {
    return other.key === this.key;
  }

  override toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "ntt-clean-placeholder";
    el.textContent = "Toggle";
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  override ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Open / close a block from a widget. `mousedown` is swallowed so the caret and
 * focus stay where they are; the actual flip happens on click (works for taps).
 */
function wireToggleClick(el: HTMLElement, view: EditorView, key: number, nextOpen: () => boolean): void {
  // v1.8.12 — touch: flip on a clean tap (pointerup) instead of trusting the
  // synthetic click, which mobile WebViews drop or delay after preventDefault.
  let tap: { x: number; y: number; t: number; id: number } | null = null;
  let flippedAt = 0;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    tap = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
  });
  el.addEventListener("pointerup", (e) => {
    const t = tap;
    tap = null;
    if (!t || e.pointerId !== t.id || e.pointerType === "mouse") return;
    if (isTapOnToggle(t, e.clientX, e.clientY, Date.now(), lastDragEnd)) {
      e.preventDefault();
      e.stopPropagation();
      flippedAt = Date.now();
      applyToggle(view, key, nextOpen());
    }
  });
  el.addEventListener("pointercancel", () => { tap = null; });
  el.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (Date.now() - flippedAt < 700) return; // already flipped by the tap
    applyToggle(view, key, nextOpen());
  });
}

/** Time the last drag ended; a tap right after a drag is not a toggle. */
let lastDragEnd = 0;

/** A finger tap that should open / close: short, barely moved, not the end of a drag. */
export function isTapOnToggle(
  down: { x: number; y: number; t: number },
  x: number, y: number, now: number, dragEnd: number,
): boolean {
  if (now - dragEnd < 350) return false;
  if (now - down.t > 600) return false;
  return Math.hypot(x - down.x, y - down.y) <= 12;
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
      case "placeholder":
        out.push(Decoration.widget({ widget: new PlaceholderWidget(p.key), side: 1 }).range(p.pos));
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
  // v1.8.11 — a parser slip must never break the editor: CodeMirror would
  // reject the whole transaction (the typed key is lost, on every keystroke).
  // Show the raw markdown for this update instead and log once.
  try {
    const result = planClean(state.doc, selRanges(state), overrides);
    if (result.plans.length === 0) return { decorations: Decoration.none, overrides: result.overrides };
    const chip = host.moreChip ? host.moreChip() : false;
    return { decorations: Decoration.set(decorationsFor(result.plans, chip), true), overrides: result.overrides };
  } catch (err) {
    reportOnce("clean toggles", err);
    return { decorations: Decoration.none, overrides: new Map(overrides) };
  }
}

let reported = false;
function reportOnce(where: string, err: unknown): void {
  if (reported) return;
  reported = true;
  console.error(`[notion-toggle] ${where} failed — showing plain markdown for this edit`, err);
}

/** Run a key handler; on an unexpected error fall back to the editor's default key (never swallow the key). */
function guard(run: () => boolean): boolean {
  try {
    return run();
  } catch (err) {
    reportOnce("key handler", err);
    return false;
  }
}

/* ---------- the extension ---------- */

let dragHost: CleanTogglesHost | null = null;
function dragAllowed(host: CleanTogglesHost, view: EditorView): boolean {
  return host.enabled() && livePreviewOn(host, view.state) && (!host.blockMoves || host.blockMoves());
}

/** Forget the plugin instance when it unloads, so a disabled plugin holds no editor state. */
export function releaseCleanToggles(): void {
  dragHost = null;
}

export function cleanTogglesExtension(host: CleanTogglesHost): Extension {
  dragHost = host;
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
    let target: number | null;
    try {
      target = redirectCaret(
        tr.newDoc,
        {
          anchor: sel.main.anchor,
          head: sel.main.head,
          prevHead: tr.startState.selection.main.head,
          pointer: tr.isUserEvent("select.pointer"),
        },
        overrides
      );
    } catch (err) {
      reportOnce("caret guard", err);
      return tr; // never block a selection change
    }
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
      { key: "End", run: (view) => guard(() => endOfTitle(view, false)) },
      { key: "Shift-End", run: (view) => guard(() => endOfTitle(view, true)) },
      { key: "ArrowRight", run: (view) => guard(() => rightFromTitleEnd(view)) },
      { key: "Backspace", run: (view) => guard(() => backspaceAtTitleStart(view)) },
      { key: "Delete", run: (view) => guard(() => deleteAtTitleEnd(view)) },
      { key: "Mod-Enter", run: (view) => guard(() => toggleUnderCaret(view)) },
      { key: "Enter", run: (view) => guard(() => enterLikeNotion(view)) },
      { key: "Space", run: (view) => guard(() => tryShortcut(host, view)) },
      { key: "Tab", run: (view) => guard(() => moveKey(view, "in")) },
      { key: "Shift-Tab", run: (view) => guard(() => moveKey(view, "out")) },
      { key: "Mod-Shift-ArrowUp", run: (view) => guard(() => moveKey(view, "up")) },
      { key: "Mod-Shift-ArrowDown", run: (view) => guard(() => moveKey(view, "down")) },
      { key: "Alt-Shift-ArrowUp", run: (view) => guard(() => moveKey(view, "up")) },
      { key: "Alt-Shift-ArrowDown", run: (view) => guard(() => moveKey(view, "down")) },
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
   * v1.8.7 / v1.8.13 — Enter like Notion (the phone app, frame by frame):
   *  - empty title            -> the toggle becomes a plain line (inside its parent when nested)
   *  - closed title with body -> a new closed toggle right after this one
   *  - title of an open or still-empty toggle -> it opens, caret on a new
   *    nested toggle inside (setting on) or a plain line inside (setting off)
   *  - empty last body line   -> leave the toggle (plain line one level up)
   * Body lines with text are left to the editor's own Enter (Obsidian keeps
   * the `>` markers and list bullets going by itself).
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
      if (sel.head < block.titleTo && !emptyTitle(doc, block)) return false; // mid-title: default split
      const overrides = view.state.field(field, false)?.overrides ?? new Map();
      const plan = planTitleEnter(doc, block, openWithoutCaret(block, overrides), {
        nested: host.nestedEnter ? host.nestedEnter() : true,
        fold: host.newToggleFold ? host.newToggleFold() : "-",
      });
      view.dispatch({
        changes: { from: plan.from, to: plan.to, insert: plan.insert },
        selection: EditorSelection.cursor(plan.caret),
        effects: plan.openKey === undefined ? [] : [setToggleOpen.of({ key: plan.openKey, open: true })],
        scrollIntoView: true,
        userEvent: "input",
      });
      return true;
    }
    const cut = markerEnd(line.text, block.depth);
    if (markerDepth(line.text) === block.depth && cut >= 0 && line.text.slice(cut).trim() === "" && line.number === block.lastLine) {
      const out = blankAt(block.depth - 1);
      view.dispatch({ changes: { from: line.from, to: line.to, insert: out }, selection: EditorSelection.cursor(line.from + out.length), userEvent: "input" });
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
    const keep = markerEnd(view.state.doc.sliceString(block.headerFrom, block.headerTo), block.depth - 1);
    const changes = [{ from: block.headerFrom + Math.max(0, keep), to: block.titleFrom }];
    if (block.boldWrap) changes.push({ from: block.titleTo, to: block.headerTo });
    view.dispatch({ changes, selection: EditorSelection.cursor(block.headerFrom + Math.max(0, keep)), userEvent: "delete" });
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

  function moveKey(view: EditorView, how: MoveHow): boolean {
    if (!host.enabled() || !livePreviewOn(host, view.state)) return false;
    if (host.blockMoves && !host.blockMoves()) return false;
    const sel = view.state.selection.main;
    if (!sel.empty && view.state.doc.lineAt(sel.from).number !== view.state.doc.lineAt(sel.to).number) return false;
    // v1.8.11 — Tab / Shift+Tab on indented text (a nested list item, a
    // continuation line) is Obsidian's own indent / outdent, not a block move:
    // Shift+Tab on `>   - sub` used to rip the item out of its toggle.
    if (how === "in" || how === "out") {
      const text = view.state.doc.lineAt(sel.head).text;
      const cut = markerEnd(text, markerDepth(text));
      if (/^[ \t]/.test(cut >= 0 ? text.slice(cut) : text)) return false;
    }
    return runBlockMove(view, how);
  }

  return [field, keepCaretVisible, keys, shortcutFromInput, blockDrag(host, field)];
}

/* ---------- v1.8.9: rearrange + shove into toggle ---------- */

export type MoveHow = "up" | "down" | "in" | "out";

/** Replace the doc with a move result; keep the caret on the same text; open the toggle shoved into. */
export function applyMove(view: EditorView, before: { line: number; col: number; unitStart: number; oldCd: number }, r: MoveResult): void {
  const doc = view.state.doc;
  const text = r.lines.join("\n");
  const old = doc.toString();
  // Smallest changed span keeps undo history tidy.
  let a = 0;
  while (a < old.length && a < text.length && old[a] === text[a]) a++;
  let b = 0;
  while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) b++;
  const offsetLine = r.at + (before.line - before.unitStart);
  let pos = 0;
  for (let i = 0; i < offsetLine && i < r.lines.length; i++) pos += (r.lines[i] ?? "").length + 1;
  const lineText = r.lines[offsetLine] ?? "";
  const col = Math.max(markerEnd(lineText, r.cd) < 0 ? 0 : markerEnd(lineText, r.cd), before.col + (markerEnd(lineText, r.cd) - Math.max(0, before.oldCd)));
  pos += Math.min(lineText.length, Math.max(0, col));
  const effects = [];
  if (r.openHeader >= 0) {
    let hp = 0;
    for (let i = 0; i < r.openHeader; i++) hp += (r.lines[i] ?? "").length + 1;
    effects.push(setToggleOpen.of({ key: hp, open: true }));
  }
  view.dispatch({
    changes: { from: a, to: old.length - b, insert: text.slice(a, text.length - b) },
    selection: EditorSelection.cursor(pos),
    effects,
    scrollIntoView: true,
    userEvent: "move",
  });
}

/** Move the block under the caret. Returns false when there is nothing to do (the key falls through). */
export function runBlockMove(view: EditorView, how: MoveHow): boolean {
  const doc = view.state.doc;
  const head = view.state.selection.main.head;
  const line = doc.lineAt(head);
  const lines = doc.toString().split("\n");
  const n = line.number - 1;
  const r = how === "up" ? moveUnit(lines, n, -1) : how === "down" ? moveUnit(lines, n, 1) : how === "in" ? indentUnit(lines, n) : outdentUnit(lines, n);
  if (!r) return false;
  const unit = unitStartAndCd(lines, n);
  // prefix length before the move (column within visible text is preserved)
  const oldPrefix = markerEnd(line.text, unit.cd);
  applyMove(view, { line: n, col: head - line.from, unitStart: unit.start, oldCd: Math.max(0, oldPrefix) }, r);
  return true;
}

function unitStartAndCd(lines: string[], n: number): { start: number; cd: number } {
  const u = unitAt(lines, n);
  return { start: u?.start ?? n, cd: u?.cd ?? 0 };
}

/**
 * Drag a block like Notion: press and hold a line (touch or mouse, ~0.4 s) or
 * drag a toggle's arrow straight away. A blue line shows where it will land;
 * hovering the middle of a toggle highlights it, and letting go there shoves the
 * block inside that toggle.
 */
function blockDrag(host: CleanTogglesHost, _field: StateField<CleanState>): Extension {
  return EditorView.domEventHandlers({
    pointerdown(e, view) {
      if (!dragAllowed(host, view) || e.button !== 0) return false;
      const onArrow = false;
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return false;
      startDrag(view, e, view.state.doc.lineAt(pos).number - 1, onArrow);
      return false;
    },
  });
}

function startDrag(view: EditorView, down: PointerEvent, srcLine: number, onArrow: boolean): void {
  const x0 = down.clientX;
  const y0 = down.clientY;
  let active = false;
  let ghost: HTMLElement | null = null;
  let marker: HTMLElement | null = null;
  let drop: { line: number; mode: DropMode } | null = null;
  const holdMs = down.pointerType === "mouse" ? 450 : 400;
  const startSel = view.state.selection;
  const timer = window.setTimeout(() => begin(), holdMs);

  function begin(): void {
    if (active) return;
    active = true;
    const lines = view.state.doc.toString().split("\n");
    const u = unitAt(lines, srcLine);
    if (!u || u.blank) return cleanup();
    view.dom.classList.add("ntt-dragging");
    document.body.classList.add("ntt-no-select");
    // the hold may already have started a native text selection: drop it
    try { window.getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    if (!view.state.selection.eq(startSel)) view.dispatch({ selection: startSel });
    ghost = document.createElement("div");
    ghost.className = "ntt-drag-ghost";
    const first = lines[u.start] ?? "";
    ghost.textContent = first.replace(/^(?:>[ \t]*)*(\[![^\]]+\][+-]\s*)?/, "").replace(/\*\*/g, "") || " ";
    document.body.appendChild(ghost);
    marker = document.createElement("div");
    marker.className = "ntt-drop-marker";
    document.body.appendChild(marker);
    if (navigator.vibrate) try { navigator.vibrate(10); } catch { /* ignore */ }
  }

  function move(e: PointerEvent): void {
    if (!active) {
      const moved = Math.hypot(e.clientX - x0, e.clientY - y0);
      // fingers jitter: a touch tap on the arrow may wander ~10px without being a drag
      const arrowSlop = down.pointerType === "mouse" ? 5 : 14;
      if (onArrow && moved > arrowSlop) begin();
      else if (moved > (down.pointerType === "mouse" ? 8 : 12)) return cleanup(); // a scroll or a text selection, not a drag
      if (!active) return;
    }
    e.preventDefault();
    if (ghost) {
      ghost.style.left = `${e.clientX + 8}px`;
      ghost.style.top = `${e.clientY - 12}px`;
    }
    drop = dropTarget(view, e.clientX, e.clientY);
    paintMarker(view, marker, drop);
  }

  function up(e: PointerEvent): void {
    const wasActive = active;
    const d = drop;
    cleanup();
    if (!wasActive) return;
    lastDragEnd = Date.now();
    // the click that follows a drag must not open / close the arrow
    const eat = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
    window.addEventListener("click", eat, { capture: true, once: true });
    window.setTimeout(() => window.removeEventListener("click", eat, true), 400);
    if (!d) return;
    e.preventDefault();
    const lines = view.state.doc.toString().split("\n");
    const r = dropUnit(lines, srcLine, d.line, d.mode);
    if (!r) return;
    const u = unitAt(lines, srcLine);
    const line = view.state.doc.line(srcLine + 1);
    const start = u?.start ?? srcLine;
    applyMove(view, { line: start, col: markerEnd(line.text, u?.cd ?? 0), unitStart: start, oldCd: Math.max(0, markerEnd(line.text, u?.cd ?? 0)) }, r);
    view.focus();
  }

  function stopTouch(e: TouchEvent): void {
    if (active) e.preventDefault();
  }
  function noMenu(e: Event): void {
    if (active) e.preventDefault();
  }
  function noSelect(e: Event): void {
    if (active) e.preventDefault();
  }

  function cleanup(): void {
    window.clearTimeout(timer);
    active = false;
    ghost?.remove();
    marker?.remove();
    ghost = marker = null;
    view.dom.classList.remove("ntt-dragging");
    document.body.classList.remove("ntt-no-select");
    document.removeEventListener("selectstart", noSelect, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cleanup, true);
    window.removeEventListener("touchmove", stopTouch, true);
    window.removeEventListener("contextmenu", noMenu, true);
  }

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cleanup, true);
  window.addEventListener("touchmove", stopTouch, { capture: true, passive: false });
  window.addEventListener("contextmenu", noMenu, true);
  document.addEventListener("selectstart", noSelect, true);
}

/** Where a drop at (x, y) lands: top part of a line = before, bottom = after, middle of a toggle = into. */
export function dropTarget(view: EditorView, x: number, y: number): { line: number; mode: DropMode } | null {
  const rect = view.contentDOM.getBoundingClientRect();
  const pos = view.posAtCoords({ x: Math.max(rect.left + 4, Math.min(x, rect.right - 4)), y });
  if (pos === null) return null;
  const line = view.state.doc.lineAt(pos);
  const lines = view.state.doc.toString().split("\n");
  const u = unitAt(lines, line.number - 1);
  if (!u) return null;
  const block = view.lineBlockAt(line.from);
  const top = view.documentTop + block.top;
  const frac = (y - top) / Math.max(1, block.height);
  if (u.toggle && line.number - 1 === u.start) {
    if (frac < 0.25) return { line: u.start, mode: "before" };
    if (frac > 0.75) return { line: u.start, mode: "after" };
    return { line: u.start, mode: "into" };
  }
  return { line: line.number - 1, mode: frac < 0.5 ? "before" : "after" };
}

function paintMarker(view: EditorView, el: HTMLElement | null, d: { line: number; mode: DropMode } | null): void {
  if (!el) return;
  if (!d) {
    el.style.display = "none";
    return;
  }
  const lines = view.state.doc.toString().split("\n");
  const u = unitAt(lines, d.line);
  const rect = view.contentDOM.getBoundingClientRect();
  const first = view.lineBlockAt(view.state.doc.line(d.line + 1).from);
  const lastLine = d.mode === "after" && u ? u.end : d.line;
  const last = view.lineBlockAt(view.state.doc.line(Math.min(lastLine + 1, view.state.doc.lines)).from);
  el.style.display = "block";
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.classList.toggle("is-into", d.mode === "into");
  if (d.mode === "into") {
    el.style.top = `${view.documentTop + first.top}px`;
    el.style.height = `${first.height}px`;
  } else {
    const yy = d.mode === "before" ? view.documentTop + first.top : view.documentTop + last.bottom;
    el.style.top = `${yy - 1}px`;
    el.style.height = "2px";
  }
}

function tryShortcut(host: CleanTogglesHost, view: EditorView): boolean {
  if (!host.shortcutEnabled()) return false;
  const sel = view.state.selection.main;
  if (!sel.empty) return false;
  const line = view.state.doc.lineAt(sel.head);
  if (!isShortcutTrigger(line.text, sel.head - line.from)) return false;
  return host.insertToggleFromShortcut(view);
}
