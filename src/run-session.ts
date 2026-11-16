/** Shared run lifecycle: source ordinals, gate cleanup, final route dwell. */
import type { AutoScrollSettings } from "./autoscroll";
import type { ThinkGate } from "./think-gate";
import { clearThinkMarks } from "./think-gate";
import { setToggleOpen } from "./toggle-dom";
export function clampStartNumber(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}
export function sessionStops<T extends { ordinal: number }>(stops: T[], s: Pick<AutoScrollSettings, "scrollStartNumber" | "scrollMode" | "scrollReverse">): T[] {
  if (s.scrollMode === "route" || s.scrollMode === "shuffle") return stops;
  const start = clampStartNumber(s.scrollStartNumber ?? 1);
  return stops.filter((t) => s.scrollReverse && start > 1 ? t.ordinal <= start : t.ordinal >= start);
}
interface GateHost {
  thinkGate: ThinkGate;
  scrollOpenEl: HTMLElement | null;
  scrollThinkMs: number;
  scrollActiveIdentity: string | null;
  answerWant?: { want: "open" | "closed" | null };
}
export function resetRunGate(host: GateHost): void {
  host.thinkGate.clear();
  if (host.scrollOpenEl) { clearThinkMarks(host.scrollOpenEl); if (host.answerWant?.want !== "open") setToggleOpen(host.scrollOpenEl, false); }
  host.scrollOpenEl = null;
  host.scrollThinkMs = 0;
  host.scrollActiveIdentity = null;
}
interface RouteHost {
  settings: Pick<AutoScrollSettings, "scrollMode" | "scrollLoopRoute" | "scrollRoute">;
  scrollRouteIdx: number;
  scrollDwellUntil: number;
  stopAutoScroll(notify: boolean): void;
}
export function finishRouteDwell(host: RouteHost, now: number): boolean {
  if ((host.settings.scrollMode !== "route" && host.settings.scrollMode !== "shuffle") || host.settings.scrollLoopRoute || host.scrollRouteIdx < host.settings.scrollRoute.length || now < host.scrollDwellUntil) return false;
  host.stopAutoScroll(false);
  return true;
}

/** Skip excluded waypoints without getting stuck gliding toward a missing question. */
export function nextRouteIndex(route: number[], at: number, pages: number[], loop: boolean): number | null {
  for (let offset = 0; offset < route.length; offset++) {
    const i = at + offset;
    if (!loop && i >= route.length) break;
    const index = i % route.length;
    if (pages.includes(route[index])) return index;
  }
  return null;
}
