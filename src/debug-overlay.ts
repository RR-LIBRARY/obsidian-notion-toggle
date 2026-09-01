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

  /* --- v1.4.9 stop / anchor / skip telemetry (all optional) --- */
  /** Human anchor name, e.g. "middle". */
  anchor?: string;
  /** Anchored scroll offset the loop parks the current stop at. */
  anchorTop?: number | null;
  /** How far that offset sits from the toggle's own top (px). */
  anchorDelta?: number | null;
  /** "portrait" | "landscape", from the scroll container's own box. */
  orientation?: string;
  /** Container box as `WxH`. */
  viewport?: string;
  /** Layout signature the anchored-target cache is keyed on. */
  layoutSig?: string;
  /** Dwell key of the current stop (mirrors `dwellKey` when parked). */
  stopKey?: string | null;
  /** Stops already visited on this leg. */
  visitedCount?: number;
  /** Stops still owed a visit on this leg. */
  pendingStops?: number;
  /** Stops recovered after a layout shift left them behind. */
  skipCount?: number;
  /** Keys of the most recently recovered stops. */
  lastSkips?: string[];
  /** Reverse wrap fallback index (where an up-leg restarts). */
  reverseWrap?: number | null;

  /* --- v1.6.1 think-time timing log (optional) --- */
  /** Current think phase, e.g. "think 3s" or "answer". */
  thinkPhase?: string;
  /** Pre-formatted timing lines from `ThinkTimeline`. */
  timing?: string[];
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
  // v1.4.9 — which stop, where it is anchored, and whether any were skipped.
  if (f.visitedCount !== undefined || f.stopKey !== undefined) {
    const total = f.stops || 0;
    const nth = f.at >= 0 ? f.at + 1 : 0;
    lines.push(
      `stop ${nth}/${total} · key ${f.stopKey ?? f.dwellKey ?? "—"} · visited ${
        f.visitedCount ?? 0
      }${f.pendingStops !== undefined ? ` · pending ${f.pendingStops}` : ""}`
    );
  }
  if (f.anchor !== undefined) {
    lines.push(
      `anchor ${f.anchor} → top ${f.anchorTop == null ? "—" : px(f.anchorTop)}${
        f.anchorDelta == null ? "" : ` (offset ${px(f.anchorDelta)} from toggle top)`
      }`
    );
  }
  if (f.orientation !== undefined) {
    lines.push(
      `orientation ${f.orientation}${f.viewport ? ` · ${f.viewport}` : ""} · same-math ✔${
        f.layoutSig ? ` · layout ${f.layoutSig}` : ""
      }`
    );
  }
  if (f.skipCount !== undefined) {
    const last = (f.lastSkips ?? []).join(", ");
    lines.push(`skips ${f.skipCount} recovered${last ? ` · last ${last}` : ""}`);
    if (f.dwellLeft === 0 && (f.pendingStops ?? 0) > 0 && f.skipCount > 0) {
      lines.push(`⚠ ${f.pendingStops} stop(s) still unvisited on this leg`);
    }
  }
  if (f.dir < 0) {
    lines.push(
      `reverse ↑ · dwell guard scoped to up-leg${
        f.reverseWrap == null ? "" : ` · wraps to stop ${f.reverseWrap}`
      }`
    );
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
  if (f.thinkPhase) lines.push(`think ${f.thinkPhase}`);
  if (f.timing && f.timing.length) {
    lines.push("— timings —");
    for (const t of f.timing) lines.push(t);
  }
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

/**
 * v1.4.7 — the colour-filter read-out (moved out of main.ts): what was found,
 * what survived the filter, and which raw type the target graded from.
 */
export function filterFrame(input: {
  filterLabel: string;
  found: number;
  kept: number;
  colors: Record<string, number>;
  targetColor: string | null;
  targetType: string | null;
}): Partial<DebugFrame> {
  return {
    filter: input.filterLabel,
    stopsFound: input.found,
    stopsKept: input.kept,
    colors: input.colors,
    targetColor: input.targetColor,
    targetType: input.targetType,
  } as Partial<DebugFrame>;
}


/**
 * v1.4.9 — anchor read-out: the offset the loop parks the current stop at, and
 * how far that is from the toggle's own top. Callers pass the number the loop
 * itself computed (via `anchorScrollTop`), so the overlay can never drift from
 * the real maths.
 */
export function anchorFrame(input: {
  anchor: string;
  anchorTop: number | null;
  stopTop: number | null;
}): Partial<DebugFrame> {
  return {
    anchor: input.anchor,
    anchorTop: input.anchorTop,
    anchorDelta:
      input.anchorTop == null || input.stopTop == null ? null : input.stopTop - input.anchorTop,
  };
}

/** v1.4.9 — portrait vs landscape, read from the scroll container's own box. */
export function orientationFrame(input: {
  width: number;
  height: number;
  layoutSig?: string;
}): Partial<DebugFrame> {
  return {
    orientation: input.height >= input.width ? "portrait" : "landscape",
    viewport: `${Math.round(input.width)}x${Math.round(input.height)}`,
    layoutSig: input.layoutSig,
  };
}

/** v1.4.9 — stop bookkeeping: visited, pending, and recovered skips. */
export function skipFrame(input: {
  stopKey: string | null;
  visited: number;
  pending: number;
  skipped: number;
  lastSkips: string[];
  reverseWrap?: number | null;
}): Partial<DebugFrame> {
  return {
    stopKey: input.stopKey,
    visitedCount: input.visited,
    pendingStops: input.pending,
    skipCount: input.skipped,
    lastSkips: input.lastSkips.slice(-3),
    reverseWrap: input.reverseWrap ?? null,
  };
}

/**
 * v1.4.9 — the whole stop / anchor / orientation / skip block in one pure
 * call, so main.ts stays an orchestrator.
 */
export function stopFrame(input: {
  anchor: string;
  anchorTop: number | null;
  stopTop: number | null;
  width: number;
  height: number;
  layoutSig?: string;
  stopKey: string | null;
  visited: number;
  pending: number;
  skipped: number;
  lastSkips: string[];
  reverseWrap?: number | null;
}): Partial<DebugFrame> {
  return {
    ...anchorFrame(input),
    ...orientationFrame(input),
    ...skipFrame(input),
  };
}

/**
 * v1.4.10 — the per-frame numbers that come straight from the loop's own
 * state. Pure so the overlay's contents are testable, and so `main.ts` only
 * has to hand over values instead of composing the frame inline.
 */
export function loopFrame(input: {
  pos: number;
  container: { scrollTop: number; scrollHeight: number; clientHeight: number };
  speed: number;
  dir: 1 | -1;
  mode: string;
  routeIdx: number;
  routeLen: number;
  routeStop: number;
  stops: number;
  at: number;
  dwellKey: string | null;
  dwellUntil: number;
  ts: number;
  lastEvent: string;
  lastGrade: string;
  progress: string;
}): Partial<DebugFrame> {
  const { container } = input;
  return {
    pos: input.pos,
    scrollTop: container.scrollTop,
    max: Math.max(0, container.scrollHeight - container.clientHeight),
    speed: input.speed,
    dir: input.dir,
    mode: input.mode,
    routeMode: false,
    target: null,
    routeIdx: input.routeIdx,
    routeLen: input.routeLen,
    routeStop: input.routeStop,
    routeStops: 1,
    stops: input.stops,
    at: input.at,
    dwellKey: input.dwellKey,
    dwellLeft: input.dwellUntil ? Math.max(0, input.dwellUntil - input.ts) : 0,
    lastEvent: input.lastEvent,
    lastGrade: input.lastGrade,
    progress: `progress ${input.progress}`,
  };
}
