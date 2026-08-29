/**
 * v1.2.5 — pure helpers for the traffic-light colour cycle.
 *
 * Extracted from `main.ts` so the red → yellow → green round trip is tested
 * against the code that actually runs, not a copy inside a test file.
 */

/** Traffic-light order used by the "Cycle colour" command. */
export const TRAFFIC_CYCLE = ["recall-red", "recall-yellow", "recall-green"] as const;

/** Callout type of a toggle header line, e.g. `> [!recall-red]- Title` → `recall-red`. */
export function calloutTypeOfLine(line: string): string {
  return line.match(/^>\s*\[!([^\]]+)\]/)?.[1]?.trim() ?? "";
}

/**
 * Next colour in the cycle.
 *
 * A toggle that is not graded yet (`!note`, `!question`, …) becomes red, so the
 * first tap always means "hard" instead of silently jumping to yellow.
 */
export function nextTrafficColor(current: string): string {
  const idx = TRAFFIC_CYCLE.indexOf(current.trim() as (typeof TRAFFIC_CYCLE)[number]);
  if (idx < 0) return TRAFFIC_CYCLE[0];
  return TRAFFIC_CYCLE[(idx + 1) % TRAFFIC_CYCLE.length];
}

/**
 * Swap the callout type of a header line, keeping the fold marker (`+` / `-`)
 * and the title exactly as they were.
 */
export function recolorHeaderLine(line: string, callout: string): string {
  return line.replace(/^(>\s*)\[![^\]]+\]([+-]?)/, `$1[!${callout}]$2`);
}
