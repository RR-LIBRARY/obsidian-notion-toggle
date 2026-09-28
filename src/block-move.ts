/**
 * v1.8.9 — rearrange blocks and shove them into / out of toggles (Notion parity).
 *
 * A "unit" is what Notion calls a block: one plain line, or a whole toggle
 * (header + every body line, nested toggles included). Units live in a
 * container — the note itself (depth 0) or the body of a toggle whose header
 * carries `depth` `>` markers. Every operation here is pure: lines in, lines
 * out, plus where the moved unit ended up so the editor can put the caret back.
 *
 * Moving a unit between depths re-prefixes each of its lines: strip the old
 * container's markers, add the new ones. Obsidian merges two callouts that touch
 * (and lazily continues a callout into a plain line right after it), so a blank
 * separator line at the right depth is added wherever a toggle meets a neighbour.
 */
import { CLEAN_HEADER_RE, blankAt, markerDepth, markerEnd, markersFor } from "./clean-toggles";

export interface Unit {
  /** 0-based first / last line (inclusive). */
  start: number;
  end: number;
  /** Depth of the container the unit sits in (0 = the note). */
  cd: number;
  toggle: boolean;
  /** An empty line (no content after the container markers). */
  blank: boolean;
}

export interface MoveResult {
  lines: string[];
  /** 0-based line where the moved unit now starts. */
  at: number;
  /** Container depth the unit now sits in. */
  cd: number;
  /** 0-based header line of a toggle that must be shown open (the one shoved into), or -1. */
  openHeader: number;
}

function isHeaderAt(text: string, depth: number): boolean {
  return markerDepth(text) === depth && CLEAN_HEADER_RE.test(text);
}

function contentAfter(text: string, cd: number): string {
  const end = markerEnd(text, cd);
  return end < 0 ? text : text.slice(end);
}

/** Split lines [from, to] of a container at depth `cd` into units. */
export function parseUnits(lines: readonly string[], from: number, to: number, cd: number): Unit[] {
  const out: Unit[] = [];
  let i = from;
  while (i <= to) {
    const text = lines[i] ?? "";
    if (isHeaderAt(text, cd + 1)) {
      let j = i + 1;
      while (j <= to) {
        const t = lines[j] ?? "";
        const d = markerDepth(t);
        if (d < cd + 1 || (d === cd + 1 && CLEAN_HEADER_RE.test(t))) break;
        j++;
      }
      out.push({ start: i, end: j - 1, cd, toggle: true, blank: false });
      i = j;
    } else {
      out.push({ start: i, end: i, cd, toggle: false, blank: contentAfter(text, cd).trim() === "" });
      i++;
    }
  }
  return out;
}

/** The container range (0-based, inclusive) and depth holding line `n`, walking toggles top-down. */
function locate(lines: readonly string[], n: number): { units: Unit[]; unit: Unit; parentHeader: number } | null {
  if (n < 0 || n >= lines.length) return null;
  let from = 0;
  let to = lines.length - 1;
  let cd = 0;
  let parentHeader = -1;
  for (;;) {
    const units = parseUnits(lines, from, to, cd);
    const unit = units.find((u) => u.start <= n && n <= u.end);
    if (!unit) return null;
    // Descend into a toggle when the line is in its body, not on its header.
    if (unit.toggle && n > unit.start) {
      parentHeader = unit.start;
      from = unit.start + 1;
      to = unit.end;
      cd += 1;
      continue;
    }
    return { units, unit, parentHeader };
  }
}

/** The unit holding line `n` (0-based), or null. */
export function unitAt(lines: readonly string[], n: number): Unit | null {
  return locate(lines, n)?.unit ?? null;
}

/** Re-prefix a unit's lines from container depth `from` to `to`. */
export function reprefix(block: readonly string[], from: number, to: number): string[] {
  return block.map((t) => {
    const rest = contentAfter(t, from);
    if (rest === "") return blankAt(to);
    return markersFor(to) + rest;
  });
}

/** True when a unit that ends / starts on these lines needs a separator from a neighbouring toggle. */
function needsGap(a: string | undefined, b: string | undefined, cd: number, aToggle: boolean, bToggle: boolean): boolean {
  if (a === undefined || b === undefined) return false;
  if (cd > 0 && isHeaderAt(a, cd)) return false; // `a` is the toggle this unit sits in
  if (markerDepth(a) < cd || markerDepth(b) < cd) return false; // edge of the container
  if (contentAfter(a, cd).trim() === "" || contentAfter(b, cd).trim() === "") return false;
  return aToggle || bToggle;
}

