// v1.7.7 — deep parameter stress tests for the autoscroll sheet (limits + odd combinations).
import { describe, expect, it } from "bun:test";
import {
  clampSpeed, clampHold, frameDelta, planStops, firstStopFrom, matchesFilter,
  normalizeFilter, reachedTarget, atEnd, SPEED_MIN, SPEED_MAX, DEFAULT_AUTOSCROLL,
  type ToggleStop,
} from "../src/autoscroll";
import { sliderToPause, pauseToSlider, formatPause, PAUSE_MIN_MS, PAUSE_MAX_MS } from "../src/pause-scale";
import {
  clampScreenDwellMs, normalizeAdvanceBy, screenStops, screenPlan, filterScreenStops,
  clampScreenOverlap, usableViewport, MAX_SCREEN_STOPS, DEFAULT_SCREEN_DWELL_MS,
} from "../src/screen-stops";
import { stopHoldMs } from "../src/screen-run";
import { fabShouldShow } from "../src/guide";

const BAD = [NaN, Infinity, -Infinity, -5, 0, "abc", null, undefined, {}, ""] as unknown[];

describe("speed limits", () => {
  it("clamps both ends and keeps sub-pixel precision", () => {
    expect(clampSpeed(0)).toBe(SPEED_MIN);
    expect(clampSpeed(-100)).toBe(SPEED_MIN);
    expect(clampSpeed(1e9)).toBe(SPEED_MAX);
    expect(clampSpeed(1.234)).toBe(1.23);
    expect(clampSpeed(NaN)).toBe(DEFAULT_AUTOSCROLL.scrollSpeed);
  });
  it("frame delta is safe for odd frames and flips with reverse", () => {
    expect(frameDelta(60, -16, false)).toBeCloseTo(0);
    expect(frameDelta(60, 1000, false)).toBe(60);
    expect(frameDelta(60, 1000, true)).toBe(-60);
    expect(frameDelta(1e9, 1000, false)).toBe(SPEED_MAX);
  });
  it("rapid speed changes never produce NaN", () => {
    for (let i = 0; i < 1000; i++) {
      const s = clampSpeed(Math.sin(i) * 3000);
      expect(Number.isFinite(frameDelta(s, 16, i % 2 === 0))).toBe(true);
    }
  });
});

