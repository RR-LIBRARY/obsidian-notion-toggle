/**
 * v1.1.5 — floating launch button (plain DOM, no Obsidian imports).
 * v1.1.6 — added a small reverse chip so direction is also one tap.
 *
 * Tap (main)   = start / pause autoscroll.
 * Tap (chip)   = flip direction (forward ↓ / reverse ↑).
 * Long-press (≥500 ms, touch or mouse) on the main button = autoscroll sheet.
 */
export interface ScrollFabCallbacks {
  onTap: () => void;
  onLongPress: () => void;
  onReverse?: () => void;
}

export const FAB_LONG_PRESS_MS = 500;
export const FAB_MOVE_TOLERANCE_PX = 12;

export class ScrollFab {
  private wrap: HTMLDivElement;
  private root: HTMLButtonElement;
  private rev: HTMLButtonElement;
  private pressTimer: number | null = null;
  private startX = 0;
  private startY = 0;
  private longFired = false;

  constructor(private cb: ScrollFabCallbacks) {
    this.wrap = document.createElement("div");
    this.wrap.className = "ntt-fab-wrap";

    this.rev = document.createElement("button");
    this.rev.className = "ntt-fab-rev";
    this.rev.textContent = "↓";
    this.rev.setAttribute("aria-label", "Autoscroll direction — forward");
    this.rev.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.cb.onReverse?.();
    });

    this.root = document.createElement("button");
    this.root.className = "ntt-fab";
    this.root.textContent = "▶";
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

    this.wrap.appendChild(this.rev);
    this.wrap.appendChild(this.root);
    document.body.appendChild(this.wrap);
  }

  private cancelTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }

  setRunning(running: boolean) {
    this.root.textContent = running ? "⏸" : "▶";
    this.root.classList.toggle("is-running", running);
    this.wrap.classList.toggle("is-running", running);
    this.root.setAttribute(
      "aria-label",
      running ? "Autoscroll running — tap to pause" : "Autoscroll — tap to start, hold for settings"
    );
  }

  /** v1.1.6 — reflect the current scroll direction on the chip. */
  setReverse(reverse: boolean) {
    this.rev.textContent = reverse ? "↑" : "↓";
    this.rev.classList.toggle("is-reverse", reverse);
    this.rev.setAttribute(
      "aria-label",
      reverse ? "Autoscroll direction — reverse (tap for forward)" : "Autoscroll direction — forward (tap for reverse)"
    );
  }

  destroy() {
    this.cancelTimer();
    this.wrap.remove();
  }
}
