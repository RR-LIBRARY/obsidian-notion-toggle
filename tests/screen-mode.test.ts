import { describe, expect, it } from "bun:test";
import {
  DEFAULT_SCREEN_OVERLAP,
  advanceLabel,
  clampScreenOverlap,
  isScreenStop,
  mergeStops,
  normalizeAdvanceBy,
  screenBoxes,
  screenStops,
} from "../src/screen-stops";

describe("screenStops", () => {
  it("a note shorter than the screen has one stop", () => {
    expect(screenStops(400, 800)).toEqual([0]);
    expect(screenStops(800, 800)).toEqual([0]);
  });

  it("starts at the top and never scrolls past the end", () => {
    const stops = screenStops(3000, 800, 0);
    expect(stops[0]).toBe(0);
    expect(stops[stops.length - 1]).toBe(2200);
    expect([...stops].sort((a, b) => a - b)).toEqual(stops);
  });

  it("advances exactly one screen with no overlap", () => {
    expect(screenStops(2400, 800, 0)).toEqual([0, 800, 1600]);
  });

  it("keeps a slice of the previous screen when overlap is on", () => {
    // step = 800 * 0.9 = 720
    expect(screenStops(3000, 800, DEFAULT_SCREEN_OVERLAP)).toEqual([0, 720, 1440, 2160, 2200]);
  });

  it("re-computes for a new viewport (rotation)", () => {
    const portrait = screenStops(3000, 800, 0);
    const landscape = screenStops(3000, 400, 0);
    expect(portrait).not.toEqual(landscape);
    expect(landscape[landscape.length - 1]).toBe(2600);
    expect(landscape.length).toBeGreaterThan(portrait.length);
  });

  it("survives junk measurements", () => {
    expect(screenStops(0, 0)).toEqual([0]);
    expect(screenStops(Number.NaN, 800)).toEqual([0]);
    expect(screenStops(1e9, 800, 0).length).toBeLessThanOrEqual(2000);
  });
});

describe("screenBoxes", () => {
  it("marks every screen stop as a non-toggle page", () => {
    const boxes = screenBoxes(2400, 800, 0);
    expect(boxes.map((b) => b.top)).toEqual([0, 800, 1600]);
    expect(boxes.every((b) => isScreenStop(b.page))).toBe(true);
    expect(boxes.every((b) => b.height === 800)).toBe(true);
  });

  it("real toggle numbers are never screen stops", () => {
    expect(isScreenStop(1)).toBe(false);
    expect(isScreenStop(73)).toBe(false);
  });
});

describe("mergeStops", () => {
  const toggles = [
    { page: 1, top: 100, height: 200 },
    { page: 3, top: 1700, height: 200 },
  ];

  it("keeps both sets in document order", () => {
    const merged = mergeStops(screenBoxes(2400, 800, 0), toggles);
    expect(merged.map((b) => b.top)).toEqual([0, 100, 800, 1600, 1700]);
  });

  it("drops a screen stop that duplicates a toggle stop", () => {
    const merged = mergeStops(screenBoxes(2400, 800, 0), toggles, 120);
    expect(merged.map((b) => b.top)).toEqual([100, 800, 1700]);
  });

  it("with no toggles left it is pure screen reading", () => {
    const merged = mergeStops(screenBoxes(1600, 800, 0), []);
    expect(merged.map((b) => b.page).every(isScreenStop)).toBe(true);
  });
});

describe("settings normalisation", () => {
  it("falls back to toggles for junk", () => {
    expect(normalizeAdvanceBy("screens")).toBe("screens");
    expect(normalizeAdvanceBy("both")).toBe("both");
    expect(normalizeAdvanceBy("pages")).toBe("toggles");
    expect(normalizeAdvanceBy(undefined)).toBe("toggles");
  });

  it("clamps the overlap", () => {
    expect(clampScreenOverlap(0.1)).toBe(0.1);
    expect(clampScreenOverlap(0.9)).toBe(0.5);
    expect(clampScreenOverlap(-1)).toBe(0);
    expect(clampScreenOverlap("x")).toBe(0);
  });

  it("labels each mode", () => {
    expect(advanceLabel("toggles")).toBe("Toggles");
    expect(advanceLabel("screens")).toBe("Screens");
    expect(advanceLabel("both")).toBe("Toggles + screens");
  });
});
