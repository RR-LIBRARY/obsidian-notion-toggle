/**
 * v1.8.0 — "clean editing": the Notion-like view of a toggle *while typing*.
 *
 * A toggle is stored as Obsidian's own foldable callout:
 *
 *     > [!question]- **Q7. Which plant was made nematode-resistant?**
 *     > **Answer:** Tobacco.
 *
 * Reading view already renders that as an arrow + title + hidden body. But the
 * moment the caret enters the block, Live Preview shows the raw `>` and
 * `[!question]-` markers, which is exactly what non-technical writers find
 * uncomfortable. This module decides — purely, from text and selection — how to
 * dress those lines up instead:
 *
 *   - header line: the `> [!type]- ` prefix becomes a clickable ▶ / ▼ arrow,
 *   - body lines: the `> ` prefix disappears and the line is indented,
 *   - a closed toggle keeps its body folded away until the arrow is clicked or
 *     the caret moves into the body.
 *
 * `src/clean-toggles-view.ts` turns these plans into CodeMirror decorations.
 * Nothing here imports Obsidian or CodeMirror, so every rule is unit-tested
 * against plain strings (tests/clean-toggles.test.ts).
 */

import { convertDetailsToCallouts } from "./editor-blocks";

/* ---------- a tiny document interface (CodeMirror's Text satisfies it) ---------- */

export interface LineInfo {
  /** 1-based line number. */
  number: number;
  from: number;
  to: number;
  text: string;
}

export interface DocLike {
  /** Number of lines (>= 1). */
  lines: number;
  line(n: number): LineInfo;
  lineAt(pos: number): LineInfo;
}

/** Wrap a string so the planner can be exercised without CodeMirror. */
export function textDoc(text: string): DocLike {
  const parts = text.split("\n");
  const infos: LineInfo[] = [];
  let pos = 0;
  parts.forEach((t, i) => {
    infos.push({ number: i + 1, from: pos, to: pos + t.length, text: t });
    pos += t.length + 1;
  });
  return {
    lines: infos.length,
    line(n) {
      const l = infos[n - 1];
      if (!l) throw new RangeError(`Invalid line number ${n}`);
      return l;
    },
    lineAt(p) {
      for (const l of infos) if (p <= l.to) return l;
      return infos[infos.length - 1] ?? { number: 1, from: 0, to: 0, text: "" };
    },
  };
}

/* ---------- block detection ---------- */

/**
 * `> [!type]- Title` — a toggle header (fold marker required). Group 1 = prefix.
 * v1.8.9: one or more `>` markers are allowed, so a toggle nested inside another
 * toggle (`> > [!type]- Title`) is a header too.
 */
