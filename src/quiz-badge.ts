/**
 * v1.3.0 — Telegram-style inline quiz timer.
 *
 * Instead of a floating HUD box that covers the note, the countdown lives on
 * the question itself: a small ring + `m:ss` badge pinned to the right of the
 * toggle's title row, exactly like the `0:07 ⟳` marker on a Telegram quiz
 * message.
 *
 * Geometry / formatting helpers are pure so they can be unit-tested.
 */

export const RING_RADIUS = 8;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Clamp a 0..1 ratio, tolerating NaN and out-of-range input. */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * `stroke-dashoffset` for a ring that shows `ratio` of time still remaining.
 * ratio 1 → full ring, ratio 0 → empty ring.
 */
export function ringOffset(ratio: number): number {
  return RING_CIRCUMFERENCE * (1 - clampRatio(ratio));
}

/** `m:ss` like Telegram (`0:07`), never negative. */
export function formatRingTime(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The row a badge should sit in: callout title, `<summary>`, or the toggle itself. */
export function titleRowOf(el: HTMLElement): HTMLElement {
  return (
    (el.querySelector(".callout-title") as HTMLElement | null) ??
    (el.querySelector("summary") as HTMLElement | null) ??
    el
  );
}

export interface QuizRingData {
  /** Milliseconds left in the current phase. */
  remaining: number;
  /** 0..1 of the phase still to run. */
  ratio: number;
  phase: "question" | "reveal" | "done";
  running: boolean;
  /** 1-based question number and total, for the screen reader. */
  index: number;
  total: number;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** The inline ring badge. One instance is reused and moved between questions. */
export class QuizRing {
  readonly root: HTMLElement;
  private track: SVGCircleElement;
  private arc: SVGCircleElement;
  private label: HTMLElement;

  constructor(doc: Document = document) {
    this.root = doc.createElement("span");
    this.root.className = "ntt-quiz-ring";
    this.root.setAttribute("role", "timer");
    this.root.setAttribute("aria-live", "polite");

    const size = (RING_RADIUS + 2) * 2;
    const svg = doc.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "ntt-quiz-ring-svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");

    const circle = (cls: string) => {
      const c = doc.createElementNS(SVG_NS, "circle") as SVGCircleElement;
      c.setAttribute("class", cls);
      c.setAttribute("cx", String(size / 2));
      c.setAttribute("cy", String(size / 2));
      c.setAttribute("r", String(RING_RADIUS));
      c.setAttribute("fill", "none");
      svg.appendChild(c);
      return c;
    };
    this.track = circle("ntt-quiz-ring-track");
    this.arc = circle("ntt-quiz-ring-arc");
    this.arc.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
    this.arc.setAttribute("stroke-dashoffset", "0");

    this.label = doc.createElement("span");
    this.label.className = "ntt-quiz-ring-time";
    this.label.textContent = "0:00";

    this.root.appendChild(this.label);
    this.root.appendChild(svg);
  }

  /** Move the badge onto `el`'s title row (no-op when it is already there). */
  mount(el: HTMLElement): void {
    const row = titleRowOf(el);
    if (this.root.parentElement !== row) row.appendChild(this.root);
  }

  render(d: QuizRingData): void {
    this.label.textContent = formatRingTime(d.remaining);
    this.arc.setAttribute("stroke-dashoffset", String(ringOffset(d.ratio)));
    this.root.classList.toggle("is-reveal", d.phase === "reveal");
    this.root.classList.toggle("is-paused", !d.running);
    this.root.setAttribute(
      "aria-label",
      `Question ${d.index} of ${d.total}, ${d.phase === "reveal" ? "answer" : "question"}, ${formatRingTime(
        d.remaining
      )} left`
    );
    void this.track;
  }

  destroy(): void {
    this.root.remove();
  }
}
