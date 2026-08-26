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
}

export class TimerWidget {
  private root: HTMLElement;
  private timeEl!: HTMLElement;
  private phaseEl!: HTMLElement;
  private sessionEl!: HTMLElement;
  private runBtn!: HTMLButtonElement;
  private hintEl!: HTMLElement;
  private jumpBtn!: HTMLButtonElement;
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
    this.root.style.left = `${clamp(opts.x, window.innerWidth - 80)}px`;
    this.root.style.top = `${clamp(opts.y, window.innerHeight - 60)}px`;
    this.build();
    this.applyCompact();
    document.body.appendChild(this.root);
  }

  private build() {
    const head = div(this.root, "ntt-head");

    const grip = div(head, "ntt-grip");
    grip.setText?.("⋮⋮");
    if (!grip.textContent) grip.textContent = "⋮⋮";
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

    const actions = div(this.root, "ntt-actions");
    this.runBtn = button(actions, "▶", "Start / pause", () => this.cb.onToggleRun());
    button(actions, "↺", "Reset phase", () => this.cb.onReset());
    button(actions, "⏭", "Skip phase", () => this.cb.onSkip());
    button(actions, "◑", "Compact / expand", () => {
      this.compact = !this.compact;
      this.applyCompact();
      this.cb.onCompactChange(this.compact);
    });
    button(actions, "✕", "Hide timer", () => this.cb.onHide());

    const hintRow = div(this.root, "ntt-hint-row");
    this.hintEl = div(hintRow, "ntt-hint");
    this.jumpBtn = button(hintRow, "🔴 Jump", "Jump to first red toggle", () =>
      this.cb.onJumpRed?.()
    );
    this.jumpBtn.style.display = "none";
    hintRow.style.display = "none";

    // Tapping the clock toggles compact mode (mobile-friendly).
    this.on(this.timeEl, "dblclick", () => {
      this.compact = !this.compact;
      this.applyCompact();
      this.cb.onCompactChange(this.compact);
    });
  }

  private applyCompact() {
    this.root.classList.toggle("is-compact", this.compact);
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
      const x = clamp(originX + (e.clientX - startX), window.innerWidth - 60);
      const y = clamp(originY + (e.clientY - startY), window.innerHeight - 40);
      this.root.style.left = `${x}px`;
      this.root.style.top = `${y}px`;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      this.root.classList.remove("is-dragging");
      const rect = this.root.getBoundingClientRect();
      this.cb.onMove(Math.round(rect.left), Math.round(rect.top));
    };

    this.on(handle, "pointerdown", down as EventListener);
    this.on(window, "pointermove", move as EventListener);
    this.on(window, "pointerup", up);
    this.on(window, "pointercancel", up);
  }

  private on(target: EventTarget, type: string, fn: EventListener) {
    target.addEventListener(type, fn);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }

  render(data: TimerRenderData) {
    const { state } = data;
    this.timeEl.textContent = formatTime(state.remaining);
    this.phaseEl.textContent = phaseLabel(state.phase);
    this.sessionEl.textContent = `${state.completedInCycle}/${data.cycleSize}`;
    this.runBtn.textContent = state.running ? "⏸" : "▶";
    this.root.dataset.phase = state.phase;
    this.root.classList.toggle("is-running", state.running);

    const hintRow = this.hintEl.parentElement as HTMLElement;
    if (data.hint) {
      this.hintEl.textContent = data.hint;
      hintRow.style.display = "";
      this.jumpBtn.style.display = data.canJumpRed ? "" : "none";
    } else {
      hintRow.style.display = "none";
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

function clamp(value: number, max: number): number {
  if (!Number.isFinite(value)) return 24;
  return Math.max(4, Math.min(Math.max(4, max), value));
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
