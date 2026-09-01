/**
 * v1.6.1 — think-time timing log.
 *
 * "Blink" and "answer too early / too late" reports are impossible to argue
 * about without timestamps, so the run can record exactly when each phase
 * happened for the last few toggles:
 *
 *   toggle 8 open      t+0ms
 *   countdown start    t+12ms   (+12)
 *   answer release     t+5031ms (+5019)
 *
 * Pure bookkeeping + a pure line formatter, so the numbers shown on the phone
 * are the very numbers the tests assert.
 */

export type ThinkPhase = "open" | "countdown" | "tick" | "reveal" | "close";

export interface ThinkEvent {
  phase: ThinkPhase;
  /** Toggle number in the note. */
  ordinal: number;
  /** Clock the run uses (rAF timestamp / Date.now — same source throughout). */
  at: number;
  /** Extra note, e.g. "tap" for a manual reveal or "5s" for the window. */
  note?: string;
}

const LABEL: Record<ThinkPhase, string> = {
  open: "toggle open",
  countdown: "countdown start",
  tick: "tick",
  reveal: "answer release",
  close: "toggle close",
};

const ms = (n: number) => `${Math.round(n)}ms`;

/**
 * Render events as overlay lines. Times are relative to the first event of the
 * run so they stay short on a phone screen; each line also carries the delta
 * from the previous event.
 */
export function thinkTimingLines(events: ThinkEvent[], limit = 6): string[] {
  if (events.length === 0) return ["timing —"];
  const base = events[0]!.at;
  const shown = events.slice(-limit);
  const out: string[] = [];
  let prev: ThinkEvent | null = null;
  for (const ev of shown) {
    const delta = prev ? ev.at - prev.at : 0;
    out.push(
      `#${ev.ordinal} ${LABEL[ev.phase]} t+${ms(ev.at - base)}${
        prev ? ` (+${ms(delta)})` : ""
      }${ev.note ? ` · ${ev.note}` : ""}`
    );
    prev = ev;
  }
  return out;
}

/** Think window actually served for a toggle: countdown start → release. */
export function thinkWindowMs(events: ThinkEvent[], ordinal: number): number | null {
  const start = events.find((e) => e.ordinal === ordinal && e.phase === "countdown");
  const end = events.find((e) => e.ordinal === ordinal && e.phase === "reveal");
  if (!start || !end) return null;
  return Math.max(0, Math.round(end.at - start.at));
}

/** Rolling recorder — keeps only the tail so a long run cannot grow forever. */
export class ThinkTimeline {
  private events: ThinkEvent[] = [];
  private cap: number;
  /** Off by default; the settings switch turns it on. */
  enabled = false;

  constructor(cap = 60) {
    this.cap = Math.max(4, cap);
  }

  reset(): void {
    this.events = [];
  }

  mark(phase: ThinkPhase, ordinal: number, at: number, note?: string): void {
    if (!this.enabled) return;
    // Ticks are noisy: keep at most one per second per toggle.
    if (phase === "tick") {
      const last = [...this.events].reverse().find((e) => e.phase === "tick" && e.ordinal === ordinal);
      if (last && at - last.at < 1000) return;
    }
    this.events.push({ phase, ordinal, at, note });
    if (this.events.length > this.cap) this.events = this.events.slice(-this.cap);
  }

  all(): ThinkEvent[] {
    return [...this.events];
  }

  lines(limit = 6): string[] {
    return thinkTimingLines(this.events, limit);
  }
}
