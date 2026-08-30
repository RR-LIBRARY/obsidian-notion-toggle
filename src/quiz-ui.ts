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

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string>
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export type QuizIcon = "pause" | "play" | "reveal" | "next" | "stop";

/**
 * v1.3.1 — one icon set, one stroke width (2), one size (20px).
 * The emoji glyphs the dock used before rendered at a different weight in every
 * theme/font and read like a toy app; these are Lucide-shaped line icons that
 * inherit `currentColor` so dark mode and the accent state just work.
 */
export function buildQuizIcon(kind: QuizIcon): SVGSVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  const path = (d: string) => svg.appendChild(svgEl("path", { d }));
  switch (kind) {
    case "pause":
      path("M9 5v14");
      path("M15 5v14");
      break;
    case "play":
      svg.appendChild(
        svgEl("path", { d: "M7 4.5l12 7.5-12 7.5z", fill: "currentColor", stroke: "none" })
      );
      break;
    case "reveal":
      path("M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z");
      svg.appendChild(svgEl("circle", { cx: "12", cy: "12", r: "2.6" }));
      break;
    case "next":
      path("M5 5l9 7-9 7z");
      path("M18 5v14");
      break;
    case "stop":
      path("M6 6l12 12");
      path("M18 6L6 18");
      break;
  }
  return svg;
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

    const btn = (icon: QuizIcon, label: string, cls: string, fn: () => void) => {
      const b = document.createElement("button");
      b.className = `ntt-quiz-dock-btn ${cls}`;
      b.type = "button";
      b.appendChild(buildQuizIcon(icon));
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      this.root.appendChild(b);
      return b;
    };

    this.runBtn = btn("pause", "Pause / resume", "is-run", () => this.cb.onTogglePause());
    btn("reveal", "Reveal the answer now", "is-reveal", () => this.cb.onRevealNow());
    btn("next", "Next question", "is-next", () => this.cb.onNext());
    btn("stop", "Stop quiz", "is-stop", () => this.cb.onStop());

    document.body.appendChild(this.root);
  }

  render(d: QuizBarData) {
    this.progressEl.textContent = d.progress;
    this.runBtn.textContent = "";
    this.runBtn.appendChild(buildQuizIcon(d.running ? "pause" : "play"));
    this.runBtn.setAttribute("aria-label", d.running ? "Pause quiz" : "Resume quiz");
    this.runBtn.title = this.runBtn.getAttribute("aria-label") ?? "";
    this.runBtn.setAttribute("aria-pressed", String(!d.running));
    this.root.classList.toggle("is-paused", !d.running);
    this.root.classList.toggle("is-reveal", d.revealing);
  }

  destroy() {
    this.root.remove();
  }
}


/* ---------- v1.4.7 — HUD painting (kept out of main.ts) ---------- */

export interface QuizHudBoard {
  render(
    items: { el?: HTMLElement; totalMs: number }[],
    at: number,
    live: { remaining: number; ratio: number; phase: string; running: boolean; index: number; total: number }
  ): void;
}

export interface QuizHudInput {
  board: QuizHudBoard | null;
  bar: { render(data: QuizBarData): void } | null;
  els: (HTMLElement | undefined)[];
  totals: number[];
  at: number;
  remaining: number;
  ratio: number;
  phase: string;
  running: boolean;
  total: number;
  progress: string;
}

/**
 * Paint the inline countdown badges and the optional dock. Pending questions
 * show the time they will get, the active one counts down.
 */
export function paintQuizHud(input: QuizHudInput): void {
  input.board?.render(
    input.els.map((el, i) => ({ el, totalMs: input.totals[i] ?? 0 })),
    input.at,
    {
      remaining: input.remaining,
      ratio: input.ratio,
      phase: input.phase,
      running: input.running,
      index: input.at + 1,
      total: input.total,
    }
  );
  input.bar?.render({ progress: input.progress, running: input.running, revealing: input.phase === "reveal" });
}
