/**
 * Floating recall timer widget — plain DOM, draggable, no Obsidian imports.
 * The plugin owns the state; this class only renders and emits intents.
 */
import { formatTime, phaseLabel, type PomodoroState } from "./timer";

export interface TimerWidgetCallbacks {
  onToggleRun: () => void;
  onReset: () => void;
  onSkip: () => void;
  onHide: () => void;
  onJumpRed?: () => void;
  onRecallAgain?: () => void;
  onGrade?: (grade: "again" | "hard" | "good" | "easy") => void;
  onMove: (x: number, y: number) => void;
  onCompactChange: (compact: boolean) => void;
}

export interface TimerRenderData {
  state: PomodoroState;
  cycleSize: number;
  /** Optional hint shown during breaks, e.g. "3 red toggles left". */
  hint?: string;
  /** Whether the hint has a jump action. */
  canJumpRed?: boolean;
  /** Whether the "collapse & recall again" action makes sense. */
  canRecallAgain?: boolean;
  /** Show the SM-2 grading row (Again / Hard / Good / Easy). */
  reviewOpen?: boolean;
  /** Suggested grade, highlighted so one tap is enough. */
  suggestedGrade?: "again" | "hard" | "good" | "easy";
  /** Schedule line, e.g. "Next recall: 6 days (Sat)". */
  scheduleLabel?: string;
}

const EDGE = 8;

export class TimerWidget {
  private root: HTMLElement;
  private timeEl!: HTMLElement;
  private phaseEl!: HTMLElement;
  private sessionEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private compactRunBtn!: HTMLButtonElement;
  private hintEl!: HTMLElement;
  private jumpBtn!: HTMLButtonElement;
  private againBtn!: HTMLButtonElement;
  private gradeRow!: HTMLElement;
  private gradeBtns: Record<string, HTMLButtonElement> = {};
  private scheduleEl!: HTMLElement;
  private compact: boolean;
  private cleanups: Array<() => void> = [];

  constructor(
    private cb: TimerWidgetCallbacks,
    opts: { x: number; y: number; compact: boolean }
  ) {
    this.compact = opts.compact;
    this.root = document.createElement("div");
    this.root.className = "notion-toggle-timer";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Recall timer");
    this.build();
    this.applyCompact();
    document.body.appendChild(this.root);
    this.place(opts.x, opts.y, false);

    // Keep the pill on screen after rotation / keyboard resize.
    this.on(window, "resize", () => {
      const rect = this.root.getBoundingClientRect();
      this.place(rect.left, rect.top, false);
    });
    this.on(window, "orientationchange", () => {
      const rect = this.root.getBoundingClientRect();
      this.place(rect.left, rect.top, false);
    });
  }

  private build() {
    const head = div(this.root, "ntt-head");

    const grip = div(head, "ntt-grip");
    grip.textContent = "⋮⋮";
    this.makeDraggable(grip);
    this.makeDraggable(head);

    const info = div(head, "ntt-info");
    this.timeEl = div(info, "ntt-time");
    this.timeEl.textContent = "25:00";
    const meta = div(info, "ntt-meta");
    this.phaseEl = div(meta, "ntt-phase");
    this.phaseEl.textContent = "Focus";
    this.sessionEl = div(meta, "ntt-session");
    this.sessionEl.textContent = "0/4";

    // Compact pill keeps one play/pause button so one tap starts the timer.
    this.compactRunBtn = button(head, "▶", "Start / pause", () => this.cb.onToggleRun());
    this.compactRunBtn.classList.add("ntt-btn-compact");

    const actions = div(this.root, "ntt-actions");
    this.runBtn = button(actions, "▶", "Start / pause", () => this.cb.onToggleRun());
    button(actions, "↺", "Reset phase", () => this.cb.onReset());
    button(actions, "⏭", "Skip phase", () => this.cb.onSkip());
    button(actions, "◑", "Compact / expand", () => this.setCompact(!this.compact));
    button(actions, "✕", "Hide timer", () => this.cb.onHide());

    const hintRow = div(this.root, "ntt-hint-row");
    this.hintEl = div(hintRow, "ntt-hint");
    this.jumpBtn = button(hintRow, "🔴", "Jump to first red toggle", () =>
      this.cb.onJumpRed?.()
    );
    this.againBtn = button(hintRow, "↻", "Collapse & recall again", () =>
      this.cb.onRecallAgain?.()
    );
    this.jumpBtn.style.display = "none";
    this.againBtn.style.display = "none";
    hintRow.style.display = "none";

    // SM-2 grading row — appears automatically when a focus phase ends.
    this.gradeRow = div(this.root, "ntt-grade-row");
    const grades = [
      ["again", "Again"],
      ["hard", "Hard"],
      ["good", "Good"],
      ["easy", "Easy"],
    ] as const;
    for (const [id, label] of grades) {
      this.gradeBtns[id] = button(this.gradeRow, label, `Grade: ${label}`, () =>
        this.cb.onGrade?.(id)
      );
      this.gradeBtns[id].classList.add("ntt-grade", `is-${id}`);
    }
    this.gradeRow.style.display = "none";

    this.scheduleEl = div(this.root, "ntt-schedule");
    this.scheduleEl.style.display = "none";

    // One tap on the clock switches compact / expanded (mobile-friendly).
    this.on(this.timeEl, "click", () => this.setCompact(!this.compact));
  }

