/**
 * v1.3.0 — inline quiz ring: geometry, formatting and mount target.
 */
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import {
  QuizRing,
  RING_CIRCUMFERENCE,
  clampRatio,
  formatRingTime,
  ringOffset,
  titleRowOf,
} from "../src/quiz-badge";
import { DEFAULT_QUIZ, quizPhaseRatio, startQuiz, quizTick } from "../src/quiz";

const doc = () => new Window().document as unknown as Document;

describe("ring geometry", () => {
  it("full ring when all the time is left, empty when it is up", () => {
    expect(ringOffset(1)).toBeCloseTo(0, 6);
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE, 6);
    expect(ringOffset(0.5)).toBeCloseTo(RING_CIRCUMFERENCE / 2, 6);
  });

  it("survives NaN and out-of-range input", () => {
    expect(clampRatio(Number.NaN)).toBe(0);
    expect(clampRatio(4)).toBe(1);
    expect(clampRatio(-2)).toBe(0);
    expect(ringOffset(Number.NaN)).toBeCloseTo(RING_CIRCUMFERENCE, 6);
  });
});

describe("Telegram-style m:ss", () => {
  it("formats like the reference video", () => {
    expect(formatRingTime(7000)).toBe("0:07");
    expect(formatRingTime(65_000)).toBe("1:05");
    expect(formatRingTime(0)).toBe("0:00");
    expect(formatRingTime(-500)).toBe("0:00");
    expect(formatRingTime(Number.NaN)).toBe("0:00");
  });
});

describe("phase ratio drives the ring, not overall progress", () => {
  const titles = ["Q1", "Q2"];
  const s = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 4 };

  it("shrinks from 1 to 0 across the question, then restarts for the answer", () => {
    let st = startQuiz(titles, s);
    expect(quizPhaseRatio(st, titles, s)).toBeCloseTo(1, 5);
    st = quizTick(st, 5_000, titles, s).state;
    expect(quizPhaseRatio(st, titles, s)).toBeCloseTo(0.5, 5);
    st = quizTick(st, 5_000, titles, s).state; // -> reveal
    expect(st.phase).toBe("reveal");
    expect(quizPhaseRatio(st, titles, s)).toBeCloseTo(1, 5);
    st = quizTick(st, 2_000, titles, s).state;
    expect(quizPhaseRatio(st, titles, s)).toBeCloseTo(0.5, 5);
  });

  it("honours a per-question ⏱ override", () => {
    const t = ["Q1 ⏱20"];
    const st = startQuiz(t, s);
    expect(quizPhaseRatio(quizTick(st, 10_000, t, s).state, t, s)).toBeCloseTo(0.5, 5);
  });
});

describe("badge mounting", () => {
  it("rides on the callout title row, not on the note body", () => {
    const d = doc();
    d.body.innerHTML = `<div class="callout" data-callout="recall-red"><div class="callout-title"><div class="callout-title-inner">Q1</div></div><div class="callout-content">a</div></div>`;
    const el = d.body.firstElementChild as HTMLElement;
    const ring = new QuizRing(d);
    ring.mount(el);
    expect(titleRowOf(el).classList.contains("callout-title")).toBe(true);
    expect(el.querySelector(".callout-title .ntt-quiz-ring")).toBeTruthy();
    // mounting twice does not duplicate it
    ring.mount(el);
    expect(el.querySelectorAll(".ntt-quiz-ring")).toHaveLength(1);
    ring.destroy();
    expect(el.querySelector(".ntt-quiz-ring")).toBeNull();
  });

  it("uses <summary> for details toggles", () => {
    const d = doc();
    d.body.innerHTML = `<details><summary>Q1</summary>a</details>`;
    const el = d.body.firstElementChild as HTMLElement;
    expect(titleRowOf(el).tagName.toLowerCase()).toBe("summary");
  });

  it("renders time, arc and an accessible label", () => {
    const d = doc();
    const ring = new QuizRing(d);
    ring.render({ remaining: 7_000, ratio: 0.5, phase: "question", running: true, index: 2, total: 8 });
    expect(ring.root.textContent).toContain("0:07");
    expect(ring.root.getAttribute("aria-label")).toBe(
      "Question 2 of 8, question, 0:07 left"
    );
    const arc = ring.root.querySelector(".ntt-quiz-ring-arc") as SVGCircleElement;
    expect(Number(arc.getAttribute("stroke-dashoffset"))).toBeCloseTo(RING_CIRCUMFERENCE / 2, 5);
    ring.render({ remaining: 1_000, ratio: 1, phase: "reveal", running: false, index: 2, total: 8 });
    expect(ring.root.classList.contains("is-reveal")).toBe(true);
    expect(ring.root.classList.contains("is-paused")).toBe(true);
  });
});
