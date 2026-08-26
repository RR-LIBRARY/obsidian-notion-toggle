import { describe, expect, test } from "bun:test";
import {
  DEFAULT_POMODORO,
  POMODORO_PRESETS,
  clampMinutes,
  collapseAllToggles,
  createState,
  formatTime,
  nextPhase,
  phaseDuration,
  phaseLabel,
  resetPhase,
  resolvePreset,
  scanRecallStats,
  sessionSummary,
  skipPhase,
  tick,
} from "../src/timer";

const s = { ...DEFAULT_POMODORO };

describe("v1.0.5 — formatting", () => {
  test("mm:ss", () => {
    expect(formatTime(25 * 60_000)).toBe("25:00");
    expect(formatTime(61_000)).toBe("01:01");
  });

  test("negative time never shows a minus", () => {
    expect(formatTime(-5000)).toBe("00:00");
  });

  test("hours are shown above 60 minutes", () => {
    expect(formatTime(90 * 60_000)).toBe("1:30:00");
  });

  test("phase labels", () => {
    expect(phaseLabel("focus")).toBe("Focus");
    expect(phaseLabel("short")).toBe("Short break");
    expect(phaseLabel("long")).toBe("Long break");
  });
});

describe("v1.0.5 — presets", () => {
  test("classic / deep / quick / custom exist", () => {
    expect(POMODORO_PRESETS.map((p) => p.id)).toEqual(["classic", "deep", "quick", "custom"]);
  });

  test("deep preset applies its minutes", () => {
    const out = resolvePreset(s, "deep");
    expect(out.focusMinutes).toBe(50);
    expect(out.shortBreakMinutes).toBe(10);
  });

  test("custom keeps the user's own numbers", () => {
    const mine = { ...s, focusMinutes: 37 };
    expect(resolvePreset(mine, "custom").focusMinutes).toBe(37);
  });

  test("minutes are clamped to a sane range", () => {
    expect(clampMinutes(0, 25)).toBe(1);
    expect(clampMinutes(9999, 25)).toBe(180);
    expect(clampMinutes(Number.NaN, 25)).toBe(25);
  });

  test("phase duration follows the settings", () => {
    expect(phaseDuration("focus", s)).toBe(25 * 60_000);
    expect(phaseDuration("long", s)).toBe(15 * 60_000);
  });
});

describe("v1.0.5 — state machine", () => {
  test("fresh state is a paused focus phase", () => {
    const st = createState(s);
    expect(st.phase).toBe("focus");
    expect(st.running).toBe(false);
    expect(st.remaining).toBe(25 * 60_000);
  });

  test("tick does nothing while paused", () => {
    const st = createState(s);
    expect(tick(st, 5000, s).state.remaining).toBe(st.remaining);
  });

  test("tick counts down while running", () => {
    const st = { ...createState(s), running: true };
    const out = tick(st, 1000, s);
    expect(out.state.remaining).toBe(25 * 60_000 - 1000);
    expect(out.phaseEnded).toBe(false);
  });

  test("phase end flips to a short break and logs the session", () => {
    const st = { ...createState(s), running: true, remaining: 500 };
    const out = tick(st, 1000, s);
    expect(out.phaseEnded).toBe(true);
    expect(out.endedPhase).toBe("focus");
    expect(out.state.phase).toBe("short");
    expect(out.state.totalFocusSessions).toBe(1);
    expect(out.state.totalFocusMinutes).toBe(25);
  });

  test("long break arrives after a full cycle", () => {
    let st = createState(s);
    for (let i = 0; i < 3; i++) {
      st = nextPhase(st, s); // focus -> short
      st = nextPhase(st, s); // short -> focus
    }
    st = nextPhase(st, s); // 4th focus -> long
    expect(st.phase).toBe("long");
    expect(st.completedInCycle).toBe(0);
    expect(st.totalFocusSessions).toBe(4);
  });

  test("auto-start off leaves the next phase paused", () => {
    const paused = { ...s, autoStartNext: false };
    expect(nextPhase(createState(paused), paused).running).toBe(false);
  });

  test("break -> focus does not add focus minutes", () => {
    const st = { ...createState(s), phase: "short" as const };
    const out = nextPhase(st, s);
    expect(out.phase).toBe("focus");
    expect(out.totalFocusMinutes).toBe(0);
  });

  test("reset restores the full phase, paused", () => {
    const st = { ...createState(s), remaining: 1000, running: true };
    const out = resetPhase(st, s);
    expect(out.remaining).toBe(25 * 60_000);
    expect(out.running).toBe(false);
  });

  test("skip jumps to the next phase", () => {
    expect(skipPhase(createState(s), s).phase).toBe("short");
  });

  test("status summary text", () => {
    const st = { ...createState(s), totalFocusSessions: 3, totalFocusMinutes: 75 };
    expect(sessionSummary(st)).toBe("⌛ 3 sessions · 75m");
  });
});

describe("v1.0.5 — recall intelligence", () => {
  const doc = [
    "> [!recall-red]- **1. Hard one**",
    "> answer",
    "> [!recall-yellow]- **2. Revise**",
    "> answer",
    "> [!recall-green]+ **3. Mastered**",
    "> answer",
    "<details open>",
    "<summary><b>4. HTML one</b></summary>",
    "</details>",
  ].join("\n");

  test("colour counts and first red line", () => {
    const stats = scanRecallStats(doc);
    expect(stats.total).toBe(4);
    expect(stats.red).toBe(1);
    expect(stats.yellow).toBe(1);
    expect(stats.green).toBe(1);
    expect(stats.firstRedLine).toBe(0);
  });

  test("no toggles -> empty stats", () => {
    const stats = scanRecallStats("just prose");
    expect(stats.total).toBe(0);
    expect(stats.firstRedLine).toBe(-1);
  });

  test("collapse hides every answer (callout + details)", () => {
    const out = collapseAllToggles(doc);
    expect(out).toContain("[!recall-green]-");
    expect(out).not.toContain("[!recall-green]+");
    expect(out).toContain("<details>");
    expect(out).not.toContain("<details open>");
  });

  test("collapse keeps the question text intact", () => {
    expect(collapseAllToggles(doc)).toContain("**1. Hard one**");
  });
});
