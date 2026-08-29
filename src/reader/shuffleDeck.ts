/**
 * Per-note persistence for the Shuffle (FSRS) deck.
 *
 * Ported from the Naveen Bharat reader (`src/lib/reader/shuffleDeck.ts`). The
 * reader keeps a deck per PDF in localStorage; the plugin keeps one per note
 * inside its own settings, so the store is injected instead of hardcoded.
 */

import { newCard, reviewCard, type Grade, type PageCard } from "./fsrsScheduler";

/** Mirrors MAX_LIST_LENGTH in the dwell engine — the route is scanned per frame. */
export const MAX_DECK_PAGES = 500;

/** Where decks live: `store[notePath] = cards`. */
export type DeckStore = Record<string, PageCard[]>;

const isFinitePositive = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/** Coerces untrusted JSON into safe cards; malformed entries are dropped. */
export function normalizeDeck(raw: unknown): PageCard[] {
  if (!Array.isArray(raw)) return [];
  const out: PageCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Partial<PageCard>;
    if (!isFinitePositive(c.page)) continue;
    out.push({
      page: Math.floor(c.page),
      difficulty: Number.isFinite(c.difficulty) ? Math.max(0, Math.min(10, c.difficulty as number)) : 0,
      stability: Number.isFinite(c.stability) ? Math.max(0, c.stability as number) : 0,
      lastReviewedAt: Number.isFinite(c.lastReviewedAt) ? Math.max(0, c.lastReviewedAt as number) : 0,
      reps: Number.isFinite(c.reps) ? Math.max(0, Math.floor(c.reps as number)) : 0,
      lapses: Number.isFinite(c.lapses) ? Math.max(0, Math.floor(c.lapses as number)) : 0,
    });
    if (out.length >= MAX_DECK_PAGES) break;
  }
  return out;
}

export function loadDeck(store: DeckStore | undefined, key: string | null | undefined): PageCard[] {
  if (!store || !key) return [];
  return normalizeDeck(store[key]);
}

export function saveDeck(
  store: DeckStore | undefined,
  key: string | null | undefined,
  cards: PageCard[]
): DeckStore {
  const next: DeckStore = { ...(store ?? {}) };
  if (!key) return next;
  next[key] = cards.slice(0, MAX_DECK_PAGES);
  return next;
}

export function resetDeck(store: DeckStore | undefined, key: string | null | undefined): DeckStore {
  const next: DeckStore = { ...(store ?? {}) };
  if (key) delete next[key];
  return next;
}

/**
 * Applies one inferred review to a toggle and returns the updated deck, so the
 * caller can persist it and refresh a summary without re-reading.
 */
export function recordReview(
  store: DeckStore | undefined,
  key: string | null | undefined,
  page: number,
  grade: Grade,
  now = Date.now()
): PageCard[] {
  if (!key || !isFinitePositive(page)) return [];
  const deck = loadDeck(store, key);
  const idx = deck.findIndex((c) => c.page === page);
  const current = idx >= 0 ? deck[idx] : newCard(Math.floor(page));
  const next = reviewCard(current, grade, now);
  if (idx >= 0) deck[idx] = next;
  else deck.push(next);
  return deck;
}
