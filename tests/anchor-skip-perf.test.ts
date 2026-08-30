/**
 * v1.4.7 — anchoring (portrait *and* landscape), skip recovery, and the
 * deep-quiz performance report.
 */
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_STOP_ANCHOR,
  STOP_ANCHORS,
  anchorFraction,
  anchorOffset,
  targetOffset,
} from "../src/autoscroll";
import { anchorScrollTop, anchoredTargets, pickStops, targetsKey } from "../src/scroll-anchor";
import { DEFAULT_DWELL, crossedTargets, layoutSignature, pendingAfterPark } from "../src/scrollmode";
import type { DwellSettings, DwellTarget, PageBox } from "../src/scrollmode";
import { FreezeDetector, TimerAccuracy, formatQuizReport, perfVerdict } from "../src/quiz-perf";
import type { QuizPerfReport } from "../src/quiz-perf";

const box = (clientHeight: number, scrollHeight = 100000) => ({ clientHeight, scrollHeight });
const target = (page: number, top: number, index = 0): DwellTarget => ({
  page,
  top,
  index,
  key: `${page}:${index}`,
});

describe("v1.4.7 — stop anchoring", () => {
  test("anchors are declared with a sane default", () => {
    expect(DEFAULT_STOP_ANCHOR).toBe("middle");
    expect(STOP_ANCHORS.middle).toBeCloseTo(0.5, 5);
    expect(anchorFraction("middle")).toBeCloseTo(0.5, 5);
    expect(anchorFraction("nonsense")).toBe(STOP_ANCHORS[DEFAULT_STOP_ANCHOR]);
    expect(STOP_ANCHORS.third).toBeLessThan(STOP_ANCHORS.middle);
    expect(STOP_ANCHORS.lower).toBeGreaterThan(STOP_ANCHORS.middle);
  });

  test("a toggle that fits is centred on the anchor line", () => {
    // 200px toggle at y=1000, 800px viewport, middle anchor.
    expect(anchorScrollTop(box(800), 1000, 200, "middle")).toBe(1000 - (400 - 100));
  });

  test("a toggle taller than the screen keeps its top visible", () => {
    const top = anchorScrollTop(box(800), 1000, 5000, "middle");
    expect(top).toBe(1000);
  });

  test("offsets clamp inside the scroll range", () => {
    expect(anchorScrollTop(box(800), 10, 100, "lower")).toBeGreaterThanOrEqual(0);
    expect(anchorScrollTop(box(800, 2000), 1990, 100, "top")).toBeLessThanOrEqual(1200);
  });

  test("portrait and landscape park the toggle at the same screen fraction", () => {
    const seen = (vh: number) => {
      const scrollTop = anchorScrollTop(box(vh), 3000, 300, "middle");
      return (3000 - scrollTop + 150) / vh; // toggle centre, as a screen fraction
    };
    expect(seen(900)).toBeCloseTo(seen(400), 2);
    expect(seen(900)).toBeCloseTo(0.5, 2);
  });

  test("the legacy upper-third helper is untouched by the new anchor", () => {
    expect(targetOffset(1000, 800)).toBe(Math.round(1000 - 800 * STOP_ANCHORS.third));
    expect(anchorOffset(1000, 200, 800, "top")).toBeGreaterThan(targetOffset(1000, 800));
  });
});

describe("v1.4.7 — layout invalidation", () => {
  const boxes: PageBox[] = [
    { page: 1, top: 0, height: 100 },
    { page: 2, top: 400, height: 100 },
  ];
  const cfg: DwellSettings = { ...DEFAULT_DWELL, enabled: true, parity: "all", seconds: 5 };

  test("layout signature changes when a box moves, not just when one is added", () => {
    expect(layoutSignature(boxes)).toBe(layoutSignature([...boxes]));
    expect(layoutSignature(boxes)).not.toBe(
      layoutSignature([boxes[0]!, { page: 2, top: 900, height: 100 }])
    );
  });

  test("the targets key reacts to viewport, anchor and layout", () => {
    const base = targetsKey(box(800), cfg, "middle", boxes);
    expect(targetsKey(box(800), cfg, "middle", boxes)).toBe(base);
    expect(targetsKey(box(400), cfg, "middle", boxes)).not.toBe(base);
    expect(targetsKey(box(800), cfg, "top", boxes)).not.toBe(base);
    expect(targetsKey(box(800), cfg, "middle", [boxes[0]!])).not.toBe(base);
  });

  test("anchored targets are ordered by travel and already anchored", () => {
    const out = anchoredTargets(boxes, cfg, box(800), "middle");
    expect(out.length).toBe(2);
    expect(out[0]!.top).toBeLessThanOrEqual(out[1]!.top);
    expect(out[1]!.top).toBe(anchorScrollTop(box(800), 400, 100, "middle"));
  });
});

