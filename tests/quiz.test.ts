import { describe, expect, it } from "bun:test";
import {
  DEFAULT_QUIZ,
  advance,
  clampQuizSeconds,
  clampRevealSeconds,
  formatQuizTime,
  parseQuestionSeconds,
  pauseQuiz,
  questionMs,
  quizPhaseLabel,
  quizProgressLabel,
  quizProgressRatio,
  quizStartLabel,
  quizSummary,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
  type QuizSettings,
} from "../src/quiz";

const S: QuizSettings = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 3 };
const titles = ["Q1. What is a cell?", "Q2. Photosynthesis ⏱30", "Q3. Mitosis [5s]"];

describe("clamps", () => {
  it("clamps question seconds into range", () => {
    expect(clampQuizSeconds(1)).toBe(3);
    expect(clampQuizSeconds(9999)).toBe(600);
    expect(clampQuizSeconds(Number.NaN)).toBe(DEFAULT_QUIZ.quizSeconds);
    expect(clampQuizSeconds(20.4)).toBe(20);
  });

  it("clamps reveal seconds", () => {
    expect(clampRevealSeconds(0)).toBe(1);
    expect(clampRevealSeconds(500)).toBe(120);
    expect(clampRevealSeconds(Number.NaN)).toBe(DEFAULT_QUIZ.quizRevealSeconds);
  });
});

describe("parseQuestionSeconds", () => {
  it("reads the ⏱ marker", () => {
    expect(parseQuestionSeconds("Q2. Photosynthesis ⏱30", 20)).toBe(30);
    expect(parseQuestionSeconds("⏱ 45s Long answer", 20)).toBe(45);
  });

  it("reads bracket / paren / @ markers", () => {
    expect(parseQuestionSeconds("Q3. Mitosis [5s]", 20)).toBe(5);
    expect(parseQuestionSeconds("Q4. Osmosis (60 s)", 20)).toBe(60);
    expect(parseQuestionSeconds("Q5. Enzymes @15s", 20)).toBe(15);
  });

  it("falls back to the default and clamps it", () => {
    expect(parseQuestionSeconds("Plain question", 25)).toBe(25);
    expect(parseQuestionSeconds(null, 1)).toBe(3);
    expect(parseQuestionSeconds(undefined, Number.NaN)).toBe(DEFAULT_QUIZ.quizSeconds);
  });

  it("questionMs converts to milliseconds", () => {
    expect(questionMs(titles[1], S)).toBe(30_000);
    expect(questionMs(titles[0], S)).toBe(10_000);
  });
});

describe("startQuiz", () => {
  it("starts on the first question", () => {
    const st = startQuiz(titles, S);
    expect(st.at).toBe(0);
    expect(st.phase).toBe("question");
    expect(st.remaining).toBe(10_000);
    expect(st.total).toBe(3);
    expect(st.running).toBe(true);
  });

  it("is immediately done with no questions", () => {
    const st = startQuiz([], S);
    expect(st.phase).toBe("done");
    expect(st.running).toBe(false);
  });
});

