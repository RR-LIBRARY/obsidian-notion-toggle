/**
 * v1.1.1 — "pause on pages" for toggles.
 *
 * The rules (clamps, list parsing, parity matching, A4 screen-by-screen stops,
 * crossing detection) are the **exact** engine from the Naveen Bharat reader:
 * see `src/reader/dwellEngine.ts`, copied verbatim from
 * `mranujbabu/navinbharat → src/lib/reader/dwellEngine.ts`.
 *
 * This file is only the adapter: a reader "page" is a plugin toggle, and the
 * speed ladder mirrors the reader's autoscroll sheet presets.
 */

import {
  DEFAULT_DWELL,
  DWELL_MAX_SECONDS,
  DWELL_MIN_SECONDS,
  DWELL_SLIDER_STEPS,
  MAX_LIST_LENGTH,
  clampDwellSeconds as clampDwellSecondsUpstream,
  crossedTarget,
  dwellStepIndex,
  dwellTargets,
  isRouteMode,
  matchesParity,
  normalizeDwell,
  pageStops,
  parseDwell,
  parsePageList,
  parseRouteList,
  waypointReached,
  type DwellParity,
  type DwellSettings,
  type DwellTarget,
  type PageBox,
} from "./reader/dwellEngine";

export {
  DEFAULT_DWELL,
  DWELL_MAX_SECONDS,
  DWELL_MIN_SECONDS,
  DWELL_SLIDER_STEPS,
  MAX_LIST_LENGTH,
  crossedTarget,
  dwellStepIndex,
  dwellTargets,
  isRouteMode,
  matchesParity,
  normalizeDwell,
  pageStops,
  parseDwell,
  parsePageList,
  parseRouteList,
  waypointReached,
};
export type { DwellParity, DwellSettings, DwellTarget, PageBox };

/** Plugin-side names: a reader "page" is a toggle, a "parity" is a pause-at mode. */
export type ScrollMode = DwellParity;
export const DWELL_PRESETS = DWELL_SLIDER_STEPS;
export const DWELL_MAX = DWELL_MAX_SECONDS;

/** Speed chips from the reader's autoscroll sheet (AutoScrollSheet.tsx). */
export const SPEED_MULTIPLIERS = [
  0.02, 0.05, 0.1, 0.2, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7, 10, 20,
];
/** Reader ceiling: 20 × ~1px per 16.67ms frame (autoScrollLimits.ts). */
export const MAX_SPEED_MULTIPLIER = 20;
/** 1x ≈ 1px per frame ≈ 60 px/s, which is what the plugin loop speaks. */
export const BASE_SPEED = 60;

export function clampDwellSeconds(value: unknown, fallback?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback ?? DEFAULT_DWELL.seconds;
  return clampDwellSecondsUpstream(n);
}

export function nearestDwellPreset(seconds: number): number {
  return DWELL_SLIDER_STEPS[dwellStepIndex(clampDwellSeconds(seconds))];
}

export function nearestSpeedMultiplier(mult: number): number {
  const n = Number.isFinite(mult) ? mult : 1;
  let best = SPEED_MULTIPLIERS[0];
  let dist = Infinity;
  for (const m of SPEED_MULTIPLIERS) {
    const d = Math.abs(m - n);
    if (d < dist) {
      dist = d;
      best = m;
    }
  }
  return best;
}

export function speedFromMultiplier(mult: number): number {
  // Two decimals keep 0.02x (1.2 px/s) alive; whole pixels would floor it away.
  return Math.max(0.6, Math.round(BASE_SPEED * nearestSpeedMultiplier(mult) * 100) / 100);
}

export function multiplierFromSpeed(px: number): number {
  return nearestSpeedMultiplier((Number(px) || BASE_SPEED) / BASE_SPEED);
}

