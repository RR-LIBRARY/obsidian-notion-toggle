/**
 * v1.1.5 — floating launch button (plain DOM, no Obsidian imports).
 * v1.1.6 — added a small reverse chip so direction is also one tap.
 * v1.2.0 — minimal UI: the chip is gone, there is exactly ONE floating button.
 * v1.2.1 — halo + rounded-square SVG icon, and the plugin's own programmatic
 *          scrolling no longer counts as "user activity" for the idle timer.
 *
 * Tap        = start / pause autoscroll.
 * Long-press (≥500 ms, touch or mouse) = autoscroll sheet (direction, quiz,
 * speed, dwell — every other control lives there).
 */
export interface ScrollFabCallbacks {
  onTap: () => void;
  onLongPress: () => void;
  /** v1.1.8 — idle delay before the button fades away (ms). */
  hideAfterMs?: number;
}

export const FAB_LONG_PRESS_MS = 500;
export const FAB_MOVE_TOLERANCE_PX = 12;
/** v1.1.8 — minimal UI: the button hides itself 3s after the last activity. */
export const FAB_AUTO_HIDE_MS = 3000;
/** v1.2.1 — how long after a programmatic scroll we ignore `scroll` events. */
export const FAB_PROGRAMMATIC_WINDOW_MS = 150;

let programmaticUntil = 0;

/** Call right before the autoscroll loop writes `scrollTop`. */
export function markProgrammaticScroll(now = Date.now()) {
  programmaticUntil = now + FAB_PROGRAMMATIC_WINDOW_MS;
}

/** Is this `scroll` event just our own loop moving the page? */
export function isProgrammaticScroll(now = Date.now()): boolean {
  return now < programmaticUntil;
}

/* v1.2.2 — screenshot style: plain white circle, dark double-chevron down.
   v1.3.1 — built with real SVG DOM nodes (no innerHTML anywhere). */
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Double chevron pointing down = "scroll on". */
export function buildPlayIcon(): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "26",
    height: "26",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2.6",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("path", { d: "M5 7l7 6 7-6" }));
  svg.appendChild(svgEl("path", { d: "M5 13l7 6 7-6" }));
  return svg;
}

/** Two rounded bars = "running, tap to pause". */
export function buildPauseIcon(): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "26",
    height: "26",
    "aria-hidden": "true",
  });
  for (const x of ["6.5", "13.5"]) {
    svg.appendChild(
      svgEl("rect", { x, y: "5", width: "4", height: "14", rx: "1.4", fill: "currentColor" })
    );
  }
  return svg;
}


export class ScrollFab {
  private wrap: HTMLDivElement;
  private root: HTMLButtonElement;
  private icon: HTMLSpanElement;
  private sr!: HTMLSpanElement;
  private pressTimer: number | null = null;
  private startX = 0;
  private startY = 0;
  private longFired = false;
  /* v1.1.8 auto-hide state (ported from the reader's useReaderChrome). */
  private hideTimer: number | null = null;
  private pinned = false;
  private wake = () => this.show();
  private wakeScroll = () => {
    if (isProgrammaticScroll()) return;
    this.show();
  };