describe("v1.4.7 — no stop gets skipped", () => {
  const targets = [target(1, 100), target(2, 150), target(3, 900)];

  test("a fast frame reports every stop it flew past, not just one", () => {
    expect(crossedTargets(targets, 50, 400, 1).map((t) => t.page)).toEqual([1, 2]);
  });

  test("reverse crossings come back in reverse travel order", () => {
    expect(crossedTargets(targets, 400, 50, -1).map((t) => t.page)).toEqual([2, 1]);
  });

  test("visited stops are filtered out of the pending queue", () => {
    const crossed = crossedTargets(targets, 50, 400, 1);
    expect(pendingAfterPark(crossed, new Set(["1:0"])).map((t) => t.page)).toEqual([2]);
    expect(pendingAfterPark(crossed, new Set(["1:0", "2:0"]))).toEqual([]);
  });

  test("pickStops queues every crossed stop and names the nearest one", () => {
    const pick = pickStops(targets, 50, 400, 1, new Set<string>());
    expect(pick.queue.map((t) => t.page)).toEqual([1, 2]);
    expect(pick.stop?.page).toBe(1);
  });

  test("a stop pushed behind the playhead by a re-measure is recovered", () => {
    // Playhead already at 500; stop 1 moved up to 200 when a toggle above closed.
    const pick = pickStops([target(1, 200), target(3, 900)], 500, 500, 1, new Set<string>());
    expect(pick.missed.map((t) => t.page)).toEqual([1]);
    expect(pick.stop?.page).toBe(1);
  });

  test("nothing is queued when the stops ahead have not been reached", () => {
    const pick = pickStops(targets, 0, 40, 1, new Set<string>());
    expect(pick.queue).toEqual([]);
    expect(pick.stop).toBeUndefined();
  });

  test("two stops sharing a page are guarded per slice, not per page", () => {
    const sliced = [target(1, 100, 0), target(1, 300, 1)];
    const pick = pickStops(sliced, 50, 400, 1, new Set(["1:0"]));
    expect(pick.queue.map((t) => t.key)).toEqual(["1:1"]);
  });
});

describe("v1.4.7 — timer accuracy", () => {
  test("drift is measured against the promised duration", () => {
    const t = new TimerAccuracy();
    t.start(1, "Q1", "question", 1000, 0);
    t.finish(1120);
    t.start(2, "Q2", "question", 1000, 1120);
    t.finish(2130);
    const r = t.report();
    expect(r.questions).toBe(2);
    expect(r.meanDriftMs).toBeGreaterThan(0);
    expect(r.worst?.title).toBe("Q1");
    expect(r.accuracy).toBeLessThanOrEqual(1);
    expect(r.accuracy).toBeGreaterThan(0.85);
  });

  test("deliberate pauses do not count as drift", () => {
    const t = new TimerAccuracy();
    t.start(1, "Q1", "question", 1000, 0);
    t.addPause(5000);
    t.finish(6010);
    expect(Math.abs(t.report().meanDriftMs)).toBeLessThan(50);
  });

  test("an empty run reports cleanly and reset clears history", () => {
    const t = new TimerAccuracy();
    expect(t.report().questions).toBe(0);
    expect(t.report().accuracy).toBe(1);
    t.start(1, "Q1", "reveal", 500, 0);
    t.finish(500);
    t.reset();
    expect(t.timings()).toEqual([]);
  });
});

describe("v1.4.7 — freeze detection", () => {
  test("a gap far past the 250ms cadence is a freeze", () => {
    const f = new FreezeDetector(250);
    expect(f.tick(250)).toBeNull();
    expect(f.tick(1500, "question", 10)).not.toBeNull();
    const r = f.report();
    expect(r.count).toBe(1);
    expect(r.longestMs).toBe(1500);
  });

  test("steady ticks are never a freeze", () => {
    const f = new FreezeDetector(250);
    for (let i = 0; i < 10; i++) f.tick(250 + (i % 3));
    expect(f.report().count).toBe(0);
  });

  test("a deliberate pause can be ignored, and reset clears events", () => {
    const f = new FreezeDetector(250);
    f.ignoreNext();
    expect(f.tick(9000)).toBeNull();
    f.tick(9000);
    expect(f.report().count).toBe(1);
    f.reset();
    expect(f.report().count).toBe(0);
  });
});

describe("v1.4.7 — the report the reader sees", () => {
  const lat = (mean: number) => ({ count: 3, mean, p95: mean, max: mean, total: mean * 3 }) as never;
  const build = (over: boolean): QuizPerfReport => {
    const t = new TimerAccuracy();
    t.start(1, "What is spaced repetition?", "question", 1000, 0);
    t.finish(over ? 2400 : 1005);
    const f = new FreezeDetector(250);
    if (over) f.tick(3000);
    return {
      quizRender: { paints: 40, meanGap: 250, p95Gap: 260, jitter: 8, dropped: 0, score: over ? 0.4 : 0.99 } as never,
      remeasure: lat(4),
      quizHeal: lat(2),
      filter: lat(3),
      badgeRender: lat(1),
      timer: t.report(),
      freezes: f.report(),
      skippedStops: over ? 2 : 0,
    };
  };

  test("every section the reader was promised is present", () => {
    const md = formatQuizReport(build(false));
    for (const heading of [
      "Timer accuracy",
      "Freezes",
      "Render + filter timings",
      "Timer paint cadence",
      "Autoscroll",
      "Skipped stops",
    ]) {
      expect(md).toContain(heading);
    }
    expect(md).toContain("Colour filter");
  });

  test("a bad run names its problems instead of hiding them", () => {
    const md = formatQuizReport(build(true));
    expect(md).toContain("freeze");
    expect(md).toContain("recovered after a jump");
    expect(perfVerdict(build(true))).not.toBe(perfVerdict(build(false)));
    expect(perfVerdict(build(false))).toContain("Smooth run");
  });
});
