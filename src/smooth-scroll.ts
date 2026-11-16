/**
 * v1.9.30 — smoother autoscroll (pure, no Obsidian).
 *
 *  - Sub-pixel writes: `scrollTop` was floored to whole pixels, so at 60 px/s
 *    on a 120 Hz phone the page moved 1 px every other frame (a visible judder).
 *    Smooth / Ultra write the fractional position (Chromium scrolls sub-pixel).
 *  - Soft start: after each stop the glide eases back to full speed instead of
 *    jumping to it.
 *  - Low-power fallback: when frames get slow (avg > 34 ms) the run drops to
 *    Standard so a struggling phone does not do extra work.
 */
export type Smoothness = "standard" | "smooth" | "ultra";
export const SMOOTHNESS_LEVELS: Smoothness[] = ["standard", "smooth", "ultra"];
const RAMP_MS: Record<Smoothness, number> = { standard: 0, smooth: 350, ultra: 650 };

export function normaliseSmoothness(v: unknown): Smoothness {
  return SMOOTHNESS_LEVELS.includes(v as Smoothness) ? (v as Smoothness) : "smooth";
}

/** The level actually used this frame, given the running average frame time. */
export function effectiveSmoothness(level: Smoothness, avgFrameMs: number): Smoothness {
  return avgFrameMs > 34 ? "standard" : level;
}

/** Speed multiplier `ms` after leaving a stop: ease-out cubic from 0.15 to 1. */
export function rampFactor(ms: number, level: Smoothness): number {
  const ramp = RAMP_MS[level];
  if (!ramp || !(ms >= 0) || ms >= ramp) return 1;
  const t = ms / ramp;
  return 0.15 + 0.85 * (1 - Math.pow(1 - t, 3));
}

/** What to write into `scrollTop`. */
export function scrollWriteValue(pos: number, level: Smoothness): number {
  return level === "standard" ? Math.floor(pos) : Math.round(pos * 100) / 100;
}

/** Exponential moving average of the frame time (ms). */
export function nextFrameAvg(avg: number, deltaMs: number): number {
  if (!(deltaMs > 0) || deltaMs > 250) return avg || 16.7;
  return avg ? avg * 0.9 + deltaMs * 0.1 : deltaMs;
}

/** Smoothness metrics over per-frame positions (px) and timestamps (ms). */
export function smoothnessStats(pos: number[], ts: number[]) {
  const steps: number[] = [];
  for (let i = 1; i < pos.length; i++) steps.push(Math.abs(pos[i] - pos[i - 1]));
  const moving = steps.filter((s) => s > 0);
  const mean = moving.reduce((a, b) => a + b, 0) / (moving.length || 1);
  const sd = Math.sqrt(moving.reduce((a, b) => a + (b - mean) ** 2, 0) / (moving.length || 1));
  const frames = ts.slice(1).map((t, i) => t - ts[i]);
  return {
    frames: steps.length,
    stalledFrames: steps.filter((s) => s === 0).length,
    jumps: steps.filter((s) => s > 40).length,
    stepMean: +mean.toFixed(3),
    stepSd: +sd.toFixed(3),
    droppedFrames: frames.filter((d) => d > 25).length,
  };
}
