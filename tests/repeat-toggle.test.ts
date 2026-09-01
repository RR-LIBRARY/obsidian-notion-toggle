/**
 * v1.5.7 — regression: "ek hi toggle baar baar khul raha hai".
 *
 * Opening a toggle makes it taller, so the forced re-measure can hand the same
 * physical toggle a *different* set of chunk keys and a shifted anchored top.
 * The old "missed stop" rescue then dragged the run straight back onto the
 * toggle it had just finished, re-opening it forever. `pickStops` now also
 * takes the set of toggle numbers already revised on this leg.
 */
import { describe, expect, it } from "bun:test";
import { pickStops } from "../src/scroll-anchor";
import type { DwellTarget } from "../src/scrollmode";

const target = (page: number, top: number, index = 0): DwellTarget => ({
  page,
  top,
  index,
  key: `${page}:${index}`,
});

const stableTarget = (page: number, identity: string, top: number, index = 0): DwellTarget => ({
  page,
  identity,
  top,
  index,
  key: `${identity}:${index}`,
});

describe("v1.5.7 — a finished toggle is never re-opened", () => {
  it("new chunk keys of the just-opened toggle do not drag the run backwards", () => {
    // Toggle 2 was parked on at 1200 and opened; the re-measure now reports it
    // as three screenfuls, so 2:1 sits *behind* the playhead.
    const grown = [target(1, 1000), target(2, 1150), target(2, 1180, 1), target(3, 1900)];
    const pick = pickStops(grown, 1200, 1230, 1, new Set(["1:0", "2:0"]), new Set([1, 2]));
    expect(pick.missed).toEqual([]);
    expect(pick.stop).toBeUndefined();
  });


  it("without the toggle guard the same toggle would be picked again", () => {
    const grown = [target(2, 1150), target(2, 1180, 1)];
    const pick = pickStops(grown, 1200, 1230, 1, new Set(["2:0"]), new Set());
    expect(pick.stop?.key).toBe("2:1");
  });

  it("a finished toggle whose anchored top drifts forward is not crossed twice", () => {
    // Toggle 2 grew and its first stop moved ahead of the playhead again.
    const drifted = [target(2, 1400), target(3, 1900)];
    const pick = pickStops(drifted, 1300, 1500, 1, new Set(["2:0"]), new Set([2]));
    expect(pick.stop?.key).toBeUndefined();
  });

  it("the run still advances to the next unvisited toggle", () => {
    const targets = [target(1, 1000), target(2, 1150), target(3, 1400)];
    const pick = pickStops(targets, 1200, 1500, 1, new Set(["1:0", "2:0"]), new Set([1, 2]));
    expect(pick.stop?.key).toBe("3:0");
  });

  it("tall-answer chunk reading still pauses per screenful going forward", () => {
    const parts = [target(4, 2000, 0), target(4, 2800, 1), target(4, 3600, 2)];
    const pick = pickStops(parts, 2700, 2900, 1, new Set(["4:0"]), new Set([4]));
    expect(pick.stop?.key).toBe("4:1");
  });

  it("reverse runs keep rescuing genuinely unvisited stops", () => {
    const targets = [target(1, 1000), target(2, 1200), target(3, 1400)];
    const pick = pickStops(targets, 1100, 1090, -1, new Set(["1:0"]), new Set([1]));
    expect(pick.queue.map((t) => t.key)).toEqual(["3:0", "2:0"]);
  });

  it("does not reopen Q5 when a lazy DOM replacement changes its ordinal", () => {
    const firstWindow = stableTarget(4, "recall-red\u0000q5", 1200);
    const firstPick = pickStops([firstWindow], 1100, 1250, 1, new Set(), new Set());
    expect(firstPick.stop?.identity).toBe("recall-red\u0000q5");

    // Q5 was ordinal 4 in one rendered window and ordinal 2 after Obsidian
    // replaced the section. Its physical identity remains the same.
    const rerendered = [
      stableTarget(2, "recall-red\u0000q5", 1180),
      stableTarget(4, "recall-red\u0000q7", 1500),
    ];
    const pick = pickStops(
      rerendered,
      1450,
      1550,
      1,
      new Set([firstWindow.key]),
      new Set(["recall-red\u0000q5"]),
    );
    expect(pick.queue.map((t) => t.identity)).toEqual(["recall-red\u0000q7"]);
  });

  it("keeps continuation slices eligible for a tall completed identity", () => {
    const parts = [
      stableTarget(2, "recall-red\u0000q5", 1200),
      stableTarget(2, "recall-red\u0000q5", 1900, 1),
    ];
    const pick = pickStops(parts, 1800, 1950, 1, new Set([parts[0]!.key]), new Set([parts[0]!.identity!]));
    expect(pick.stop?.index).toBe(1);
  });
});
