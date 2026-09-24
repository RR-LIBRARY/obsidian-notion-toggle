/**
 * v1.7.1 — screen stops and "open / close all" as first-class run behaviour.
 *
 * Pure helpers (no Obsidian import) so the orchestration in `main.ts` stays
 * thin and every rule here is unit-tested:
 *
 *  - `gapScreenStops`  — "Toggles + screens": screenful stops that fill the
 *    gaps *between* toggle stops instead of a global grid that duplicates or
 *    shadows the toggles.
 *  - `stopHoldMs`      — which dwell a stop gets (toggle hold vs screen dwell).
 *  - `keepOpenAtDwellEnd` — never auto-close a tall toggle while continuation
 *    stops (chunks / screen stops inside the answer) are still ahead.
 *  - `waitFor`         — poll until the DOM caught up with a forced full render.
 *  - `answersNotice`   — honest "opened N of M" copy for Open all / Close all.
 */
import { isScreenStop } from "./screen-stops";

export const SCREEN_KEY_PREFIX = "screen:";
/** Hard cap so a broken measurement can never plan thousands of stops. */
export const MAX_GAP_SCREEN_STOPS = 400;

export interface ScreenGapStop {
  /** Negative page ordinal — recognised by `isScreenStop`. */
  page: number;
  top: number;
  height: number;
  index: 0;
  /** Stable key: `screen:<anchor>:<n>` — survives re-measurement. */
  key: string;
  identity: string;
}

interface TopWithKey {
  top: number;
  key: string;
}

/**
 * Screenful stops between consecutive toggle stops.
 *
 * Every segment runs from one toggle top (or 0 for the lead-in) to the next
 * toggle top (or `maxScroll` for the tail). Inside a segment we step by
 * `stepPx` and drop anything within `tolerance` of the segment ends — the
 * toggle stop already pauses there. The tail segment ends with an explicit
 * stop at `maxScroll` so the note's last screenful is read too.
 *
 * Keys are derived from the segment's anchor toggle (`^` for the lead-in), so
 * a re-measure that moves everything by a few pixels keeps the visited set
 * intact — no double pause, no skipped screen.
 */
export function gapScreenStops(
  toggleStops: readonly TopWithKey[],
  stepPx: number,
  maxScroll: number,
  tolerance: number,
  screenHeight = stepPx
): ScreenGapStop[] {
  const out: ScreenGapStop[] = [];
  const step = Math.floor(stepPx);
  const tol = Math.max(0, tolerance);
  const end = Math.max(0, Math.floor(maxScroll));
  // A zero / NaN step means the screen was never measured: plan nothing rather
  // than a 1 px grid (the cap below is a last resort, not the normal path).
  if (!Number.isFinite(step) || step < 1 || step <= tol || !Number.isFinite(end) || end <= 0) return out;
  const anchors = [...toggleStops]
    .filter((s) => Number.isFinite(s.top))
    .sort((a, b) => a.top - b.top)
    .filter((s, i, arr) => i === 0 || Math.abs(s.top - arr[i - 1].top) > tol);
  const segments: { start: number; end: number; anchor: string }[] = [];
  let start = 0;
  let anchor = "^";
  for (const a of anchors) {
    const top = Math.max(0, Math.min(end, a.top));
    segments.push({ start, end: top, anchor });
    start = top;
    anchor = a.key;
  }
  segments.push({ start, end, anchor });
  const push = (top: number, key: string) => {
    if (out.length >= MAX_GAP_SCREEN_STOPS) return;
    out.push({
      page: -(out.length + 1),
      top,
      height: screenHeight,
      index: 0,
      key,
      identity: key,
    });
  };
  for (const seg of segments) {
    if (seg.end - seg.start <= tol) continue;
    let n = 1;
    let last = seg.start;
    for (let top = seg.start + step; top < seg.end - tol; top += step, n++) {
      push(top, `${SCREEN_KEY_PREFIX}${seg.anchor}:${n}`);
      last = top;
    }
    // Tail: the very last screenful (nothing after it would pause there).
    if (seg.end === end && end - last > tol) push(end, `${SCREEN_KEY_PREFIX}${seg.anchor}:end`);
  }
  return out;
}

/** Same stops, expressed as the planner's `{ top, ordinal }` list. */
export function screenPlanEntries(tops: readonly number[]): { top: number; ordinal: number }[] {
  return tops.map((top, i) => ({ top, ordinal: -(i + 1) }));
}

/**
 * How long the run parks on `stop`. A toggle's *first* stop gets the toggle
 * hold (`holdSeconds`); every continuation chunk and every screen stop gets
 * the dedicated screen dwell — the "Screen pause duration" slider is finally
 * honoured outside route mode.
 */
