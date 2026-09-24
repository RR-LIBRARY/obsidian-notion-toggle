/**
 * v1.5.4 — count the toggles the *note source* has, per kind.
 *
 * The DOM can lie while Obsidian is still rendering (see `full-render.ts`).
 * The markdown never lies: `> [!recall-red]-` is a red toggle whether or not
 * that section is on screen. These counts are the ground truth used to
 *
 *   - decide whether "No toggles match this selection" is honest or premature,
 *   - keep re-measuring until the DOM catches up with the source,
 *   - show truthful per-kind numbers in the picker and settings read-out.
 *
 * Pure module — no Obsidian, no DOM.
 */

import { kindOf, matchesFilter, type RecallColor } from "./autoscroll";

/** `> [!kind]` at the start of a callout block (any blockquote nesting depth). */
const CALLOUT_RE = /^[ \t]*(?:>[ \t]*)+\[!([^\]\n]+)\]([+-]?)/gm;
const DETAILS_RE = /<details[\s>]/gi;

export interface SourceToggles {
  /** Every toggle kind in the note, in document order. */
  kinds: RecallColor[];
  /** How many toggles the note has in total. */
  total: number;
  /**
   * v1.7.1 — how many of them can actually fold: `[!kind]-` / `[!kind]+`
   * callouts and every `<details>`. A plain `> [!note]` has no fold arrow, so
   * "Open all" must not count it as missing.
   */
  foldable: number;
}

/** Strip fenced code blocks so a documented example never counts as a toggle. */
function withoutFences(text: string): string {
  return text.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
}

export function scanSourceToggles(text: string | null | undefined): SourceToggles {
  const src = withoutFences(String(text ?? ""));
  const kinds: RecallColor[] = [];
  let foldable = 0;
  for (const m of src.matchAll(CALLOUT_RE)) {
    kinds.push(kindOf(m[1]));
    if (m[2] === "-" || m[2] === "+") foldable++;
  }
  const details = src.match(DETAILS_RE)?.length ?? 0;
  for (let i = 0; i < details; i++) kinds.push("other");
  return { kinds, total: kinds.length, foldable: foldable + details };
}


/** How many toggles the source has for this filter (empty filter = all). */
export function sourceMatchCount(text: string | null | undefined, filter: RecallColor[] = []): number {
  const { kinds } = scanSourceToggles(text);
  if (!filter || filter.length === 0) return kinds.length;
  return kinds.filter((k) => matchesFilter(k, filter)).length;
}

/** Per-kind counts, e.g. `{ red: 14, yellow: 37, green: 20 }`. */
export function sourceKindCounts(text: string | null | undefined): Partial<Record<RecallColor, number>> {
  const out: Partial<Record<RecallColor, number>> = {};
  for (const kind of scanSourceToggles(text).kinds) out[kind] = (out[kind] ?? 0) + 1;
  return out;
}

/**
 * Has the DOM caught up with the source?
 *
 * `domCount` is what `noteToggleCount()` sees right now. Rendering is treated
 * as complete once the DOM has at least as many toggles as the source — a
 * plugin-rendered extra can only push it over, never under.
 */
export function isFullyRendered(domCount: number, sourceTotal: number): boolean {
  if (!Number.isFinite(sourceTotal) || sourceTotal <= 0) return true;
  return Number(domCount) >= sourceTotal;
}
