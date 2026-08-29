import { describe, expect, it } from "bun:test";
import {
  FSRS_W,
  buildShuffleOrder,
  deckStats,
  deckSummary,
  forecastDue,
  gradeFromDwell,
  gradeFsrs,
  isDue,
  isFresh,
  makeRandom,
  newFsrsCard,
  normalizeDeck,
  recordReview,
  retrievability,
} from "../src/fsrs";

const DAY = 86400000;
const NOW = 1700000000000;

describe("fsrs cards", () => {
  it("starts fresh", () => {
    const c = newFsrsCard(1);
    expect(isFresh(c)).toBe(true);
    expect(retrievability(c, NOW)).toBe(0);
  });
  it("grades a fresh card into a schedule", () => {
    const c = gradeFsrs(newFsrsCard(1), 3, NOW);
    expect(c.stability).toBeGreaterThan(0);
    expect(c.reps).toBe(1);
    expect(isFresh(c)).toBe(false);
    expect(retrievability(c, NOW)).toBeCloseTo(1, 2);
  });
  it("counts lapses and shrinks stability on Again", () => {
    const good = gradeFsrs(newFsrsCard(1), 4, NOW);
    const lapsed = gradeFsrs(good, 1, NOW + 5 * DAY);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.stability).toBeLessThanOrEqual(good.stability);
  });
  it("becomes due as time passes", () => {
    const c = gradeFsrs(newFsrsCard(1), 1, NOW);
    expect(isDue(c, NOW)).toBe(false);
    expect(isDue(c, NOW + 90 * DAY)).toBe(true);
  });
  it("turns dwell time into a grade", () => {
    expect(gradeFromDwell(0.4)).toBe(4);
    expect(gradeFromDwell(1)).toBe(3);
    expect(gradeFromDwell(1.5)).toBe(2);
    expect(gradeFromDwell(3)).toBe(1);
    expect(gradeFromDwell(0.4, true)).toBe(1);
  });
});

describe("ordering", () => {
  it("is deterministic for a seed", () => {
    const a = makeRandom(7);
    const b = makeRandom(7);
    expect(a()).toBe(b());
  });
  it("uses the upstream FSRS-5 weights", () => {
    expect(FSRS_W[0]).toBe(0.4072);
    expect(FSRS_W).toHaveLength(19);
  });
  it("keeps neighbours apart in the route", () => {
    const order = buildShuffleOrder([], 6, { now: NOW, newMix: 0, seed: 3 });
    expect(order).toHaveLength(6);
    expect(new Set(order).size).toBe(6);
  });
  it("forecasts upcoming due toggles", () => {
    const cards = [gradeFsrs(newFsrsCard(1), 1, NOW)];
    expect(forecastDue(cards, 1, 7, { now: NOW }).length).toBe(7);
  });
  it("persists a review into the deck", () => {
    const deck = recordReview({}, "note.md", 3, 2, NOW);
    expect(deck[0].page).toBe(3);
    expect(normalizeDeck(deck)).toHaveLength(1);
    expect(normalizeDeck([{ page: -1 }])).toHaveLength(0);
  });
  it("puts due cards before strong ones", () => {
    const strong = gradeFsrs(newFsrsCard(1), 4, NOW);
    const weak = gradeFsrs(newFsrsCard(2), 1, NOW - 120 * DAY);
    const order = buildShuffleOrder([strong, weak], 2, { now: NOW, newMix: 0, seed: 1 });
    expect(order[0]).toBe(2);
    expect(order).toHaveLength(2);
  });
  it("reports deck stats", () => {
    const stats = deckStats([gradeFsrs(newFsrsCard(1), 3, NOW)], 3, { now: NOW });
    expect(stats.total).toBe(3);
    expect(stats.fresh).toBe(2);
    expect(deckSummary(stats)).toContain("3 toggles");
  });
});
