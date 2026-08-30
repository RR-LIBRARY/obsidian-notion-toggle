/**
 * v1.4.7 — deep-quiz run metrics: how accurate the timers really were, whether
 * the loop froze, and how long filtering / rendering took.
 *
 * Pure module (no DOM, no Obsidian) so every number in the report is testable.
 */
import type { LatencyReport, StabilityReport } from "./telemetry";

export type QuizPhaseName = "question" | "reveal";

export interface QuestionTiming {
  /** 1-based question number. */
  index: number;
  title: string;
  phase: QuizPhaseName;
  /** What the badge promised, in ms. */
  scheduledMs: number;
  /** Wall-clock time the phase actually held the screen (pauses removed). */
  actualMs: number;
  /** actual − scheduled (positive = ran long). */
  driftMs: number;
}

export interface TimerAccuracyReport {
  questions: number;
  meanDriftMs: number;
  p95DriftMs: number;
  totalDriftMs: number;
  scheduledMs: number;
  actualMs: number;
  /** 0–1: how close the run stayed to the promised schedule. */
  accuracy: number;
  worst: QuestionTiming | null;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function p95of(sorted: number[]): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * 0.95)))] ?? 0;
}

/**
 * Compares the time each phase was promised with the time it actually got.
 * Drift comes from the wall clock, so a phone that throttles timers in the
 * background shows up honestly instead of hiding behind the tick counter.
 */
export class TimerAccuracy {
  private items: QuestionTiming[] = [];
  private open:
    | { index: number; title: string; phase: QuizPhaseName; scheduledMs: number; startedAt: number }
    | null = null;
  /** ms of deliberate pause inside the open phase (never counted as drift). */
  private paused = 0;

  constructor(readonly capacity = 300) {}

  start(index: number, title: string, phase: QuizPhaseName, scheduledMs: number, now: number): void {
    this.open = { index, title, phase, scheduledMs, startedAt: now };
    this.paused = 0;
  }

  addPause(ms: number): void {
    if (Number.isFinite(ms) && ms > 0) this.paused += ms;
  }

  finish(now: number): QuestionTiming | null {
    const o = this.open;
    if (!o) return null;
    this.open = null;
    const actualMs = Math.max(0, now - o.startedAt - this.paused);
    this.paused = 0;
    const item: QuestionTiming = {
      index: o.index,
      title: o.title,
      phase: o.phase,
      scheduledMs: Math.max(0, Math.round(o.scheduledMs)),
      actualMs: Math.round(actualMs),
      driftMs: Math.round(actualMs - o.scheduledMs),
    };
    this.items.push(item);
    if (this.items.length > this.capacity) this.items.shift();
    return item;
  }

  timings(): QuestionTiming[] {
    return [...this.items];
  }

  reset(): void {
    this.items = [];
    this.open = null;
    this.paused = 0;
  }

  report(): TimerAccuracyReport {
    const items = this.items;
    if (!items.length) {
      return {
        questions: 0,
        meanDriftMs: 0,
        p95DriftMs: 0,
        totalDriftMs: 0,
        scheduledMs: 0,
        actualMs: 0,
        accuracy: 1,
        worst: null,
      };
    }
    const abs = items.map((i) => Math.abs(i.driftMs)).sort((a, b) => a - b);
    const scheduled = items.reduce((a, i) => a + i.scheduledMs, 0);
    const actual = items.reduce((a, i) => a + i.actualMs, 0);
    const worst = items.reduce((a, b) => (Math.abs(b.driftMs) > Math.abs(a.driftMs) ? b : a));
    return {
      questions: items.length,
      meanDriftMs: round1(abs.reduce((a, b) => a + b, 0) / abs.length),
      p95DriftMs: round1(p95of(abs)),
      totalDriftMs: Math.round(actual - scheduled),
      scheduledMs: scheduled,
      actualMs: actual,
      accuracy: scheduled > 0 ? Math.max(0, Math.min(1, 1 - Math.abs(actual - scheduled) / scheduled)) : 1,
      worst,
    };
  }
}

export interface FreezeEvent {
  ms: number;
  phase: string;
  at: number;
}

export interface FreezeReport {
  count: number;
  longestMs: number;
  totalMs: number;
  events: FreezeEvent[];
}

/**
 * A freeze is a loop tick that arrived far later than the 250 ms cadence while
 * the run was supposed to be ticking. Deliberate pauses call `ignoreNext()`, so
 * stopping the quiz yourself is never reported as a stall.
 */
export class FreezeDetector {
  private events: FreezeEvent[] = [];
  private skip = false;

  constructor(
    readonly expectedGap = 250,
    /** A gap over this multiple of the cadence counts as a freeze. */
    readonly factor = 3,
    readonly capacity = 40
  ) {}

  ignoreNext(): void {
    this.skip = true;
  }

