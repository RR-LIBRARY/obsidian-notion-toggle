/**
 * v1.0.9 — Auto-scroll + auto-toggle recall engine (pure module).
 *
 * Inspired by the "autoscroller" idea (ChasKane/autoscroller): the note scrolls
 * by itself at a chosen speed, forwards or in reverse, while the plugin opens
 * the toggle it stops at and closes the previous one. A colour filter lets you
 * revise only 🔴 / 🟡 / 🟢 toggles.
 *
 * No Obsidian / DOM imports here so the logic stays unit-testable.
 */

export type RecallColor = "red" | "yellow" | "green" | "other";

export interface AutoScrollSettings {
  /** Pixels per second while gliding between toggles. */
  scrollSpeed: number;
  /** Scroll upwards (bottom → top) for reverse revision. */
  scrollReverse: boolean;
  /** Seconds a matched toggle stays open before moving on. */
  scrollHold: number;
  /** Which toggle colours to stop at; empty array = every toggle. */
  scrollFilter: RecallColor[];
  /** Open the toggle we stop at. */
  scrollAutoOpen: boolean;
  /** Close it again when we leave it. */
  scrollAutoClose: boolean;
  /** Restart from the other end when the note is finished. */
  scrollLoop: boolean;
}

export const DEFAULT_AUTOSCROLL: AutoScrollSettings = {
  scrollSpeed: 60,
  scrollReverse: false,
  scrollHold: 4,
  scrollFilter: [],
  scrollAutoOpen: true,
  scrollAutoClose: true,
  scrollLoop: false,
};

export const SPEED_MIN = 10;
export const SPEED_MAX = 600;
export const SPEED_STEP = 20;

export function clampSpeed(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_AUTOSCROLL.scrollSpeed;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(px)));
}

export function clampHold(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_AUTOSCROLL.scrollHold;
  return Math.min(120, Math.max(0, Math.round(seconds)));
}

/** Map a callout type (or <details> class) to a traffic-light colour. */
export function colorOf(calloutType: string | null | undefined): RecallColor {
  const t = (calloutType ?? "").toLowerCase();
  if (t.includes("recall-red")) return "red";
  if (t.includes("recall-yellow")) return "yellow";
  if (t.includes("recall-green")) return "green";
  return "other";
}

/** Does this toggle belong to the current filter? Empty filter = everything. */
export function matchesFilter(color: RecallColor, filter: RecallColor[]): boolean {
  if (!filter || filter.length === 0) return true;
  return filter.includes(color);
}

export interface ToggleStop {
  /** Index in the document order of toggles. */
  index: number;
  /** Distance from the top of the scroll container, in px. */
  top: number;
  color: RecallColor;
}

/** Toggles the session should visit, in travel order. */
export function planStops(
  stops: ToggleStop[],
  filter: RecallColor[],
  reverse: boolean
): ToggleStop[] {
  const kept = stops.filter((s) => matchesFilter(s.color, filter));
  const sorted = [...kept].sort((a, b) => a.top - b.top);
  return reverse ? sorted.reverse() : sorted;
}

/** First stop at or after (reverse: at or before) the current scroll offset. */
export function firstStopFrom(
  plan: ToggleStop[],
  scrollTop: number,
  reverse: boolean
): number {
  if (plan.length === 0) return -1;
  const hit = plan.findIndex((s) => (reverse ? s.top <= scrollTop : s.top >= scrollTop));
  return hit >= 0 ? hit : 0;
}

/** Signed pixels to move this frame. */
export function frameDelta(speed: number, dtMs: number, reverse: boolean): number {
  const px = (clampSpeed(speed) * Math.max(0, dtMs)) / 1000;
  return reverse ? -px : px;
}

/**
 * Where the container should scroll so a stop sits comfortably in view
 * (slightly above the middle, like a teleprompter line).
 */
export function targetOffset(stopTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(stopTop - viewportHeight * 0.3));
}

/** Have we reached the target this frame (direction aware)? */
export function reachedTarget(current: number, target: number, reverse: boolean): boolean {
  return reverse ? current <= target + 1 : current >= target - 1;
}

/** Have we hit the end of the note? */
export function atEnd(
  scrollTop: number,
  scrollHeight: number,
  viewportHeight: number,
  reverse: boolean
): boolean {
  return reverse ? scrollTop <= 0 : scrollTop >= scrollHeight - viewportHeight - 1;
}

export function filterLabel(filter: RecallColor[]): string {
  if (!filter || filter.length === 0) return "all toggles";
  const icon: Record<RecallColor, string> = {
    red: "🔴",
    yellow: "🟡",
    green: "🟢",
    other: "⚪",
  };
  return filter.map((c) => icon[c]).join(" ");
}

export function sessionLabel(s: AutoScrollSettings, stops: number): string {
  const dir = s.scrollReverse ? "reverse ↑" : "forward ↓";
  return `Autoscroll ${dir} · ${clampSpeed(s.scrollSpeed)} px/s · ${filterLabel(
    s.scrollFilter
  )} · ${stops} stop${stops === 1 ? "" : "s"}`;
}
