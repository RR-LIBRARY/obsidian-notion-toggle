/**
 * v1.3.3 — in-Obsidian E2E harness.
 *
 * Renders a note the way Obsidian's reading view does (callouts with
 * `.callout-title` / `.callout-content`, native `<details>`, plain paragraphs)
 * inside a scrollable container, then drives the *real* plugin modules over it:
 * deep-link parsing → quiz engine ticks → visibility classes → self-heal →
 * inline ring + dock painting.
 *
 * It is deliberately module-level rather than a mocked `Plugin` subclass: every
 * step below is the same function main.ts calls, so a regression in any of them
 * fails here instead of only on a phone.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { DEFAULT_QUIZ, quizTick, startQuiz, type QuizSettings, type QuizState } from "../../src/quiz";
import { parseDeepLink, type DeepLink } from "../../src/deeplink";
import {
  applyQuizVisibilityClasses,
  clearQuizVisibility,
  isQuizVisible,
  setQuizVisible,
  snapshotToggles,
  type ToggleSnapshot,
} from "../../src/quiz-visibility";
import { healQuizEls, needsHeal, revealLanded } from "../../src/quiz-heal";
import { collectToggleEls, toggleTitleOf, toggleTypeOf } from "../../src/toggle-dom";
import { colorOf, matchesFilter } from "../../src/autoscroll";
import type { RecallColor } from "../../src/autoscroll";
import { QuizRing } from "../../src/quiz-badge";
import { QuizBar } from "../../src/quiz-ui";
import { Telemetry } from "../../src/telemetry";

export function ensureDom(): void {
  if (typeof (globalThis as { document?: unknown }).document === "undefined") {
    GlobalRegistrator.register();
  }
}

export interface NoteQuestion {
  title: string;
  answer: string;
  /** Callout type, e.g. `question`, `note`, `danger` (red), `warning` (yellow). */
  type?: string;
  /** Render as a raw `<details>` toggle instead of a callout. */
  details?: boolean;
  collapsed?: boolean;
}

/** Markup identical in shape to Obsidian's reading view. */
export function renderNote(questions: NoteQuestion[], extraText = "Plain reading text."): HTMLElement {
  const body = questions
    .map((q, i) =>
      q.details
        ? `<details id="q${i}"${q.collapsed === false ? " open" : ""}><summary>${q.title}</summary><div class="callout-content">${q.answer}</div></details>`
        : `<div class="callout${q.collapsed === false ? "" : " is-collapsed"}" data-callout="${q.type ?? "question"}" id="q${i}">
             <div class="callout-title"><div class="callout-title-inner">${q.title}</div></div>
             <div class="callout-content">${q.answer}</div>
           </div>`
    )
    .join("\n");
  document.body.innerHTML = `<div class="markdown-preview-view" id="note"><p>${extraText}</p>${body}</div>`;
  return document.getElementById("note") as HTMLElement;
}

/**
 * A quiz run over the rendered note. Mirrors main.ts's orchestration:
 * capture → tick → reveal (with heal + landed fallback) → next → stop.
 */
export class QuizHarness {
  readonly perf = new Telemetry();
  readonly settings: QuizSettings;
  state: QuizState;
  els: (HTMLElement | undefined)[];
  titles: string[];
  snapshot: ToggleSnapshot[];
  readonly events: string[] = [];
  ring: QuizRing | null = null;
  bar: QuizBar | null = null;
  private clock = 0;

  constructor(
    readonly container: HTMLElement,
    settings: Partial<QuizSettings> = {},
    readonly filter: RecallColor[] = [],
    readonly closeOthers = true
  ) {
    this.settings = { ...DEFAULT_QUIZ, ...settings };
    const nodes = collectToggleEls(container).filter(
      (el) => filter.length === 0 || matchesFilter(colorOf(toggleTypeOf(el)), filter)
    );
    this.els = nodes;
    this.titles = nodes.map((el) => toggleTitleOf(el));
    this.snapshot = snapshotToggles(nodes);
    this.state = startQuiz(this.titles, this.settings);
    this.paint();
  }

