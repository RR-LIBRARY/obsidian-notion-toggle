/**
 * v1.3.3 — performance telemetry: cadence stability, latency percentiles and
 * bounded memory (the meters run for the whole session on a phone).
 */
import { describe, expect, it } from "bun:test";
import {
  Latency,
  RenderStability,
  Samples,
  Telemetry,
  formatTelemetry,
} from "../src/telemetry";

describe("Samples", () => {
  it("keeps only `capacity` values but counts everything", () => {
    const s = new Samples(5);
    for (let i = 1; i <= 50; i++) s.add(i);
    expect(s.count).toBe(50);
    expect(s.values().length).toBe(5);
    expect(s.max).toBe(50);
  });

  it("ignores NaN / Infinity and reports sane empty stats", () => {
    const s = new Samples(4);
    s.add(NaN);
    s.add(Infinity);
    expect(s.count).toBe(0);
    expect(s.mean).toBe(0);
    expect(s.percentile(95)).toBe(0);
    expect(s.max).toBe(0);
  });

  it("computes percentiles", () => {
    const s = new Samples(100);
    for (let i = 1; i <= 100; i++) s.add(i);
    expect(s.percentile(50)).toBeGreaterThanOrEqual(50);
    expect(s.percentile(95)).toBeGreaterThanOrEqual(95);
    expect(s.percentile(0)).toBe(1);
    expect(s.percentile(1000)).toBe(100);
  });
});

describe("RenderStability", () => {
  it("scores a perfectly steady 250 ms quiz cadence as 1", () => {
    const r = new RenderStability(250);
    for (let t = 0; t <= 5000; t += 250) r.mark(t);
    const rep = r.report();
    expect(rep.paints).toBe(21);
    expect(rep.meanGap).toBe(250);
    expect(rep.jitter).toBe(0);
    expect(rep.dropped).toBe(0);
    expect(rep.score).toBe(1);
  });

  it("flags stutter and dropped frames", () => {
    const r = new RenderStability(250);
    let t = 0;
    for (const gap of [250, 250, 900, 250, 1200, 250]) {
      t += gap;
      r.mark(t);
    }
    const rep = r.report();
    expect(rep.dropped).toBe(2);
    expect(rep.p95Gap).toBeGreaterThan(800);
    expect(rep.score).toBeLessThan(0.5);
  });

  it("resets cleanly between runs", () => {
    const r = new RenderStability(250);
    r.mark(0);
    r.mark(2000);
    r.reset();
    expect(r.report()).toEqual({
      paints: 0,
      meanGap: 0,
      p95Gap: 0,
      jitter: 0,
      dropped: 0,
      score: 1,
    });
  });
});

describe("Latency", () => {
  it("measures a call and keeps its value", () => {
    const l = new Latency();
    let clock = 0;
    const out = l.measure(
      () => (clock += 5),
      () => "stops"
    );
    expect(out).toBe("stops");
    expect(l.report().count).toBe(1);
    expect(l.report().max).toBeGreaterThan(0);
  });

  it("records the duration even when the measured call throws", () => {
    const l = new Latency();
    let clock = 0;
    expect(() =>
      l.measure(
        () => (clock += 3),
        () => {
          throw new Error("re-render");
        }
      )
    ).toThrow("re-render");
    expect(l.report().count).toBe(1);
  });

  it("reports mean / p95 / max", () => {
    const l = new Latency();
    [1, 2, 3, 40].forEach((v) => l.add(v));
    const r = l.report();
    expect(r.count).toBe(4);
    expect(r.max).toBe(40);
    expect(r.mean).toBeCloseTo(11.5, 1);
  });
});

describe("Telemetry report", () => {
  it("formats one readable screen and resets", () => {
    const t = new Telemetry();
    t.quizRender.mark(0);
    t.quizRender.mark(250);
    t.remeasure.add(12);
    t.quizHeal.add(3);
    const text = formatTelemetry(t.report());
    expect(text).toContain("Quiz timer: 2 paints");
    expect(text).toContain("Re-measure: 1×");
    expect(text).toContain("Quiz heal: 1×");
    t.reset();
    expect(t.report().remeasure.count).toBe(0);
    expect(t.report().quizRender.paints).toBe(0);
  });
});
