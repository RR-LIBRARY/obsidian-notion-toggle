/**
 * v1.1.0 — Quiz mode engine (pure module, no Obsidian / DOM imports).
 *
 * Telegram-quiz style run through the toggles of a note:
 *  question phase → countdown → answer auto-reveals → short reveal phase →
 *  toggle closes → next question. Per-question time can be written in the
 *  toggle title ("⏱30", "[30s]", "(30s)").
 */

export interface QuizSettings {
  /** Default seconds a question stays hidden. */
  quizSeconds: number;
  /** Seconds the revealed answer stays open. */
  quizRevealSeconds: number;
  /** Move to the next question automatically after the reveal. */
  quizAutoNext: boolean;
  /** Close the toggle again before moving on. */
  quizCloseAfterReveal: boolean;
  /** Reuse the autoscroll colour filter (🔴 / 🟡 / 🟢). */
  quizUseColorFilter: boolean;
  /** Start again from the first question when the note ends. */
  quizLoop: boolean;
  /** Small notice / sound when the time is up. */
  quizBeepOnTimeUp: boolean;
}

export const DEFAULT_QUIZ: QuizSettings = {
  quizSeconds: 20,
  quizRevealSeconds: 5,
  quizAutoNext: true,
  quizCloseAfterReveal: true,
  quizUseColorFilter: true,
  quizLoop: false,
  quizBeepOnTimeUp: true,
};

export const QUIZ_SECONDS_MIN = 3;
export const QUIZ_SECONDS_MAX = 600;
export const QUIZ_PRESETS = [10, 15, 20, 30, 45, 60, 90];

export function clampQuizSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_QUIZ.quizSeconds;
  return Math.min(QUIZ_SECONDS_MAX, Math.max(QUIZ_SECONDS_MIN, Math.round(seconds)));
}

export function clampRevealSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return DEFAULT_QUIZ.quizRevealSeconds;
  return Math.min(120, Math.max(1, Math.round(seconds)));
}

/**
 * Per-question override written in the toggle title.
 * Supported: "⏱30", "⏱ 30s", "[30s]", "(45 s)", "@20s".
 */
export function parseQuestionSeconds(
  title: string | null | undefined,
  fallback: number
): number {
  const text = title ?? "";
  const patterns = [
    /⏱\s*(\d{1,3})\s*s?/i,
    /⏲\s*(\d{1,3})\s*s?/i,
    /\[\s*(\d{1,3})\s*s\s*\]/i,
    /\(\s*(\d{1,3})\s*s\s*\)/i,
    /@\s*(\d{1,3})\s*s/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return clampQuizSeconds(Number(m[1]));
  }
  return clampQuizSeconds(fallback);
}

/** Seconds for question `title`, in milliseconds. */
export function questionMs(title: string | undefined, s: QuizSettings): number {
  return parseQuestionSeconds(title, s.quizSeconds) * 1000;
}

export type QuizPhase = "question" | "reveal" | "done";
export type QuizEvent = "reveal" | "next" | "done" | null;

export interface QuizState {
  /** Index into the planned question list. */
  at: number;
  phase: QuizPhase;
  /** Milliseconds left in the current phase. */
  remaining: number;
  total: number;
  /** Questions completed (reveal finished). */
  answered: number;
  running: boolean;
  /** Total elapsed milliseconds in this quiz. */
  elapsedMs: number;
}

export function startQuiz(titles: string[], s: QuizSettings): QuizState {
  return {
    at: 0,
    phase: titles.length ? "question" : "done",
    remaining: titles.length ? questionMs(titles[0], s) : 0,
    total: titles.length,
    answered: 0,
    running: titles.length > 0,
    elapsedMs: 0,
  };
}

export interface QuizTickResult {
  state: QuizState;
  event: QuizEvent;
}

