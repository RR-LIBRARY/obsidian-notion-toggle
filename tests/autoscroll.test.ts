import { describe, expect, it } from "bun:test";
import {
  atEnd,
  clampHold,
  clampSpeed,
  colorOf,
  filterLabel,
  firstStopFrom,
  frameDelta,
  matchesFilter,
  planStops,
  reachedTarget,
  sessionLabel,
  targetOffset,
  DEFAULT_AUTOSCROLL,
  type ToggleStop,
} from "../src/autoscroll";

const stops: ToggleStop[] = [
  { index: 0, top: 0, color: "red" },
  { index: 1, top: 200, color: "green" },
  { index: 2, top: 400, color: "yellow" },
  { index: 3, top: 600, color: "other" },
];

describe("colour mapping", () => {
  it("reads traffic-light callouts", () => {
    expect(colorOf("recall-red")).toBe("red");
    expect(colorOf("RECALL-YELLOW")).toBe("yellow");
    expect(colorOf("recall-green")).toBe("green");
    expect(colorOf("question")).toBe("other");
    expect(colorOf(null)).toBe("other");
  });

  it("empty filter means everything", () => {
    expect(matchesFilter("other", [])).toBe(true);
    expect(matchesFilter("red", ["red", "yellow"])).toBe(true);
    expect(matchesFilter("green", ["red"])).toBe(false);
  });
});

describe("plan", () => {
  it("keeps only filtered toggles in document order", () => {
    const plan = planStops(stops, ["red", "yellow"], false);
    expect(plan.map((s) => s.index)).toEqual([0, 2]);
  });

  it("reverses for fast backwards revision", () => {
    const plan = planStops(stops, [], true);
    expect(plan.map((s) => s.top)).toEqual([600, 400, 200, 0]);
  });

  it("starts from the current position", () => {
    const plan = planStops(stops, [], false);
    expect(firstStopFrom(plan, 250, false)).toBe(2);
    const rev = planStops(stops, [], true);
    expect(firstStopFrom(rev, 250, true)).toBe(2);
    expect(firstStopFrom([], 0, false)).toBe(-1);
  });
});

describe("motion", () => {
  it("moves speed * time, signed by direction", () => {
    expect(frameDelta(60, 1000, false)).toBeCloseTo(60);
    expect(frameDelta(60, 500, true)).toBeCloseTo(-30);
  });

  it("clamps speed and hold", () => {
    expect(clampSpeed(0)).toBe(1);
    expect(clampSpeed(9999)).toBe(1200);
    expect(clampHold(-5)).toBe(0);
    expect(clampHold(99999)).toBe(3600);
    expect(clampSpeed(Number.NaN)).toBe(DEFAULT_AUTOSCROLL.scrollSpeed);
  });

  it("centres the stop a bit above the middle", () => {
    expect(targetOffset(500, 1000)).toBe(200);
    expect(targetOffset(10, 1000)).toBe(0);
  });

  it("detects arrival and note ends in both directions", () => {
    expect(reachedTarget(199, 200, false)).toBe(true);
    expect(reachedTarget(150, 200, false)).toBe(false);
    expect(reachedTarget(201, 200, true)).toBe(true);
    expect(atEnd(0, 5000, 800, true)).toBe(true);
    expect(atEnd(4200, 5000, 800, false)).toBe(true);
    expect(atEnd(1000, 5000, 800, false)).toBe(false);
  });
});

describe("labels", () => {
  it("describes the filter and the session", () => {
    expect(filterLabel([])).toBe("all toggles");
    expect(filterLabel(["red", "green"])).toBe("🔴 🟢");
    expect(sessionLabel({ ...DEFAULT_AUTOSCROLL, scrollReverse: true }, 1)).toContain(
      "reverse ↑"
    );
    expect(sessionLabel(DEFAULT_AUTOSCROLL, 3)).toContain("3 stops");
  });
});
