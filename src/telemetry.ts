/**
 * v1.3.3 — lightweight performance telemetry (pure, no Obsidian / DOM imports).
 *
 * Two things were only ever judged by eye on the screen recordings:
 *  1. quiz timer render stability — is the inline ring repainting on a steady
 *     cadence, or stuttering / dropping frames on a long note?
 *  2. scroll re-measure latency — how long `collectStops()` takes when the
 *     reading view re-renders a big document.
 *
 * Both are now measured with fixed-size ring buffers: bounded memory, no
 * allocation per sample, and O(n log n) only when a report is asked for.
 */
import { FreezeDetector, TimerAccuracy, type QuizPerfReport } from "./quiz-perf";

export { FreezeDetector, TimerAccuracy, formatQuizReport, perfVerdict } from "./quiz-perf";
export type { FreezeReport, QuestionTiming, QuizPerfReport, TimerAccuracyReport } from "./quiz-perf";

/** Rolling numeric samples with percentile stats. Fixed capacity. */
export class Samples {
  private buf: number[] = [];
  private next = 0;
  private seen = 0;

  constructor(readonly capacity = 120) {}

  add(value: number): void {
    if (!Number.isFinite(value)) return;
    this.seen++;
    if (this.buf.length < this.capacity) this.buf.push(value);
    else {
      this.buf[this.next] = value;
      this.next = (this.next + 1) % this.capacity;
    }
  }

  get count(): number {
    return this.seen;
  }

  values(): number[] {
    return [...this.buf];
  }

  reset(): void {
    this.buf = [];
    this.next = 0;
    this.seen = 0;
  }

  percentile(p: number): number {
    if (!this.buf.length) return 0;
    const sorted = [...this.buf].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round(((sorted.length - 1) * Math.min(100, Math.max(0, p))) / 100))
    );
    return sorted[idx] ?? 0;
  }

  get mean(): number {
    if (!this.buf.length) return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }

  get max(): number {
    return this.buf.length ? Math.max(...this.buf) : 0;
  }
}

export interface StabilityReport {
  /** Paints recorded since the last reset. */
  paints: number;
  /** Mean gap between paints, in ms. */
  meanGap: number;
  /** 95th-percentile gap — the stutter the reader actually notices. */
  p95Gap: number;
  /** Mean absolute deviation from the expected cadence, in ms. */
  jitter: number;
  /** Paints that arrived later than 2× the expected cadence. */
  dropped: number;
  /** 0..1, 1 = perfectly steady at the expected cadence. */
  score: number;
}

/**
 * Render-cadence meter for the quiz ring: feed it a timestamp per paint and it
 * reports jitter, dropped frames and a 0..1 stability score.
 */
export class RenderStability {
  private gaps = new Samples(120);
  private last: number | null = null;
  private paints = 0;
  private dropped = 0;

  /** @param expectedGap the cadence the caller aims for (quiz loop = 250 ms). */
  constructor(private expectedGap = 250) {}

  mark(now: number): void {
    if (!Number.isFinite(now)) return;
    this.paints++;
    if (this.last !== null) {
      const gap = now - this.last;
      if (gap >= 0) {
        this.gaps.add(gap);
        if (gap > this.expectedGap * 2) this.dropped++;
      }
    }
    this.last = now;
  }

  reset(): void {
    this.gaps.reset();
    this.last = null;
    this.paints = 0;
    this.dropped = 0;
  }

  report(): StabilityReport {
    const values = this.gaps.values();
    const jitter = values.length
      ? values.reduce((a, g) => a + Math.abs(g - this.expectedGap), 0) / values.length
      : 0;
    const score = values.length
      ? Math.max(0, Math.min(1, 1 - jitter / this.expectedGap))
      : 1;
    return {
      paints: this.paints,
      meanGap: round(this.gaps.mean),
      p95Gap: round(this.gaps.percentile(95)),
      jitter: round(jitter),
      dropped: this.dropped,
      score: Math.round(score * 100) / 100,
    };
  }
}

export interface LatencyReport {
  count: number;
  mean: number;
  p95: number;
  max: number;
}

/** Duration sampler for a named operation (scroll re-measure, quiz heal…). */
export class Latency {
  private s = new Samples(60);

  add(ms: number): void {
    this.s.add(ms);
  }

  /** Time `fn`, record it, return its value. */
  measure<T>(now: () => number, fn: () => T): T {
    const t0 = now();
    try {
      return fn();
    } finally {
      this.add(now() - t0);
    }
  }

  reset(): void {
    this.s.reset();
  }

  report(): LatencyReport {
    return {
      count: this.s.count,
      mean: round(this.s.mean),
      p95: round(this.s.percentile(95)),
      max: round(this.s.max),
    };
  }
}

export type TelemetryReport = QuizPerfReport;

/** The plugin-wide collector. Cheap enough to leave on permanently. */
export class Telemetry {
  readonly quizRender = new RenderStability(250);
  readonly remeasure = new Latency();
  readonly quizHeal = new Latency();
  /** v1.4.7 — colour-filter evaluation while collecting stops. */
  readonly filter = new Latency();
  /** v1.4.7 — per-question badge painting. */
  readonly badgeRender = new Latency();
  readonly timer = new TimerAccuracy();
  readonly freezes = new FreezeDetector(250);
  /** v1.4.7 — stops crossed without parking (recovered on a later frame). */
  skippedStops = 0;

  noteSkipped(n = 1): void {
    if (n > 0) this.skippedStops += n;
  }

  reset(): void {
    this.quizRender.reset();
    this.remeasure.reset();
    this.quizHeal.reset();
    this.filter.reset();
    this.badgeRender.reset();
    this.timer.reset();
    this.freezes.reset();
    this.skippedStops = 0;
  }

  report(): TelemetryReport {
    return {
      quizRender: this.quizRender.report(),
      remeasure: this.remeasure.report(),
      quizHeal: this.quizHeal.report(),
      filter: this.filter.report(),
      badgeRender: this.badgeRender.report(),
      timer: this.timer.report(),
      freezes: this.freezes.report(),
      skippedStops: this.skippedStops,
    };
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

/** One-screen summary for a Notice / the debug overlay. */
export function formatTelemetry(r: TelemetryReport): string {
  const q = r.quizRender;
  const line = (name: string, l: LatencyReport) =>
    `${name}: ${l.count}× · avg ${l.mean}ms · p95 ${l.p95}ms · max ${l.max}ms`;
  return [
    `Quiz timer: ${q.paints} paints · avg ${q.meanGap}ms · p95 ${q.p95Gap}ms`,
    `Jitter ${q.jitter}ms · dropped ${q.dropped} · stability ${Math.round(q.score * 100)}%`,
    line("Re-measure", r.remeasure),
    line("Quiz heal", r.quizHeal),
  ].join("\n");
}
