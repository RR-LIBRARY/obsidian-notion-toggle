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
  const tags=Array.from(src.matchAll(/<details\b[^>]*>/gi));
  const details=tags.length;
  for(const tag of tags) kinds.push(kindOf(tag[0].match(/data-callout=["']([^"']+)["']/i)?.[1] ?? 'other'));
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

const TOP_CALLOUT_RE = /^[ \t]*>[ \t]*\[!([^\]\n]+)\][+-]?[ \t]*(.*)$/gm;
let qCache: { text: string; map: Map<string, number> } | null = null;
/** Plain text of a markdown title, close to what Obsidian shows. */
function plainTitle(md: string): string {
  return md.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_`~=]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}
/**
 * Question numbers from the note text: top-level callouts count 1, 2, 3…
 * (nested Answers are not questions). Keyed like `toggleIdentity` (kind + title),
 * so a question keeps its real number even when Obsidian has drawn only part of a long note.
 */
export function sourceQuestionNumbers(text: string | null | undefined): Map<string, number> {
  const raw = String(text ?? "");
  if (qCache?.text === raw) return qCache.map;
  const map = new Map<string, number>();
  let n = 0;
  for (const m of withoutFences(raw).matchAll(TOP_CALLOUT_RE)) {
    n++;
    const kind = m[1].trim().toLowerCase();
    const title = plainTitle(m[2]) || kind;
    const key = `${kind}\u0000${title}`;
    if (!map.has(key)) map.set(key, n);
  }
  qCache = { text: raw, map };
  return map;
}
