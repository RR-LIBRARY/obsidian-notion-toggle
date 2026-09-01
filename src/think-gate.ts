/**
 * v1.5.9 — "think time" gate.
 *
 * Reading flow is now three steps, Telegram-quiz style:
 *
 *   question title  ->  THINK TIME (answer hidden)  ->  answer reveal  ->  hold
 *
 * The gate owns the hidden/shown flip, the countdown badge on the title and
 * the tap-to-reveal shortcut. It never clicks `.callout-title`, so Obsidian's
 * fold handler (and the mobile blink that came with it) is never triggered and
 * the note's persisted fold state is left alone.
 *
 * Pure module: DOM only, no Obsidian imports.
 */

/** Body class while a run with a think gate is active (drives the CSS). */
export const THINK_RUN_CLASS = "ntt-think-run";
/** Body class that hides Obsidian's chrome for a distraction-free run. */
export const FOCUS_RUN_CLASS = "ntt-focus-run";
/** Answer held back by the think gate. */
export const THINK_HIDDEN_CLASS = "ntt-think-hidden";
/** Answer released by the think gate. */
export const THINK_SHOWN_CLASS = "ntt-think-shown";
/** Countdown chip appended to the question title. */
export const THINK_BADGE_CLASS = "ntt-think-badge";

export const THINK_SECONDS_MIN = 0;
/** Same ceiling as a quiz question: one hour of thinking is plenty. */
export const THINK_SECONDS_MAX = 3600;

export interface ThinkSettings {
  /** Hold the answer back after the toggle opens. */
  scrollThinkEnabled: boolean;
  /** Seconds of thinking time before the answer is released. */
  scrollThinkSeconds: number;
}

export const DEFAULT_THINK: ThinkSettings = {
  scrollThinkEnabled: true,
  scrollThinkSeconds: 5,
};

export function clampThinkSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_THINK.scrollThinkSeconds;
  return Math.min(THINK_SECONDS_MAX, Math.max(THINK_SECONDS_MIN, Math.round(seconds)));
}

function unitMultiplier(unit: string | undefined): number {
  const u = (unit ?? "s").toLowerCase();
  return u === "h" ? 3600 : u === "m" ? 60 : 1;
}

/**
 * Per-toggle think override written in the title:
 * "🤔20", "🤔 2m", "?20s", "[think 30s]", "(think 45 s)".
 */
export function parseThinkSeconds(
  title: string | null | undefined,
  fallback: number
): number {
  const text = title ?? "";
  const unit = "([smh])(?![a-z])";
  const patterns = [
    new RegExp(`🤔\\s*(\\d{1,5})\\s*(?:${unit})?`, "i"),
    new RegExp(`💭\\s*(\\d{1,5})\\s*(?:${unit})?`, "i"),
    new RegExp(`\\?\\s*(\\d{1,5})\\s*${unit}`, "i"),
    new RegExp(`\\[\\s*think\\s*(\\d{1,5})\\s*${unit}?\\s*\\]`, "i"),
    new RegExp(`\\(\\s*think\\s*(\\d{1,5})\\s*${unit}?\\s*\\)`, "i"),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return clampThinkSeconds(Number(m[1]) * unitMultiplier(m[2]));
  }
  return clampThinkSeconds(fallback);
}

/** Think window for this title, in milliseconds (0 = reveal immediately). */
export function thinkMsFor(title: string | undefined, s: ThinkSettings): number {
  if (!s.scrollThinkEnabled) return 0;
  return parseThinkSeconds(title, s.scrollThinkSeconds) * 1000;
}

/**
 * A stop's budget: the think window is *added* to the hold, so a tall answer
 * still gets its full reading time (and its screen-by-screen chunks).
 */
export function thinkSplit(holdMs: number, thinkMs: number) {
  const think = Math.max(0, Math.round(thinkMs));
  const hold = Math.max(0, Math.round(holdMs));
  return { thinkMs: think, holdMs: hold, totalMs: think + hold };
}

/** "⏱ 4" — countdown chip text for the remaining think window. */
export function thinkCountdownLabel(msLeft: number): string {
  const secs = Math.max(0, Math.ceil(msLeft / 1000));
  if (secs < 60) return `🤔 ${secs}`;
  const m = Math.floor(secs / 60);
  const rest = secs % 60;
  return rest ? `🤔 ${m}m ${rest}` : `🤔 ${m}m`;
}

