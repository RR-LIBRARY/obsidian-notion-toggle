/**
 * v1.3.0 — quiz open/close must never touch Obsidian's own fold state.
 *
 * The screen recording showed the reading view blinking on every question and
 * the note's collapsed state being rewritten. Cause: the old path *clicked*
 * `.callout-title`. These tests assert that click never happens again and that
 * the note comes back exactly as it was.
 */
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  QUIZ_HIDDEN_CLASS,
  QUIZ_SHOWN_CLASS,
  applyQuizVisibilityClasses,
  clearQuizVisibility,
  isQuizVisible,
  setQuizVisible,
  snapshotToggles,
} from "../src/quiz-visibility";

const callout = (type: string, collapsed = true) =>
  `<div class="callout is-collapsible${collapsed ? " is-collapsed" : ""}" data-callout="${type}">` +
  `<div class="callout-title"><div class="callout-title-inner">${type}</div></div>` +
  `<div class="callout-content">answer</div></div>`;

function mount(html: string) {
  const win = new Window();
  const doc = win.document as unknown as Document;
  doc.body.innerHTML = html;
  const els = Array.from(doc.body.children) as HTMLElement[];
  let clicks = 0;
  for (const el of els) {
    el.querySelector(".callout-title")?.addEventListener("click", () => {
      clicks++;
    });
    el.addEventListener("click", () => {
      clicks++;
    });
  }
  return { doc, els, clicks: () => clicks };
}

describe("class-based reveal (no Obsidian fold events)", () => {
  it("hides and shows without a single title click", () => {
    const { els, clicks } = mount(callout("recall-red") + callout("recall-yellow"));
    setQuizVisible(els[0], false);
    setQuizVisible(els[0], true);
    expect(clicks()).toBe(0);
    expect(isQuizVisible(els[0])).toBe(true);
    expect(els[0].classList.contains(QUIZ_SHOWN_CLASS)).toBe(true);
    expect(els[0].classList.contains(QUIZ_HIDDEN_CLASS)).toBe(false);
  });

  it("records the answer height for a full, animated reveal", () => {
    const { els } = mount(callout("recall-red"));
    const content = els[0].querySelector(".callout-content") as HTMLElement;
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 2400 });
    setQuizVisible(els[0], true);
    expect(content.style.getPropertyValue("--ntt-reveal-height")).toBe("2400px");
    setQuizVisible(els[0], false);
    expect(content.style.getPropertyValue("--ntt-reveal-height")).toBe("");
  });

  it("leaves Obsidian's own is-collapsed class untouched", () => {
    const { els } = mount(callout("recall-red", true) + callout("note", false));
    setQuizVisible(els[0], true);
    setQuizVisible(els[1], false);
    expect(els[0].classList.contains("is-collapsed")).toBe(true);
    expect(els[1].classList.contains("is-collapsed")).toBe(false);
  });

  it("uses the native attribute for <details>, still no click", () => {
    const { els, clicks } = mount(`<details open><summary>Q</summary>a</details>`);
    setQuizVisible(els[0], false);
    expect((els[0] as HTMLDetailsElement).open).toBe(false);
    setQuizVisible(els[0], true);
    expect((els[0] as HTMLDetailsElement).open).toBe(true);
    expect(clicks()).toBe(0);
  });
});

describe("one answer at a time", () => {
  it("opens only the current question after the reveal", () => {
    const { els } = mount(callout("q1") + callout("q2") + callout("q3"));
    applyQuizVisibilityClasses(els, 1, false, true);
    expect(els.map(isQuizVisible)).toEqual([false, false, false]);
    applyQuizVisibilityClasses(els, 1, true, true);
    expect(els.map(isQuizVisible)).toEqual([false, true, false]);
  });

  it("keeps earlier answers readable when close-after-reveal is off", () => {
    const { els } = mount(callout("q1") + callout("q2"));
    applyQuizVisibilityClasses(els, 0, true, false);
    applyQuizVisibilityClasses(els, 1, true, false);
    expect(els.map(isQuizVisible)).toEqual([true, true]);
  });
});

describe("stop gives the note back untouched", () => {
  it("removes every quiz class and restores <details>", () => {
    const { els, clicks } = mount(
      callout("q1", true) + callout("q2", false) + `<details open><summary>Q3</summary>a</details>`
    );
    const snap = snapshotToggles(els);
    for (const el of els) setQuizVisible(el, false);
    applyQuizVisibilityClasses(els, 0, true, true);

    clearQuizVisibility(els, snap);

    for (const el of els) {
      expect(el.classList.contains(QUIZ_HIDDEN_CLASS)).toBe(false);
      expect(el.classList.contains(QUIZ_SHOWN_CLASS)).toBe(false);
    }
    expect(els[0].classList.contains("is-collapsed")).toBe(true);
    expect(els[1].classList.contains("is-collapsed")).toBe(false);
    expect((els[2] as HTMLDetailsElement).open).toBe(true);
    expect(clicks()).toBe(0);
  });

  it("never leaves a toggle stuck hidden, even without a snapshot", () => {
    const { els } = mount(callout("q1"));
    setQuizVisible(els[0], false);
    clearQuizVisibility(els);
    expect(els[0].className).not.toContain("ntt-quiz");
  });
});
