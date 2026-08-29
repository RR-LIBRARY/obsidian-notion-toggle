/**
 * v1.1.8 — "hold anywhere to pause" controller (plain DOM, no Obsidian imports).
 *
 * While autoscroll runs, pressing and holding anywhere on the note freezes the
 * scroll. Releasing resumes at exactly the same speed / direction / plan state.
 *
 * Ported in spirit from the reader's pause/resume split in `useAutoScroll`.
 */
export const HOLD_PAUSE_MS = 250;
export const HOLD_MOVE_TOLERANCE_PX = 12;

/** Elements whose presses must never trigger the hold-pause. */
export const HOLD_IGNORE_SELECTOR =
  ".ntt-fab-wrap, .ntt-scroll-bar, .modal, .modal-container, .menu, .notice, button, a, input, textarea, select";

export function isIgnoredHoldTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return !!el.closest(HOLD_IGNORE_SELECTOR);
}

export function movedTooFar(dx: number, dy: number, tolerance = HOLD_MOVE_TOLERANCE_PX): boolean {
  return Math.abs(dx) > tolerance || Math.abs(dy) > tolerance;
}

export interface HoldPauseCallbacks {
  /** Is a session live right now? Holds are ignored when it is not. */
  isActive: () => boolean;
  /** Fired once when the press has been held long enough. */
  onHold: () => void;
  /** Fired when the finger lifts / the gesture is cancelled after a hold. */
  onRelease: () => void;
  /** Test seam. */
  holdMs?: number;
}

export class HoldPause {
  private timer: number | null = null;
  private held = false;
  private startX = 0;
  private startY = 0;
  private attached = false;

  constructor(private cb: HoldPauseCallbacks) {}

  attach(doc: Document = document) {
    if (this.attached) return;
    this.attached = true;
    doc.addEventListener("pointerdown", this.down, true);
    doc.addEventListener("pointermove", this.move, true);
    doc.addEventListener("pointerup", this.up, true);
    doc.addEventListener("pointercancel", this.up, true);
    window.addEventListener("blur", this.up);
    this.doc = doc;
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    const doc = this.doc ?? document;
    doc.removeEventListener("pointerdown", this.down, true);
    doc.removeEventListener("pointermove", this.move, true);
    doc.removeEventListener("pointerup", this.up, true);
    doc.removeEventListener("pointercancel", this.up, true);
    window.removeEventListener("blur", this.up);
    this.cancel();
    if (this.held) {
      this.held = false;
      this.cb.onRelease();
    }
  }

  private doc: Document | null = null;

  private down = (e: PointerEvent) => {
    if (!this.cb.isActive()) return;
    if (isIgnoredHoldTarget(e.target)) return;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.cancel();
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.held = true;
      this.cb.onHold();
    }, this.cb.holdMs ?? HOLD_PAUSE_MS);
  };

  private move = (e: PointerEvent) => {
    if (this.timer === null) return;
    if (movedTooFar(e.clientX - this.startX, e.clientY - this.startY)) this.cancel();
  };

  private up = () => {
    this.cancel();
    if (!this.held) return;
    this.held = false;
    this.cb.onRelease();
  };

  private cancel() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Testing helper. */
  isHolding(): boolean {
    return this.held;
  }
}
