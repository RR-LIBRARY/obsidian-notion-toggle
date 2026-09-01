/**
 * v1.4.7 — where a stop lands on screen, and the skip-proof stop queue.
 *
 * Kept out of main.ts (and free of Obsidian) so the "toggle opens in the middle
 * of the screen" rule and the "no toggle is ever skipped" rule are both
 * testable without a vault.
 */
import { anchorOffset, type StopAnchor } from "./autoscroll";
import { crossedTargets, dwellTargets, layoutSignature, pageStops, type DwellSettings, type PageBox } from "./scrollmode";
import type { DwellTarget } from "./scrollmode";

/** Minimal scroll-container shape (a real HTMLElement satisfies it). */
export interface ScrollBox {
  clientHeight: number;
  scrollHeight: number;
}

/**
 * Scroll offset that puts a toggle at the reader's chosen place on screen.
 * Portrait and landscape run the same maths — only `clientHeight` differs — so
 * a stop that sits mid-screen upright also sits mid-screen turned sideways.
 */
export function anchorScrollTop(
  container: ScrollBox,
  top: number,
  height: number,
  anchor: StopAnchor
): number {
  return anchorOffset(
    top,
    height,
    container.clientHeight,
    anchor,
    Math.max(0, container.scrollHeight - container.clientHeight)
  );
}

export interface StopPick {
  /** The stop to park on now (nearest in travel order), if any. */
  stop: DwellTarget | undefined;
  /** Stops left behind by a layout shift — counted as recovered skips. */
  missed: DwellTarget[];
  /** Everything still owed a visit on this leg, in travel order. */
  queue: DwellTarget[];
}

/**
 * Which stop the loop should park on this frame.
 *
 * Three skip sources are handled together:
 *  1. one frame crossing several stops (high speed, a long phone frame, or the
 *     first frame back from the background) — all of them are queued;
 *  2. a stop that a re-measure moved *behind* the playhead (a toggle above just
 *     opened or closed) — still unvisited, so it is picked up as "missed";
 *  3. two stops sharing a dwell key — the guard is a per-stop visited set.
 *
 * v1.5.7 — `donePages` closes the "one toggle keeps re-opening" loop. Opening a
 * toggle makes it taller, so the forced re-measure can hand the *same* toggle a
 * larger set of chunk keys (`7:1`, `7:2` …) that were never visited. Those new
 * keys sit behind the playhead, so the "missed" rescue used to jump straight
 * back onto the toggle the run had just finished. A toggle already recorded as
 * visited can therefore never be rescued backwards again; chunk reading still
 * works, because those stops are reached *forwards* as `crossed`.
 */
export function pickStops(
  targets: DwellTarget[],
  prevPos: number,
  pos: number,
  dir: number,
  visited: ReadonlySet<string>,
  donePages: ReadonlySet<number> = new Set()
): StopPick {
  const unvisited = (t: DwellTarget) => !visited.has(t.key);
  // A finished toggle's *first* stop can also drift forward when the toggle
  // grows, so it must not be crossed a second time either. Its continuation
  // chunks (index > 0) stay eligible: that is how a tall answer is read on.
  const reopens = (t: DwellTarget) => donePages.has(t.page) && t.index === 0;
  const crossed = crossedTargets(targets, prevPos, pos, dir).filter((t) => unvisited(t) && !reopens(t));

  const missed = targets.filter(
    (t) =>
      unvisited(t) &&
      !donePages.has(t.page) &&
      !crossed.some((c) => c.key === t.key) &&
      (dir < 0 ? t.top > pos + 1 : t.top < pos - 1)
  );
  const queue = [...missed, ...crossed].sort((a, b) => (dir < 0 ? b.top - a.top : a.top - b.top));
  return { stop: queue[0], missed, queue };
}


/** Cache key for anchored targets: viewport, dwell config, anchor and layout. */
export function targetsKey(
  container: ScrollBox,
  cfg: DwellSettings,
  anchor: StopAnchor,
  boxes: PageBox[]
): string {
  return `${container.clientHeight}|${cfg.a4}|${cfg.parity}|${cfg.pages.join(",")}|${anchor}|${layoutSignature(boxes)}`;
}

/**
 * Dwell targets whose `top` is already the scroll offset that puts the toggle
 * at the reader's anchor. A4 continuation stops keep the screen-top anchor so a
 * long toggle scrolls a screenful at a time.
 */
export function anchoredTargets(
  boxes: PageBox[],
  cfg: DwellSettings,
  container: ScrollBox,
  anchor: StopAnchor
): DwellTarget[] {
  const heights = new Map(boxes.map((b) => [b.page, b.height]));
  return dwellTargets(boxes, cfg, container.clientHeight)
    .map((t) => ({
      ...t,
      top: anchorScrollTop(
        container,
        t.top,
        cfg.a4 && t.index > 0 ? container.clientHeight : heights.get(t.page) ?? 0,
        anchor
      ),
    }))
    .sort((a, b) => a.top - b.top);
}

/**
 * v1.4.10 — every anchored `scrollTop` a route waypoint parks at. A4 mode
 * turns a tall toggle into one stop per screenful; otherwise the toggle has a
 * single stop. Pure, so route legs are testable without a view.
 */
export function routeStopTops(
  container: ScrollBox,
  box: { top: number; height: number },
  a4: boolean,
  anchor: StopAnchor
): number[] {
  const tops = a4 ? pageStops(box.top, box.height, container.clientHeight) : [box.top];
  return tops.map((top, i) =>
    anchorScrollTop(container, top, a4 && i > 0 ? container.clientHeight : box.height, anchor)
  );
}
