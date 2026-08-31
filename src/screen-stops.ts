/**
 * v1.5.2 — screen-by-screen ("page") reading stops for the whole note.
 *
 * `scrollChunkTall` only chunks *inside* one tall toggle. Readers also asked for
 * the plain reading-view behaviour: park on whatever fills the screen right now
 * (mobile or desktop, portrait or landscape), hold for the dwell time, then
 * advance exactly one screenful — until the note ends.
 *
 * Everything here is pure maths on content-space pixels so it is testable
 * without Obsidian or a DOM.
 */

import type { PageBox } from "./scrollmode";

/** How much of the previous screen stays visible, so lines are never cut. */
export const DEFAULT_SCREEN_OVERLAP = 0.1;
export const MAX_SCREEN_OVERLAP = 0.5;
/** Hard ceiling so a broken measurement can never build a million stops. */
export const MAX_SCREEN_STOPS = 2000;

/** How screen stops and toggle stops are combined during a run. */
export type AdvanceBy = "toggles" | "screens" | "both";
const KNOWN_ADVANCE: AdvanceBy[] = ["toggles", "screens", "both"];

export function normalizeAdvanceBy(value: unknown): AdvanceBy {
  return KNOWN_ADVANCE.includes(value as AdvanceBy) ? (value as AdvanceBy) : "toggles";
}

export function clampScreenOverlap(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_SCREEN_OVERLAP, Math.round(n * 100) / 100);
}

export function advanceLabel(mode: AdvanceBy): string {
  if (mode === "screens") return "Screens";
  if (mode === "both") return "Toggles + screens";
  return "Toggles";
}

/**
 * Content-space tops of every screenful, ascending.
 *
 * The first stop is always the top of the note; the last stop is clamped so it
 * shows the final screenful instead of scrolling past the end. A note shorter
 * than one screen has exactly one stop.
 */
export function screenStops(
  contentHeight: number,
  viewport: number,
  overlap: number = DEFAULT_SCREEN_OVERLAP
): number[] {
  const vh = Math.max(1, Math.floor(Number.isFinite(Number(viewport)) ? Number(viewport) : 0));
  const height = Math.max(0, Math.floor(Number.isFinite(Number(contentHeight)) ? Number(contentHeight) : 0));
  if (height <= vh) return [0];
  const step = Math.max(1, Math.round(vh * (1 - clampScreenOverlap(overlap))));
  const last = height - vh;
  const out: number[] = [];
  for (let top = 0; top < last && out.length < MAX_SCREEN_STOPS - 1; top += step) {
    out.push(top);
  }
  out.push(last);
  return out;
}

/** Screen stops as page boxes. Negative page ids mark "not a toggle". */
export function screenBoxes(
  contentHeight: number,
  viewport: number,
  overlap: number = DEFAULT_SCREEN_OVERLAP
): PageBox[] {
  const vh = Math.max(1, Math.floor(viewport));
  return screenStops(contentHeight, viewport, overlap).map((top, i) => ({
    page: -(i + 1),
    top,
    height: vh,
  }));
}

/** True for a synthetic screen stop (no toggle to open / grade). */
export function isScreenStop(page: number): boolean {
  return !Number.isFinite(page) || page <= 0;
}

/**
 * Merge screen stops with the (already filtered + parity-matched) toggle stops.
 *
 * Toggle stops win: a screen stop that would land within `tolerance` of a
 * toggle stop is dropped, so "both" mode never double-pauses on the same view.
 */
export function mergeStops<T extends { top: number }>(
  screens: T[],
  toggles: T[],
  tolerance = 0
): T[] {
  const tol = Math.max(0, Math.floor(tolerance));
  const keep = screens.filter((s) => !toggles.some((t) => Math.abs(t.top - s.top) <= tol));
  return [...toggles, ...keep].sort((a, b) => a.top - b.top);
}
