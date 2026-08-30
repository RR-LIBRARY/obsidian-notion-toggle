import { describe, expect, it } from "bun:test";
import {
  DWELL_PRESETS,
  buildModeStops,
  effectiveMode,
  inShuffleRange,
  toDwellSettings,
  chunkTops,
  clampDwellSeconds,
  formatDwell,
  matchesMode,
  modeLabel,
  multiplierFromSpeed,
  nearestDwellPreset,
  normalizeMode,
  orderModeStops,
  parsePicks,
  parseRoute,
  speedFromMultiplier,
  advancePosition,
  crossedTarget,
  frameFactor,
  legDirection,
  shouldPark,
  dwellTargets,
  isRouteMode,
  normalizeDwell,
  parseDwell,
  waypointReached,
  seedStartOffset,
  finishedAtEdge,
  seedStartOffset,
  finishedAtEdge,
} from "../src/scrollmode";

const cfg = (over: Partial<Parameters<typeof matchesMode>[0]> = {}) => ({
  mode: "all" as const,
  picks: [],
  route: [],
  ...over,
});

describe("dwell + speed", () => {
  it("clamps dwell to 1s…1h", () => {
    expect(clampDwellSeconds(0)).toBe(1);
    expect(clampDwellSeconds(99999)).toBe(3600);
    expect(clampDwellSeconds(Number.NaN, 12)).toBe(12);
  });
  it("snaps to the nearest preset", () => {
    expect(DWELL_PRESETS).toContain(nearestDwellPreset(28));
    expect(nearestDwellPreset(28)).toBe(30);
  });
  it("formats human dwell labels", () => {
    expect(formatDwell(30)).toBe("30s");
    expect(formatDwell(600)).toBe("10m");
    expect(formatDwell(3600)).toBe("1h");
  });
  it("maps multipliers to px/s and back", () => {
    expect(speedFromMultiplier(1)).toBe(60);
    expect(multiplierFromSpeed(120)).toBe(2);
    expect(multiplierFromSpeed(60 * 0.02)).toBe(0.02);
  });
});

describe("modes", () => {
  it("normalizes unknown modes", () => {
    // upstream normalizeParity falls back to "odd"
    expect(normalizeMode("nope")).toBe("odd");
    expect(normalizeMode("shuffle")).toBe("shuffle");
  });
  it("parses custom and route lists", () => {
    expect(parsePicks("5, 2 2 9")).toEqual([2, 5, 9]);
    expect(parseRoute("5, 2, 2, 9, 2")).toEqual([5, 2, 9, 2]);
  });
  it("matches odd / even / custom / route", () => {
    expect(matchesMode(cfg({ mode: "odd" }), 3)).toBe(true);
    expect(matchesMode(cfg({ mode: "even" }), 3)).toBe(false);
    expect(matchesMode(cfg({ mode: "custom", picks: [4] }), 4)).toBe(true);
    expect(matchesMode(cfg({ mode: "route", route: [7] }), 4)).toBe(false);
  });
  it("labels modes", () => {
    expect(modeLabel(cfg())).toBe("every toggle");
    expect(modeLabel(cfg({ mode: "custom", picks: [1, 2] }))).toBe("custom (2)");
  });
});

