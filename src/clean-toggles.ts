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

/** `> [!type]- Title` — a toggle header (fold marker required). Group 1 = prefix. */
export const CLEAN_HEADER_RE = /^(>[ \t]*\[!([^\]\n]+)\]([+-])[ \t]?)/;
/** `> body` — group 1 = the marker that gets hidden (`>` plus one optional space). */
export const CLEAN_BODY_RE = /^(>[ ]?)/;
const FENCE_RE = /^[ \t]*(```|~~~)/;

export interface ToggleBlock {
  /** Stable key for per-block state: offset of the header line start. */
  key: number;
  headerLine: number;
  lastLine: number;
  /** Header line start / end. */
  headerFrom: number;
  headerTo: number;
  /** Where the visible title starts (after `> [!type]- `). */
  prefixEnd: number;
  /** First body line start / last body line end (both equal to headerTo when there is no body). */
  bodyFrom: number;
  bodyTo: number;
  type: string;
  marker: "+" | "-";
  /** Hidden `> ` prefixes, one per body line. */
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
 * The toggle block that contains `lineNumber`, or null.
 *
 * Walks up over `>` lines to the nearest header, then down over the body. A
 * second header line ends the block (matching `convertCalloutsToDetails`).
 */
export function findBlockAt(doc: DocLike, lineNumber: number): ToggleBlock | null {
  if (lineNumber < 1 || lineNumber > doc.lines) return null;
  let headerLine = -1;
  for (let n = lineNumber; n >= 1; n--) {
    const text = doc.line(n).text;
    if (CLEAN_HEADER_RE.test(text)) {
      headerLine = n;
      break;
    }
    if (!/^>/.test(text)) return null;
  }
  if (headerLine < 0) return null;
  if (insideFence(doc, headerLine)) return null;
  return blockFromHeader(doc, headerLine);
}

/** Build the block record for a header line that is known to match. */
export function blockFromHeader(doc: DocLike, headerLine: number): ToggleBlock | null {
  const header = doc.line(headerLine);
  const m = header.text.match(CLEAN_HEADER_RE);
  if (!m) return null;
  const bodyPrefixes: { from: number; to: number }[] = [];
  let lastLine = headerLine;
  for (let n = headerLine + 1; n <= doc.lines; n++) {
    const line = doc.line(n);
    if (!/^>/.test(line.text) || CLEAN_HEADER_RE.test(line.text)) break;
    const bm = line.text.match(CLEAN_BODY_RE);
    bodyPrefixes.push({ from: line.from, to: line.from + (bm ? (bm[1] ?? ">").length : 1) });
    lastLine = n;
  }
  const hasBody = lastLine > headerLine;
  return {
    key: header.from,
    headerLine,
    lastLine,
    headerFrom: header.from,
    headerTo: header.to,
    prefixEnd: header.from + (m[1] ?? "").length,
    bodyFrom: hasBody ? doc.line(headerLine + 1).from : header.to,
    bodyTo: hasBody ? doc.line(lastLine).to : header.to,
    type: (m[2] ?? "").trim(),
    marker: m[3] as "+" | "-",
    bodyPrefixes,
  };
}

export interface SelRange {
  from: number;
  to: number;
  head?: number;
}

/** Every toggle block that at least one selection range touches, in document order. */
export function blocksTouching(doc: DocLike, ranges: readonly SelRange[]): ToggleBlock[] {
  const seen = new Set<number>();
  const out: ToggleBlock[] = [];
  for (const r of ranges) {
    const first = doc.lineAt(Math.min(r.from, r.to)).number;
    const last = doc.lineAt(Math.max(r.from, r.to)).number;
    for (let n = first; n <= last; n++) {
      const block = findBlockAt(doc, n);
      if (!block || seen.has(block.key)) {
        if (block) n = block.lastLine;
        continue;
      }
      seen.add(block.key);
      out.push(block);
      n = block.lastLine;
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
  | { kind: "fold"; from: number; to: number; key: number };

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
  for (const block of blocks) {
    const inBody = selectionInBody(block, ranges);
    const prior = overrides.get(block.key);
    // A caret in the body makes the toggle sticky-open, so moving back up to
    // the title never snaps the answer shut mid-edit.
    if (inBody) kept.set(block.key, true);
    else if (prior !== undefined) kept.set(block.key, prior);
    const open = isOpen(block, ranges, kept);
    const slug = typeSlug(block.type);
    plans.push({
      kind: "line",
      pos: block.headerFrom,
      cls: `ntt-clean-header ntt-clean-t-${slug} ${open ? "ntt-clean-open" : "ntt-clean-closed"}`,
    });
    plans.push({ kind: "arrow", from: block.headerFrom, to: block.prefixEnd, key: block.key, open, type: block.type });
    const hasBody = block.bodyTo > block.headerTo;
    if (!hasBody) continue;
    if (!open) {
      plans.push({ kind: "fold", from: block.headerTo, to: block.bodyTo, key: block.key });
      continue;
    }
    for (const p of block.bodyPrefixes) {
      plans.push({ kind: "line", pos: p.from, cls: `ntt-clean-body ntt-clean-t-${slug}` });
      plans.push({ kind: "hide", from: p.from, to: p.to });
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
}

/**
 * Where a caret must go so it never sits inside a hidden marker, and never
 * slips into the folded body of a closed toggle by keyboard.
 *
 * Rules (Notion parity):
 *  - header line: anything inside the hidden `> [!type]- ` prefix → after it;
 *  - open toggle: column 0 of a body line → after the hidden `> `;
 *  - closed toggle: a caret arriving in the folded body from the title while
 *    moving forward (Right / End) skips to the line after the toggle; any other
 *    arrival (Up from below, Left from the next line, a click past the chip)
 *    parks it at the end of the title. A selection anchored on the title that
 *    reaches into the folded body is clamped to the title so typing can never
 *    replace hidden text.
 *
 * Returns the new head, or null when nothing needs to change.
 */
export function redirectCaret(doc: DocLike, move: CaretMove, overrides: OverrideMap): number | null {
  const { anchor, head, prevHead } = move;
  const line = doc.lineAt(head);
  const block = findBlockAt(doc, line.number);
  if (!block) return null;
  if (line.number === block.headerLine) {
    return head >= block.headerFrom && head < block.prefixEnd ? block.prefixEnd : null;
  }
  if (openWithoutCaret(block, overrides)) {
    if (anchor !== head) return null;
    const prefix = block.bodyPrefixes.find((p) => head >= p.from && head < p.to);
    return prefix ? prefix.to : null;
  }
  // Closed toggle: the body is not a place for the caret.
  const anchorOnHeader = anchor >= block.headerFrom && anchor <= block.headerTo;
  if (anchor !== head) return anchorOnHeader ? block.headerTo : null;
  const cameFromTitle = prevHead !== undefined && prevHead >= block.headerFrom && prevHead <= block.headerTo;
  if (cameFromTitle && head >= block.bodyTo && block.bodyTo < doc.line(doc.lines).to) {
    return block.bodyTo + 1;
  }
  return block.headerTo;
}

/** Backwards-compatible caret-only form of `redirectCaret`. */
export function nudgeCaret(doc: DocLike, head: number, overrides: OverrideMap): number | null {
  return redirectCaret(doc, { anchor: head, head }, overrides);
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