/** Advance the quiz by `elapsed` milliseconds. */
export function quizTick(
  state: QuizState,
  elapsed: number,
  titles: string[],
  s: QuizSettings
): QuizTickResult {
  if (state.phase === "done" || !state.running || elapsed <= 0) {
    return { state, event: null };
  }
  const elapsedMs = state.elapsedMs + elapsed;
  const remaining = state.remaining - elapsed;
  if (remaining > 0) {
    return { state: { ...state, remaining, elapsedMs }, event: null };
  }

  if (state.phase === "question") {
    return {
      state: {
        ...state,
        phase: "reveal",
        remaining: clampRevealSeconds(s.quizRevealSeconds) * 1000,
        elapsedMs,
      },
      event: "reveal",
    };
  }

  // Reveal finished.
  const answered = state.answered + 1;
  if (!s.quizAutoNext) {
    return {
      state: { ...state, remaining: 0, running: false, answered, elapsedMs },
      event: null,
    };
  }
  return { ...advance({ ...state, answered, elapsedMs }, titles, s) };
}

/** Move to the next question (also used by the "skip" button). */
export function advance(state: QuizState, titles: string[], s: QuizSettings): QuizTickResult {
  const nextAt = state.at + 1;
  if (nextAt >= state.total) {
    if (s.quizLoop && state.total > 0) {
      return {
        state: {
          ...state,
          at: 0,
          phase: "question",
          remaining: questionMs(titles[0], s),
          running: true,
        },
        event: "next",
      };
    }
    return {
      state: { ...state, phase: "done", remaining: 0, running: false },
      event: "done",
    };
  }
  return {
    state: {
      ...state,
      at: nextAt,
      phase: "question",
      remaining: questionMs(titles[nextAt], s),
      running: true,
    },
    event: "next",
  };
}

/** "Reveal now" button: jump straight to the reveal phase. */
export function revealNow(state: QuizState, s: QuizSettings): QuizTickResult {
  if (state.phase !== "question") return { state, event: null };
  return {
    state: {
      ...state,
      phase: "reveal",
      remaining: clampRevealSeconds(s.quizRevealSeconds) * 1000,
      running: true,
    },
    event: "reveal",
  };
}

/** "Next" button: count the current question and move on. */
export function skipQuestion(
  state: QuizState,
  titles: string[],
  s: QuizSettings
): QuizTickResult {
  if (state.phase === "done") return { state, event: null };
  return advance({ ...state, answered: state.answered + 1 }, titles, s);
}

export function pauseQuiz(state: QuizState): QuizState {
  return state.phase === "done" ? state : { ...state, running: false };
}

export function resumeQuiz(state: QuizState): QuizState {
  return state.phase === "done" ? state : { ...state, running: true };
}

export function formatQuizTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function quizProgressLabel(state: QuizState): string {
  if (state.total === 0) return "Q 0/0";
  const shown = state.phase === "done" ? state.total : Math.min(state.at + 1, state.total);
  return `Q ${shown}/${state.total}`;
}

export function quizPhaseLabel(state: QuizState): string {
  if (state.phase === "done") return "Finished";
  if (state.phase === "reveal") return "Answer";
  return state.running ? "Question" : "Paused";
}

/** 0..1 progress through the whole quiz, for the HUD bar. */
export function quizProgressRatio(state: QuizState): number {
  if (state.total === 0) return 0;
  return Math.min(1, Math.max(0, state.answered / state.total));
}

/**
 * v1.3.0 — 0..1 of the *current phase* still to run, for the inline ring on
 * the question (Telegram's shrinking `0:07 ⟳` circle).
 */
export function quizPhaseRatio(
  state: QuizState,
  titles: string[],
  s: QuizSettings
): number {
  if (state.phase === "done") return 0;
  const total =
    state.phase === "reveal"
      ? clampRevealSeconds(s.quizRevealSeconds) * 1000
      : questionMs(titles[state.at], s);
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, state.remaining / total));
}

export function quizSummary(state: QuizState): string {
  const minutes = Math.round(state.elapsedMs / 60000);
  const q = state.answered;
  return `Quiz finished — ${q} question${q === 1 ? "" : "s"} · ${minutes}m`;
}

export function quizStartLabel(count: number, s: QuizSettings): string {
  return `Quiz started — ${count} question${count === 1 ? "" : "s"} · ${clampQuizSeconds(
    s.quizSeconds
  )}s each · reveal ${clampRevealSeconds(s.quizRevealSeconds)}s`;
}
