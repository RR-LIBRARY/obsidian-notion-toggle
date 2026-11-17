/** Shared run lifecycle: source ordinals, gate cleanup, final route dwell. */
import type { AutoScrollSettings } from "./autoscroll";
import type { ThinkGate } from "./think-gate";
import { clearThinkMarks } from "./think-gate";
import { setToggleOpen } from "./toggle-dom";
import { matchesQuestionParity } from "./question-selection";
export function clampStartNumber(n: number): number {
  return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
}
export function sessionStops<T extends { ordinal: number; question?: number }>(stops: T[], s: Pick<AutoScrollSettings, "scrollStartNumber" | "scrollMode" | "scrollReverse"> & { scrollStartSequence?: number[] }): T[] {
  if (s.scrollStartSequence?.length) return stops.filter(t => s.scrollStartSequence?.includes(t.question ?? t.ordinal) && matchesQuestionParity(t.question ?? t.ordinal, s.scrollMode));
  if (s.scrollMode === "route" || s.scrollMode === "shuffle") return stops;
  const start = clampStartNumber(s.scrollStartNumber ?? 1);
  // Typed number = question number (nested Answer toggles are not counted).
  const num = (t: T) => t.question ?? t.ordinal;
  return stops.filter((t) => matchesQuestionParity(num(t), s.scrollMode) && (s.scrollReverse && start > 1 ? num(t) <= start : num(t) >= start));
}
/** "Advance by: screens": skip whole screens before the start question (after it, in reverse). */
export function screensFromStart(tops: number[], keptTops: number[], s: Pick<AutoScrollSettings, "scrollStartNumber" | "scrollMode" | "scrollReverse">, screenPx: number): number[] {
  if (s.scrollMode === "route" || s.scrollMode === "shuffle" || clampStartNumber(s.scrollStartNumber ?? 1) <= 1 || !keptTops.length) return tops;
  if (s.scrollReverse) { const last = Math.max(...keptTops); return tops.filter((t) => t <= last); }
  const first = Math.min(...keptTops);
  // Land on the first question itself; drop every screen that ends before it.
  return [...new Set([first, ...tops.filter((t) => t > first)])].sort((a, b) => a - b).filter((t) => t + screenPx > first || t === first);
}
/**
 * Obsidian only draws the part of a long note near the screen. When the typed start
 * question is further down, scroll past the last drawn question so it gets drawn, then
 * plan again. Returns true while it should keep seeking.
 */
export function seekStartQuestion(container: HTMLElement, seen: { top: number; question?: number; ordinal?: number }[], s: Pick<AutoScrollSettings, "scrollStartNumber" | "scrollMode" | "scrollReverse">, tries: number): boolean {
  const start = clampStartNumber(s.scrollStartNumber ?? 1);
  if (start <= 1 || s.scrollReverse || s.scrollMode === "route" || s.scrollMode === "shuffle" || !seen.length || tries >= 40) return false;
  const last = seen.reduce((a, b) => ((b.question ?? b.ordinal ?? 0) > (a.question ?? a.ordinal ?? 0) ? b : a));
  if ((last.question ?? last.ordinal ?? 0) >= start) return false;
  const max = container.scrollHeight - container.clientHeight;
  if (container.scrollTop >= max - 1) return false;
  container.scrollTop = Math.min(max, Math.max(container.scrollTop + container.clientHeight, last.top));
  return true;
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
  modeConfig?(): { mode: string; route: number[]; loopRoute?: boolean };
}
export function finishRouteDwell(host: RouteHost, now: number): boolean {
  const cfg = host.modeConfig?.() ?? { mode: host.settings.scrollMode, route: host.settings.scrollRoute, loopRoute: host.settings.scrollLoopRoute };
  if ((cfg.mode !== "route" && cfg.mode !== "shuffle") || cfg.loopRoute || host.scrollRouteIdx < cfg.route.length || now < host.scrollDwellUntil) return false;
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