  /** Mount the real inline ring + dock, as quiz mode does on screen. */
  withUi(): this {
    this.ring = new QuizRing(document);
    this.bar = new QuizBar({
      onTogglePause: () => this.togglePause(),
      onRevealNow: () => this.revealNow(),
      onNext: () => this.next(),
      onStop: () => this.stop(),
    });
    this.paint();
    return this;
  }

  /** Re-map captured questions after a re-render (main.ts `ensureQuizEls`). */
  heal(): void {
    if (!needsHeal(this.els)) return;
    const fresh = collectToggleEls(this.container).filter(
      (el) => this.filter.length === 0 || matchesFilter(colorOf(toggleTypeOf(el)), this.filter)
    );
    this.els = healQuizEls(this.els, this.titles, fresh, (el) => toggleTitleOf(el));
  }

  private paint(): void {
    this.clock += 250;
    this.perf.quizRender.mark(this.clock);
    const el = this.els[this.state.at];
    if (el?.isConnected) this.ring?.mount(el);
    this.ring?.render({
      remaining: this.state.remaining,
      ratio: 0.5,
      phase: this.state.phase,
      running: this.state.running,
      index: this.state.at + 1,
      total: this.state.total,
    });
    this.bar?.render({
      progress: `Q ${Math.min(this.state.at + 1, this.state.total)}/${this.state.total}`,
      running: this.state.running,
      revealing: this.state.phase === "reveal",
    });
  }

  private applyVisibility(revealed: boolean): void {
    this.heal();
    applyQuizVisibilityClasses(this.els, this.state.at, revealed, this.closeOthers);
    const el = this.els[this.state.at];
    // Safety net: a re-rendered callout can come back collapsed by Obsidian.
    if (revealed && el && !revealLanded(el)) setQuizVisible(el, true);
    this.paint();
  }

  /** Advance the engine by `ms`, applying every event it emits. */
  tick(ms: number): void {
    const { state, event } = quizTick(this.state, ms, this.titles, this.settings);
    this.clock += Math.max(0, ms - 250);
    this.state = state;
    if (event) {
      this.events.push(event);
      if (event === "reveal") this.applyVisibility(true);
      else if (event === "next") this.applyVisibility(false);
      else if (event === "done") this.stop();
    } else this.paint();
  }

  /** Run the whole quiz in `step`-ms slices, with a safety bound. */
  run(step = 250, maxMs = 10 * 60 * 1000): void {
    let spent = 0;
    while (this.state.phase !== "done" && spent < maxMs) {
      this.tick(step);
      spent += step;
    }
  }

  revealNow(): void {
    this.state = { ...this.state, phase: "reveal", remaining: this.settings.quizRevealSeconds * 1000 };
    this.events.push("reveal");
    this.applyVisibility(true);
  }

  next(): void {
    if (this.state.at + 1 >= this.state.total) {
      this.state = { ...this.state, phase: "done", running: false, remaining: 0 };
      this.stop();
      return;
    }
    this.state = {
      ...this.state,
      at: this.state.at + 1,
      phase: "question",
      remaining: this.settings.quizSeconds * 1000,
      answered: this.state.answered + 1,
    };
    this.events.push("next");
    this.applyVisibility(false);
  }

  togglePause(): void {
    this.state = { ...this.state, running: !this.state.running };
    this.paint();
  }

  stop(): void {
    clearQuizVisibility(this.els, this.snapshot);
    this.ring?.destroy();
    this.bar?.destroy();
    this.ring = null;
    this.bar = null;
  }

  visibleTitles(): string[] {
    return this.els
      .filter((el): el is HTMLElement => !!el && isQuizVisible(el))
      .map((el) => toggleTitleOf(el));
  }
}

/** Deep link → the settings a run would start with (main.ts protocol handler). */
export function applyDeepLink(
  link: DeepLink | null,
  base: QuizSettings = DEFAULT_QUIZ
): { settings: QuizSettings; filter: RecallColor[]; file?: string; speed?: number } | null {
  if (!link) return null;
  const settings = { ...base };
  if (link.seconds) settings.quizSeconds = link.seconds;
  const out: { settings: QuizSettings; filter: RecallColor[]; file?: string; speed?: number } = {
    settings,
    filter: link.filter ?? [],
  };
  if (link.file) out.file = link.file;
  if (link.speed) out.speed = link.speed;
  return out;
}

export { parseDeepLink };