  private setCompact(compact: boolean) {
    this.compact = compact;
    this.applyCompact();
    const rect = this.root.getBoundingClientRect();
    this.place(rect.left, rect.top, false);
    this.cb.onCompactChange(this.compact);
  }

  private applyCompact() {
    this.root.classList.toggle("is-compact", this.compact);
  }

  /** Position the widget inside the viewport, optionally snapping to an edge. */
  private place(x: number, y: number, snap: boolean) {
    const rect = this.root.getBoundingClientRect();
    const w = rect.width || 168;
    const h = rect.height || 60;
    let left = clamp(x, EDGE, Math.max(EDGE, window.innerWidth - w - EDGE));
    const top = clamp(y, EDGE, Math.max(EDGE, window.innerHeight - h - EDGE));
    if (snap) {
      const center = left + w / 2;
      left =
        center < window.innerWidth / 2 ? EDGE : Math.max(EDGE, window.innerWidth - w - EDGE);
    }
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
    return { left: Math.round(left), top: Math.round(top) };
  }

  private makeDraggable(handle: HTMLElement) {
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.root.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      this.root.classList.add("is-dragging");
      handle.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      e.preventDefault();
      this.place(originX + (e.clientX - startX), originY + (e.clientY - startY), false);
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      this.root.classList.remove("is-dragging");
      const rect = this.root.getBoundingClientRect();
      const pos = this.place(rect.left, rect.top, true);
      this.cb.onMove(pos.left, pos.top);
    };

    this.on(handle, "pointerdown", down as EventListener);
    this.on(window, "pointermove", move as EventListener);
    this.on(window, "pointerup", up);
    this.on(window, "pointercancel", up);
  }

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  render(data: TimerRenderData) {
    const { state } = data;
    const label = state.running ? "⏸" : "▶";
    this.timeEl.textContent = formatTime(state.remaining);
    this.phaseEl.textContent = phaseLabel(state.phase);
    this.sessionEl.textContent = `${state.completedInCycle}/${data.cycleSize}`;
    this.runBtn.textContent = label;
    this.compactRunBtn.textContent = label;
    this.root.dataset.phase = state.phase;
    this.root.classList.toggle("is-running", state.running);
    this.root.classList.toggle("is-auto-paused", !!state.autoPaused);

    const hintRow = this.hintEl.parentElement as HTMLElement;
    if (data.hint) {
      this.hintEl.textContent = data.hint;
      hintRow.style.display = "";
      this.jumpBtn.style.display = data.canJumpRed ? "" : "none";
      this.againBtn.style.display = data.canRecallAgain ? "" : "none";
    } else {
      hintRow.style.display = "none";
    }

    this.gradeRow.style.display = data.reviewOpen ? "" : "none";
    for (const [id, btn] of Object.entries(this.gradeBtns)) {
      btn.classList.toggle("is-suggested", data.reviewOpen && data.suggestedGrade === id);
    }
    if (data.scheduleLabel) {
      this.scheduleEl.textContent = data.scheduleLabel;
      this.scheduleEl.style.display = "";
    } else {
      this.scheduleEl.style.display = "none";
    }
  }

  flashPhaseEnd() {
    this.root.classList.remove("ntt-flash");
    // Force reflow so the animation restarts.
    void this.root.offsetWidth;
    this.root.classList.add("ntt-flash");
  }

  destroy() {
    for (const fn of this.cleanups) fn();
    this.cleanups = [];
    this.root.remove();
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function div(parent: HTMLElement, cls: string): HTMLElement {
  const el = document.createElement("div");
  el.className = cls;
  parent.appendChild(el);
  return el;
}

function button(
  parent: HTMLElement,
  label: string,
  title: string,
  onClick: () => void
): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = "ntt-btn";
  el.type = "button";
  el.textContent = label;
  el.setAttribute("aria-label", title);
  el.title = title;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  parent.appendChild(el);
  return el;
}
