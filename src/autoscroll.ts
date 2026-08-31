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

import type { FsrsCard } from "./fsrs";
import { DWELL_MAX, type ScrollMode } from "./scrollmode";

/**
 * v1.4.13 — a toggle kind: traffic-light grades, every Obsidian built-in
 * callout (!question / !tip / !important / !quote …), and `other` as the
 * ungraded wildcard.
 */
export type RecallColor =
  | "red"
  | "yellow"
  | "green"
  | "question"
  | "info"
  | "note"
  | "abstract"
  | "tip"
  | "warning"
  | "success"
  | "todo"
  | "important"
  | "failure"
  | "danger"
  | "bug"
  | "example"
  | "quote"
  | "other";

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
  /** v1.1.1 — pause-at mode: every / odd / even / custom / route / shuffle. */
  scrollMode: ScrollMode;
  /** 1-based toggle numbers used by "custom". */
  scrollPicks: number[];
  /** 1-based toggle numbers, in visit order, used by "route" / "shuffle". */
  scrollRoute: number[];
  /**
   * v1.4.3 — the route the *user* typed. `scrollRoute` is overwritten every
   * time shuffle rebuilds an order, so the hand-written plan is kept here and
   * restored when route mode is picked again (survives a vault reload).
   */
  scrollUserRoute: number[];
  /** Replay the route from the start when it finishes. */
  scrollLoopRoute: boolean;

  /** v1.1.3 — show the loop's live state (waypoints, stops, grades) on screen. */
  scrollDebug: boolean;
  /** Read tall toggles screen-by-screen before moving on. */
  scrollChunkTall: boolean;
  /** Shuffle range (0 = whole note). */
  scrollShuffleFrom: number;
  scrollShuffleTo: number;
  /** Target recall for shuffle scheduling (0.7 … 0.97). */
  scrollRetention: number;
  /** Share of brand-new toggles mixed into a shuffle run (0 … 1). */
  scrollNewMix: number;
  /** Auto-grade each toggle from how long it stayed open. */
  scrollAutoGrade: boolean;
  /** FSRS memory per note: settings.scrollMemory[notePath] = cards. */
  scrollMemory: Record<string, FsrsCard[]>;
  /** v1.1.2 — per-note memory of speed / direction / hold, like the reader's per-doc keys. */
  scrollPerNote: Record<string, { speed: number; reverse: boolean; hold: number }>;
  /** v1.4.7 — where a stop lands on screen (portrait and landscape alike). */
  scrollStopAnchor: StopAnchor;
  /** v1.5.1 — switch the note into Obsidian's reading view when autoscroll starts. */
  scrollForceReading: boolean;
  /** v1.5.1 — put the note back into its old view mode when the run stops. */
  scrollRestoreMode: boolean;
}

export const DEFAULT_AUTOSCROLL: AutoScrollSettings = {
  scrollSpeed: 60,
  scrollReverse: false,
  scrollHold: 4,
  scrollFilter: [],
  scrollAutoOpen: true,
  scrollAutoClose: true,
  scrollLoop: false,
  scrollMode: "all",
  scrollPicks: [],
  scrollRoute: [],
  scrollUserRoute: [],
  scrollLoopRoute: false,


  scrollDebug: false,
  scrollChunkTall: true,
  scrollShuffleFrom: 0,
  scrollShuffleTo: 0,
  scrollRetention: 0.9,
  scrollNewMix: 0.35,
  scrollAutoGrade: true,
  scrollMemory: {},
  scrollPerNote: {},
  scrollStopAnchor: "middle",
  scrollForceReading: true,
  scrollRestoreMode: true,
};

export const SPEED_MIN = 1;
export const SPEED_MAX = 1200;
export const SPEED_STEP = 20;

/**
 * Speed in px/s. Kept to two decimals (not whole pixels) because the reader's
 * slowest chips (0.02x ≈ 1.2 px/s) only work with sub-pixel precision.
 */
export function clampSpeed(px: number): number {
  if (!Number.isFinite(px)) return DEFAULT_AUTOSCROLL.scrollSpeed;
  const rounded = Math.round(px * 100) / 100;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, rounded));
}

export function clampHold(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_AUTOSCROLL.scrollHold;
  return Math.min(DWELL_MAX, Math.max(0, Math.round(seconds)));
}

