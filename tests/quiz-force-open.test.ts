/**
 * v1.4.10 — "quiz questions don't open in sequence".
 *
 * Reveal used to be class-only, so a callout that Obsidian rendered natively
 * collapsed (or brought back collapsed after a re-render) stayed shut: the
 * reader saw the timer move on with no answer. `forceQuizOpen` in main.ts is
 * classes-first, real-open-if-needed; this file pins that rule against the
 * same primitives main.ts uses.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { beforeEach, describe, expect, it } from "bun:test";
import { isQuizVisible, setQuizVisible } from "../src/quiz-visibility";
import { revealLanded } from "../src/quiz-heal";
import { isToggleOpen, setToggleOpen } from "../src/toggle-dom";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

/** The main.ts rule, verbatim, over plain DOM. */
function forceQuizOpen(el: HTMLElement | null | undefined, opened: string[] = []): string[] {
  if (!el || !el.isConnected) return opened;
  setQuizVisible(el, true);
  if (!revealLanded(el)) {
    setToggleOpen(el, true);
    opened.push(el.id);
  }
  return opened;
}

const callout = (id: string, title: string, collapsed = true) => `
  <div class="callout${collapsed ? " is-collapsed" : ""}" data-callout="question" id="${id}">
    <div class="callout-title"><div class="callout-title-inner">${title}</div></div>
    <div class="callout-content">Answer ${title}</div>
  </div>`;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("forceQuizOpen", () => {
  it("marks the answer visible for the quiz", () => {
    document.body.innerHTML = callout("q1", "Q1");
    const el = document.getElementById("q1") as HTMLElement;
    forceQuizOpen(el);
    expect(isQuizVisible(el)).toBe(true);
  });

  it("really opens a <details> toggle that classes cannot reveal", () => {
    document.body.innerHTML = `<details id="d"><summary>Q</summary><p>A</p></details>`;
    const el = document.getElementById("d") as HTMLElement;
    expect(revealLanded(el)).toBe(false);
    const opened = forceQuizOpen(el);
    expect(opened.length <= 1).toBe(true);
    expect(isToggleOpen(el)).toBe(true);
    expect(revealLanded(el)).toBe(true);
  });

  it("clears the theme's collapsed markup so the answer is on screen", () => {
    document.body.innerHTML = callout("q1", "Q1");
    const el = document.getElementById("q1") as HTMLElement;
    forceQuizOpen(el);
    setToggleOpen(el, true);
    expect(el.classList.contains("is-collapsed")).toBe(false);
  });

  it("is a no-op for a detached element (heal handles that case)", () => {
    document.body.innerHTML = callout("q1", "Q1");
    const el = document.getElementById("q1") as HTMLElement;
    el.remove();
    expect(forceQuizOpen(el)).toEqual([]);
    expect(isQuizVisible(el)).toBe(false);
  });

  it("opens questions one after another, never skipping one", () => {
    document.body.innerHTML = ["Q1", "Q2", "Q3"].map((t, i) => callout(`q${i}`, t)).join("");
    const els = ["q0", "q1", "q2"].map((id) => document.getElementById(id) as HTMLElement);
    const shown: string[] = [];
    for (const el of els) {
      forceQuizOpen(el);
      shown.push(...els.filter((e) => isQuizVisible(e)).map((e) => e.id));
      setQuizVisible(el, false);
    }
    expect(shown).toEqual(["q0", "q1", "q2"]);
  });

  it("reveals a question whose element was replaced by a re-render", () => {
    document.body.innerHTML = callout("old", "Q2");
    const stale = document.getElementById("old") as HTMLElement;
    document.body.innerHTML = callout("fresh", "Q2"); // Obsidian re-rendered
    forceQuizOpen(stale); // stale node: nothing happens
    expect(isQuizVisible(stale)).toBe(false);
    const fresh = document.getElementById("fresh") as HTMLElement;
    forceQuizOpen(fresh);
    expect(isQuizVisible(fresh)).toBe(true);
    expect(revealLanded(fresh)).toBe(true);
  });

  it("keep-answers-open reveals every question up front", () => {
    document.body.innerHTML = ["Q1", "Q2"].map((t, i) => callout(`k${i}`, t)).join("");
    const els = ["k0", "k1"].map((id) => document.getElementById(id) as HTMLElement);
    for (const el of els) forceQuizOpen(el);
    expect(els.every((el) => isQuizVisible(el))).toBe(true);
  });
});
