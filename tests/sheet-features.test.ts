/**
 * v1.7.6 — full feature inventory of the Autoscroll quick-controls sheet.
 * Opens the real ScrollSheetModal against a fake plugin and checks that every
 * row documented in AUTOSCROLL-SHEET-GUIDE.md exists (in order) and is wired.
 */
import "./sheet-dom-prelude";
import { describe, expect, test } from "bun:test";
import { ScrollSheetModal } from "../src/sheet-modal";

export const SHEET_ROWS = [
  "Autoscroll",
  "Think time before the answer",
  "Think seconds",
  "Preview the countdown",
  "Countdown icon",
  "Distraction-free mode",
  "Reduced motion",
  "Timing debug overlay",
  "Quiz (timed question run)",
  "Quiz — time per question",
  "Quiz — answer time",
  "Quiz — auto next",
  "Quiz — kaunse toggle",
  "Quiz — minimal UI",
  "Quiz — loop",
  "Answers — open / close all",
  "Open with auto-quiz (answers stay open)",
  "Direction",
  "Speed",
  "Pause for",
  "Pause at",
  "Colour filter",
  "Reverse direction ↑",
  "Loop the note",
  "Open toggles automatically",
  "Close them when leaving",
  "Tall toggles screen-by-screen",
  "Advance by",
  "Screen calculation (live)",
  "Screen overlap",
  "Usable viewport",
  "Debug overlay",
  "Quiet mode (no popups)",
  "More",
];

function makePlugin() {
  const calls: string[] = [];
  const settings: Record<string, unknown> = {
    scrollThinkEnabled: false, scrollThinkSeconds: 10, scrollThinkIcon: "🤔",
    scrollFocusChrome: false, scrollReducedMotion: false, scrollTimingDebug: false,
    quizSeconds: 30, quizRevealSeconds: 10, quizAutoNext: true, quizMinimalUi: false,
    quizLoop: false, quizKeepAnswersOpen: false, scrollReverse: false, scrollSpeed: 60,
    scrollHold: 5, scrollFilter: [], scrollLoop: false, scrollAutoOpen: true,
    scrollAutoClose: true, scrollChunkTall: true, scrollScreenDwellMs: 7000,
    scrollAdvanceBy: "toggles", scrollScreenOverlap: 0.1, scrollViewportPct: 0.9,
    scrollDebug: false, scrollQuiet: false, scrollMode: "all", scrollPicks: [],
  };
  return {
    settings, calls, scrollSheetOpen: true, scrollRunning: false, quizState: null as unknown,
    autoScrollActive: () => false,
    setAutoScrollEnabled: async (v: boolean) => { calls.push(`autoscroll:${v}`); },
    startQuizRun: () => calls.push("quiz:start"),
    stopQuiz: () => calls.push("quiz:stop"),
    quizFilterColors: () => [],
    setAllAnswersOpen: (v: boolean) => calls.push(`answers:${v}`),
    refreshQuizAnswerVisibility: () => calls.push("quiz:vis"),
    setScrollReverse: async (v: boolean) => { settings.scrollReverse = v; calls.push(`reverse:${v}`); },
    modeConfig: () => ({ mode: "all", picks: [], route: [] }),
    saveSettings: async () => { calls.push("save"); },
    refreshScrollPlan: () => calls.push("plan"),
    screenPlanSummary: () => "1 screen = 900px",
    syncScrollDebugOverlay: () => calls.push("debug"),
    syncScrollFab: () => calls.push("fab"),
    scrollToStart: () => calls.push("first"),
  };
}

function open() {
  const plugin = makePlugin();
  const m = new ScrollSheetModal({} as never, plugin as never);
  m.open();
  const el = (m as unknown as { contentEl: HTMLElement }).contentEl;
  return { plugin, m, el };
}
const nameOf = (r: Element) => (r.firstChild as HTMLElement | null)?.textContent ?? "";
const row = (el: HTMLElement, name: string) =>
  [...el.querySelectorAll(".setting-item")].find((r) => nameOf(r) === name) as HTMLElement;
const btn = (r: HTMLElement, text: string) =>
  [...r.querySelectorAll("button")].find((b) => b.textContent === text) as HTMLButtonElement;