export function stopHoldMs(
  stop: { page: number; index: number },
  holdSeconds: number,
  screenDwellMs: number,
  chunked = false
): number {
  const screen = Math.max(0, screenDwellMs);
  if (isScreenStop(stop.page) || stop.index > 0) return screen;
  const hold = Math.max(0, holdSeconds) * 1000;
  // v1.7.5 — a tall (chunked) toggle's first screen is read too: wait at least the screen pause.
  return chunked ? Math.max(hold, screen) : hold;
}

/** A stop is a continuation of an already-open toggle (chunk 2, 3, …). */
export function isContinuationStop(stop: { page: number; index: number }): boolean {
  return !isScreenStop(stop.page) && stop.index > 0;
}

/** Log line for the debug overlay / stats — screen stops have no ordinal. */
export function screenStopLabel(stop: { key: string; top: number }, dwellMs: number): string {
  return `screen stop ${stop.key.replace(SCREEN_KEY_PREFIX, "")} @ ${Math.round(stop.top)} · ${(
    dwellMs / 1000
  ).toFixed(1)}s`;
}

export interface OpenBox {
  identity?: string | null;
  page?: number;
  top: number;
  height: number;
}

/**
 * True while the open toggle still has unread stops ahead in the run
 * direction: its own continuation chunks, or screen stops that land inside
 * its answer. "Close them when leaving" waits for those, so a tall answer is
 * never folded after its first screenful.
 */
export function keepOpenAtDwellEnd(
  targets: readonly { page: number; top: number; index: number; key: string; identity?: string }[],
  visited: ReadonlySet<string>,
  open: OpenBox | null | undefined,
  pos: number,
  dir: 1 | -1
): boolean {
  if (!open) return false;
  const bottom = open.top + Math.max(0, open.height);
  for (const t of targets) {
    if (visited.has(t.key)) continue;
    const ahead = dir < 0 ? t.top < pos - 1 : t.top > pos + 1;
    if (!ahead) continue;
    const sameToggle =
      !isScreenStop(t.page) &&
      t.index > 0 &&
      ((open.identity && t.identity === open.identity) ||
        (!open.identity && open.page !== undefined && t.page === open.page));
    if (sameToggle) return true;
    if (isScreenStop(t.page) && t.top > open.top && t.top < bottom) return true;
  }
  return false;
}

export interface WaitOptions {
  /** Poll interval in ms. */
  everyMs?: number;
  /** Give up after this long (ms). */
  timeoutMs?: number;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  now?: () => number;
}

/**
 * Resolve `true` as soon as `ready()` holds, `false` after `timeoutMs`.
 * Used after forcing the full render so "Open all" acts on the *whole* note
 * rather than the screenful Obsidian had rendered when the button was tapped.
 */
export function waitFor(ready: () => boolean, opts: WaitOptions = {}): Promise<boolean> {
  const every = Math.max(1, opts.everyMs ?? 50);
  const timeout = Math.max(0, opts.timeoutMs ?? 2500);
  const schedule = opts.setTimeout ?? ((fn, ms) => setTimeout(fn, ms));
  const now = opts.now ?? (() => Date.now());
  const started = now();
  return new Promise((resolve) => {
    const tick = () => {
      let ok = false;
      try {
        ok = ready();
      } catch {
        ok = false;
      }
      if (ok) return resolve(true);
      if (now() - started >= timeout) return resolve(false);
      schedule(tick, every);
    };
    tick();
  });
}

export interface AnswersResult {
  /** Toggles whose state changed. */
  changed: number;
  /** Toggles found in the rendered note (including nested ones). */
  rendered: number;
  /** Toggles the note source declares (0 = unknown). */
  total: number;
}

/**
 * Notice copy: honest about partial results, silent-friendly when complete.
 *
 * v1.7.2 — the count is always "N of M", and a partial result no longer tells
 * the reader to scroll down and tap again: the sticky state applies the same
 * command to every answer the renderer builds later, so the rest follow on
 * their own.
 */
export function answersNotice(open: boolean, r: AnswersResult): string {
  const verb = open ? "Opened" : "Closed";
  const noun = (n: number) => `${n} answer${n === 1 ? "" : "s"}`;
  if (r.rendered === 0) return "No answer toggles in this note.";
  const total = Math.max(r.total, r.rendered);
  if (r.total > r.rendered) {
    return `${verb} ${r.rendered} of ${total} answers — the rest will ${
      open ? "open" : "close"
    } as you scroll.`;
  }
  if (r.changed === 0) return `All ${noun(r.rendered)} already ${open ? "open" : "closed"}.`;
  if (total === 1) return `${verb} ${noun(1)}.`;
  return `${verb} ${r.rendered} of ${total} answers.`;
}


/** Should the notice show even in quiet mode? Only when something is off. */
export function answersNoticeIsImportant(r: AnswersResult): boolean {
  return r.rendered === 0 || r.total > r.rendered;
}