export const CLEAN_HEADER_RE = /^((?:>[ \t]*)+\[!([^\]\n]+)\]([+-])[ \t]?)/;
/** `> body` — group 1 = the marker that gets hidden (`>` plus one optional space). */
export const CLEAN_BODY_RE = /^(>[ ]?)/;
const FENCE_RE = /^[ \t]*(```|~~~)/;

/** How many `>` markers open the line (0 = not a quote line). */
export function markerDepth(text: string): number {
  let depth = 0;
  let i = 0;
  while (text.charCodeAt(i) === 62 /* > */) {
    depth++;
    i++;
    while (text[i] === " " || text[i] === "\t") i++;
  }
  return depth;
}

/**
 * Offset just past the `depth`-th `>` marker and one optional space after it
 * (`> > text`, depth 2 → 4). -1 when the line has fewer markers; 0 for depth 0.
 */
export function markerEnd(text: string, depth: number): number {
  if (depth <= 0) return 0;
  let i = 0;
  for (let k = 1; k <= depth; k++) {
    if (text[i] !== ">") return -1;
    i++;
    if (k < depth) {
      while (text[i] === " " || text[i] === "\t") i++;
    } else if (text[i] === " ") i++;
  }
  return i;
}

/** `> ` repeated `depth` times — the prefix a body line at that depth carries. */
export function markersFor(depth: number): string {
  return "> ".repeat(Math.max(0, depth));
}

/** An empty line at `depth` (`>` / `> >` / "" for depth 0). */
export function blankAt(depth: number): string {
  return markersFor(depth).trimEnd();
}
/**
 * v1.8.2 — a title stored as `**Title**` (the "Bold the question" setting).
 * Group 1 = the inner text. The inner text may not contain another `**`, and
 * must start and end with a non-space so Obsidian really renders it bold.
 */
export const BOLD_WRAP_RE = /^\*\*(\S(?:[^*\n]|\*(?!\*))*?\S|\S)\*\*[ \t]*$/;

export interface ToggleBlock {
  /** Stable key for per-block state: offset of the header line start. */
  key: number;
  headerLine: number;
  lastLine: number;
  /** Header line start / end. */
  headerFrom: number;
  headerTo: number;
  /** Where the callout prefix ends (after `> [!type]- `). */
  prefixEnd: number;
  /** Title stored as `**…**`: the markers are hidden along with the prefix. */
  boldWrap: boolean;
  /** Where the visible title starts / ends (inside the hidden `**` pair when boldWrap). */
  titleFrom: number;
  titleTo: number;
  /** First body line start / last body line end (both equal to headerTo when there is no body). */
  bodyFrom: number;
  bodyTo: number;
  type: string;
  marker: "+" | "-";
  /** v1.8.9 — how many `>` markers the header carries (1 = top-level toggle, 2 = nested once, …). */
  depth: number;
  /** Hidden `> ` prefixes (all `depth` markers), one per body line. */
  bodyPrefixes: { from: number; to: number }[];
}

export function isCleanHeader(text: string): boolean {
  return CLEAN_HEADER_RE.test(text);
}

/** Is `lineNumber` inside a fenced code block? (A documented example is not a toggle.) */
export function insideFence(doc: DocLike, lineNumber: number): boolean {
  let open: string | null = null;
  for (let n = 1; n < lineNumber; n++) {
    const m = doc.line(n).text.match(FENCE_RE);
    if (!m) continue;
    if (open === null) open = m[1] ?? null;
    else if (m[1] === open) open = null;
  }
  return open !== null;
}

/**
 * Walk up from `fromLine` to the header of the innermost block a line at
 * `maxDepth` markers sits in. A header only counts when no shallower quote line
 * lies between it and the start (`minDepth` tracks that), so a sibling nested
 * toggle that already ended is never mistaken for the container.
 */
function headerAbove(doc: DocLike, fromLine: number, maxDepth: number): number {
  let minDepth = maxDepth;
  for (let n = fromLine; n >= 1; n--) {
    const text = doc.line(n).text;
    const d = markerDepth(text);
    if (d === 0) return -1;
    if (d <= minDepth && CLEAN_HEADER_RE.test(text)) return n;
    if (d < minDepth) minDepth = d;
  }
  return -1;
}

/**
 * The innermost toggle block that contains `lineNumber`, or null.
 *
 * Walks up over `>` lines to the nearest header at the line's depth or less,
 * then down over the body. A header at the same depth ends the block; a deeper
 * header (a nested toggle) is part of the body.
 */
export function findBlockAt(doc: DocLike, lineNumber: number): ToggleBlock | null {
  if (lineNumber < 1 || lineNumber > doc.lines) return null;
  const text = doc.line(lineNumber).text;
  const depth = markerDepth(text);
  if (depth === 0) return null;
  const headerLine = CLEAN_HEADER_RE.test(text) ? lineNumber : headerAbove(doc, lineNumber - 1, depth);
  if (headerLine < 0) return null;
  if (insideFence(doc, headerLine)) return null;
  return blockFromHeader(doc, headerLine);
}

/** The toggle a nested block sits in, or null for a top-level toggle. */
export function parentOf(doc: DocLike, block: ToggleBlock): ToggleBlock | null {
  if (block.depth <= 1) return null;
  const headerLine = headerAbove(doc, block.headerLine - 1, block.depth - 1);
  return headerLine < 0 ? null : blockFromHeader(doc, headerLine);
}

/** The outermost toggle around a block (the block itself when top-level). */
export function rootOf(doc: DocLike, block: ToggleBlock): ToggleBlock {
  let cur = block;
  for (;;) {
    const parent = parentOf(doc, cur);
    if (!parent) return cur;
    cur = parent;
  }
}

/** Every toggle nested anywhere inside `block` (any depth), in document order. */
export function descendantsOf(doc: DocLike, block: ToggleBlock): ToggleBlock[] {
  const out: ToggleBlock[] = [];
  for (let n = block.headerLine + 1; n <= block.lastLine; n++) {
    const text = doc.line(n).text;
    if (markerDepth(text) > block.depth && CLEAN_HEADER_RE.test(text)) {
      const b = blockFromHeader(doc, n);
      if (b) out.push(b);
    }
  }
  return out;
}

/** Build the block record for a header line that is known to match. */
export function blockFromHeader(doc: DocLike, headerLine: number): ToggleBlock | null {
  const header = doc.line(headerLine);
  const m = header.text.match(CLEAN_HEADER_RE);
  if (!m) return null;
  const depth = markerDepth(header.text);
  const bodyPrefixes: { from: number; to: number }[] = [];
  let lastLine = headerLine;
  for (let n = headerLine + 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    const d = markerDepth(line.text);
    if (d < depth) break;
    if (d === depth && CLEAN_HEADER_RE.test(line.text)) break;
    bodyPrefixes.push({ from: line.from, to: line.from + markerEnd(line.text, depth) });
    lastLine = n;
  }
  const hasBody = lastLine > headerLine;
  const prefixEnd = header.from + (m[1] ?? "").length;
  const wrap = header.text.slice(prefixEnd - header.from).match(BOLD_WRAP_RE);
  const inner = wrap?.[1] ?? "";
  return {
    key: header.from,
    headerLine,
    lastLine,
    headerFrom: header.from,
    headerTo: header.to,
    prefixEnd,
    boldWrap: !!wrap,
    titleFrom: wrap ? prefixEnd + 2 : prefixEnd,
    titleTo: wrap ? prefixEnd + 2 + inner.length : header.to,
    bodyFrom: hasBody ? doc.line(headerLine + 1).from : header.to,
    bodyTo: hasBody ? doc.line(lastLine).to : header.to,
    type: (m[2] ?? "").trim(),
    marker: m[3] as "+" | "-",
    depth,
    bodyPrefixes,
  };
}

export interface SelRange {
  from: number;
  to: number;
  head?: number;
}

/**
 * Every toggle block the selection touches, in document order. v1.8.9: when a
 * touched toggle is nested — or contains nested toggles — the whole family
 * (outermost ancestor plus every descendant) comes along, because Obsidian
 * shows the entire outer callout as raw text while the caret is anywhere in it.
 */
export function blocksTouching(doc: DocLike, ranges: readonly SelRange[]): ToggleBlock[] {
  const seen = new Set<number>();
  const out: ToggleBlock[] = [];
  const add = (b: ToggleBlock) => {
    if (seen.has(b.key)) return;
    seen.add(b.key);
    out.push(b);
  };
  for (const r of ranges) {
    const first = doc.lineAt(Math.min(r.from, r.to)).number;
    const last = doc.lineAt(Math.max(r.from, r.to)).number;
    for (let n = first; n <= last; n++) {
      const block = findBlockAt(doc, n);
      if (!block) continue;
      const root = rootOf(doc, block);
      if (!seen.has(root.key)) {
        add(root);
        for (const d of descendantsOf(doc, root)) add(d);
      }
      n = root.lastLine;
    }
  }
  return out.sort((a, b) => a.key - b.key);
}

function rangeTouches(r: SelRange, from: number, to: number): boolean {
  return Math.min(r.from, r.to) <= to && Math.max(r.from, r.to) >= from;
}

/** Does any range put a caret / selection endpoint inside the body lines? */
export function selectionInBody(block: ToggleBlock, ranges: readonly SelRange[]): boolean {
  if (block.bodyTo <= block.headerTo) return false;
  return ranges.some((r) => rangeTouches(r, block.bodyFrom, block.bodyTo));
}

/* ---------- decoration plans ---------- */

export type CleanPlan =
  | { kind: "line"; pos: number; cls: string }
  | { kind: "arrow"; from: number; to: number; key: number; open: boolean; type: string }
  | { kind: "hide"; from: number; to: number }
  | { kind: "fold"; from: number; to: number; key: number }
  /** v1.8.13 — grey "Toggle" hint after the arrow of a title with nothing typed yet (Notion shows the same). */
  | { kind: "placeholder"; pos: number; key: number };

/** v1.8.13 — the title text as typed, without the callout prefix (bold `**` kept). */
export function rawTitle(doc: DocLike, block: ToggleBlock): string {
  return doc.lineAt(block.headerFrom).text.slice(block.prefixEnd - block.headerFrom);
}

/** v1.8.13 — is the title empty (nothing but spaces, or an empty `****` bold pair)? */
export function emptyTitle(doc: DocLike, block: ToggleBlock): boolean {
  return rawTitle(doc, block).replace(/\*/g, "").trim().length === 0;
}

/** Sticky per-block open/closed choices the writer made with the arrow. */
export type OverrideMap = ReadonlyMap<number, boolean>;

export interface CleanPlanResult {
  plans: CleanPlan[];
  blocks: ToggleBlock[];
  /** All remembered arrow choices, updated for the touched blocks. */
  overrides: Map<number, boolean>;
}

/** `is the toggle open right now?` — override wins, else the fold marker, and a caret in the body always opens it. */
export function isOpen(block: ToggleBlock, ranges: readonly SelRange[], overrides: OverrideMap): boolean {
  if (selectionInBody(block, ranges)) return true;
  const o = overrides.get(block.key);
  if (o !== undefined) return o;
  return block.marker === "+";
}

/** CSS-safe slug of a callout type (`recall-red` → `recall-red`, `Note` → `note`). */
export function typeSlug(type: string): string {
  return type.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || "toggle";
}

/**
 * Plan every decoration for the blocks the selection touches.
 *
 * Blocks the caret is *not* in are left alone on purpose: Obsidian renders
 * those as its own callout widget, so there is nothing to hide.
 */
export function planClean(doc: DocLike, ranges: readonly SelRange[], overrides: OverrideMap): CleanPlanResult {
  const blocks = blocksTouching(doc, ranges);
  const plans: CleanPlan[] = [];
  // Arrow choices are remembered for the whole session (mapped through edits),
  // so a toggle the writer opened stays open when the caret wanders off and back.
  const kept = new Map<number, boolean>(overrides);
  // v1.8.9 — nested toggles: a closed toggle hides its whole body (nested ones
  // included), and a body line that belongs to a nested toggle is dressed by
  // that toggle, not by every ancestor (their decorations would overlap).
  const folded: { from: number; to: number }[] = [];
  const nestedHeads = blocks.filter((b) => b.depth > 1);
  for (const block of blocks) {
    if (folded.some((f) => block.headerFrom > f.from && block.headerFrom <= f.to)) continue;
    const inBody = selectionInBody(block, ranges);
    const prior = overrides.get(block.key);
    if (inBody) kept.set(block.key, true);
    else if (prior !== undefined) kept.set(block.key, prior);
    const open = isOpen(block, ranges, kept);
    const slug = typeSlug(block.type);
    const depthCls = block.depth > 1 ? ` ntt-clean-d${Math.min(block.depth, 6)}` : "";
    plans.push({
      kind: "line",
      pos: block.headerFrom,
      cls: `ntt-clean-header ntt-clean-t-${slug} ${open ? "ntt-clean-open" : "ntt-clean-closed"}${block.boldWrap ? " ntt-clean-bold" : ""}${depthCls}`,
    });
    plans.push({ kind: "arrow", from: block.headerFrom, to: block.titleFrom, key: block.key, open, type: block.type });
    // v1.8.13 — nothing typed yet: show the grey "Toggle" hint (only when the title is truly blank;
    // an empty `****` bold pair keeps showing its markers so the caret has somewhere visible to sit).
    if (rawTitle(doc, block).trim().length === 0) plans.push({ kind: "placeholder", pos: block.titleFrom, key: block.key });
    if (block.boldWrap && block.titleTo < block.headerTo) plans.push({ kind: "hide", from: block.titleTo, to: block.headerTo });
    const hasBody = block.bodyTo > block.headerTo;
    if (!hasBody) continue;
    if (!open) {
      plans.push({ kind: "fold", from: block.headerTo, to: block.bodyTo, key: block.key });
      folded.push({ from: block.headerTo, to: block.bodyTo });
      continue;
    }
    const inner = nestedHeads.filter((b) => b.depth > block.depth && b.headerFrom > block.headerFrom && b.headerFrom <= block.bodyTo);
    for (const p of block.bodyPrefixes) {
      if (inner.some((b) => p.from >= b.headerFrom && p.from <= b.bodyTo)) continue;
      plans.push({ kind: "line", pos: p.from, cls: `ntt-clean-body ntt-clean-t-${slug}${depthCls}` });
      if (p.to > p.from) plans.push({ kind: "hide", from: p.from, to: p.to });
    }
  }
  return { plans, blocks, overrides: kept };
}

/** Is the block open on its own — marker or arrow choice — ignoring where the caret is? */
export function openWithoutCaret(block: ToggleBlock, overrides: OverrideMap): boolean {
  const o = overrides.get(block.key);
  return o !== undefined ? o : block.marker === "+";
}

export interface CaretMove {
  /** Selection anchor (equals `head` for a plain caret). */
  anchor: number;
  head: number;
  /** Where the main caret was before this move (undefined for a fresh state). */
  prevHead?: number;
  /** The move came from a mouse / touch tap (never "skip forward", just park). */
  pointer?: boolean;
}

/** The first visible spot after a title, or the title end when there is none. */
export function afterTitle(doc: DocLike, block: ToggleBlock, overrides: OverrideMap): number {
  const docEnd = doc.line(doc.lines).to;
  const hasBody = block.bodyTo > block.headerTo;
  if (hasBody && openWithoutCaret(block, overrides)) return block.bodyPrefixes[0]?.to ?? block.titleTo;
  const last = hasBody ? block.bodyTo : block.headerTo;
  return last < docEnd ? last + 1 : block.titleTo;
}

/**
 * Where a caret must go so it never sits inside a hidden marker, and never
 * slips into the folded body of a closed toggle by keyboard.
 *
 * Rules (Notion parity):
 *  - header line: anything inside the hidden `> [!type]- ` prefix (and the
 *    opening `**` of a bold title) → the visible title start; anything after
 *    the visible title end (the hidden closing `**`) → the title end, or —
 *    when the keyboard moved forward off the title — the next visible spot;
 *  - open toggle: column 0 of a body line → after the hidden `> `;
 *  - closed toggle: a caret arriving in the folded body from the title while
 *    moving forward (Right / End) skips to the line after the toggle; any other
 *    arrival (Up from below, Left from the next line, a tap past the title)
 *    parks it at the end of the title. A selection anchored on the title that
 *    reaches into the folded body is clamped to the title so typing can never
 *    replace hidden text.
 *
 * Returns the new head, or null when nothing needs to change.
 */
export function redirectCaret(doc: DocLike, move: CaretMove, overrides: OverrideMap): number | null {
  const { anchor, head, prevHead, pointer } = move;
  const line = doc.lineAt(head);
  const block = findBlockAt(doc, line.number);
  if (!block) return null;
  const anchorOnHeader = anchor >= block.headerFrom && anchor <= block.headerTo;
  const cameFromTitle = !pointer && prevHead !== undefined && prevHead >= block.headerFrom && prevHead <= block.headerTo;
  if (line.number === block.headerLine) {
    if (head >= block.headerFrom && head < block.titleFrom) return block.titleFrom;
    if (head <= block.titleTo) return null;
    // Past the visible title: only the hidden closing `**` lives here.
    if (anchor !== head) return anchorOnHeader ? block.titleTo : null;
    return cameFromTitle ? afterTitle(doc, block, overrides) : block.titleTo;
  }
  if (openWithoutCaret(block, overrides)) {
    if (anchor !== head) return null;
    const prefix = block.bodyPrefixes.find((p) => head >= p.from && head < p.to);
    return prefix ? prefix.to : null;
  }
  // Closed toggle: the body is not a place for the caret.
  if (anchor !== head) return anchorOnHeader ? block.titleTo : null;
  if (cameFromTitle && head >= block.bodyTo && block.bodyTo < doc.line(doc.lines).to) {
    return block.bodyTo + 1;
  }
  return block.titleTo;
}

/** Backwards-compatible caret-only form of `redirectCaret`. */
export function nudgeCaret(doc: DocLike, head: number, overrides: OverrideMap): number | null {
  return redirectCaret(doc, { anchor: head, head }, overrides);
}

/* ---------- v1.8.22: Enter at the end of a title (same-depth continuation) ---------- */

/**
 * Does the clean layer own Enter at this caret? The plugin's older Enter
 * handler (main.ts) runs first and only knows flat `> ` lines; it steps aside
 * here so nesting and open state are respected:
 *  - the caret sits at (or past) the end of a toggle title (or anywhere in an
 *    empty title, e.g. between the `**|**` the shortcut leaves), or
 *  - the caret is anywhere inside a nested toggle (depth >= 2).
 * Pure; `lineNumber` is 1-based.
 */
export function cleanOwnsEnter(doc: DocLike, lineNumber: number, head: number): boolean {
  const block = findBlockAt(doc, lineNumber);
  if (!block) return false;
  if (block.depth >= 2) return true;
  if (block.headerLine !== lineNumber) return false;
  return head >= block.titleTo || emptyTitle(doc, block);
}

export interface TitleEnterOptions {
  /** Fold marker for a freshly made toggle (`-` = starts closed, the recall default). */
  fold: "+" | "-";
}

export interface TitleEnterPlan {
  /** Replace doc[from, to) with `insert` … */
  from: number;
  to: number;
  insert: string;
  /** … and put the caret here (absolute, after the change). */
  caret: number;
}

/**
 * What Enter does at the end of a toggle title:
 *
 *  - empty title                       → the toggle becomes a plain line at the
 *                                        parent's depth (a `>` line inside the
 *                                        parent, or an empty line at top level);
 *  - non-empty title                   → a new toggle after the complete block,
 *                                        at exactly the same depth (a sibling).
 *
 * Enter never changes depth. Tab/Shift+Tab (Indent/Outdent) are the only ways
 * to move a toggle into or out of another toggle.
 *
 * Pure: the caller dispatches the change and the open effect.
 */
export function planTitleEnter(doc: DocLike, block: ToggleBlock, _isOpenNow: boolean, opts: TitleEnterOptions): TitleEnterPlan {
  const bold = block.boldWrap || rawTitle(doc, block).trim() === "****" ? "**" : "";
  if (emptyTitle(doc, block)) {
    const insert = blankAt(block.depth - 1);
    return { from: block.headerFrom, to: block.headerTo, insert, caret: block.headerFrom + insert.length };
  }
  const head = `\n${blankAt(block.depth - 1)}\n${markersFor(block.depth - 1)}> [!${block.type}]${opts.fold} ${bold}`;
  const at = block.bodyTo;
  return { from: at, to: at, insert: head + bold, caret: at + head.length };
}

/* ---------- the `>` + space shortcut (Notion parity) ---------- */

/**
 * Typing `>` then a space on an otherwise empty line starts a toggle, like in
 * Notion. Returns true when the line is exactly `>` with the caret after it.
 */
export function isShortcutTrigger(lineText: string, col: number): boolean {
  return lineText === ">" && col === 1;
}

/* ---------- `<details>` comfort ---------- */

/** How many `<details>` blocks a text has, ignoring fenced examples. */
export function detailsBlockCount(text: string | null | undefined): number {
  const src = String(text ?? "").replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
  return src.match(/<details[\s>]/gi)?.length ?? 0;
}

export interface PasteOptions {
  calloutType: string;
  collapsed: boolean;
  boldSummary: boolean;
}

/**
 * Pasted text that carries `<details>` blocks comes back as toggles; anything
 * else returns null so the default paste runs untouched.
 */
export function convertPastedText(text: string, opts: PasteOptions): string | null {
  if (detailsBlockCount(text) === 0) return null;
  const converted = convertDetailsToCallouts(text, opts.calloutType, opts.collapsed, opts.boldSummary);
  return converted === text ? null : converted;
}

/* ---------- default state ---------- */

/** Flip `-` ↔ `+` on a header line (closed by default ↔ open by default). Non-headers come back unchanged. */
export function flipFoldMarker(line: string): string {
  return line.replace(/^(>[ \t]*\[![^\]\n]+\])([+-])/, (_m, head: string, marker: string) => `${head}${marker === "-" ? "+" : "-"}`);
}

/* ---------- v1.8.15: Notion's Ctrl/Cmd+Alt+T — open / close every toggle ---------- */

export interface ToggleAllPlan {
  /** The note with every toggle flipped; identical to the input when there is nothing to do. */
  doc: string;
  /** True when the pass opened toggles, false when it closed them. */
  opened: boolean;
  /** How many toggle headers changed state. */
  changed: number;
  /** How many foldable toggles the note has in total. */
  total: number;
}

const FOLD_HEADER = /^(\s*(?:>\s*)*>[ \t]*\[![^\]\n]+\])([+-])/;
const DETAILS_TAG = /^(\s*)<details(\s+open)?\s*>/i;

/**
 * Notion's Ctrl/Cmd+Alt+T toggles the whole page at once: if anything is still
 * folded it opens everything, otherwise it closes everything. Works on callout
 * toggles at any nesting depth and on raw `<details>` blocks. Pure string in →
 * plan out, so the behaviour is testable without an editor.
 */
export function planToggleAll(doc: string, force?: "open" | "close"): ToggleAllPlan {
  const lines = String(doc ?? "").split("\n");
  let total = 0;
  let closed = 0;
  for (const line of lines) {
    const head = FOLD_HEADER.exec(line);
    if (head) {
      total++;
      if (head[2] === "-") closed++;
      continue;
    }
    const det = DETAILS_TAG.exec(line);
    if (det) {
      total++;
      if (!det[2]) closed++;
    }
  }
  const opened = force ? force === "open" : closed > 0;
  let changed = 0;
  const out = lines.map((line) => {
    const head = FOLD_HEADER.exec(line);
    if (head) {
      const want = opened ? "+" : "-";
      if (head[2] === want) return line;
      changed++;
      return line.replace(FOLD_HEADER, `$1${want}`);
    }
    const det = DETAILS_TAG.exec(line);
    if (det) {
      const isOpen = Boolean(det[2]);
      if (isOpen === opened) return line;
      changed++;
      return line.replace(DETAILS_TAG, opened ? "$1<details open>" : "$1<details>");
    }
    return line;
  });
  return { doc: out.join("\n"), opened, changed, total };
}