describe("quizTick", () => {
  it("counts down without an event", () => {
    const r = quizTick(startQuiz(titles, S), 4000, titles, S);
    expect(r.event).toBeNull();
    expect(r.state.remaining).toBe(6000);
    expect(r.state.elapsedMs).toBe(4000);
  });

  it("reveals the answer when the question time is up", () => {
    const r = quizTick(startQuiz(titles, S), 10_000, titles, S);
    expect(r.event).toBe("reveal");
    expect(r.state.phase).toBe("reveal");
    expect(r.state.remaining).toBe(3000);
  });

  it("moves to the next question after the reveal", () => {
    let st = quizTick(startQuiz(titles, S), 10_000, titles, S).state;
    const r = quizTick(st, 3000, titles, S);
    expect(r.event).toBe("next");
    expect(r.state.at).toBe(1);
    expect(r.state.phase).toBe("question");
    expect(r.state.answered).toBe(1);
    // per-question override from the title
    expect(r.state.remaining).toBe(30_000);
  });

  it("stops after the reveal when auto-next is off", () => {
    const s = { ...S, quizAutoNext: false };
    const st = quizTick(startQuiz(titles, s), 10_000, titles, s).state;
    const r = quizTick(st, 3000, titles, s);
    expect(r.state.running).toBe(false);
    expect(r.state.at).toBe(0);
    expect(r.state.answered).toBe(1);
  });

  it("finishes after the last question", () => {
    let st = startQuiz([titles[0]], S);
    st = quizTick(st, 10_000, titles, S).state;
    const r = quizTick(st, 3000, titles, S);
    expect(r.event).toBe("done");
    expect(r.state.phase).toBe("done");
    expect(r.state.running).toBe(false);
    expect(r.state.answered).toBe(1);
  });

  it("loops back to the first question when looping is on", () => {
    const s = { ...S, quizLoop: true };
    let st = startQuiz([titles[0]], s);
    st = quizTick(st, 10_000, titles, s).state;
    const r = quizTick(st, 3000, titles, s);
    expect(r.event).toBe("next");
    expect(r.state.at).toBe(0);
    expect(r.state.phase).toBe("question");
  });

  it("ignores ticks while paused or done", () => {
    const st = pauseQuiz(startQuiz(titles, S));
    expect(quizTick(st, 5000, titles, S).state.remaining).toBe(10_000);
    const done = { ...startQuiz(titles, S), phase: "done" as const };
    expect(quizTick(done, 5000, titles, S).event).toBeNull();
  });
});

describe("manual controls", () => {
  it("reveals now only from the question phase", () => {
    const r = revealNow(startQuiz(titles, S), S);
    expect(r.event).toBe("reveal");
    expect(r.state.remaining).toBe(3000);
    expect(revealNow(r.state, S).event).toBeNull();
  });

  it("skips to the next question and counts it", () => {
    const r = skipQuestion(startQuiz(titles, S), titles, S);
    expect(r.event).toBe("next");
    expect(r.state.at).toBe(1);
    expect(r.state.answered).toBe(1);
  });

  it("advance ends the quiz on the last item", () => {
    const st = { ...startQuiz(titles, S), at: 2 };
    expect(advance(st, titles, S).state.phase).toBe("done");
  });

  it("pause and resume flip running", () => {
    const st = startQuiz(titles, S);
    expect(pauseQuiz(st).running).toBe(false);
    expect(resumeQuiz(pauseQuiz(st)).running).toBe(true);
    const done = { ...st, phase: "done" as const, running: false };
    expect(resumeQuiz(done).running).toBe(false);
  });
});

describe("labels", () => {
  it("formats the countdown", () => {
    expect(formatQuizTime(20_000)).toBe("00:20");
    expect(formatQuizTime(95_000)).toBe("01:35");
    expect(formatQuizTime(-5)).toBe("00:00");
  });

  it("shows progress and phase", () => {
    const st = startQuiz(titles, S);
    expect(quizProgressLabel(st)).toBe("Q 1/3");
    expect(quizPhaseLabel(st)).toBe("Question");
    expect(quizPhaseLabel(pauseQuiz(st))).toBe("Paused");
    expect(quizPhaseLabel({ ...st, phase: "reveal" })).toBe("Answer");
    expect(quizProgressLabel({ ...st, phase: "done" })).toBe("Q 3/3");
    expect(quizProgressLabel(startQuiz([], S))).toBe("Q 0/0");
  });

  it("reports ratio and summary", () => {
    const st = { ...startQuiz(titles, S), answered: 3, elapsedMs: 120_000 };
    expect(quizProgressRatio(st)).toBe(1);
    expect(quizProgressRatio(startQuiz([], S))).toBe(0);
    expect(quizSummary(st)).toBe("Quiz finished — 3 questions · 2m");
    expect(quizStartLabel(3, S)).toContain("3 questions");
  });
});
