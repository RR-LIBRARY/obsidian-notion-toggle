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

/* ---------- v1.5.3 — customisable viewport + filter-aware screens ---------- */

/** Usable fraction of the real viewport that counts as one "screenful". */
export const DEFAULT_VIEWPORT_PCT = 0.9;
export const MIN_VIEWPORT_PCT = 0.5;
/** How long a plain screen stop is held, in ms. */
export const DEFAULT_SCREEN_DWELL_MS = 4000;
export const MIN_SCREEN_DWELL_MS = 250;
export const MAX_SCREEN_DWELL_MS = 120000;

export function clampViewportPct(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_VIEWPORT_PCT;
  const pct = n > 1 ? n / 100 : n;
  return Math.min(1, Math.max(MIN_VIEWPORT_PCT, Math.round(pct * 100) / 100));
}

export function clampScreenDwellMs(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SCREEN_DWELL_MS;
  return Math.min(MAX_SCREEN_DWELL_MS, Math.max(MIN_SCREEN_DWELL_MS, Math.round(n)));
}

/**
 * One screenful in content pixels: the same percentage setting works on a phone
 * and on a desktop because it is applied to the live client height.
 */
export function usableViewport(clientHeight: number, pct: unknown = DEFAULT_VIEWPORT_PCT): number {
  const h = Number(clientHeight);
  const vh = Number.isFinite(h) && h > 0 ? h : 1;
  return Math.max(1, Math.floor(vh * clampViewportPct(pct)));
}

/**
 * v1.5.3 — with a colour / callout filter on, only the screens that actually
 * contain a kept toggle are worth stopping on. Empty screens (or screens whose
 * toggles were filtered out) are dropped, so a red-only run never parks on a
 * screenful of yellow toggles.
 *
 * `toggleTops` are the content-space tops of the *kept* toggles. An empty list
 * means "no filter information" → every screen is kept.
 */
export function filterScreenStops(
  stops: number[],
  toggleTops: number[],
  viewport: number,
  prune = true
): number[] {
  // v1.5.4 — while the note is still rendering the kept-toggle list is
  // incomplete, so pruning would throw away screens that *do* hold a matching
  // toggle a moment later. The caller passes `prune: false` until the DOM has
  // caught up with the note source.
  if (!prune) return stops;
  const tops = toggleTops.filter((t) => Number.isFinite(t));
  if (tops.length === 0) return stops;
  const vh = Math.max(1, Math.floor(viewport));
  const kept = stops.filter((top) => tops.some((t) => t >= top && t < top + vh));
  return kept;
}

/* ---------- v1.5.4 — one exact derivation shared by all three modes ---------- */

export interface ScreenPlan {
  /** Real container height, in px. */
  viewportPx: number;
  /** Fraction of it that counts as one screenful. */
  pct: number;
  /** One screenful, in px. */
  screenPx: number;
  /** Overlap fraction and its pixel value. */
  overlap: number;
  overlapPx: number;
  /** How far the note advances per screen stop, in px. */
  stepPx: number;
  /** Content-space tops, ascending. */
  stops: number[];
  /** Number of screen stops. */
  count: number;
  /** Top of the final screenful. */
  lastTop: number;
}

/**
 * The full screen-stop derivation, so `main.ts`, the settings tab and the quick
 * sheet all read the same numbers instead of each recomputing a part of them.
 */
export function screenPlan(
  contentHeight: number,
  clientHeight: number,
  pct: unknown = DEFAULT_VIEWPORT_PCT,
  overlap: unknown = DEFAULT_SCREEN_OVERLAP
): ScreenPlan {
  const viewportPx = Math.max(1, Math.floor(Number(clientHeight) > 0 ? Number(clientHeight) : 1));
  const usedPct = clampViewportPct(pct);
  const screenPx = usableViewport(viewportPx, usedPct);
  const usedOverlap = clampScreenOverlap(overlap);
  const stepPx = Math.max(1, Math.round(screenPx * (1 - usedOverlap)));
  const stops = screenStops(contentHeight, screenPx, usedOverlap);
  return {
    viewportPx,
    pct: usedPct,
    screenPx,
    overlap: usedOverlap,
    overlapPx: screenPx - stepPx,
    stepPx,
    stops,
    count: stops.length,
    lastTop: stops.length ? stops[stops.length - 1] : 0,
  };
}

/** "745 px × 90% = 670 px · overlap 10% = 67 px · step 603 px · 12 screens" */
export function describeScreenPlan(plan: ScreenPlan): string {
  return [
    `${plan.viewportPx} px × ${Math.round(plan.pct * 100)}% = ${plan.screenPx} px`,
    `overlap ${Math.round(plan.overlap * 100)}% = ${plan.overlapPx} px`,
    `step ${plan.stepPx} px`,
    `${plan.count} screen${plan.count === 1 ? "" : "s"}`,
  ].join(" · ");
}

/**
 * How close a screen stop may sit to a toggle stop before it is dropped in
 * "Toggles + screens" mode. A quarter screen keeps the two kinds of pause from
 * landing on the same view.
 */
export function screenMergeTolerance(screenPx: number): number {
  return Math.max(1, Math.round(Math.max(1, screenPx) * 0.25));
}

