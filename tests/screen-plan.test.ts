/**
 * v1.5.4 — the exact screen-stop derivation used by Toggles / Screens /
 * Toggles + screens, plus the read-out shown in the settings UI.
 */
import { describe, expect, test } from "bun:test";
import {
  describeScreenPlan,
  filterScreenStops,
  mergeStops,
  screenMergeTolerance,
  screenPlan,
} from "../src/screen-stops";

describe("screenPlan", () => {
  test("derives screenful, overlap and step from the live viewport", () => {
    const plan = screenPlan(4000, 800, 0.9, 0.1);
    expect(plan.viewportPx).toBe(800);
    expect(plan.screenPx).toBe(720);
    expect(plan.stepPx).toBe(648);
    expect(plan.overlapPx).toBe(72);
    expect(plan.stops[0]).toBe(0);
    expect(plan.lastTop).toBe(4000 - 720);
    expect(plan.count).toBe(plan.stops.length);
  });

  test("mobile and desktop share one percentage setting", () => {
    const phone = screenPlan(9000, 640, 0.9, 0.1);
    const desktop = screenPlan(9000, 1200, 0.9, 0.1);
    expect(phone.screenPx).toBe(576);
    expect(desktop.screenPx).toBe(1080);
    expect(phone.count).toBeGreaterThan(desktop.count);
  });

  test("a note shorter than one screen has exactly one stop", () => {
    expect(screenPlan(300, 800).stops).toEqual([0]);
  });

  test("read-out spells the whole calculation out", () => {
    expect(describeScreenPlan(screenPlan(4000, 800, 0.9, 0.1))).toBe(
      "800 px × 90% = 720 px · overlap 10% = 72 px · step 648 px · 7 screens"
    );
  });
});

describe("filterScreenStops", () => {
  const stops = [0, 600, 1200, 1800];

  test("keeps only screens that hold a matching toggle", () => {
    expect(filterScreenStops(stops, [50, 1300], 600)).toEqual([0, 1200]);
  });

  test("never prunes while the note is still rendering", () => {
    expect(filterScreenStops(stops, [50], 600, false)).toEqual(stops);
  });

  test("no filter information keeps every screen", () => {
    expect(filterScreenStops(stops, [], 600)).toEqual(stops);
  });
});

describe("both-mode merge", () => {
  test("a screen stop on the same view as a toggle stop is dropped", () => {
    const tol = screenMergeTolerance(720);
    expect(tol).toBe(180);
    const merged = mergeStops([{ top: 0 }, { top: 648 }], [{ top: 700 }], tol);
    expect(merged.map((m) => m.top)).toEqual([0, 700]);
  });
});