  tick(gapMs: number, phase = "question", at = 0): FreezeEvent | null {
    if (this.skip) {
      this.skip = false;
      return null;
    }
    if (!Number.isFinite(gapMs) || gapMs <= this.expectedGap * this.factor) return null;
    const ev: FreezeEvent = { ms: Math.round(gapMs), phase, at };
    this.events.push(ev);
    if (this.events.length > this.capacity) this.events.shift();
    return ev;
  }

  reset(): void {
    this.events = [];
    this.skip = false;
  }

  report(): FreezeReport {
    return {
      count: this.events.length,
      longestMs: this.events.reduce((a, e) => Math.max(a, e.ms), 0),
      totalMs: this.events.reduce((a, e) => a + e.ms, 0),
      events: [...this.events],
    };
  }
}

/** Everything the reader sees in the performance report. */
export interface QuizPerfReport {
  quizRender: StabilityReport;
  remeasure: LatencyReport;
  quizHeal: LatencyReport;
  filter: LatencyReport;
  badgeRender: LatencyReport;
  timer: TimerAccuracyReport;
  freezes: FreezeReport;
  /** Stops the autoscroll crossed but had to come back for. */
  skippedStops: number;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const ms = (n: number): string => `${Math.round(n)}ms`;
const sec = (v: number): string => `${Math.round(v / 100) / 10}s`;

/** Plain-language verdict shown at the top of the report. */
export function perfVerdict(r: QuizPerfReport): string {
  const acc = Math.round(r.timer.accuracy * 100);
  if (r.freezes.count === 0 && acc >= 98 && r.quizRender.score >= 0.8 && !r.skippedStops) {
    return `Smooth run — timer ${acc}% accurate, no freezes.`;
  }
  const parts: string[] = [];
  if (acc < 98) parts.push(`timer ${acc}% accurate (${signed(r.timer.totalDriftMs)}ms over the run)`);
  if (r.freezes.count)
    parts.push(`${r.freezes.count} freeze${r.freezes.count === 1 ? "" : "s"}, longest ${r.freezes.longestMs}ms`);
  if (r.quizRender.score < 0.8)
    parts.push(`ring painting unevenly (${Math.round(r.quizRender.score * 100)}% stable)`);
  if (r.skippedStops) parts.push(`${r.skippedStops} stop${r.skippedStops === 1 ? "" : "s"} recovered after a jump`);
  const hint = r.freezes.count || r.quizRender.score < 0.8 ? " Try a shorter note, or turn the debug overlay off." : "";
  return `${parts.join("; ")}.${hint}`;
}

/** The user-visible deep-quiz performance report, as markdown. */
export function formatQuizReport(r: QuizPerfReport): string {
  const t = r.timer;
  const q = r.quizRender;
  const lat = (name: string, l: LatencyReport) => `| ${name} | ${l.count} | ${ms(l.mean)} | ${ms(l.p95)} | ${ms(l.max)} |`;
  const out: string[] = [`**${perfVerdict(r)}**`, "", "### Timer accuracy"];
  if (!t.questions) out.push("No question finished yet — run a quiz to collect timings.");
  else {
    out.push(
      `- Questions measured: **${t.questions}**`,
      `- Accuracy: **${Math.round(t.accuracy * 100)}%** (scheduled ${sec(t.scheduledMs)}, actual ${sec(t.actualMs)})`,
      `- Drift: mean ${ms(t.meanDriftMs)} · p95 ${ms(t.p95DriftMs)} · total ${signed(t.totalDriftMs)}ms`
    );
    if (t.worst)
      out.push(
        `- Worst: Q${t.worst.index} "${t.worst.title}" (${t.worst.phase}) — ${signed(t.worst.driftMs)}ms vs ${sec(
          t.worst.scheduledMs
        )}`
      );
  }
  out.push("", "### Freezes");
  if (!r.freezes.count) out.push("None detected — every tick arrived within 750ms.");
  else {
    out.push(`- Count: **${r.freezes.count}** · longest ${ms(r.freezes.longestMs)} · total ${ms(r.freezes.totalMs)}`);
    for (const e of r.freezes.events.slice(-5)) out.push(`  - ${ms(e.ms)} during *${e.phase}*`);
  }
  out.push(
    "",
    "### Render + filter timings",
    "| Stage | Runs | Avg | p95 | Max |",
    "| --- | --- | --- | --- | --- |",
    lat("Colour filter", r.filter),
    lat("Badge render", r.badgeRender),
    lat("Scroll re-measure", r.remeasure),
    lat("Quiz self-heal", r.quizHeal),
    "",
    "### Timer paint cadence",
    `- ${q.paints} paints · avg ${ms(q.meanGap)} · p95 ${ms(q.p95Gap)} (target 250ms)`,
    `- Jitter ${ms(q.jitter)} · dropped ${q.dropped} · stability **${Math.round(q.score * 100)}%**`,
    "",
    "### Autoscroll",
    `- Skipped stops: **${r.skippedStops}** (crossed but recovered — 0 means nothing was missed)`
  );
  return out.join("\n");
}
