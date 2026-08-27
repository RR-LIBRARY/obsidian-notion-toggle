/**
 * SM-2 spaced repetition — pure module, no Obsidian imports.
 * One card per note path; stored in the plugin's data.json.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

/** SM-2 quality values (0..5) for our four buttons. */
export const GRADE_QUALITY: Record<Grade, number> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

export const GRADE_LABEL: Record<Grade, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export interface SrsCard {
  /** Ease factor, 1.3 – 2.7 (SM-2 EF). */
  ease: number;
  /** Current interval in days. */
  interval: number;
  /** Successful repetitions in a row. */
  repetitions: number;
  /** How many times the note was failed ("Again"). */
  lapses: number;
  /** Last review timestamp (ms) — 0 when never reviewed. */
  lastReviewed: number;
  /** Next due timestamp (ms). */
  due: number;
}

export const MIN_EASE = 1.3;
export const MAX_EASE = 2.7;
export const DAY_MS = 86_400_000;

export function newCard(): SrsCard {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewed: 0,
    due: 0,
  };
}

function clampEase(ease: number): number {
  if (!Number.isFinite(ease)) return 2.5;
  return Math.max(MIN_EASE, Math.min(MAX_EASE, Math.round(ease * 100) / 100));
}

/** Start of the day for a timestamp — schedules are day-granular. */
export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Apply one review to a card (SM-2).
 * interval: 1 day -> 6 days -> previous * ease. "Again" restarts at 1 day.
 */
export function gradeCard(card: SrsCard, grade: Grade, now: number): SrsCard {
  const base = { ...newCard(), ...card };
  const q = GRADE_QUALITY[grade];
  let { ease, interval, repetitions, lapses } = base;

  // SM-2 ease update.
  ease = clampEase(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (grade === "again") {
    repetitions = 0;
    lapses += 1;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * ease);
    if (grade === "hard") interval = Math.max(1, Math.round(interval * 0.8));
    if (grade === "easy") interval = Math.round(interval * 1.3);
  }

  interval = Math.max(1, Math.min(365, interval));

  return {
    ease,
    interval,
    repetitions,
    lapses,
    lastReviewed: now,
    due: startOfDay(now) + interval * DAY_MS,
  };
}

export function isDue(card: SrsCard | undefined, now: number): boolean {
  if (!card || !card.lastReviewed) return true;
  return card.due <= startOfDay(now) + DAY_MS - 1;
}

export function daysUntilDue(card: SrsCard | undefined, now: number): number {
  if (!card || !card.lastReviewed) return 0;
  return Math.round((startOfDay(card.due) - startOfDay(now)) / DAY_MS);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Short human label for the widget, e.g. "Next recall: 6 days (Sat)". */
export function nextDueLabel(card: SrsCard | undefined, now: number): string {
  if (!card || !card.lastReviewed) return "Not scheduled yet — grade to start";
  const days = daysUntilDue(card, now);
  if (days <= 0) return "Due today";
  const day = WEEKDAYS[new Date(card.due).getDay()];
  if (days === 1) return `Next recall: tomorrow (${day})`;
  return `Next recall: ${days} days (${day})`;
}

/** How many stored notes are due right now. */
export function dueCount(cards: Record<string, SrsCard>, now: number): number {
  let n = 0;
  for (const key of Object.keys(cards ?? {})) {
    if (isDue(cards[key], now)) n += 1;
  }
  return n;
}

/** Note paths that are due, soonest first. */
export function dueNotes(cards: Record<string, SrsCard>, now: number): string[] {
  return Object.keys(cards ?? {})
    .filter((k) => isDue(cards[k], now))
    .sort((a, b) => (cards[a]?.due ?? 0) - (cards[b]?.due ?? 0));
}

export interface RecallCounts {
  total: number;
  red: number;
  yellow: number;
  green: number;
}

/**
 * Suggest a grade from the note's traffic-light toggles so one tap is enough.
 * Lots of red -> Again/Hard, all green -> Easy.
 */
export function suggestGrade(stats: RecallCounts): Grade {
  const graded = stats.red + stats.yellow + stats.green;
  if (!graded) return "good";
  const redShare = stats.red / graded;
  if (redShare >= 0.5) return "again";
  if (redShare > 0 || stats.yellow / graded >= 0.4) return "hard";
  if (stats.green === graded) return "easy";
  return "good";
}

/** One-line summary for the status bar. */
export function dueSummary(cards: Record<string, SrsCard>, now: number): string {
  const n = dueCount(cards, now);
  if (!n) return "";
  return ` · ⏭ ${n} due`;
}
