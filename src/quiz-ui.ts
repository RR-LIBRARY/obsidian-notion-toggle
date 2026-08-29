/**
 * v1.1.0 — floating quiz HUD (plain DOM, no Obsidian imports).
 * Big countdown, Q x/y, progress bar, pause / reveal now / next / stop.
 */
export interface QuizHudCallbacks {
  onTogglePause: () => void;
  onRevealNow: () => void;
  onNext: () => void;
  onStop: () => void;
}

export interface QuizHudData {
  time: string;
  progress: string;
  phase: string;
  running: boolean;
  revealing: boolean;
  /** 0..1 */
  ratio: number;
}

export class QuizHud {
  private root: HTMLElement;
  private timeEl: HTMLElement;
  private progressEl: HTMLElement;
  private phaseEl: HTMLElement;
  private barFill: HTMLElement;
  private runBtn: HTMLButtonElement;

  constructor(private cb: QuizHudCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "ntt-quiz-hud";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Quiz mode");

    const head = document.createElement("div");
    head.className = "ntt-quiz-head";
    this.root.appendChild(head);

    this.timeEl = document.createElement("div");
    this.timeEl.className = "ntt-quiz-time";
    this.timeEl.textContent = "00:20";
    head.appendChild(this.timeEl);

    const meta = document.createElement("div");
    meta.className = "ntt-quiz-meta";
    head.appendChild(meta);

    this.progressEl = document.createElement("div");
    this.progressEl.className = "ntt-quiz-progress";
    this.progressEl.textContent = "Q 1/1";
    meta.appendChild(this.progressEl);

    this.phaseEl = document.createElement("div");
    this.phaseEl.className = "ntt-quiz-phase";
    this.phaseEl.textContent = "Question";
    meta.appendChild(this.phaseEl);

    const bar = document.createElement("div");
    bar.className = "ntt-quiz-bar";
    this.barFill = document.createElement("div");
    this.barFill.className = "ntt-quiz-bar-fill";
    bar.appendChild(this.barFill);
    this.root.appendChild(bar);

    const row = document.createElement("div");
    row.className = "ntt-quiz-actions";
    this.root.appendChild(row);

    const btn = (text: string, label: string, cls: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = `ntt-btn ntt-quiz-btn ${cls}`;
      b.textContent = text;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      row.appendChild(b);
      return b;
    };

    this.runBtn = btn("⏸", "Pause / resume", "is-run", () => this.cb.onTogglePause());
    btn("👁", "Reveal the answer now", "is-reveal", () => this.cb.onRevealNow());
    btn("⏭", "Next question", "is-next", () => this.cb.onNext());
    btn("✕", "Stop quiz", "is-stop", () => this.cb.onStop());

    document.body.appendChild(this.root);
  }

  render(d: QuizHudData) {
    this.timeEl.textContent = d.time;
    this.progressEl.textContent = d.progress;
    this.phaseEl.textContent = d.phase;
    this.runBtn.textContent = d.running ? "⏸" : "▶";
    this.barFill.style.width = `${Math.round(Math.min(1, Math.max(0, d.ratio)) * 100)}%`;
    this.root.classList.toggle("is-paused", !d.running);
    this.root.classList.toggle("is-reveal", d.revealing);
  }

  destroy() {
    this.root.remove();
  }
}
