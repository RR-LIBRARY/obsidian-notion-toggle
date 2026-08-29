/**
 * v1.3.0 — slim quiz control bar (plain DOM, no Obsidian imports).
 *
 * The old floating HUD (big countdown box over the note) is gone: the time now
 * lives on the question itself (`src/quiz-badge.ts`). What is left is an
 * optional, low-profile control strip docked to the bottom safe area with
 * pause / reveal / next / stop — hidden entirely in "minimal quiz UI" mode.
 */
export interface QuizBarCallbacks {
  onTogglePause: () => void;
  onRevealNow: () => void;
  onNext: () => void;
  onStop: () => void;
}

export interface QuizBarData {
  progress: string;
  running: boolean;
  revealing: boolean;
}

export class QuizBar {
  private root: HTMLElement;
  private progressEl: HTMLElement;
  private runBtn: HTMLButtonElement;

  constructor(private cb: QuizBarCallbacks) {
    this.root = document.createElement("div");
    this.root.className = "ntt-quiz-dock";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Quiz controls");

    this.progressEl = document.createElement("span");
    this.progressEl.className = "ntt-quiz-dock-progress";
    this.progressEl.textContent = "Q 1/1";
    this.root.appendChild(this.progressEl);

    const btn = (text: string, label: string, cls: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = `ntt-quiz-dock-btn ${cls}`;
      b.textContent = text;
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      this.root.appendChild(b);
      return b;
    };

    this.runBtn = btn("⏸", "Pause / resume", "is-run", () => this.cb.onTogglePause());
    btn("👁", "Reveal the answer now", "is-reveal", () => this.cb.onRevealNow());
    btn("⏭", "Next question", "is-next", () => this.cb.onNext());
    btn("✕", "Stop quiz", "is-stop", () => this.cb.onStop());

    document.body.appendChild(this.root);
  }

  render(d: QuizBarData) {
    this.progressEl.textContent = d.progress;
    this.runBtn.textContent = d.running ? "⏸" : "▶";
    this.runBtn.setAttribute("aria-pressed", String(!d.running));
    this.root.classList.toggle("is-paused", !d.running);
    this.root.classList.toggle("is-reveal", d.revealing);
  }

  destroy() {
    this.root.remove();
  }
}
