/**
 * v1.1.3 — autoscroll debug overlay.
 *
 * A tiny always-on-top read-out of what the reader loop is doing this frame:
 * position, direction, which waypoint it is heading to, whether
 * `waypointReached` / `crossedTarget` fired, the dwell key that is currently
 * guarding repeat pauses, and the route/shuffle progress.
 *
 * Why it exists: the loop's bugs are all invisible ones — a stop that fires
 * twice, a waypoint above the cursor that is never reached, a 0.02x speed that
 * looks frozen. Printing the state each frame turns those into something you
 * can read on the phone screen while it runs.
 *
 * `debugLines` is pure so it can be unit tested; the class is DOM-only.
 */

export interface DebugFrame {
  /** Float scroll position (the loop's own, not `scrollTop`). */
  pos: number;
  /** Whole-pixel value actually written to the container. */
  scrollTop: number;
  max: number;
  /** px per second. */
  speed: number;
  dir: 1 | -1;
  mode: string;
  routeMode: boolean;
  /** Waypoint the current leg is heading to, when in route/shuffle. */
  target: number | null;
  routeIdx: number;
  routeLen: number;
  /** Which screenful of a tall toggle the leg is on. */
  routeStop: number;
  routeStops: number;
  stops: number;
  /** Sequential mode: index of the last stop parked on. */
  at: number;
  dwellKey: string | null;
  /** ms left in the current pause, 0 when running. */
  dwellLeft: number;
  /** Last loop event, e.g. "waypointReached 7" or "crossedTarget 3:1". */
  lastEvent: string;
  /** Last dwell → FSRS grade decision, e.g. "toggle 3 · 6.2s → Good (3)". */
  lastGrade: string;
  progress: string;
  /* --- v1.2.5 colour-filter telemetry (optional: overlay works without it) --- */
  /** Human label of the active filter, e.g. "🔴 🟡" or "all toggles". */
  filter?: string;
  /** Toggles found in the note before the colour filter. */
  stopsFound?: number;
  /** Toggles left after the colour filter. */
  stopsKept?: number;
  /** Colour breakdown of everything found. */
  colors?: { red: number; yellow: number; green: number; other: number };
  /** Colour of the stop the loop is heading to. */
  targetColor?: string | null;
  /** Raw `data-callout` / class string the colour was read from. */
  targetType?: string | null;
}


const px = (n: number) => `${Math.round(n)}`;

/** One line per fact — the overlay renders these in order. */
export function debugLines(f: DebugFrame): string[] {
  const lines = [
    `pos ${f.pos.toFixed(2)} → top ${px(f.scrollTop)} / ${px(f.max)}`,
    `dir ${f.dir > 0 ? "down ↓" : "up ↑"} · ${f.speed.toFixed(2)} px/s · frac ${(
      f.pos - Math.floor(f.pos)
    ).toFixed(2)}`,
    `mode ${f.mode}${f.routeMode ? " (route legs)" : ""} · stops ${f.stops}`,
  ];
  if (f.routeMode) {
    lines.push(
      `leg ${Math.min(f.routeIdx + 1, f.routeLen)}/${f.routeLen} → target ${
        f.target == null ? "—" : px(f.target)
      }${f.routeStops > 1 ? ` · screen ${f.routeStop + 1}/${f.routeStops}` : ""}`
    );
  } else {
    lines.push(`stop index ${f.at < 0 ? "—" : f.at}`);
  }
  lines.push(`dwellKey ${f.dwellKey ?? "—"} · ${f.dwellLeft > 0 ? `paused ${(f.dwellLeft / 1000).toFixed(1)}s` : "running"}`);
  if (f.filter !== undefined) {
    const c = f.colors ?? { red: 0, yellow: 0, green: 0, other: 0 };
    const found = f.stopsFound ?? 0;
    const kept = f.stopsKept ?? 0;
    lines.push(
      `filter ${f.filter} · kept ${kept}/${found} (🔴${c.red} 🟡${c.yellow} 🟢${c.green} ⚪${c.other})`
    );
    if (f.filter !== "all toggles" && kept === 0) {
      lines.push(`⚠ filter matches 0 of ${found} toggles`);
    }
    lines.push(`target ${f.targetColor ?? "—"} ← "${f.targetType ?? "—"}"`);
  }
  lines.push(`event ${f.lastEvent || "—"}`);
  lines.push(`grade ${f.lastGrade || "—"}`);
  if (f.progress) lines.push(f.progress);
  return lines;
}


export class ScrollDebugOverlay {
  private root: HTMLElement | null = null;
  private body: HTMLElement | null = null;

  mount(parent: HTMLElement) {
    if (this.root) return;
    const root = parent.createDiv({ cls: "notion-toggle-scroll-debug" });
    root.createDiv({ cls: "notion-toggle-scroll-debug-title", text: "autoscroll debug" });
    this.body = root.createDiv({ cls: "notion-toggle-scroll-debug-body" });
    this.root = root;
  }

  update(frame: DebugFrame) {
    if (!this.body) return;
    this.body.empty();
    for (const line of debugLines(frame)) {
      this.body.createDiv({ text: line });
    }
  }

  destroy() {
    this.root?.remove();
    this.root = null;
    this.body = null;
  }
}
