/**
 * v1.7.5 — "Pause on each screen" scale (pure). A 0–100 slider covers 1 s … 1 h
 * on a log curve, so short pauses get fine steps and long ones coarse steps.
 */
export const PAUSE_MIN_MS = 1000;
export const PAUSE_MAX_MS = 3_600_000;
export const PAUSE_STEPS = 100;
export const PAUSE_CHIPS: { label: string; ms: number }[] = [
  { label: "10s", ms: 10_000 },
  { label: "20s", ms: 20_000 },
  { label: "30s", ms: 30_000 },
  { label: "60s", ms: 60_000 },
  { label: "1h", ms: 3_600_000 },
];

const LN = Math.log(PAUSE_MAX_MS / PAUSE_MIN_MS);

/** Round a raw duration to a friendly value: whole seconds < 2 min, 5 s < 10 min, whole minutes above. */
export function roundPause(ms: number): number {
  const s = Math.min(PAUSE_MAX_MS, Math.max(PAUSE_MIN_MS, ms)) / 1000;
  if (s < 120) return Math.round(s) * 1000;
  if (s < 600) return Math.round(s / 5) * 5000;
  return Math.round(s / 60) * 60_000;
}

export function sliderToPause(pos: number): number {
  const p = Math.min(PAUSE_STEPS, Math.max(0, pos)) / PAUSE_STEPS;
  return roundPause(PAUSE_MIN_MS * Math.exp(LN * p));
}

export function pauseToSlider(ms: number): number {
  const v = Math.min(PAUSE_MAX_MS, Math.max(PAUSE_MIN_MS, ms));
  return Math.round((Math.log(v / PAUSE_MIN_MS) / LN) * PAUSE_STEPS);
}

/** "7s", "1m 30s", "45m", "1h". */
export function formatPause(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total >= 3600) return total % 3600 === 0 ? `${total / 3600}h` : `${Math.floor(total / 3600)}h ${Math.round((total % 3600) / 60)}m`;
  if (total >= 60) return total % 60 === 0 ? `${total / 60}m` : `${Math.floor(total / 60)}m ${total % 60}s`;
  return `${total}s`;
}