/** Insert `block` (already prefixed for depth `cd`) before 0-based index `at`, adding blank separators as needed. */
function insertBlock(
  lines: string[],
  at: number,
  block: string[],
  cd: number,
  blockToggle: boolean,
  prevToggle: boolean,
  nextToggle: boolean
): { lines: string[]; at: number } {
  const before = lines.slice(0, at);
  const after = lines.slice(at);
  const out = [...before];
  if (needsGap(before[before.length - 1], block[0], cd, prevToggle, blockToggle)) out.push(blankAt(cd));
  const start = out.length;
  out.push(...block);
  if (needsGap(block[block.length - 1], after[0], cd, blockToggle, nextToggle)) out.push(blankAt(cd));
  out.push(...after);
  return { lines: out, at: start };
}

/** Is the unit ending at / starting at index `i` (in container depth `cd`) a toggle? */
function toggleEndingAt(lines: readonly string[], i: number, cd: number): boolean {
  if (i < 0) return false;
  const u = unitAt(lines, i);
  if (!u) return false;
  // Climb to the unit at depth cd (a deeper line belongs to a toggle at cd).
  let cur: Unit | null = u;
  while (cur && cur.cd > cd) {
    const loc = locate(lines, cur.start);
    if (!loc || loc.parentHeader < 0) break;
    cur = unitAt(lines, loc.parentHeader);
  }
  return !!cur && cur.cd === cd && cur.toggle;
}

function toggleStartingAt(lines: readonly string[], i: number, cd: number): boolean {
  return i >= 0 && i < lines.length && isHeaderAt(lines[i] ?? "", cd + 1);
}

/** Remove a unit; a blank separator it leaves doubled (or dangling at an edge) goes too. */
function removeUnit(lines: readonly string[], u: Unit): { lines: string[]; removedFrom: number; removedCount: number } {
  let from = u.start;
  let count = u.end - u.start + 1;
  const isBlank = (t: string | undefined) => t !== undefined && markerDepth(t) <= u.cd && contentAfter(t, Math.min(u.cd, markerDepth(t))).trim() === "";
  const prev = lines[from - 1];
  const next = lines[u.end + 1];
  const edgePrev = prev === undefined || markerDepth(prev) < u.cd || (u.cd > 0 && isHeaderAt(prev, u.cd));
  const edgeNext = next === undefined || markerDepth(next) < u.cd;
  if (isBlank(next) && (isBlank(prev) || edgePrev)) count++;
  else if (isBlank(prev) && edgeNext) {
    from--;
    count++;
  }
  return { lines: lines.slice(0, from).concat(lines.slice(from + count)), removedFrom: from, removedCount: count };
}

/** Move the unit holding line `n` one sibling up (-1) or down (+1). Blank lines are stepped over. */
export function moveUnit(lines: readonly string[], n: number, dir: -1 | 1): MoveResult | null {
  const loc = locate(lines, n);
  if (!loc || loc.unit.blank) return null;
  const { units, unit } = loc;
  const idx = units.indexOf(unit);
  let j = idx + dir;
  while (units[j]?.blank) j += dir;
  const other = units[j];
  if (!other) return null;
  const [a, b] = dir < 0 ? [other, unit] : [unit, other];
  const aLines = lines.slice(a.start, a.end + 1);
  const bLines = lines.slice(b.start, b.end + 1);
  const gap = lines.slice(a.end + 1, b.start);
  const head = lines.slice(0, a.start);
  const tail = lines.slice(b.end + 1);
  // Two toggles that end up touching would merge: keep (or add) a separator.
  let mid = gap;
  if (mid.length === 0 && (a.toggle || b.toggle)) mid = [blankAt(unit.cd)];
  const cd = unit.cd;
  const lead = needsGap(head[head.length - 1], bLines[0], cd, toggleEndingAt(lines, a.start - 1, cd), b.toggle) ? [blankAt(cd)] : [];
  const trail = needsGap(aLines[aLines.length - 1], tail[0], cd, a.toggle, toggleStartingAt(lines, b.end + 1, cd)) ? [blankAt(cd)] : [];
  const out = [...head, ...lead, ...bLines, ...mid, ...aLines, ...trail, ...tail];
  const at = dir < 0 ? a.start + lead.length : a.start + lead.length + bLines.length + mid.length;
  return { lines: out, at, cd: unit.cd, openHeader: -1 };
}