/** Palette kinds written as `recall-<id>` callout types. */
/** Obsidian's built-in callout types this plugin can create. */
export const CALLOUT_KINDS: RecallColor[] = [
  "question",
  "info",
  "note",
  "abstract",
  "tip",
  "warning",
  "success",
  "todo",
  "important",
  "failure",
  "danger",
  "bug",
  "example",
  "quote",
];

/** Obsidian alias words that mean an existing kind. */
export const KIND_WORD_ALIASES: Record<string, RecallColor> = {
  hint: "tip",
  summary: "abstract",
  tldr: "abstract",
  faq: "question",
  help: "question",
  check: "success",
  done: "success",
  caution: "warning",
  attention: "warning",
  fail: "failure",
  missing: "failure",
  error: "danger",
  cite: "quote",
};

/** The three graded (traffic-light) kinds. */
export const GRADED_COLORS: RecallColor[] = ["red", "yellow", "green"];

/** Resolve a rendered callout to its exact filter kind. */
export function kindOf(calloutType: string | null | undefined): RecallColor {
  const t = (calloutType ?? "").toLowerCase();
  if (t.includes("recall-red")) return "red";
  if (t.includes("recall-yellow")) return "yellow";
  if (t.includes("recall-green")) return "green";
  const words = t.split(/[^a-z]+/).filter(Boolean);
  for (const kind of CALLOUT_KINDS) if (words.includes(kind)) return kind;
  for (const word of words) {
    const alias = KIND_WORD_ALIASES[word];
    if (alias) return alias;
  }
  return "other";
}

/** Map a callout type (or <details> class) to a traffic-light colour. */
export function colorOf(calloutType: string | null | undefined): RecallColor {
  const kind = kindOf(calloutType);
  return GRADED_COLORS.includes(kind) ? kind : "other";
}

/** Is this kind ungraded (anything that is not 🔴 / 🟡 / 🟢)? */
export function isUngraded(color: RecallColor): boolean {
  return !GRADED_COLORS.includes(color);
}

/**
 * Does this toggle belong to the current filter? Empty filter = everything.
 * `other` acts as the "ungraded" wildcard, so it keeps matching !note / !tip /
 * !question and every non-traffic-light palette colour.
 */
