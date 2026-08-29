/**
 * v1.2.3 — engine-level deep verification of quiz timing.
 *
 * Drives the pure quiz engine with a fake clock so every phase transition
 * (question -> reveal -> next -> done), every per-question duration format and
 * the auto-next / loop / pause switches are proven, not assumed.
 */
import { describe, expect, it } from "bun:test";
import {
  DEFAULT_QUIZ,
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  advance,
  clampQuizSeconds,
  formatQuizSeconds,
  parseQuestionSeconds,
  pauseQuiz,
  questionMs,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
  type QuizEvent,
  type QuizSettings,
  type QuizState,
} from "../src/quiz";

const S: QuizSettings = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 3 };

/** Run the engine forward in 250ms frames (the real loop interval). */
function run(
  state: QuizState,
  ms: number,
  titles: string[],
  s: QuizSettings
): { state: QuizState; events: QuizEvent[] } {
  const events: QuizEvent[] = [];
  let cur = state;
  for (let t = 0; t < ms; t += 250) {
    const out = quizTick(cur, 250, titles, s);
    cur = out.state;
    if (out.event) events.push(out.event);
  }
  return { state: cur, events };
}

describe("per-question duration parsing", () => {
  it("reads every supported marker in the toggle title", () => {
    expect(parseQuestionSeconds("Q1 ⏱30", 10)).toBe(30);
    expect(parseQuestionSeconds("Q1 ⏱ 45s", 10)).toBe(45);
    expect(parseQuestionSeconds("Q1 ⏲ 25", 10)).toBe(25);
    expect(parseQuestionSeconds("Q1 [30s]", 10)).toBe(30);
    expect(parseQuestionSeconds("Q1 (45 s)", 10)).toBe(45);
    expect(parseQuestionSeconds("Q1 @20s", 10)).toBe(20);
  });

  it("falls back to the setting and clamps out-of-range values", () => {
    expect(parseQuestionSeconds("plain question", 17)).toBe(17);
    expect(parseQuestionSeconds(null, 17)).toBe(17);
    expect(parseQuestionSeconds("⏱1", 20)).toBe(QUIZ_SECONDS_MIN);
    expect(parseQuestionSeconds("⏱999", 20)).toBe(999);
    expect(parseQuestionSeconds("⏱99999", 20)).toBe(QUIZ_SECONDS_MAX);
    expect(clampQuizSeconds(Number.NaN)).toBe(DEFAULT_QUIZ.quizSeconds);
  });

  it("questionMs honours the per-question override over the global setting", () => {
    expect(questionMs("Answer this ⏱30", S)).toBe(30_000);
    expect(questionMs("Answer this", S)).toBe(10_000);
  });
});

describe("full quiz timeline (fake clock)", () => {
  const titles = ["Q1", "Q2 ⏱5", "Q3"];

  it("reveals each answer exactly when its own time is up, then moves on", () => {
    let st = startQuiz(titles, S);
    expect(st.remaining).toBe(10_000);

    // Q1: 10s question -> reveal
    let out = run(st, 10_000, titles, S);
    expect(out.events).toEqual(["reveal"]);
    expect(out.state.phase).toBe("reveal");
    expect(out.state.remaining).toBe(3_000);

    // reveal 3s -> next question, timer resets to Q2's own 5s
    out = run(out.state, 3_000, titles, S);
    expect(out.events).toEqual(["next"]);
    expect(out.state.at).toBe(1);
    expect(out.state.remaining).toBe(5_000);
    expect(out.state.answered).toBe(1);

    // Q2 (5s) -> reveal -> next
    out = run(out.state, 5_000 + 3_000, titles, S);
    expect(out.events).toEqual(["reveal", "next"]);
    expect(out.state.at).toBe(2);
    expect(out.state.remaining).toBe(10_000);

    // Q3 -> reveal -> done (no loop)
    out = run(out.state, 10_000 + 3_000, titles, S);
    expect(out.events).toEqual(["reveal", "done"]);
    expect(out.state.phase).toBe("done");
    expect(out.state.answered).toBe(3);
    expect(out.state.running).toBe(false);
    st = out.state;
    expect(st.elapsedMs).toBeGreaterThan(0);
  });

  it("stops after the reveal when auto-next is off", () => {
    const s = { ...S, quizAutoNext: false };
    const out = run(startQuiz(titles, s), 10_000 + 3_000, titles, s);
    expect(out.state.running).toBe(false);
    expect(out.state.at).toBe(0);
    expect(out.state.answered).toBe(1);
    // A manual next resumes from the same place.
    const next = advance(out.state, titles, s);
    expect(next.state.at).toBe(1);
    expect(next.state.running).toBe(true);
  });

  it("loops back to question 1 with the right duration", () => {
    const s = { ...S, quizLoop: true };
    let out = run(startQuiz(titles, s), 13_000 + 8_000 + 13_000, titles, s);
    expect(out.state.phase).not.toBe("done");
    expect(out.state.at).toBe(0);
    expect(out.state.remaining).toBe(10_000);
    expect(out.state.answered).toBe(3);
    out = run(out.state, 10_000, titles, s);
    expect(out.events).toEqual(["reveal"]);
  });
});