/** Shove the unit holding line `n` into the toggle right above it (Tab). */
export function indentUnit(lines: readonly string[], n: number): MoveResult | null {
  const loc = locate(lines, n);
  if (!loc || loc.unit.blank) return null;
  const { units, unit } = loc;
  let j = units.indexOf(unit) - 1;
  while (units[j]?.blank) j--;
  const target = units[j];
  if (!target || !target.toggle) return null;
  const moved = reprefix(lines.slice(unit.start, unit.end + 1), unit.cd, unit.cd + 1);
  // Drop the unit and the blank separators between it and the toggle.
  const out = lines.slice(0, target.end + 1).concat(lines.slice(unit.end + 1));
  const lastBody = target.end > target.start ? target.end : -1;
  const prevToggle = lastBody >= 0 && toggleEndingAt(out, lastBody, unit.cd + 1);
  const ins = insertBlock(out, target.end + 1, moved, unit.cd + 1, unit.toggle, prevToggle, false);
  // Whatever followed the unit now follows the toggle: keep them apart.
  let res = ins.lines;
  const afterIdx = ins.at + moved.length;
  const follower = res[afterIdx];
  if (follower !== undefined && markerDepth(follower) <= unit.cd && contentAfter(follower, unit.cd).trim() !== "") {
    res = res.slice(0, afterIdx).concat([blankAt(unit.cd)], res.slice(afterIdx));
  }
  return { lines: res, at: ins.at, cd: unit.cd + 1, openHeader: target.start };
}

/** Move the unit holding line `n` out of its toggle, right after it (Shift+Tab). */
export function outdentUnit(lines: readonly string[], n: number): MoveResult | null {
  const loc = locate(lines, n);
  if (!loc || loc.parentHeader < 0) return null;
  const { unit } = loc;
  const parent = unitAt(lines, loc.parentHeader);
  if (!parent || unit.blank) return null;
  const moved = reprefix(lines.slice(unit.start, unit.end + 1), unit.cd, unit.cd - 1);
  const rm = removeUnit(lines, unit);
  const parentEnd = parent.end - rm.removedCount;
  let insertAt = parentEnd + 1;
  const sep = rm.lines[insertAt];
  if (sep !== undefined && markerDepth(sep) === unit.cd - 1 && contentAfter(sep, unit.cd - 1).trim() === "") insertAt++;
  const nextToggle = toggleStartingAt(rm.lines, insertAt, unit.cd - 1);
  const ins = insertBlock(rm.lines, insertAt, moved, unit.cd - 1, unit.toggle, true, nextToggle);
  return { lines: ins.lines, at: ins.at, cd: unit.cd - 1, openHeader: -1 };
}

export type DropMode = "before" | "after" | "into";

/**
 * Drag and drop: put the unit holding line `src` before / after the unit
 * holding line `target`, or at the end of that toggle's body ("into").
 * Dropping a toggle into itself or its own body is refused.
 */
export function dropUnit(lines: readonly string[], src: number, target: number, mode: DropMode): MoveResult | null {
  const s = unitAt(lines, src);
  const t = unitAt(lines, target);
  if (!s || !t || s.blank) return null;
  if (t.start >= s.start && t.end <= s.end) return null; // onto itself / inside itself
  if (mode === "into" && !t.toggle) mode = "after";
  const destCd = mode === "into" ? t.cd + 1 : t.cd;
  const moved = reprefix(lines.slice(s.start, s.end + 1), s.cd, destCd);
  // Anchor on the target header text so we can find it again after removal.
  const rm = removeUnit(lines, s);
  const shift = (i: number) => (i > rm.removedFrom ? i - rm.removedCount : i);
  const tStart = shift(t.start);
  const t2 = unitAt(rm.lines, tStart);
  if (!t2) return null;
  let at: number;
  let prevToggle: boolean;
  let nextToggle: boolean;
  if (mode === "before") {
    at = t2.start;
    prevToggle = toggleEndingAt(rm.lines, at - 1, destCd);
    nextToggle = t2.toggle;
  } else if (mode === "after") {
    at = t2.end + 1;
    prevToggle = t2.toggle;
    nextToggle = toggleStartingAt(rm.lines, at, destCd);
  } else {
    at = t2.end + 1;
    prevToggle = t2.end > t2.start && toggleEndingAt(rm.lines, t2.end, destCd);
    nextToggle = false;
  }
  const ins = insertBlock(rm.lines, at, moved, destCd, s.toggle, prevToggle, nextToggle);
  let res = ins.lines;
  if (mode === "into") {
    const afterIdx = ins.at + moved.length;
    const follower = res[afterIdx];
    if (follower !== undefined && markerDepth(follower) <= t2.cd && contentAfter(follower, t2.cd).trim() !== "") {
      res = res.slice(0, afterIdx).concat([blankAt(t2.cd)], res.slice(afterIdx));
    }
  }
  return { lines: res, at: ins.at, cd: destCd, openHeader: mode === "into" ? t2.start : -1 };
}