export function matchesFilter(color: RecallColor, filter: RecallColor[]): boolean {
  if (!filter || filter.length === 0) return true;
  if (filter.includes(color)) return true;
  return filter.includes("other") && isUngraded(color);
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

/**
 * First stop at or after (reverse: at or before) the current scroll offset.
 *
 * v1.4.6 — when nothing lies ahead, wrap to the stop the run is actually
 * heading for: index 0 forward (top of the note), and the *last* entry in
 * reverse (the highest stop). Reverse used to wrap to index 0 too, which in a
 * descending plan is the bottom-most stop — a target behind an upward run, so
 * every stop reported "reached" on the first frame and the dwell was skipped.
 */
export function firstStopFrom(
  plan: ToggleStop[],
  scrollTop: number,
  reverse: boolean
): number {
  if (plan.length === 0) return -1;
  const hit = plan.findIndex((s) => (reverse ? s.top <= scrollTop : s.top >= scrollTop));
  if (hit >= 0) return hit;
  return reverse ? plan.length - 1 : 0;
}

/** Signed pixels to move this frame. */
export function frameDelta(speed: number, dtMs: number, reverse: boolean): number {
  const px = (clampSpeed(speed) * Math.max(0, dtMs)) / 1000;
  return reverse ? -px : px;
}

/** v1.4.7 — where a stop sits on screen. 0 = top edge, 0.5 = middle. */
export type StopAnchor = "top" | "third" | "middle" | "lower";

export const STOP_ANCHORS: Record<StopAnchor, number> = {
  top: 0.02,
  third: 0.3,
  middle: 0.5,
  lower: 0.66,
};

export const DEFAULT_STOP_ANCHOR: StopAnchor = "middle";

export function anchorFraction(anchor: unknown): number {
  const key = String(anchor ?? "") as StopAnchor;
  return STOP_ANCHORS[key] ?? STOP_ANCHORS[DEFAULT_STOP_ANCHOR];
}

/**
 * v1.4.7 — scroll offset that puts a stop at the reader's chosen place on the
 * screen, identically in portrait and landscape (the only input that differs
 * is `viewportHeight`).
 *
 * A toggle that fits on screen is centred by its own middle, so a question
 * lands in the middle of the phone with room for its answer instead of
 * clinging to the top edge. A toggle taller than the viewport keeps its top
 * line anchored — centring it would push the question itself off-screen. The
 * result is clamped to the scrollable range, so the first and last stops rest
 * against their edge.
 */
export function anchorOffset(
  stopTop: number,
  stopHeight: number,
  viewportHeight: number,
  anchor: StopAnchor | number = DEFAULT_STOP_ANCHOR,
  max = Number.POSITIVE_INFINITY
): number {
  const vh = Math.max(0, viewportHeight);
  const frac = typeof anchor === "number" ? Math.min(1, Math.max(0, anchor)) : anchorFraction(anchor);
  const h = Math.max(0, Number.isFinite(stopHeight) ? stopHeight : 0);
  const fits = h > 0 && h <= vh;
  const desiredScreenTop = fits ? Math.max(0, vh * frac - h / 2) : 0;
  const ceiling = Number.isFinite(max) ? Math.max(0, max) : Number.POSITIVE_INFINITY;
  return Math.round(Math.min(ceiling, Math.max(0, stopTop - desiredScreenTop)));
}

/** Legacy helper (upper-third anchor, no height information). */
export function targetOffset(stopTop: number, viewportHeight: number): number {
  return Math.max(0, Math.round(stopTop - viewportHeight * STOP_ANCHORS.third));
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

/** Legacy traffic-light order, kept stable for existing integrations. */
export const COLOR_ORDER: RecallColor[] = ["red", "yellow", "green", "other"];

/** Full canonical order for the expanded per-callout-kind filter. */
export const KIND_ORDER: RecallColor[] = [
  "red", "yellow", "green", "question", "info", "note", "abstract", "tip", "warning", "success",
  "todo", "important", "failure", "danger", "bug", "example", "quote", "other",
];

/** Every kind that is not a traffic-light grade, in canonical order. */
export const UNGRADED_COLORS: RecallColor[] = KIND_ORDER.filter(isUngraded);

/** De-duplicate a filter and put it in expanded canonical order. */
export function normalizeFilter(filter: RecallColor[] | null | undefined): RecallColor[] {
  if (!filter || filter.length === 0) return [];
  return KIND_ORDER.filter((c) => filter.includes(c));
}

/** Same selection, regardless of the order it was stored in. */
export function sameFilter(a: RecallColor[], b: RecallColor[]): boolean {
  const na = normalizeFilter(a);
  const nb = normalizeFilter(b);
  return na.length === nb.length && na.every((c, i) => c === nb[i]);
}

/** How many toggles of each colour a plan contains. */
export function colorCounts(
  colors: RecallColor[]
): Record<RecallColor, number> {
  const out = { red: 0, yellow: 0, green: 0, other: 0 };
  for (const c of colors) {
    if (c === "red" || c === "yellow" || c === "green") out[c] += 1;
    else out.other += 1;
  }
  return out as Record<RecallColor, number>;
}

/** One glyph per kind, used by every label and picker. */
export const COLOR_ICON: Record<RecallColor, string> = {
  red: "🔴",
  yellow: "🟡",
  green: "🟢",
  question: "❓",
  info: "ℹ️",
  note: "📝",
  abstract: "📋",
  tip: "💡",
  warning: "⚠️",
  success: "✅",
  todo: "☑️",
  important: "❗",
  failure: "❌",
  danger: "🚨",
  bug: "🐞",
  example: "🧩",
  quote: "❝",
  other: "⚪",
};

export function filterLabel(filter: RecallColor[]): string {
  if (!filter || filter.length === 0) return "all toggles";
  const norm = normalizeFilter(filter);
  if (norm.length === 1 && norm[0] === "other") return "⚪ notes (!note / !tip)";
  return norm.map((c) => COLOR_ICON[c]).join(" ");
}


export function sessionLabel(s: AutoScrollSettings, stops: number): string {
  const dir = s.scrollReverse ? "reverse ↑" : "forward ↓";
  return `Autoscroll ${dir} · ${clampSpeed(s.scrollSpeed)} px/s · ${filterLabel(
    s.scrollFilter
  )} · ${stops} stop${stops === 1 ? "" : "s"}`;
}