describe("pause on each screen — extremes and bad saved values", () => {
  it("1s, 20s, 1h", () => {
    expect(clampScreenDwellMs(1000)).toBe(1000);
    expect(clampScreenDwellMs(20_000)).toBe(20_000);
    expect(clampScreenDwellMs(3_600_000)).toBe(3_600_000);
  });
  it("old 0.25s carries to 1s; huge caps at 1h", () => {
    expect(clampScreenDwellMs(250)).toBe(1000);
    expect(clampScreenDwellMs(1e12)).toBe(3_600_000);
  });
  it("broken saved values fall back to the default", () => {
    for (const v of BAD) {
      const out = clampScreenDwellMs(v);
      expect(out === DEFAULT_SCREEN_DWELL_MS || out >= 1000).toBe(true);
      expect(Number.isFinite(out)).toBe(true);
    }
  });
  it("slider outside 0..100 still gives a legal pause", () => {
    for (const p of [-50, -1, 101, 1e6, 0.5, 99.9]) {
      const ms = sliderToPause(p);
      expect(ms).toBeGreaterThanOrEqual(PAUSE_MIN_MS);
      expect(ms).toBeLessThanOrEqual(PAUSE_MAX_MS);
      expect(formatPause(ms).length).toBeGreaterThan(0);
    }
    const s = pauseToSlider(1e12);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("toggle hold vs screen pause", () => {
  const first = { page: 3, index: 0 };
  const cont = { page: 3, index: 4 };
  const screen = { page: -1, index: 0 };
  it("chunked first screen = longer of the two, both directions", () => {
    expect(stopHoldMs(first, 60, 5_000, true)).toBe(60_000);
    expect(stopHoldMs(first, 2, 3_600_000, true)).toBe(3_600_000);
  });
  it("not chunked → hold only; continuation/screen → pause only", () => {
    expect(stopHoldMs(first, 2, 30_000, false)).toBe(2_000);
    expect(stopHoldMs(cont, 60, 7_000, true)).toBe(7_000);
    expect(stopHoldMs(screen, 60, 7_000, false)).toBe(7_000);
  });
  it("negative inputs never give a negative wait", () => {
    expect(stopHoldMs(first, -5, -5, true)).toBe(0);
    expect(stopHoldMs(screen, -5, -5)).toBe(0);
  });
  it("hold clamp", () => {
    expect(clampHold(-3)).toBe(0);
    expect(clampHold(NaN)).toBe(DEFAULT_AUTOSCROLL.scrollHold);
  });
});

describe("advance mode × chunking (all combos)", () => {
  it("unknown saved mode → toggles", () => {
    for (const v of BAD) expect(normalizeAdvanceBy(v)).toBe("toggles");
  });
  for (const mode of ["toggles", "screens", "both"] as const)
    for (const chunked of [true, false])
      it(`${mode} / chunked=${chunked} gives legal waits`, () => {
        expect(normalizeAdvanceBy(mode)).toBe(mode);
        const w = stopHoldMs({ page: 1, index: 0 }, 4, 20_000, chunked);
        expect(w).toBe(chunked ? 20_000 : 4_000);
      });
});

describe("hard notes", () => {
  const mk = (n: number): ToggleStop[] =>
    Array.from({ length: n }, (_, i) => ({ index: i, top: i * 50, color: (["red", "yellow", "green", "other"] as const)[i % 4] }));
  it("empty note", () => {
    expect(planStops([], ["red"], false)).toEqual([]);
    expect(firstStopFrom([], 0, false)).toBe(-1);
    expect(screenStops(0, 800)).toEqual([0]);
  });
  it("single toggle, both directions", () => {
    const p = planStops(mk(1), [], false);
    expect(firstStopFrom(p, 9999, false)).toBe(0);
    expect(firstStopFrom(p, 9999, true)).toBe(0);
  });
  it("600 toggles, red filter keeps 150 in order", () => {
    const p = planStops(mk(600), ["red"], false);
    expect(p.length).toBe(150);
    for (let i = 1; i < p.length; i++) expect(p[i].top).toBeGreaterThan(p[i - 1].top);
    const r = planStops(mk(600), ["red"], true);
    expect(r[0].top).toBeGreaterThan(r[r.length - 1].top);
  });
  it("huge single answer (25 screens) and absurd height is capped", () => {
    const plan = screenPlan(800 * 25, 800, 0.9, 0.1);
    expect(plan.count).toBeGreaterThan(25);
    expect(plan.lastTop).toBe(800 * 25 - plan.screenPx);
    expect(screenStops(1e9, 10).length).toBeLessThanOrEqual(MAX_SCREEN_STOPS);
  });
  it("broken viewport / overlap values", () => {
    expect(usableViewport(0)).toBeGreaterThanOrEqual(1);
    expect(clampScreenOverlap(9)).toBe(0.5);
    expect(clampScreenOverlap(-1)).toBe(0);
    expect(screenStops(5000, NaN as unknown as number).length).toBeGreaterThan(0);
  });
});

describe("filter edge cases", () => {
  it("filter with no matches → nothing planned, screens pruned", () => {
    const stops = [{ index: 0, top: 0, color: "green" as const }];
    expect(planStops(stops, ["red"], false)).toEqual([]);
    expect(filterScreenStops([0, 700, 1400], [750], 700)).toEqual([700]);
  });
  it("no filter info → keep every screen; still rendering → no prune", () => {
    expect(filterScreenStops([0, 700], [], 700)).toEqual([0, 700]);
    expect(filterScreenStops([0, 700], [5000], 700, false)).toEqual([0, 700]);
  });
  it("duplicates / order normalise; empty filter matches all", () => {
    expect(normalizeFilter(["green", "red", "red"])).toEqual(["red", "green"]);
    expect(matchesFilter("yellow", [])).toBe(true);
    expect(matchesFilter("note", ["other"])).toBe(true);
  });
});

describe("run edges + floating button", () => {
  it("reached / end checks both directions", () => {
    expect(reachedTarget(99, 100, false)).toBe(true);
    expect(reachedTarget(101, 100, true)).toBe(true);
    expect(atEnd(0, 5000, 800, true)).toBe(true);
    expect(atEnd(4199, 5000, 800, false)).toBe(true);
  });
  it("button hides for any overlay (sheet, modal) and when not a note", () => {
    expect(fabShouldShow(true, true, false, true, false)).toBe(true);
    expect(fabShouldShow(true, true, false, true, true)).toBe(false);
    expect(fabShouldShow(true, true, false, false, false)).toBe(false);
    expect(fabShouldShow(false, true)).toBe(false);
    expect(fabShouldShow(true, false)).toBe(false);
  });
});