  constructor(private cb: ScrollFabCallbacks) {
    this.wrap = document.createElement("div");
    this.wrap.className = "ntt-fab-wrap";

    this.root = document.createElement("button");
    this.root.className = "ntt-fab";
    this.icon = document.createElement("span");
    this.icon.className = "ntt-fab-icon";
    this.icon.appendChild(buildPlayIcon());
    this.root.appendChild(this.icon);
    this.root.type = "button";
    this.root.setAttribute("aria-label", "Autoscroll — tap to start, hold for settings");
    this.root.setAttribute("aria-pressed", "false");
    this.root.setAttribute("aria-keyshortcuts", "Control+Shift+S");
    this.root.title = "Autoscroll — tap to start, hold for settings";
    // v1.2.4 — screen-reader text + live region for state changes.
    this.sr = document.createElement("span");
    this.sr.className = "ntt-fab-sr";
    this.sr.setAttribute("aria-live", "polite");
    this.sr.textContent = "Autoscroll stopped";
    this.root.appendChild(this.sr);
    // Keyboard parity: Enter/Space = tap, Shift+Enter or context key = sheet.
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (e.shiftKey) this.cb.onLongPress();
        else this.cb.onTap();
        this.show();
      }
    });
    this.root.addEventListener("focus", () => this.show());

    this.root.addEventListener("pointerdown", (e) => {
      this.longFired = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.cancelTimer();
      this.pressTimer = window.setTimeout(() => {
        this.pressTimer = null;
        this.longFired = true;
        this.root.classList.add("is-pressed");
        this.cb.onLongPress();
      }, FAB_LONG_PRESS_MS);
    });

    this.root.addEventListener("pointermove", (e) => {
      if (this.pressTimer === null) return;
      const dx = Math.abs(e.clientX - this.startX);
      const dy = Math.abs(e.clientY - this.startY);
      if (dx > FAB_MOVE_TOLERANCE_PX || dy > FAB_MOVE_TOLERANCE_PX) {
        this.cancelTimer(); // user is scrolling, not long-pressing
      }
    });

    const finish = (e: PointerEvent) => {
      this.root.classList.remove("is-pressed");
      if (this.pressTimer !== null) {
        this.cancelTimer();
        if (!this.longFired) {
          e.preventDefault();
          this.cb.onTap();
        }
      }
    };
    this.root.addEventListener("pointerup", finish);
    this.root.addEventListener("pointercancel", () => {
      this.cancelTimer();
      this.root.classList.remove("is-pressed");
    });
    // Swallow the synthetic click so a long-press doesn't also tap.
    this.root.addEventListener("click", (e) => e.preventDefault());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());

    this.wrap.appendChild(this.root);
    document.body.appendChild(this.wrap);

    // Any tap / scroll anywhere brings the button back for another 3 seconds.
    document.addEventListener("pointerdown", this.wake, true);
    document.addEventListener("scroll", this.wakeScroll, true);
    this.arm();
  }

  private cancelTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  setRunning(running: boolean) {
    this.icon.textContent = "";
    this.icon.appendChild(running ? buildPauseIcon() : buildPlayIcon());
    this.root.setAttribute("aria-pressed", running ? "true" : "false");
    if (this.sr) this.sr.textContent = running ? "Autoscroll running" : "Autoscroll stopped";
    this.root.classList.toggle("is-running", running);
    this.wrap.classList.toggle("is-running", running);
    this.root.setAttribute(
      "aria-label",
      running ? "Autoscroll running — tap to pause" : "Autoscroll — tap to start, hold for settings"
    );
    this.root.title = this.root.getAttribute("aria-label") ?? "";
  }

  /* ---------- v1.1.8: auto-hide ---------- */

  private clearHide() {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private arm() {
    this.clearHide();
    if (this.pinned) return;
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.wrap.classList.add("is-hidden");
    }, this.cb.hideAfterMs ?? FAB_AUTO_HIDE_MS);
  }

  /** Show the button and restart the idle timer. */
  show() {
    this.wrap.classList.remove("is-hidden");
    this.arm();
  }

  /** Keep the button on screen regardless of the idle timer (e.g. when paused). */
  setPinned(pinned: boolean) {
    this.pinned = pinned;
    if (pinned) {
      this.clearHide();
      this.wrap.classList.remove("is-hidden");
    } else {
      this.arm();
    }
  }

  isHidden(): boolean {
    return this.wrap.classList.contains("is-hidden");
  }

  destroy() {
    this.cancelTimer();
    this.clearHide();
    document.removeEventListener("pointerdown", this.wake, true);
    document.removeEventListener("scroll", this.wakeScroll, true);
    this.wrap.remove();
  }
}
