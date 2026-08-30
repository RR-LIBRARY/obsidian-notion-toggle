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

/**
 * `m:ss` like Telegram (`0:07`); an hour or more reads `h:mm:ss` so a 2h
 * question is unmistakable (v1.4.2).
 */
export function formatRingTime(ms: number): string {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The row a badge should sit in: callout title, `<summary>`, or the toggle itself. */
export function titleRowOf(el: HTMLElement): HTMLElement {
  return strictTitleRowOf(el) ?? el;
}

/**
 * v1.4.2 — the *real* title row, or `null` when the toggle has none. Badges use
 * this so a countdown can never end up pinned to a note paragraph.
 */
export function strictTitleRowOf(el: HTMLElement): HTMLElement | null {
  return (
    (el.querySelector(".callout-title") as HTMLElement | null) ??
    (el.querySelector("summary") as HTMLElement | null)
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
  /** v1.4.2 — pending (not reached yet) / active / answered. */
  state?: "pending" | "active" | "done";
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

  /**
   * Move the badge onto `el`'s title row (no-op when it is already there).
   * Returns false when the toggle has no title row — the badge stays off the
   * note rather than floating over body text (v1.4.2).
   */
  mount(el: HTMLElement): boolean {
    const row = strictTitleRowOf(el) ?? (el.tagName.toLowerCase() === "details" ? null : el);
    if (!row) {
      this.root.remove();
      return false;
    }
    if (this.root.parentElement !== row) row.appendChild(this.root);
    return true;
  }

  render(d: QuizRingData): void {
    this.label.textContent = formatRingTime(d.remaining);
    this.arc.setAttribute("stroke-dashoffset", String(ringOffset(d.ratio)));
    this.root.classList.toggle("is-reveal", d.phase === "reveal");
    this.root.classList.toggle("is-paused", !d.running);
    const state = d.state ?? "active";
    this.root.classList.toggle("is-pending", state === "pending");
    this.root.classList.toggle("is-active", state === "active");
    this.root.classList.toggle("is-done", state === "done");
    const what = state === "pending" ? "waiting" : d.phase === "reveal" ? "answer" : "question";
    this.root.setAttribute(
      "aria-label",
      `Question ${d.index} of ${d.total}, ${what}, ${formatRingTime(d.remaining)} left`
    );
    void this.track;
  }

  destroy(): void {
    this.root.remove();
  }
}

/** One question's slot in the board. */
export interface QuizBoardItem {
  /** Toggle element, or undefined when it is not in the DOM right now. */
  el?: HTMLElement;
  /** Full duration of this question, in ms (⏱ override or the setting). */
  totalMs: number;
}

/**
 * v1.4.2 — a badge on **every** question of the run.
 *
 * Before, one ring hopped between questions, so only the active toggle showed a
 * countdown. Now each question keeps its own badge: pending questions display
 * the time they will get, the active one counts down live, answered ones are
 * marked done.
 */
export class QuizBoard {
  private rings = new Map<number, QuizRing>();

  constructor(private doc: Document = document) {}

  /** Paint every badge from the current run state. */
  render(items: QuizBoardItem[], active: number, live: QuizRingData): void {
    const total = items.length;
    items.forEach((item, i) => {
      const el = item.el;
      if (!el || !el.isConnected) {
        this.rings.get(i)?.destroy();
        this.rings.delete(i);
        return;
      }
      let ring = this.rings.get(i);
      if (!ring) {
        ring = new QuizRing(this.doc);
        this.rings.set(i, ring);
      }
      if (!ring.mount(el)) {
        ring.destroy();
        this.rings.delete(i);
        return;
      }
      if (i === active) {
        ring.render({ ...live, index: i + 1, total, state: "active" });
      } else {
        const done = i < active;
        ring.render({
          remaining: done ? 0 : item.totalMs,
          ratio: done ? 0 : 1,
          phase: "question",
          running: false,
          index: i + 1,
          total,
          state: done ? "done" : "pending",
        });
      }
    });
    for (const [i, ring] of [...this.rings]) {
      if (i >= items.length) {
        ring.destroy();
        this.rings.delete(i);
      }
    }
  }

  /** How many badges are on screen (tests / telemetry). */
  get size(): number {
    return this.rings.size;
  }

  destroy(): void {
    for (const ring of this.rings.values()) ring.destroy();
    this.rings.clear();
  }
}

