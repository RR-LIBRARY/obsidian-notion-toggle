/**
 * v1.1.1 — FSRS shuffle memory for toggles.
 *
 * The algorithm is the **exact** scheduler from the Naveen Bharat reader
 * (`src/reader/fsrsScheduler.ts`, copied verbatim from
 * `mranujbabu/navinbharat → src/lib/reader/fsrsScheduler.ts`), plus the
 * reader's deck persistence rules in `src/reader/shuffleDeck.ts` (adapted to
 * store one deck per note inside the plugin's settings).
 *
 * This file only re-exports it under the plugin's names.
 */

import {
  FSRS_W,
  RETENTION_TARGET,
  buildShuffleRoute,
  deckStats as deckStatsUpstream,
  elapsedDays,
  forecastDue,
  inferGrade,
  isDue,
  isNewCard,
  newCard,
  retrievability,
  reviewCard,
  seededRandom,
  type DeckStats,
  type Grade,
  type PageCard,
  type ShuffleOptions,
} from "./reader/fsrsScheduler";
import {
  MAX_DECK_PAGES,
  loadDeck,
  normalizeDeck,
  recordReview,
  resetDeck,
  saveDeck,
  type DeckStore,
} from "./reader/shuffleDeck";

export {
  FSRS_W,
  MAX_DECK_PAGES,
  RETENTION_TARGET,
  buildShuffleRoute,
  elapsedDays,
  forecastDue,
  inferGrade,
  isDue,
  isNewCard,
  loadDeck,
  newCard,
  normalizeDeck,
  recordReview,
  resetDeck,
  retrievability,
  reviewCard,
  saveDeck,
  seededRandom,
};
export type { DeckStats, DeckStore, Grade, PageCard, ShuffleOptions };

/* ---- plugin aliases (a reader "page" is a toggle) ---- */
export type FsrsCard = PageCard;
export type FsrsGrade = Grade;
export const newFsrsCard = newCard;
export const isFresh = isNewCard;
export const gradeFsrs = reviewCard;
export const gradeFromDwell = inferGrade;
export const buildShuffleOrder = buildShuffleRoute;
export const makeRandom = seededRandom;
export const deckStats = deckStatsUpstream;

export function deckSummary(stats: DeckStats): string {
  const recall = stats.avgRecall === null ? "—" : `${Math.round(stats.avgRecall * 100)}%`;
  return `${stats.total} toggles · ${stats.due} due · ${stats.fresh} new · ${stats.leeches} hard · recall ${recall}`;
}