export function formatDwell(seconds: number): string {
  const s = clampDwellSeconds(seconds);
  if (s >= 3600) return `${Math.round(s / 3600)}h`;
  if (s >= 60) return s % 60 === 0 ? `${s / 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

/* -------------------- plugin-facing wrappers (toggles) -------------------- */

export interface ModeConfig {
  mode: ScrollMode;
  /** 1-based toggle numbers for "custom". */
  picks: number[];
  /** 1-based toggle numbers, in visit order, for "route" / "shuffle". */
  route: number[];
  /** Replay the route from the start when it finishes. */
  loopRoute?: boolean;
  /** Limit shuffle stops to this 1-based range (0 = whole note). */
  shuffleFrom?: number;
  /** Upper bound of the shuffle range (0 = whole note). */
  shuffleTo?: number;
}

export interface ModeItem {
  ordinal: number;
  top: number;
  height: number;
}

export interface ModeStop {
  ordinal: number;
  top: number;
  part: number;
  key: string;
}

/**
 * A custom / route selection with no numbers yet would produce zero stops and a
 * dead run — fall back to "every toggle" until the reader fills the list in.
 */
export function effectiveMode(cfg: ModeConfig): ScrollMode {
  if (cfg.mode === "custom" && cfg.picks.length === 0) return "all";
  if ((cfg.mode === "route" || cfg.mode === "shuffle") && cfg.route.length === 0) return "all";
  return cfg.mode;
}

/** ModeConfig → the reader's DwellSettings shape, so the exact rules apply. */
export function toDwellSettings(cfg: ModeConfig, seconds = DEFAULT_DWELL.seconds, a4 = true): DwellSettings {
  return normalizeDwell({
    enabled: true,
    parity: effectiveMode(cfg),
    seconds,
    pages: cfg.picks,
    route: cfg.route,
    loopRoute: !!cfg.loopRoute,
    a4,
    shuffleFrom: cfg.shuffleFrom ?? 0,
    shuffleTo: cfg.shuffleTo ?? 0,
  });
}


/**
 * v1.4.6 — pick list with range support.
 *
 * The vendored reader engine splits on every non-digit, so "3-5" meant
 * "toggles 3 and 5" and quietly lost 4. Readers type ranges, so expand
 * `a-b` (either way round) before handing the numbers to the engine.
 */
export function parsePicks(raw: string): number[] {
  const expanded = String(raw ?? "").replace(
    /(\d{1,4})\s*(?:-|–|—|to|through)\s*(\d{1,4})/gi,
    (_m, a: string, b: string) => {
      const lo = Math.min(Number(a), Number(b));
      const hi = Math.max(Number(a), Number(b));
      if (hi - lo > MAX_LIST_LENGTH) return `${lo},${hi}`;
      const out: number[] = [];
      for (let n = lo; n <= hi; n += 1) out.push(n);
      return out.join(",");
    }
  );
  return parsePageList(expanded);
}

export const parseRoute = parseRouteList;

const KNOWN_MODES: ScrollMode[] = ["all", "odd", "even", "custom", "route", "shuffle"];

/**
 * v1.4.6 — an unknown / corrupt saved mode falls back to "every toggle".
 * The upstream reader engine defaults to "odd", which turned a damaged plan
 * into a run that silently skipped half the note.
 */
export function normalizeMode(mode: unknown): ScrollMode {
  return KNOWN_MODES.includes(mode as ScrollMode)
    ? normalizeDwell({ parity: mode as DwellParity }).parity
    : "all";
}

/** Should we stop at this (1-based) toggle number? */
export function matchesMode(cfg: ModeConfig, ordinal: number): boolean {
  return matchesParity(toDwellSettings(cfg), ordinal);
}

/** Screen-by-screen stops inside one tall toggle (the reader's A4 mode). */
export function chunkTops(top: number, height: number, viewport: number): number[] {
  return pageStops(top, height, viewport);
}

/** Is this toggle number inside the configured shuffle range? */
export function inShuffleRange(cfg: ModeConfig, ordinal: number): boolean {
  const from = Math.max(0, Math.floor(cfg.shuffleFrom ?? 0));
  const to = Math.max(0, Math.floor(cfg.shuffleTo ?? 0));
  if (!from && !to) return true;
  const lo = from || 1;
  const hi = to || Number.MAX_SAFE_INTEGER;
  return ordinal >= Math.min(lo, hi) && ordinal <= Math.max(lo, hi);
}

/** Every stop for the current mode, ascending — `dwellTargets` under the hood. */
export function buildModeStops(
  items: ModeItem[],
  cfg: ModeConfig,
  viewport: number,
  chunkTall: boolean
): ModeStop[] {
  const boxes: PageBox[] = items.map((i) => ({ page: i.ordinal, top: i.top, height: i.height }));
  const stops = dwellTargets(
    boxes,
    toDwellSettings(cfg, DEFAULT_DWELL.seconds, chunkTall),
    viewport
  ).map((t) => ({ ordinal: t.page, top: t.top, part: t.index, key: t.key }));
  if (effectiveMode(cfg) !== "shuffle") return stops;
  return stops.filter((s) => inShuffleRange(cfg, s.ordinal));
}

/**
 * Visit order. "route" / "shuffle" follow the saved waypoint order (duplicates
 * kept, like the reader's route legs); everything else follows the note.
 */
export function orderModeStops(stops: ModeStop[], cfg: ModeConfig, reverse: boolean): ModeStop[] {
  const mode = effectiveMode(cfg);
  if (mode === "route" || mode === "shuffle") {
    const byOrdinal = new Map<number, ModeStop[]>();
    for (const s of stops) {
      const list = byOrdinal.get(s.ordinal) ?? [];
      list.push(s);
      byOrdinal.set(s.ordinal, list);
    }
    const out: ModeStop[] = [];
    for (const ordinal of cfg.route) {
      if (mode === "shuffle" && !inShuffleRange(cfg, ordinal)) continue;
      const list = byOrdinal.get(ordinal);
      if (list) out.push(...list);
    }
    return out;
  }
  const sorted = [...stops].sort((a, b) => a.top - b.top);
  return reverse ? sorted.reverse() : sorted;
}


export function modeLabel(cfg: ModeConfig): string {
  switch (cfg.mode) {
    case "all":
      return "every toggle";
    case "odd":
      return "odd toggles";
    case "even":
      return "even toggles";
    case "custom":
      return `custom (${cfg.picks.length})`;
    case "route":
      return `route (${cfg.route.length})`;
    case "shuffle":
      return `shuffle (${cfg.route.length})`;
  }
}

/**
 * v1.4.3 — one line that confirms what the plan actually does, including the
 * two options that used to change silently: "Loop the route" and the shuffle
 * range. Shown as a toast whenever either one is edited.
 */
export function planSummary(cfg: ModeConfig): string {
  const parts = [`Plan: ${modeLabel(cfg)}`];
  const mode = effectiveMode(cfg);
  if (mode === "route" || mode === "shuffle") {
    parts.push(cfg.loopRoute ? "loop ON" : "loop OFF");
  }
  const from = Math.max(0, Math.floor(cfg.shuffleFrom || 0));
  const to = Math.max(0, Math.floor(cfg.shuffleTo || 0));
  if (mode === "shuffle") {
    parts.push(from > 0 || to > 0 ? `range ${from || 1}–${to || "end"}` : "range: whole note");
  }
  return parts.join(" · ");
}


export function modeIcon(mode: ScrollMode): string {
  return mode === "odd"
    ? "1️⃣"
    : mode === "even"
      ? "2️⃣"
      : mode === "custom"
        ? "✍️"
        : mode === "route"
          ? "🧭"
          : mode === "shuffle"
            ? "🔀"
            : "∞";
}

/* ------------------- loop helpers (reader loop, extracted) ----------------- */

/**
 * Route mode owns the direction: each leg heads toward its waypoint, so the
 * sign flips automatically (6 down -> 3 up -> 8 down). Mirrors useAutoScroll:
 * `if (Math.abs(delta) > 0.5) dir = delta > 0 ? 1 : -1`.
 */
export function legDirection(target: number, pos: number, current: 1 | -1): 1 | -1 {
  const delta = target - pos;
  if (Math.abs(delta) <= 0.5) return current;
  return delta > 0 ? 1 : -1;
}

/**
 * Float position accumulator. `scrollTop` snaps to whole device pixels, so the
 * remainder must live outside the DOM or slow speeds stall completely.
 */
export function advancePosition(
  pos: number,
  perFrame: number,
  dt: number,
  dir: 1 | -1,
  max: number
): number {
  return Math.max(0, Math.min(max, pos + perFrame * dt * dir));
}

/**
 * v1.4.2 — where a run should begin.
 *
 * Reverse autoscroll started at the very top used to clamp at 0 on the first
 * frame and instantly report "finished". A run whose direction points at the
 * edge it is already sitting on starts from the *opposite* edge instead.
 */
export function seedStartOffset(scrollTop: number, max: number, reverse: boolean): number {
  const top = Math.max(0, Math.min(Math.max(0, max), scrollTop));
  if (max <= 2) return top;
  if (reverse && top <= 1) return max;
  if (!reverse && top >= max - 1) return 0;
  return top;
}

/**
 * v1.4.2 — an edge only finishes the run once the loop actually moved.
 * Without `movedPx` a reverse run could "finish" on frame one.
 */
export function finishedAtEdge(pos: number, max: number, dir: 1 | -1, movedPx: number): boolean {
  if (movedPx <= 1) return false;
  return dir < 0 ? pos <= 1 : pos >= max - 1;
}


/** Frame delta factor, capped like the reader (avoids jumps after tab-away). */
export function frameFactor(deltaMs: number): number {
  return Math.min(4, Math.max(0, deltaMs) / 16.67);
}

/** A stop only fires once per direction — guarded by its "page:slice" key. */
export function shouldPark(previousKey: string | null, crossed: { key: string } | undefined): boolean {
  return !!crossed && previousKey !== crossed.key;
}

/**
 * v1.4.7 — **every** target crossed by one frame, in travel order.
 *
 * `crossedTarget()` returns a single stop, so a fast frame that flew past three
 * toggles parked on one and silently dropped the other two. Callers park on the
 * first and keep the rest pending, so no stop is skipped.
 */
export function crossedTargets(
  targets: DwellTarget[],
  prevPos: number,
  pos: number,
  dir: number
): DwellTarget[] {
  const lo = Math.min(prevPos, pos);
  const hi = Math.max(prevPos, pos);
  const hits = targets.filter((t) => t.top > lo + 0.001 && t.top <= hi + 0.001);
  hits.sort((a, b) => a.top - b.top);
  return dir < 0 ? hits.reverse() : hits;
}

/** v1.4.7 — crossed stops that still owe a visit. */
export function pendingAfterPark(
  crossed: DwellTarget[],
  visited: ReadonlySet<string>
): DwellTarget[] {
  return crossed.filter((t) => !visited.has(t.key));
}

/**
 * v1.4.7 — signature of the measured layout. Opening a toggle moves every box
 * below it while the *count* stays the same, so a cache keyed on the count
 * alone kept serving stale tops and walked straight past the moved stops.
 */
export function layoutSignature(boxes: { top: number; height: number }[]): string {
  return boxes.map((b) => `${Math.round(b.top)}:${Math.round(b.height)}`).join(",");
}
