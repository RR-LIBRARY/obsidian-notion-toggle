/**
 * Pomodoro / recall timer — pure state machine.
 * No Obsidian imports here, so it is fully unit-testable.
 */

export type TimerPhase = "focus" | "short" | "long";

export interface PomodoroSettings {
  /** Preset id: classic | deep | quick | custom */
  preset: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  /** Focus sessions completed before a long break. */
  sessionsBeforeLongBreak: number;
  autoStartNext: boolean;
  notifyOnPhaseEnd: boolean;
  soundOnPhaseEnd: boolean;
  showOnStartup: boolean;
  compactByDefault: boolean;
  /** Last widget position, in px from the top-left of the window. */
  timerX: number;
  timerY: number;
}

export const DEFAULT_POMODORO: PomodoroSettings = {
  preset: "classic",
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNext: true,
  notifyOnPhaseEnd: true,
  soundOnPhaseEnd: true,
  showOnStartup: false,
  compactByDefault: false,
  timerX: 24,
  timerY: 120,
};

export interface PomodoroPreset {
  id: string;
  label: string;
  focus: number;
  short: number;
  long: number;
  sessions: number;
}

export const POMODORO_PRESETS: PomodoroPreset[] = [
  { id: "classic", label: "Classic 25 / 5", focus: 25, short: 5, long: 15, sessions: 4 },
  { id: "deep", label: "Deep work 50 / 10", focus: 50, short: 10, long: 25, sessions: 3 },
  { id: "quick", label: "Quick recall 15 / 3", focus: 15, short: 3, long: 10, sessions: 4 },
  { id: "custom", label: "Custom (fields below)", focus: 25, short: 5, long: 15, sessions: 4 },
];

/** Apply a preset over settings. "custom" keeps the user's own numbers. */
export function resolvePreset(settings: PomodoroSettings, presetId: string): PomodoroSettings {
  const preset = POMODORO_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === "custom") return { ...settings, preset: presetId };
  return {
    ...settings,
    preset: preset.id,
    focusMinutes: preset.focus,
    shortBreakMinutes: preset.short,
    longBreakMinutes: preset.long,
    sessionsBeforeLongBreak: preset.sessions,
  };
}

export function clampMinutes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(180, Math.round(value)));
}

/** Duration (ms) of a phase for the given settings. */
export function phaseDuration(phase: TimerPhase, s: PomodoroSettings): number {
  const minutes =
    phase === "focus"
      ? clampMinutes(s.focusMinutes, 25)
      : phase === "short"
        ? clampMinutes(s.shortBreakMinutes, 5)
        : clampMinutes(s.longBreakMinutes, 15);
  return minutes * 60_000;
}

export function phaseLabel(phase: TimerPhase): string {
  return phase === "focus" ? "Focus" : phase === "short" ? "Short break" : "Long break";
}

export interface PomodoroState {
  phase: TimerPhase;
  /** Milliseconds left in the current phase. */
  remaining: number;
  running: boolean;
  /** Focus sessions completed in this cycle (0 .. sessionsBeforeLongBreak). */
  completedInCycle: number;
  /** Focus sessions completed overall (for the status bar). */
  totalFocusSessions: number;
  /** Total focused minutes overall. */
  totalFocusMinutes: number;
}

export function createState(s: PomodoroSettings): PomodoroState {
  return {
    phase: "focus",
    remaining: phaseDuration("focus", s),
    running: false,
    completedInCycle: 0,
    totalFocusSessions: 0,
    totalFocusMinutes: 0,
  };
}

/** mm:ss (or h:mm:ss above an hour). Never negative. */
export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export interface TickResult {
  state: PomodoroState;
  /** True when the phase just ended during this tick. */
  phaseEnded: boolean;
  /** Phase that ended (only when phaseEnded). */
  endedPhase?: TimerPhase;
}

/** Advance the timer by `elapsed` ms. Ending a phase moves to the next one. */
export function tick(state: PomodoroState, elapsed: number, s: PomodoroSettings): TickResult {
  if (!state.running || elapsed <= 0) return { state, phaseEnded: false };
  const remaining = state.remaining - elapsed;
  if (remaining > 0) return { state: { ...state, remaining }, phaseEnded: false };
  const endedPhase = state.phase;
  const next = nextPhase(state, s);
  return { state: next, phaseEnded: true, endedPhase };
}

/**
 * Move to the next phase. Focus -> short break, or long break every
 * `sessionsBeforeLongBreak` sessions; any break -> focus.
 */
export function nextPhase(state: PomodoroState, s: PomodoroSettings): PomodoroState {
  const cycleSize = Math.max(1, Math.min(8, Math.round(s.sessionsBeforeLongBreak || 4)));

  if (state.phase === "focus") {
    const completed = state.completedInCycle + 1;
    const goLong = completed >= cycleSize;
    const phase: TimerPhase = goLong ? "long" : "short";
    return {
      phase,
      remaining: phaseDuration(phase, s),
      running: s.autoStartNext,
      completedInCycle: goLong ? 0 : completed,
      totalFocusSessions: state.totalFocusSessions + 1,
      totalFocusMinutes: state.totalFocusMinutes + clampMinutes(s.focusMinutes, 25),
    };
  }

  return {
    ...state,
    phase: "focus",
    remaining: phaseDuration("focus", s),
    running: s.autoStartNext,
  };
}

/** Restart the current phase from full duration, paused. */
export function resetPhase(state: PomodoroState, s: PomodoroSettings): PomodoroState {
  return { ...state, remaining: phaseDuration(state.phase, s), running: false };
}

/** Skip straight to the next phase (counts as a completed focus session). */
export function skipPhase(state: PomodoroState, s: PomodoroSettings): PomodoroState {
  return nextPhase(state, s);
}

export function sessionSummary(state: PomodoroState): string {
  return `⌛ ${state.totalFocusSessions} sessions · ${state.totalFocusMinutes}m`;
}

/* ---------- Recall intelligence (pure text scans) ---------- */

export interface RecallStats {
  total: number;
  red: number;
  yellow: number;
  green: number;
  /** 0-based line index of the first red toggle, or -1. */
  firstRedLine: number;
}

const HEADER_ANY = /^>\s*\[!([^\]]+)\][+-]/;

/** Count toggles per recall colour in a note. */
export function scanRecallStats(doc: string): RecallStats {
  const stats: RecallStats = { total: 0, red: 0, yellow: 0, green: 0, firstRedLine: -1 };
  const lines = doc.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(HEADER_ANY);
    if (!m) {
      if (/<summary>/.test(line)) stats.total += 1;
      return;
    }
    stats.total += 1;
    const type = m[1].toLowerCase();
    if (type === "recall-red") {
      stats.red += 1;
      if (stats.firstRedLine < 0) stats.firstRedLine = i;
    } else if (type === "recall-yellow") stats.yellow += 1;
    else if (type === "recall-green") stats.green += 1;
  });
  return stats;
}

/** Collapse every callout toggle in the note (answers hidden) for active recall. */
export function collapseAllToggles(doc: string): string {
  return doc
    .split("\n")
    .map((line) =>
      HEADER_ANY.test(line)
        ? line.replace(/^(>\s*\[![^\]]+\])\+/, "$1-")
        : line.replace(/^(\s*)<details\s+open>/, "$1<details>")
    )
    .join("\n");
}
