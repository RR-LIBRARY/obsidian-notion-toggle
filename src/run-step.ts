/**
 * v1.6.2 — pure decisions the autoscroll frame used to make inline.
 *
 * The audit's HIGH finding was that `main.ts`'s frame loop decided, in place,
 * what a refused park means. Three "cannot open this" outcomes existed
 * (`filtered-out`, `detached`, `missing`) and only two were handled, so a stop
 * whose element had vanished still burned the whole hold + think window doing
 * nothing — the run looked frozen.
 *
 * Everything here is pure so those rules are unit tested without Obsidian.
 */
import type { ParkReason } from "./filter-guard";

/** Every reason that means "no element to open": all of them skip the stop. */
export function isRefusedPark(reason: ParkReason): boolean {
  return reason === "missing" || reason === "detached" || reason === "filtered-out";
}

/**
 * Identity to remember as the run's active toggle.
 *
 * Never a synthetic `String(ordinal)`: `pickStops`/`reopens` compare *real*
 * rendered identities against this value, and an ordinal string can be reused
 * by a different toggle after a re-measure — which silently weakened the
 * anti-reopen guard behind the 1.5.7 → 1.6.0 loop bugs.
 */
export function nextActiveIdentity(
  identity: string | undefined | null,
  parked: boolean
): string | null {
  if (!parked) return null;
  return identity && identity.length > 0 ? identity : null;
}

export interface DwellPlan {
  /** Frame-clock deadline for this stop; 0 = do not pause, keep gliding. */
  dwellUntil: number;
  /** Think window that was added on top of the hold, in ms. */
  thinkMs: number;
}

/**
 * Deadline for a stop. A refused park never pauses: the run advances on the
 * next frame instead of standing still for `hold + think`.
 */
export function dwellPlan(
  now: number,
  holdMs: number,
  thinkMs: number,
  parked: boolean
): DwellPlan {
  if (!parked) return { dwellUntil: 0, thinkMs: 0 };
  const hold = Math.max(0, Number.isFinite(holdMs) ? holdMs : 0);
  const think = Math.max(0, Number.isFinite(thinkMs) ? thinkMs : 0);
  return { dwellUntil: now + hold + think, thinkMs: think };
}

/** Debug line for a skipped stop, appended after the crossing event. */
export function skipEventLabel(base: string, reason: ParkReason): string {
  return `${base} · skipped (${reason})`;
}