describe("tall toggles + stop planning", () => {
  it("keeps short items as one stop", () => {
    expect(chunkTops(100, 200, 800)).toEqual([100]);
  });
  it("splits tall items screen-by-screen", () => {
    const tops = chunkTops(0, 2000, 800);
    expect(tops.length).toBeGreaterThan(1);
    expect(tops[0]).toBe(0);
    expect(tops[tops.length - 1]).toBe(1200);
  });
  it("builds and orders stops", () => {
    const items = [
      { ordinal: 1, top: 0, height: 100 },
      { ordinal: 2, top: 300, height: 100 },
      { ordinal: 3, top: 600, height: 100 },
    ];
    const all = buildModeStops(items, cfg(), 800, true);
    expect(all.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    const odd = buildModeStops(items, cfg({ mode: "odd" }), 800, true);
    expect(odd.map((s) => s.ordinal)).toEqual([1, 3]);
    const reversed = orderModeStops(all, cfg(), true);
    expect(reversed.map((s) => s.ordinal)).toEqual([3, 2, 1]);
    const routed = orderModeStops(
      buildModeStops(items, cfg({ mode: "route", route: [3, 1, 3] }), 800, false),
      cfg({ mode: "route", route: [3, 1, 3] }),
      false
    );
    expect(routed.map((s) => s.ordinal)).toEqual([3, 1, 3]);
  });
});

describe("upstream dwell engine", () => {
  it("normalizes untrusted settings", () => {
    const d = normalizeDwell({ parity: "nope" as never, seconds: 99999, pages: [3, 1, 1] });
    expect(d.parity).toBe("odd");
    expect(d.seconds).toBe(3600);
    expect(d.pages).toEqual([1, 3]);
    expect(parseDwell("{bad json")).toBeNull();
  });
  it("only runs route mode with waypoints", () => {
    expect(isRouteMode(normalizeDwell({ enabled: true, parity: "route", route: [2] }))).toBe(true);
    expect(isRouteMode(normalizeDwell({ enabled: true, parity: "route", route: [] }))).toBe(false);
  });
  it("detects crossed targets and reached waypoints", () => {
    const targets = dwellTargets(
      [
        { page: 1, top: 100, height: 50 },
        { page: 2, top: 400, height: 50 },
      ],
      normalizeDwell({ enabled: true, parity: "all", seconds: 10 }),
      800
    );
    expect(crossedTarget(targets, 0, 150, 1)?.page).toBe(1);
    expect(crossedTarget(targets, 500, 50, -1)?.page).toBe(2);
    expect(waypointReached(90, 110, 100)).toBe(true);
    expect(waypointReached(90, 95, 400)).toBe(false);
  });
});

describe("loop helpers (reader parity)", () => {
  it("flips direction per route leg", () => {
    expect(legDirection(900, 100, 1)).toBe(1);
    expect(legDirection(100, 900, 1)).toBe(-1);
    // inside 0.5px of the target the current direction is kept
    expect(legDirection(100.2, 100, -1)).toBe(-1);
  });

  it("keeps sub-pixel movement instead of snapping to whole pixels", () => {
    let pos = 0;
    const perFrame = 0.02; // 0.02x chip
    for (let i = 0; i < 60; i++) pos = advancePosition(pos, perFrame, 1, 1, 5000);
    expect(pos).toBeCloseTo(1.2, 5);
    expect(Math.floor(pos)).toBe(1);
    expect(advancePosition(10, 5, 1, -1, 5000)).toBe(5);
    expect(advancePosition(2, 5, 1, -1, 5000)).toBe(0);
    expect(advancePosition(4999, 5, 1, 1, 5000)).toBe(5000);
  });

  it("caps the frame factor after a tab-away", () => {
    expect(frameFactor(16.67)).toBeCloseTo(1, 3);
    expect(frameFactor(5000)).toBe(4);
    expect(frameFactor(-10)).toBe(0);
  });

  it("fires each stop once per direction", () => {
    expect(shouldPark(null, { key: "3:0" })).toBe(true);
    expect(shouldPark("3:0", { key: "3:0" })).toBe(false);
    expect(shouldPark("3:0", { key: "3:1" })).toBe(true);
    expect(shouldPark("3:0", undefined)).toBe(false);
  });
});

/* v1.4.1 — pause-at sheet actually drives the plan */
describe("v1.4.1 — pause-at options reach the plan", () => {
  const items = [1, 2, 3, 4, 5].map((n) => ({ ordinal: n, top: n * 1000, height: 200 }));
  const base = { picks: [], route: [], loopRoute: false, shuffleFrom: 0, shuffleTo: 0 };

  it("falls back to every toggle when custom / route lists are empty", () => {
    expect(effectiveMode({ ...base, mode: "custom" })).toBe("all");
    expect(effectiveMode({ ...base, mode: "route" })).toBe("all");
    expect(effectiveMode({ ...base, mode: "shuffle" })).toBe("all");
    expect(effectiveMode({ ...base, mode: "custom", picks: [2] })).toBe("custom");
    const stops = buildModeStops(items, { ...base, mode: "route" }, 800, false);
    expect(stops.map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });

  it("keeps the custom / route selection once numbers exist", () => {
    const custom = { ...base, mode: "custom" as const, picks: [2, 4] };
    expect(buildModeStops(items, custom, 800, false).map((s) => s.ordinal)).toEqual([2, 4]);
    const route = { ...base, mode: "route" as const, route: [4, 1, 4] };
    const ordered = orderModeStops(buildModeStops(items, route, 800, false), route, false);
    expect(ordered.map((s) => s.ordinal)).toEqual([4, 1, 4]);
  });

  it("limits shuffle stops to the configured range", () => {
    const cfg = { ...base, mode: "shuffle" as const, route: [5, 1, 3], shuffleFrom: 2, shuffleTo: 4 };
    expect(inShuffleRange(cfg, 1)).toBe(false);
    expect(inShuffleRange(cfg, 3)).toBe(true);
    const ordered = orderModeStops(buildModeStops(items, cfg, 800, false), cfg, false);
    expect(ordered.map((s) => s.ordinal)).toEqual([3]);
  });

  it("passes loop and range through to the dwell settings", () => {
    const cfg = { ...base, mode: "route" as const, route: [2], loopRoute: true, shuffleFrom: 1, shuffleTo: 3 };
    const dwell = toDwellSettings(cfg);
    expect(dwell.loopRoute).toBe(true);
    expect(dwell.shuffleFrom).toBe(1);
    expect(dwell.shuffleTo).toBe(3);
    expect(toDwellSettings({ ...base, mode: "all" }).loopRoute).toBe(false);
  });
});

describe("v1.4.2 — reverse autoscroll edges", () => {
  it("reverse from the top jumps to the bottom instead of finishing", () => {
    expect(seedStartOffset(0, 4000, true)).toBe(4000);
    expect(seedStartOffset(1200, 4000, true)).toBe(1200);
  });

  it("forward from the very bottom restarts at the top", () => {
    expect(seedStartOffset(4000, 4000, false)).toBe(0);
    expect(seedStartOffset(10, 4000, false)).toBe(10);
  });

  it("a note that cannot scroll keeps its position", () => {
    expect(seedStartOffset(0, 0, true)).toBe(0);
  });

  it("an edge only finishes a run that actually moved", () => {
    expect(finishedAtEdge(0, 4000, -1, 0)).toBe(false);
    expect(finishedAtEdge(0, 4000, -1, 500)).toBe(true);
    expect(finishedAtEdge(4000, 4000, 1, 500)).toBe(true);
    expect(finishedAtEdge(2000, 4000, 1, 500)).toBe(false);
  });
});
