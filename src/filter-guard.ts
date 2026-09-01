/**
 * v1.6.1 — the colour-filter hard guard.
 *
 * Every "🔴 filter par 🟡 bhi khul gaya" report traced back to the same shape:
 * the run decides *which* toggle to open from a measurement taken one or more
 * frames earlier (identity map + DOM ordinal), and Obsidian's Reading View is
 * free to replace a lazy section in between. When that happens an identity can
 * resolve to a detached node and an ordinal can resolve to a *different*
 * physical toggle — one that never passed the filter.
 *
 * Rather than chase every drift path, this module re-checks reality at the
 * moment of the open:
 *
 *   1. a resolved element must still be connected to the document, and
 *   2. its own live colour must satisfy the active filter.
 *
 * Anything else opens nothing and is reported as a skip. The functions are pure
 * (they take the lookups and a colour reader) so the whole guard is unit
 * testable without Obsidian.
 */
import type { RecallColor } from "./autoscroll";

export interface ParkLookup {
  /** Identity carried by the measured stop, when there is one. */
  identity?: string;
  ordinal: number;
  byIdentity: Map<string, HTMLElement>;
  byOrdinal: Map<number, HTMLElement>;
  /** Active colour filter; empty = every colour allowed. */
  filter: RecallColor[];
  /** Live colour of an element, read fresh from the DOM. */
  colorOf: (el: HTMLElement) => RecallColor;
  /** Test seam: happy-dom nodes are connected, detached fakes are not. */
  isConnected?: (el: HTMLElement) => boolean;
}

export type ParkReason =
  | "identity"
  | "ordinal"
  | "missing"
  | "detached"
  | "filtered-out";

export interface ParkResolution {
  el: HTMLElement | null;
  reason: ParkReason;
  /** Colour the guard actually read, when an element was found. */
  color: RecallColor | null;
}

const connected = (el: HTMLElement, probe?: (el: HTMLElement) => boolean): boolean =>
  probe ? probe(el) : el.isConnected !== false;

/** Does this colour pass the filter? Empty filter = everything passes. */
export function colorAllowed(color: RecallColor, filter: RecallColor[]): boolean {
  return filter.length === 0 || filter.includes(color);
}

/**
 * Resolve the element to park on — or refuse.
 *
 * Identity first (stable across section replacement), ordinal only as a
 * fallback, and the colour re-check applies to *both* paths.
 */
export function resolveParkTarget(lookup: ParkLookup): ParkResolution {
  const { identity, ordinal, byIdentity, byOrdinal, filter, colorOf, isConnected } = lookup;
  const byId = identity ? byIdentity.get(identity) : undefined;
  const el = byId ?? byOrdinal.get(ordinal) ?? null;
  const reason: ParkReason = byId ? "identity" : el ? "ordinal" : "missing";
  if (!el) return { el: null, reason: "missing", color: null };
  if (!connected(el, isConnected)) return { el: null, reason: "detached", color: null };
  const color = colorOf(el);
  if (!colorAllowed(color, filter)) return { el: null, reason: "filtered-out", color };
  return { el, reason, color };
}

export interface StrayScan {
  el: HTMLElement;
  color: RecallColor;
  open: boolean;
}

/**
 * Toggles that are open but do not belong to this run.
 *
 * Two ways one appears: the reader opened it by hand before starting, or a
 * previous plan left it open and the healed plan no longer contains it. Both
 * look exactly like a filter leak on screen, so a filtered run closes them.
 * `keep` is the element the run is parked on (never closed).
 */
export function strayOpenToggles(
  scan: StrayScan[],
  filter: RecallColor[],
  keep?: HTMLElement | null
): HTMLElement[] {
  if (filter.length === 0) return [];
  return scan
    .filter((s) => s.open && s.el !== keep && !colorAllowed(s.color, filter))
    .map((s) => s.el);
}

/** Human line for the debug overlay / `scrollLastEvent`. */
export function parkSkipLabel(res: ParkResolution, ordinal: number): string {
  if (res.el) return "";
  if (res.reason === "filtered-out") {
    return `filter guard: skipped toggle ${ordinal} (${res.color ?? "?"} not in filter)`;
  }
  if (res.reason === "detached") return `filter guard: toggle ${ordinal} was re-rendered`;
  return `filter guard: toggle ${ordinal} not in the filtered plan`;
}
