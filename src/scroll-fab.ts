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

const PLAY_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.53.85l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>';
const PAUSE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.4" fill="currentColor"/></svg>';

export class ScrollFab {
  private wrap: HTMLDivElement;
  private root: HTMLButtonElement;
  private icon: HTMLSpanElement;
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
    this.icon.innerHTML = PLAY_ICON;
    this.root.appendChild(this.icon);
    this.root.setAttribute("aria-label", "Autoscroll — tap to start, hold for settings");

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
    this.icon.innerHTML = running ? PAUSE_ICON : PLAY_ICON;
    this.root.classList.toggle("is-running", running);
    this.wrap.classList.toggle("is-running", running);
    this.root.setAttribute(
      "aria-label",
      running ? "Autoscroll running — tap to pause" : "Autoscroll — tap to start, hold for settings"
    );
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
