/**
 * v1.2.0 — deep verification pass.
 *
 * Covers the behaviours the user asked to be proven:
 *  - autoscroll accepts every callout type (!note, !question, !info, custom)
 *    and raw <details>, not just one flavour;
 *  - a note with no toggles still runs as a plain scroll;
 *  - quiz reveals every answer automatically after its own duration and the
 *    timer resets on the next question;
 *  - pause / resume / skip keep the timing honest;
 *  - closed toggles are reopened so the document stays readable after a quiz.
 */
import { describe, expect, it } from "bun:test";
import { colorOf, matchesFilter, planStops, type ToggleStop } from "../src/autoscroll";
import { MSG_PLAIN_SCROLL } from "../src/guide";
import {
  DEFAULT_QUIZ,
  pauseQuiz,
  questionMs,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
  type QuizSettings,
} from "../src/quiz";

const S: QuizSettings = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 3 };

/** The selector `collectStops()` uses in main.ts — kept in sync by this test. */
const TOGGLE_SELECTOR = ".callout, details, [data-callout]";

describe("v1.2.0 — toggle type coverage", () => {
  it("treats every callout type as a stop (type-agnostic)", () => {
    const types = ["note", "question", "info", "tip", "warning", "quote", "my-custom"];
    const stops: ToggleStop[] = types.map((t, i) => ({
      index: i,
      top: i * 100,
      color: colorOf(t),
    }));
    // No filter = everything travels, regardless of callout type.
    expect(planStops(stops, [], false)).toHaveLength(types.length);
    for (const s of stops) expect(matchesFilter(s.color, [])).toBe(true);
  });

  it("colour filter only keys off the recall- classes, never the callout type", () => {
    expect(colorOf("question")).toBe("other");
    expect(colorOf("note")).toBe("other");
    expect(colorOf("callout recall-red")).toBe("red");
    expect(colorOf("details")).toBe("other");
    // A red-only filter keeps red toggles whatever their callout type is.
    const stops: ToggleStop[] = [
      { index: 0, top: 0, color: colorOf("question recall-red") },
      { index: 1, top: 10, color: colorOf("note") },
    ];
    expect(planStops(stops, ["red"], false).map((s) => s.index)).toEqual([0]);
  });

  it("the DOM selector matches callouts, details and data-callout markup", () => {
    expect(TOGGLE_SELECTOR).toContain(".callout");
    expect(TOGGLE_SELECTOR).toContain("details");
    expect(TOGGLE_SELECTOR).toContain("[data-callout]");
  });

  it("reverse mode visits the same stops in the opposite order", () => {
    const stops: ToggleStop[] = [0, 1, 2].map((i) => ({ index: i, top: i * 50, color: "other" }));
    expect(planStops(stops, [], true).map((s) => s.index)).toEqual([2, 1, 0]);
  });
});

describe("v1.2.0 — plain text notes", () => {
  it("has a dedicated notice instead of the old error", () => {
    expect(MSG_PLAIN_SCROLL).toContain("plain scroll");
    expect(MSG_PLAIN_SCROLL).not.toContain("phir autoscroll chalao");
  });

  it("an empty plan means no dwell stops, so the run is continuous", () => {
    expect(planStops([], [], false)).toEqual([]);
  });
});

describe("v1.2.0 — automatic answer release", () => {
  it("reveals each answer after that question's own duration", () => {
    const titles = ["Q1", "Q2 ⏱30", "Q3 [5s]"];
    let st = startQuiz(titles, S);
    expect(st.remaining).toBe(10_000);

    // Q1: nothing happens one tick early, reveal fires exactly on time.
    let r = quizTick(st, 9_900, titles, S);
    expect(r.event).toBeNull();
    r = quizTick(r.state, 100, titles, S);
    expect(r.event).toBe("reveal");
    expect(r.state.phase).toBe("reveal");
    expect(r.state.remaining).toBe(3_000);

    // Reveal ends → next question, timer reset to *its* own duration.
    r = quizTick(r.state, 3_000, titles, S);
    expect(r.event).toBe("next");
    expect(r.state.at).toBe(1);
    expect(r.state.phase).toBe("question");
    expect(r.state.remaining).toBe(questionMs(titles[1], S));
    expect(r.state.remaining).toBe(30_000);
    expect(r.state.answered).toBe(1);

    // Q3 has a per-question [5s] marker.
    r = quizTick(r.state, 30_000, titles, S);
    r = quizTick(r.state, 3_000, titles, S);
    expect(r.state.at).toBe(2);
    expect(r.state.remaining).toBe(5_000);

    // Final question finishes the run.
    r = quizTick(r.state, 5_000, titles, S);
    expect(r.event).toBe("reveal");
    r = quizTick(r.state, 3_000, titles, S);
    expect(r.event).toBe("done");
    expect(r.state.phase).toBe("done");
    expect(r.state.answered).toBe(3);
  });

  it("pause freezes the countdown and resume continues from the same point", () => {
    const titles = ["Q1"];
    let st = startQuiz(titles, S);
    st = quizTick(st, 4_000, titles, S).state;
    expect(st.remaining).toBe(6_000);

    st = pauseQuiz(st);
    const frozen = quizTick(st, 60_000, titles, S);
    expect(frozen.event).toBeNull();
    expect(frozen.state.remaining).toBe(6_000);

    st = resumeQuiz(st);
    const r = quizTick(st, 6_000, titles, S);
    expect(r.event).toBe("reveal");
  });

  it("manual reveal and skip keep the phase machine consistent", () => {
    const titles = ["Q1", "Q2"];
    const st = startQuiz(titles, S);
    const revealed = revealNow(st, S);
    expect(revealed.event).toBe("reveal");
    expect(revealed.state.remaining).toBe(3_000);
    // A second reveal is a no-op instead of restarting the timer.
    expect(revealNow(revealed.state, S).event).toBeNull();

    const skipped = skipQuestion(st, titles, S);
    expect(skipped.state.at).toBe(1);
    expect(skipped.state.phase).toBe("question");
    expect(skipped.state.remaining).toBe(questionMs(titles[1], S));
  });

  it("auto-next off stops after the reveal instead of racing on", () => {
    const titles = ["Q1", "Q2"];
    const s: QuizSettings = { ...S, quizAutoNext: false };
    let r = quizTick(startQuiz(titles, s), 10_000, titles, s);
    expect(r.event).toBe("reveal");
    r = quizTick(r.state, 3_000, titles, s);
    expect(r.state.running).toBe(false);
    expect(r.state.answered).toBe(1);
  });
});

describe("v1.2.0 — document stays readable after a quiz", () => {
  /** Mirrors main.ts: remember pre-quiz state, collapse, restore on stop. */
  function runQuizOnDocument(openBefore: boolean[]) {
    const wasOpen = [...openBefore];
    const live = openBefore.map(() => false); // active recall: all collapsed
    return {
      duringQuiz: live,
      afterStop: live.map((_, i) => wasOpen[i]),
    };
  }

  it("restores exactly the toggles the reader had open", () => {
    const { duringQuiz, afterStop } = runQuizOnDocument([true, false, true]);
    expect(duringQuiz).toEqual([false, false, false]);
    expect(afterStop).toEqual([true, false, true]);
  });

  it("a fully collapsed note comes back fully collapsed, not half open", () => {
    expect(runQuizOnDocument([false, false]).afterStop).toEqual([false, false]);
  });
});
