/**
 * v1.2.3 — DOM-level deep verification of the automatic toggle open/close
 * behaviour used by quiz mode and autoscroll.
 *
 * Uses the real helpers from src/toggle-dom.ts (the same ones main.ts calls),
 * on a happy-dom rendering of a mixed note: foldable callouts (!note,
 * !question, !info), raw <details>, an already-open <details> and plain text.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import {
  applyQuizVisibility,
  collectToggleEls,
  isToggleOpen,
  restoreToggles,
  setToggleOpen,
  toggleTitleOf,
  toggleTypeOf,
} from "../src/toggle-dom";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

/** Obsidian folds a callout by clicking its title — replicate that handler. */
function wireCallout(el: HTMLElement) {
  const title = el.querySelector(".callout-title") as HTMLElement;
  title.addEventListener("click", () => el.classList.toggle("is-collapsed"));
}

function render(): HTMLElement {
  document.body.innerHTML = `
    <div class="markdown-preview-view" id="note">
      <p>Plain reading text, not a toggle.</p>
      <div class="callout is-collapsed" data-callout="note" id="t0">
        <div class="callout-title"><div class="callout-title-inner">Q1 ⏱30</div></div>
        <div class="callout-content">Answer 1</div>
      </div>
      <div class="callout" data-callout="question" id="t1">
        <div class="callout-title"><div class="callout-title-inner">Q2</div></div>
        <div class="callout-content">
          Answer 2
          <div class="callout is-collapsed" data-callout="info" id="nested">
            <div class="callout-title"><div class="callout-title-inner">nested</div></div>
          </div>
        </div>
      </div>
      <details id="t2"><summary>Q3 [15s]</summary>Answer 3</details>
      <details id="t3" open><summary>Q4</summary>Answer 4</details>
      <p>More plain text.</p>
    </div>`;
  const note = document.getElementById("note") as HTMLElement;
  note.querySelectorAll<HTMLElement>(".callout").forEach(wireCallout);
  return note;
}

let note: HTMLElement;
beforeEach(() => {
  note = render();
});
afterAll(() => {
  document.body.innerHTML = "";
});

describe("toggle discovery", () => {
  it("finds every toggle type and ignores nested + plain text", () => {
    const els = collectToggleEls(note);
    expect(els.map((e) => e.id)).toEqual(["t0", "t1", "t2", "t3"]);
    expect(els.some((e) => e.id === "nested")).toBe(false);
  });

  it("reports the callout type / details tag for the colour filter", () => {
    const [a, b, c] = collectToggleEls(note);
    expect(toggleTypeOf(a)).toBe("note");
    expect(toggleTypeOf(b)).toBe("question");
    expect(toggleTypeOf(c)).toBe("details");
  });

  it("reads the title text used for per-question durations", () => {
    const els = collectToggleEls(note);
    expect(toggleTitleOf(els[0])).toContain("⏱30");
    expect(toggleTitleOf(els[2])).toContain("[15s]");
  });
});

describe("open / close", () => {
  it("reads the initial state of callouts and details correctly", () => {
    const [t0, t1, t2, t3] = collectToggleEls(note);
    expect([t0, t1, t2, t3].map(isToggleOpen)).toEqual([false, true, false, true]);
  });

  it("opens and closes both flavours, and is idempotent", () => {
    for (const el of collectToggleEls(note)) {
      setToggleOpen(el, true);
      setToggleOpen(el, true);
      expect(isToggleOpen(el)).toBe(true);
      setToggleOpen(el, false);
      setToggleOpen(el, false);
      expect(isToggleOpen(el)).toBe(false);
    }
  });
});

describe("quiz run: automatic close, reveal and restore", () => {
  it("collapses everything at the start, then reveals one answer at a time", () => {
    const els = collectToggleEls(note);
    const wasOpen = els.map(isToggleOpen);
    expect(wasOpen).toEqual([false, true, false, true]);

    // start: active recall — all closed
    els.forEach((el) => setToggleOpen(el, false));
    expect(els.map(isToggleOpen)).toEqual([false, false, false, false]);

    // Q1 question phase: nothing open
    applyQuizVisibility(els, 0, false, true);
    expect(els.map(isToggleOpen)).toEqual([false, false, false, false]);

    // Q1 reveal: only Q1 open
    applyQuizVisibility(els, 0, true, true);
    expect(els.map(isToggleOpen)).toEqual([true, false, false, false]);

    // move to Q2: previous closes automatically
    applyQuizVisibility(els, 1, false, true);
    expect(els.map(isToggleOpen)).toEqual([false, false, false, false]);
    applyQuizVisibility(els, 1, true, true);
    expect(els.map(isToggleOpen)).toEqual([false, true, false, false]);

    // <details> question behaves the same
    applyQuizVisibility(els, 2, true, true);
    expect(els.map(isToggleOpen)).toEqual([false, false, true, false]);

    // stop: document comes back exactly as the reader left it
    restoreToggles(els, wasOpen);
    expect(els.map(isToggleOpen)).toEqual(wasOpen);
  });

  it("keeps revealed answers open when 'close after reveal' is off", () => {
    const els = collectToggleEls(note);
    els.forEach((el) => setToggleOpen(el, false));
    applyQuizVisibility(els, 0, true, false);
    applyQuizVisibility(els, 1, true, false);
    expect(els.map(isToggleOpen)).toEqual([true, true, false, false]);
  });

  it("leaves no toggle stuck collapsed after a finished run", () => {
    const els = collectToggleEls(note);
    const wasOpen = els.map(isToggleOpen);
    els.forEach((el) => setToggleOpen(el, false));
    for (let i = 0; i < els.length; i++) applyQuizVisibility(els, i, true, true);
    restoreToggles(els, wasOpen);
    // Everything the reader had open is open again; the document is readable.
    expect(els.filter(isToggleOpen).map((e) => e.id)).toEqual(["t1", "t3"]);
  });

  it("restores safely when the stored state array is shorter (stale run)", () => {
    const els = collectToggleEls(note);
    els.forEach((el) => setToggleOpen(el, true));
    restoreToggles(els, [true]);
    expect(els.map(isToggleOpen)).toEqual([true, false, false, false]);
  });
});