const flip = (r: HTMLElement) => (r.querySelector(".checkbox-container") as HTMLElement).click();
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("Autoscroll sheet — full feature inventory", () => {
  test("every documented row is present, in order", () => {
    const { el } = open();
    const names = [...el.querySelectorAll(".setting-item")].map(nameOf).filter((n) => SHEET_ROWS.includes(n));
    expect(names).toEqual(SHEET_ROWS);
  });

  test("Pause on each screen (chips 10s…1h) renders right under Tall toggles", () => {
    const { el } = open();
    const txt = el.textContent ?? "";
    const tall = txt.indexOf("Tall toggles screen-by-screen");
    const adv = txt.indexOf("Advance by");
    const seg = txt.slice(tall, adv);
    for (const c of ["10s", "20s", "30s", "60s", "1h"]) expect(seg).toContain(c);
  });

  test("Autoscroll switch starts the run", async () => {
    const { el, plugin } = open();
    flip(row(el, "Autoscroll"));
    await tick();
    expect(plugin.calls).toContain("autoscroll:true");
  });

  test("Quiz switch starts the quiz", () => {
    const { el, plugin } = open();
    flip(row(el, "Quiz (timed question run)"));
    expect(plugin.calls).toContain("quiz:start");
  });

  test("Open all / Close all buttons", () => {
    const { el, plugin } = open();
    const r = row(el, "Answers — open / close all");
    btn(r, "Open all").click();
    btn(r, "Close all").click();
    expect(plugin.calls).toEqual(expect.arrayContaining(["answers:true", "answers:false"]));
  });

  test("Direction switch saves reverse", async () => {
    const { el, plugin } = open();
    flip(row(el, "Direction"));
    await tick();
    expect(plugin.settings.scrollReverse).toBe(true);
  });

  test("simple on/off switches save their setting", async () => {
    const pairs: [string, string][] = [
      ["Think time before the answer", "scrollThinkEnabled"],
      ["Distraction-free mode", "scrollFocusChrome"],
      ["Reduced motion", "scrollReducedMotion"],
      ["Timing debug overlay", "scrollTimingDebug"],
      ["Loop the note", "scrollLoop"],
      ["Open toggles automatically", "scrollAutoOpen"],
      ["Close them when leaving", "scrollAutoClose"],
      ["Tall toggles screen-by-screen", "scrollChunkTall"],
      ["Debug overlay", "scrollDebug"],
      ["Quiet mode (no popups)", "scrollQuiet"],
      ["Quiz — auto next", "quizAutoNext"],
      ["Quiz — minimal UI", "quizMinimalUi"],
      ["Quiz — loop", "quizLoop"],
      ["Open with auto-quiz (answers stay open)", "quizKeepAnswersOpen"],
    ];
    for (const [name, key] of pairs) {
      const { el, plugin } = open();
      const before = plugin.settings[key];
      flip(row(el, name));
      await tick();
      expect({ name, v: plugin.settings[key] }).toEqual({ name, v: !before });
    }
  });

  test("Advance by dropdown offers three modes and saves", async () => {
    const { el, plugin } = open();
    const sel = row(el, "Advance by").querySelector("select") as HTMLSelectElement;
    expect([...sel.options].map((o) => o.value)).toEqual(["toggles", "screens", "both"]);
    sel.value = "screens";
    sel.dispatchEvent(new (globalThis as unknown as { Event: typeof Event }).Event("change"));
    await tick();
    expect(plugin.settings.scrollAdvanceBy).toBe("screens");
  });

  test("overlap and viewport sliders save clamped values", async () => {
    const { el, plugin } = open();
    const E = (globalThis as unknown as { Event: typeof Event }).Event;
    const ov = row(el, "Screen overlap").querySelector("input[type=range]") as HTMLInputElement;
    ov.value = "0.3"; ov.dispatchEvent(new E("input"));
    const vp = row(el, "Usable viewport").querySelector("input[type=range]") as HTMLInputElement;
    vp.value = "0.8"; vp.dispatchEvent(new E("input"));
    await tick();
    expect(plugin.settings.scrollScreenOverlap as number).toBeCloseTo(0.3);
    expect(plugin.settings.scrollViewportPct as number).toBeCloseTo(0.8);
  });

  test("More row has Go to first, Stats, Toolbar guide", () => {
    const { el, plugin } = open();
    const r = row(el, "More");
    expect(btn(r, "Stats")).toBeTruthy();
    expect(btn(r, "Toolbar guide")).toBeTruthy();
    btn(r, "Go to first").click();
    expect(plugin.calls).toContain("first");
    expect(plugin.scrollSheetOpen).toBe(false);
  });

  test("Speed / Pause for / Pause at / Colour filter show current value + Choose", () => {
    const { el } = open();
    for (const n of ["Speed", "Pause for", "Pause at", "Colour filter"]) expect(btn(row(el, n), "Choose")).toBeTruthy();
    expect(row(el, "Speed").textContent).toContain("1x");
    expect(row(el, "Pause at").textContent).toContain("every toggle");
  });

  test("closing the sheet brings the floating button back", () => {
    const { m, plugin } = open();
    m.close();
    expect(plugin.scrollSheetOpen).toBe(false);
    expect(plugin.calls).toContain("fab");
  });
});