/** Title row of a toggle (summary for `<details>`, callout title otherwise). */
export function titleRowOf(el: HTMLElement): HTMLElement | null {
  if (el.tagName.toLowerCase() === "details") {
    return el.querySelector<HTMLElement>("summary");
  }
  return el.querySelector<HTMLElement>(".callout-title");
}

/** Visible title text, used for the per-toggle "🤔20s" override. */
export function titleTextOf(el: HTMLElement): string {
  const row = titleRowOf(el);
  return (row?.textContent ?? "").trim();
}

/** Hide / show the answer body with plugin-owned classes only. */
export function setThinkHidden(el: HTMLElement, hidden: boolean): void {
  el.classList.toggle(THINK_HIDDEN_CLASS, hidden);
  el.classList.toggle(THINK_SHOWN_CLASS, !hidden);
}

/** Drop every think-gate marker from a toggle. */
export function clearThinkMarks(el: HTMLElement): void {
  el.classList.remove(THINK_HIDDEN_CLASS, THINK_SHOWN_CLASS);
  el.querySelectorAll(`.${THINK_BADGE_CLASS}`).forEach((b) => b.remove());
}

/**
 * The live think gate for one autoscroll stop. `now` is always the same clock
 * the caller uses for its dwell deadlines (the rAF timestamp).
 */
export class ThinkGate {
  private el: HTMLElement | null = null;
  private until = 0;
  private badge: HTMLElement | null = null;
  private onTap: ((ev: Event) => void) | null = null;
  private lastLabel = "";

  /** Is an answer currently held back? */
  get thinking(): boolean {
    return !!this.el && this.until > 0;
  }

  /** Deadline of the current think window (same clock as `now`). */
  get revealAt(): number {
    return this.until;
  }

  /**
   * Hold this toggle's answer back. Returns the think window in ms so the
   * caller can extend the stop's dwell by exactly that much.
   */
  begin(el: HTMLElement | null | undefined, s: ThinkSettings, now: number): number {
    this.release();
    if (!el) return 0;
    const ms = thinkMsFor(titleTextOf(el), s);
    if (ms <= 0) {
      setThinkHidden(el, false);
      return 0;
    }
    this.el = el;
    this.until = now + ms;
    setThinkHidden(el, true);
    this.paint(ms);
    const row = titleRowOf(el) ?? el;
    this.onTap = () => this.revealNow();
    row.addEventListener("click", this.onTap, { capture: true });
    return ms;
  }

  /** Advance the gate. Returns true on the frame the answer is released. */
  tick(now: number): boolean {
    if (!this.el || this.until <= 0) return false;
    const left = this.until - now;
    if (left > 0) {
      this.paint(left);
      return false;
    }
    this.revealNow();
    return true;
  }

  /** Reveal the answer right now (timer end, or a tap on the question). */
  revealNow(): void {
    const el = this.el;
    if (!el) return;
    setThinkHidden(el, false);
    this.detach();
    this.until = 0;
    this.el = null;
  }

  /** Stop gating without deciding anything: the answer becomes visible. */
  release(): void {
    if (this.el) {
      setThinkHidden(this.el, false);
      this.detach();
    }
    this.until = 0;
    this.el = null;
  }

  /** End of run: remove every marker from the toggle we touched. */
  clear(): void {
    const el = this.el;
    this.release();
    if (el) clearThinkMarks(el);
  }

  /** Phase label for the debug overlay / screen-maths readout. */
  phaseLabel(now: number): string {
    if (!this.thinking) return "answer";
    return `think ${Math.max(0, Math.ceil((this.until - now) / 1000))}s`;
  }

  private paint(msLeft: number) {
    const el = this.el;
    if (!el) return;
    const label = thinkCountdownLabel(msLeft);
    if (label === this.lastLabel && this.badge?.isConnected) return;
    this.lastLabel = label;
    if (!this.badge || !this.badge.isConnected) {
      const row = titleRowOf(el) ?? el;
      const badge = el.ownerDocument.createElement("span");
      badge.className = THINK_BADGE_CLASS;
      row.appendChild(badge);
      this.badge = badge;
    }
    this.badge.textContent = label;
  }

  private detach() {
    if (this.badge) {
      this.badge.remove();
      this.badge = null;
    }
    this.lastLabel = "";
    const el = this.el;
    if (el && this.onTap) {
      const row = titleRowOf(el) ?? el;
      row.removeEventListener("click", this.onTap, { capture: true } as EventListenerOptions);
    }
    this.onTap = null;
  }
}