describe("manual controls", () => {
  const titles = ["Q1", "Q2"];

  it("pause freezes the countdown, resume continues from the same value", () => {
    let st = startQuiz(titles, S);
    st = run(st, 4_000, titles, S).state;
    const frozen = st.remaining;
    st = pauseQuiz(st);
    st = run(st, 5_000, titles, S).state;
    expect(st.remaining).toBe(frozen);
    st = resumeQuiz(st);
    st = run(st, 1_000, titles, S).state;
    expect(st.remaining).toBe(frozen - 1_000);
  });

  it("reveal-now jumps to the answer phase with the reveal duration", () => {
    const { state, event } = revealNow(startQuiz(titles, S), S);
    expect(event).toBe("reveal");
    expect(state.phase).toBe("reveal");
    expect(state.remaining).toBe(3_000);
    // A second reveal-now is a no-op.
    expect(revealNow(state, S).event).toBeNull();
  });

  it("skip counts the question and advances / finishes", () => {
    const first = skipQuestion(startQuiz(titles, S), titles, S);
    expect(first.event).toBe("next");
    expect(first.state.at).toBe(1);
    expect(first.state.answered).toBe(1);
    const second = skipQuestion(first.state, titles, S);
    expect(second.event).toBe("done");
    expect(second.state.phase).toBe("done");
  });
});

describe("v1.4.0 — quiz time range 1s–12h", () => {
  it("accepts minute and hour suffixes in toggle titles", () => {
    expect(parseQuestionSeconds("Q1 ⏱15m", 10)).toBe(900);
    expect(parseQuestionSeconds("Q1 ⏱2h", 10)).toBe(7200);
    expect(parseQuestionSeconds("Q1 [5m]", 10)).toBe(300);
    expect(parseQuestionSeconds("Q1 (1 h)", 10)).toBe(3600);
    expect(parseQuestionSeconds("Q1 @30m", 10)).toBe(1800);
  });

  it("clamps to the 1s–12h bounds", () => {
    expect(clampQuizSeconds(0)).toBe(QUIZ_SECONDS_MIN);
    expect(clampQuizSeconds(1)).toBe(1);
    expect(clampQuizSeconds(43200)).toBe(43200);
    expect(clampQuizSeconds(999999)).toBe(QUIZ_SECONDS_MAX);
    expect(parseQuestionSeconds("⏱48h", 20)).toBe(QUIZ_SECONDS_MAX);
  });

  it("does not eat the first letter of the next word as a unit", () => {
    // "30 seconds" must stay 30s, and "15 minutes" must NOT become 15m.
    expect(parseQuestionSeconds("⏱30 seconds", 10)).toBe(30);
    expect(parseQuestionSeconds("⏱15 minutes", 10)).toBe(15);
    expect(parseQuestionSeconds("⏱15m", 10)).toBe(900);
  });

  it("formats durations across units", () => {
    expect(formatQuizSeconds(1)).toBe("1s");
    expect(formatQuizSeconds(45)).toBe("45s");
    expect(formatQuizSeconds(60)).toBe("1m");
    expect(formatQuizSeconds(900)).toBe("15m");
    expect(formatQuizSeconds(3600)).toBe("1h");
    expect(formatQuizSeconds(9000)).toBe("2h 30m");
    expect(formatQuizSeconds(43200)).toBe("12h");
  });

  it("questionMs honours hour-long per-question overrides", () => {
    expect(questionMs("Essay ⏱1h", { ...DEFAULT_QUIZ, quizSeconds: 30 })).toBe(3600_000);
  });
});
