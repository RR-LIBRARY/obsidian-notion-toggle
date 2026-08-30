/**
 * v1.4.8 — full feature logic audit.
 *
 * Every feature area of the plugin gets its own reasoning pass here, written
 * from the *stated behaviour* the manual promises the reader — not copied from
 * the implementation or from the existing suites. If a module quietly changes
 * meaning (a filter that stops filtering, a stop order that skips, a quiz that
 * loses a question, a schedule that goes backwards), this file fails.
 */
import { describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

import {
  COLOR_ORDER,
  DEFAULT_STOP_ANCHOR,
  STOP_ANCHORS,
  anchorFraction,
  anchorOffset,
  atEnd,
  clampHold,
  clampSpeed,
  colorCounts,
  colorOf,
  filterLabel,
  firstStopFrom,
  frameDelta,
  matchesFilter,
  normalizeFilter,
  planStops,
  reachedTarget,
  sameFilter,
  type RecallColor,
  type ToggleStop,
} from "../src/autoscroll";
import { anchorScrollTop, anchoredTargets, pickStops, targetsKey } from "../src/scroll-anchor";
import {
  DEFAULT_DWELL,
  buildModeStops,
  chunkTops,
  crossedTargets,
  effectiveMode,
  inShuffleRange,
  layoutSignature,
  legDirection,
  matchesMode,
  normalizeMode,
  orderModeStops,
  parsePicks,
  parseRoute,
  pendingAfterPark,
  planSummary,
  toDwellSettings,
  type DwellSettings,
  type DwellTarget,
  type ModeConfig,
  type PageBox,
} from "../src/scrollmode";
import {
  DEFAULT_QUIZ,
  advance,
  clampQuizSeconds,
  parseQuestionSeconds,
  pauseQuiz,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
} from "../src/quiz";
import {
  DEFAULT_POMODORO,
  createState,
  isIdle,
  nextPhase,
  pauseForInactivity,
  resumeAfterAutoPause,
  scanRecallStats,
  collapseAllToggles,
  shouldAutoPause,
  tick as timerTick,
} from "../src/timer";
import { gradeCard, isDue, newCard, daysUntilDue, dueCount, suggestGrade } from "../src/srs";
import { buildShuffleOrder, gradeFsrs, makeRandom, newFsrsCard } from "../src/fsrs";
import { pruneCards, removeCardKey, renameCardKey } from "../src/maintenance";
import { parseDeepLink, parseFilterParam } from "../src/deeplink";
import { calloutTypeOfLine, nextTrafficColor, recolorHeaderLine } from "../src/recolor";
import { calloutForColor } from "../src/toggle-colors";
import { commandName, isPrimary } from "../src/naming";
import { fabShouldShow } from "../src/guide";
import { needsHeal, revealLanded } from "../src/quiz-heal";
import {
  QUIZ_HIDDEN_CLASS,
  clearQuizVisibility,
  isQuizVisible,
  setQuizVisible,
  snapshotToggles,
} from "../src/quiz-visibility";
import { FreezeDetector, TimerAccuracy, formatQuizReport, perfVerdict } from "../src/quiz-perf";
import type { QuizPerfReport } from "../src/quiz-perf";
import { Telemetry } from "../src/telemetry";
import { filterFrame } from "../src/debug-overlay";
import { isIgnoredHoldTarget, movedTooFar } from "../src/hold-pause";
import { buildLayersIcon } from "../src/scroll-fab";

/* ------------------------------ helpers ---------------------------------- */

const stop = (index: number, top: number, color: RecallColor): ToggleStop => ({ index, top, color });
const cfg = (over: Partial<ModeConfig> = {}): ModeConfig => ({
  mode: "all",
  picks: [],
  route: [],
  loopRoute: false,
  shuffleFrom: 0,
  shuffleTo: 0,
  ...over,
});
const target = (page: number, top: number, index = 0): DwellTarget => ({
  page,
  top,
  index,
  key: `${page}:${index}`,
});
const box = (clientHeight: number, scrollHeight = 100000) => ({ clientHeight, scrollHeight });

/* ------------------------- 1. colours and filters ------------------------- */

describe("audit — toggle colours and filters", () => {
  it("maps every recall callout to its traffic colour and everything else to 'other'", () => {
    expect(colorOf("recall-red")).toBe("red");
    expect(colorOf("RECALL-YELLOW")).toBe("yellow");
    expect(colorOf("callout recall-green is-collapsed")).toBe("green");
    expect(colorOf("note")).toBe("other");
    expect(colorOf(null)).toBe("other");
    expect(colorOf(undefined)).toBe("other");
  });

  it("an empty filter means 'everything', never 'nothing'", () => {
    for (const c of COLOR_ORDER) expect(matchesFilter(c, [])).toBe(true);
    expect(planStops([stop(0, 10, "red"), stop(1, 20, "other")], [], false)).toHaveLength(2);
  });

  it("a colour filter keeps only that colour, in travel order", () => {
    const stops = [stop(0, 300, "red"), stop(1, 100, "green"), stop(2, 200, "red")];
    const red = planStops(stops, ["red"], false);
    expect(red.map((s) => s.top)).toEqual([200, 300]);
    expect(planStops(stops, ["green"], false).map((s) => s.index)).toEqual([1]);
    expect(planStops(stops, ["yellow"], false)).toEqual([]);
  });

  it("reverse walks the same plan bottom-up (never a different set)", () => {
    const stops = [stop(0, 100, "red"), stop(1, 200, "red"), stop(2, 300, "red")];
    const down = planStops(stops, ["red"], false).map((s) => s.top);
    const up = planStops(stops, ["red"], true).map((s) => s.top);
    expect(up).toEqual([...down].reverse());
  });

  it("filter identity ignores the order it was saved in", () => {
    expect(normalizeFilter(["green", "red"])).toEqual(["red", "green"]);
    expect(sameFilter(["yellow", "red"], ["red", "yellow"])).toBe(true);
    expect(sameFilter(["red"], ["red", "green"])).toBe(false);
    // De-duplicated, so a corrupt saved filter cannot double-count.
    expect(normalizeFilter(["red", "red", "red"])).toEqual(["red"]);
  });

  it("counts and labels describe the same selection the plan uses", () => {
    const counts = colorCounts(["red", "red", "green", "other"]);
    expect(counts).toEqual({ red: 2, yellow: 0, green: 1, other: 1 });
    expect(filterLabel([])).toBe("all toggles");
    expect(filterLabel(["red"])).toContain("🔴");
  });

  it("recolour cycles red → yellow → green → red and rewrites only the header", () => {
    expect(nextTrafficColor("recall-red")).toBe("recall-yellow");
    expect(nextTrafficColor("recall-yellow")).toBe("recall-green");
    expect(nextTrafficColor("recall-green")).toBe("recall-red");
    expect(nextTrafficColor("note")).toBe("recall-red");
    const line = "> [!note]- What is a vector?";
    expect(calloutTypeOfLine(line)).toBe("note");
    const out = recolorHeaderLine(line, "recall-red");
    expect(out).toContain("[!recall-red]-");
    expect(out).toContain("What is a vector?");
    // Collapsed / expanded state survives a recolour.
    expect(recolorHeaderLine("> [!note]+ Q", "recall-green")).toContain("]+");
    expect(calloutForColor("red", "note")).toBe("recall-red");
    expect(calloutForColor("green", "note")).toBe("recall-green");
    expect(calloutForColor("default", "note")).toBe("note");
    expect(calloutForColor("nonsense", "note")).toBe("note");
  });
});

/* ---------------------------- 2. plan / modes ----------------------------- */

describe("audit — scroll plan modes", () => {
  it("odd / even / all select the toggles their names promise", () => {
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "odd" }), n))).toEqual([1, 3]);
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "even" }), n))).toEqual([2, 4]);
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "all" }), n))).toEqual([1, 2, 3, 4]);
  });

  it("custom picks accept ranges typed the way readers type them", () => {
    expect(parsePicks("3-5")).toEqual([3, 4, 5]);
    expect(parsePicks("3–5")).toEqual([3, 4, 5]);
    expect(parsePicks("3 to 5")).toEqual([3, 4, 5]);
    expect(parsePicks("5-3")).toEqual([3, 4, 5]);
    expect(parsePicks("1, 4, 7")).toEqual([1, 4, 7]);
    expect(parsePicks("")).toEqual([]);
  });

  it("an empty or corrupt plan falls back to every toggle, never to half the note", () => {
    expect(effectiveMode(cfg({ mode: "custom", picks: [] }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "route", route: [] }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "shuffle", route: [] }))).toBe("all");
    expect(normalizeMode("garbage")).toBe("all");
    expect(normalizeMode(undefined)).toBe("all");
    expect(normalizeMode("even")).toBe("even");
  });

  it("route order is the reader's order, duplicates and all", () => {
    const boxes = [1, 2, 3].map((n) => ({ ordinal: n, top: n * 1000, height: 200 }));
    const conf = cfg({ mode: "route", route: parseRoute("3,1,3") });
    const stops = buildModeStops(boxes, conf, 800, false);
    const ordered = orderModeStops(stops, conf, false);
    expect(ordered.map((s) => s.ordinal)).toEqual([3, 1, 3]);
    // Reverse does not reshuffle a route: the waypoints are the instruction.
    expect(orderModeStops(stops, conf, true).map((s) => s.ordinal)).toEqual([3, 1, 3]);
  });

  it("shuffle honours its range and drops waypoints outside it", () => {
    const conf = cfg({ mode: "shuffle", route: [1, 5, 9], shuffleFrom: 4, shuffleTo: 8 });
    expect(inShuffleRange(conf, 1)).toBe(false);
    expect(inShuffleRange(conf, 5)).toBe(true);
    expect(inShuffleRange(conf, 9)).toBe(false);
    const boxes = [1, 5, 9].map((n) => ({ ordinal: n, top: n * 500, height: 100 }));
    const stops = buildModeStops(boxes, conf, 800, false);
    expect(orderModeStops(stops, conf, false).map((s) => s.ordinal)).toEqual([5]);
    // No range set = whole note.
    expect(inShuffleRange(cfg({ mode: "shuffle" }), 42)).toBe(true);
  });

  it("the plan summary states loop and range so nothing changes silently", () => {
    expect(planSummary(cfg({ mode: "route", route: [1, 2], loopRoute: true }))).toContain("loop ON");
    expect(planSummary(cfg({ mode: "route", route: [1, 2], loopRoute: false }))).toContain("loop OFF");
    expect(planSummary(cfg({ mode: "shuffle", route: [1], shuffleFrom: 2, shuffleTo: 6 }))).toContain("range 2–6");
    expect(planSummary(cfg({ mode: "shuffle", route: [1] }))).toContain("whole note");
  });

  it("a toggle taller than the screen is walked a screenful at a time", () => {
    const tops = chunkTops(1000, 2500, 800);
    expect(tops[0]).toBe(1000);
    expect(tops.length).toBeGreaterThan(1);
    for (let i = 1; i < tops.length; i += 1) expect(tops[i]).toBeGreaterThan(tops[i - 1]);
  });

  it("each route leg heads toward its own waypoint, flipping direction as needed", () => {
    expect(legDirection(5000, 1000, 1)).toBe(1);
    expect(legDirection(1000, 5000, 1)).toBe(-1);
    // Already there: keep the current direction rather than jittering.
    expect(legDirection(1000, 1000.2, -1)).toBe(-1);
  });

  it("speed and hold stay inside their advertised limits", () => {
    expect(clampSpeed(0)).toBeGreaterThan(0);
    expect(clampSpeed(99999)).toBeLessThanOrEqual(1200);
    expect(clampSpeed(Number.NaN)).toBe(60);
    expect(clampHold(-5)).toBe(0);
    expect(frameDelta(60, 1000, false)).toBeCloseTo(60, 5);
    expect(frameDelta(60, 1000, true)).toBeCloseTo(-60, 5);
  });
});

/* ------------------- 3. anchoring, portrait and landscape ----------------- */

describe("audit — where a toggle lands on screen", () => {
  const dwell: DwellSettings = toDwellSettings(cfg(), DEFAULT_DWELL.seconds, false);

  it("portrait and landscape run the same maths — only the viewport differs", () => {
    const portrait = anchorScrollTop(box(900), 4000, 300, "middle");
    const landscape = anchorScrollTop(box(400), 4000, 300, "middle");
    expect(portrait).toBe(4000 - (450 - 150));
    expect(landscape).toBe(4000 - (200 - 150));
    // Same anchor fraction drives both.
    expect(anchorFraction("middle")).toBeCloseTo(0.5, 5);
    expect(DEFAULT_STOP_ANCHOR).toBe("middle");
  });

  it("a toggle taller than the screen keeps its first line visible", () => {
    // Centring a 2000px toggle in a 800px screen would hide the question.
    expect(anchorOffset(5000, 2000, 800, "middle")).toBe(5000);
  });

  it("the first and last stop rest against the edges instead of over-scrolling", () => {
    expect(anchorScrollTop(box(800, 5000), 50, 100, "middle")).toBe(0);
    expect(anchorScrollTop(box(800, 5000), 4900, 100, "middle")).toBe(4200);
  });

  it("every anchor choice is honoured and an unknown one falls back to middle", () => {
    const tops = (["top", "third", "middle", "lower"] as const).map((a) =>
      anchorScrollTop(box(1000), 3000, 100, a)
    );
    expect(tops[0]).toBeGreaterThan(tops[1]);
    expect(tops[1]).toBeGreaterThan(tops[2]);
    expect(tops[2]).toBeGreaterThan(tops[3]);
    expect(anchorFraction("bogus")).toBe(STOP_ANCHORS.middle);
  });

  it("rotating the phone invalidates the cached targets", () => {
    const boxes: PageBox[] = [{ page: 1, top: 1000, height: 200 }];
    const a = targetsKey(box(900), dwell, "middle", boxes);
    const b = targetsKey(box(400), dwell, "middle", boxes);
    expect(a).not.toBe(b);
    // Opening a toggle above shifts the layout — also a new key.
    const shifted: PageBox[] = [{ page: 1, top: 1600, height: 200 }];
    expect(targetsKey(box(900), dwell, "middle", shifted)).not.toBe(a);
    expect(layoutSignature(boxes)).not.toBe(layoutSignature(shifted));
    // Anchor choice is part of the identity too.
    expect(targetsKey(box(900), dwell, "top", boxes)).not.toBe(a);
  });

  it("anchored targets are real scroll offsets, ascending", () => {
    const boxes: PageBox[] = [1, 2, 3].map((n) => ({ page: n, top: n * 2000, height: 200 }));
    const targets = anchoredTargets(boxes, dwell, box(800, 20000), "middle");
    expect(targets).toHaveLength(3);
    for (let i = 1; i < targets.length; i += 1) {
      expect(targets[i].top).toBeGreaterThan(targets[i - 1].top);
      expect(targets[i].top).toBeLessThanOrEqual(20000 - 800);
    }
  });
});

/* ---------------------------- 4. no skipped stop -------------------------- */

describe("audit — no toggle is skipped", () => {
  const targets = [target(1, 1000), target(2, 1200), target(3, 1400)];

  it("one long frame that jumps three stops still owes all three", () => {
    const pick = pickStops(targets, 900, 1500, 1, new Set());
    expect(pick.stop?.key).toBe("1:0");
    expect(pick.queue.map((t) => t.key)).toEqual(["1:0", "2:0", "3:0"]);
    expect(pendingAfterPark(pick.queue, new Set(["1:0"])).map((t) => t.key)).toEqual(["2:0", "3:0"]);
  });

  it("a stop pushed behind the playhead by a re-measure is recovered, not lost", () => {
    // Playhead at 1300; stop 1 moved above it while a toggle above expanded.
    const pick = pickStops(targets, 1300, 1310, 1, new Set(["2:0"]));
    expect(pick.missed.map((t) => t.key)).toEqual(["1:0"]);
    expect(pick.queue[0].key).toBe("1:0");
  });

  it("a visited stop is never offered twice, even mid-leg", () => {
    const visited = new Set(["1:0", "2:0", "3:0"]);
    const pick = pickStops(targets, 900, 1500, 1, visited);
    expect(pick.stop).toBeUndefined();
    expect(pick.queue).toEqual([]);
  });

  it("reverse runs collect stops top-down in travel order", () => {
    const pick = pickStops(targets, 1500, 900, -1, new Set());
    expect(pick.queue.map((t) => t.key)).toEqual(["3:0", "2:0", "1:0"]);
  });

  it("two stops in one toggle keep separate identities (per-stop guard)", () => {
    const parts = [target(4, 2000, 0), target(4, 2800, 1)];
    expect(parts[0].key).not.toBe(parts[1].key);
    const pick = pickStops(parts, 1900, 2900, 1, new Set(["4:0"]));
    expect(pick.queue.map((t) => t.key)).toEqual(["4:1"]);
  });

  it("crossing detection is direction aware", () => {
    expect(crossedTargets(targets, 900, 1250, 1).map((t) => t.page)).toEqual([1, 2]);
    expect(crossedTargets(targets, 1500, 1150, -1).map((t) => t.page)).toEqual([3, 2]);
    expect(crossedTargets(targets, 1000, 1000, 1)).toEqual([]);
  });

  it("wrapping picks the stop the run is heading for, in both directions", () => {
    const plan = [stop(0, 100, "red"), stop(1, 500, "red"), stop(2, 900, "red")];
    expect(firstStopFrom(plan, 400, false)).toBe(1);
    expect(firstStopFrom(plan, 5000, false)).toBe(0); // wrap to the top
    const up = planStops(plan, [], true);
    expect(firstStopFrom(up, 0, true)).toBe(up.length - 1); // wrap to the highest stop
    expect(firstStopFrom([], 0, false)).toBe(-1);
  });

  it("target arrival and end-of-note are direction aware", () => {
    expect(reachedTarget(999, 1000, false)).toBe(true); // within 1px
    expect(reachedTarget(900, 1000, false)).toBe(false);
    expect(reachedTarget(1001, 1000, true)).toBe(true);
    expect(atEnd(4200, 5000, 800, false)).toBe(true);
    expect(atEnd(0, 5000, 800, true)).toBe(true);
    expect(atEnd(100, 5000, 800, true)).toBe(false);
  });
});

/* -------------------------------- 5. quiz --------------------------------- */

describe("audit — quiz engine", () => {
  const s = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 5, quizAutoNext: true, quizLoop: false };
  const titles = ["Q1", "Q2", "Q3"];

  it("a quiz starts on question 1 with its own duration", () => {
    const st = startQuiz(titles, s);
    expect(st.at).toBe(0);
    expect(st.phase).toBe("question");
    expect(st.remaining).toBe(10_000);
    expect(st.total).toBe(3);
    expect(st.running).toBe(true);
    expect(startQuiz([], s).phase).toBe("done");
  });

  it("question → reveal → next question, counting each answer exactly once", () => {
    let st = startQuiz(titles, s);
    let r = quizTick(st, 10_000, titles, s);
    expect(r.event).toBe("reveal");
    expect(r.state.phase).toBe("reveal");
    r = quizTick(r.state, 5_000, titles, s);
    expect(r.state.at).toBe(1);
    expect(r.state.answered).toBe(1);
    expect(r.state.phase).toBe("question");
  });

  it("the whole run ends after the last reveal, with every question answered", () => {
    let st = startQuiz(titles, s);
    for (let i = 0; i < 3; i += 1) {
      st = quizTick(st, 10_000, titles, s).state;
      st = quizTick(st, 5_000, titles, s).state;
    }
    expect(st.phase).toBe("done");
    expect(st.answered).toBe(3);
    expect(st.running).toBe(false);
    // A finished quiz ignores further ticks.
    expect(quizTick(st, 10_000, titles, s).event).toBeNull();
  });

  it("loop restarts at question 1 instead of finishing", () => {
    const loop = { ...s, quizLoop: true };
    const st = { ...startQuiz(titles, loop), at: 2 };
    const r = advance(st, titles, loop);
    expect(r.state.at).toBe(0);
    expect(r.state.phase).toBe("question");
    expect(r.state.running).toBe(true);
  });

  it("auto-next off parks after the reveal instead of racing on", () => {
    const manual = { ...s, quizAutoNext: false };
    let st = startQuiz(titles, manual);
    st = quizTick(st, 10_000, titles, manual).state;
    const r = quizTick(st, 5_000, titles, manual);
    expect(r.state.running).toBe(false);
    expect(r.state.at).toBe(0);
    expect(r.state.answered).toBe(1);
  });

  it("pause freezes the countdown and resume continues from the same point", () => {
    let st = startQuiz(titles, s);
    st = quizTick(st, 4_000, titles, s).state;
    const paused = pauseQuiz(st);
    expect(quizTick(paused, 60_000, titles, s).state.remaining).toBe(6_000);
    const resumed = resumeQuiz(paused);
    expect(quizTick(resumed, 1_000, titles, s).state.remaining).toBe(5_000);
  });

  it("reveal-now and skip keep the phase machine honest", () => {
    const st = startQuiz(titles, s);
    const rev = revealNow(st, s);
    expect(rev.state.phase).toBe("reveal");
    expect(revealNow(rev.state, s).event).toBeNull(); // no double reveal
    const sk = skipQuestion(st, titles, s);
    expect(sk.state.at).toBe(1);
    expect(sk.state.answered).toBe(1);
  });

  it("per-question durations written in the title win over the default", () => {
    expect(parseQuestionSeconds("Explain diffusion (45s)", 10)).toBe(45);
    expect(parseQuestionSeconds("Long one [2m]", 10)).toBe(120);
    expect(parseQuestionSeconds("No timing here", 10)).toBe(10);
    expect(clampQuizSeconds(0)).toBeGreaterThan(0);
    expect(clampQuizSeconds(999_999)).toBeLessThanOrEqual(43_200);
  });

  it("open-all / close-all restores exactly what the reader had open", () => {
    const host = document.createElement("div");
    host.innerHTML = `
      <details><summary>A</summary><p>a</p></details>
      <details open><summary>B</summary><p>b</p></details>`;
    document.body.appendChild(host);
    const els = Array.from(host.querySelectorAll<HTMLElement>("details"));
    const before = snapshotToggles(els);
    expect(before.map((s) => s.open)).toEqual([false, true]);
    for (const el of els) setQuizVisible(el, false);
    expect(els.every((el) => el.classList.contains(QUIZ_HIDDEN_CLASS))).toBe(true);
    expect(isQuizVisible(els[0])).toBe(false);
    clearQuizVisibility(els);
    expect(els.some((el) => el.classList.contains(QUIZ_HIDDEN_CLASS))).toBe(false);
  });

  it("healing only fires when a question element has gone missing", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    expect(needsHeal([el, el])).toBe(false);
    expect(needsHeal([el, document.createElement("div")])).toBe(true); // detached
    expect(needsHeal([el, undefined])).toBe(true);
    expect(typeof revealLanded(el)).toBe("boolean");
  });
});

/* ------------------------------- 6. timers -------------------------------- */

describe("audit — focus timer and guards", () => {
  const s = { ...DEFAULT_POMODORO, focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4, autoStartNext: false };

  it("focus runs down to a break and counts the session", () => {
    const st = createState(s);
    expect(st.phase).toBe("focus");
    const r = timerTick({ ...st, running: true }, st.remaining, s);
    expect(r.phaseEnded).toBe(true);
    expect(r.state.phase).toBe("short");
    expect(r.state.totalFocusSessions).toBe(1);
    expect(r.state.totalFocusMinutes).toBe(25);
  });

  it("the long break arrives on the configured session, then the cycle resets", () => {
    let st = createState(s);
    for (let i = 0; i < 3; i += 1) {
      st = nextPhase({ ...st, phase: "focus" }, s);
      expect(st.phase).toBe("short");
    }
    st = nextPhase({ ...st, phase: "focus" }, s);
    expect(st.phase).toBe("long");
    expect(st.completedInCycle).toBe(0);
  });

  it("a paused timer never advances", () => {
    const st = createState(s);
    expect(timerTick(st, 10_000, s).state.remaining).toBe(st.remaining);
  });

  it("the focus guard pauses for the right reason and only resumes what it paused", () => {
    const running = { ...createState(s), running: true };
    expect(shouldAutoPause({ state: running, enabled: true, visible: false, onSessionNote: true, pinned: false })).toBe("hidden");
    expect(shouldAutoPause({ state: running, enabled: true, visible: true, onSessionNote: false, pinned: true })).toBe("other-note");
    expect(shouldAutoPause({ state: running, enabled: true, visible: true, onSessionNote: false, pinned: false })).toBeNull();
    expect(shouldAutoPause({ state: running, enabled: false, visible: false, onSessionNote: true, pinned: true })).toBeNull();
    const auto = pauseForInactivity(running);
    expect(auto.running).toBe(false);
    expect(resumeAfterAutoPause(auto).running).toBe(true);
    // A manual pause stays paused.
    expect(resumeAfterAutoPause({ ...running, running: false, autoPaused: false }).running).toBe(false);
    expect(isIdle(0, 10 * 60_000, 5)).toBe(true);
    expect(isIdle(0, 10 * 60_000, 0)).toBe(false);
  });

  it("recall stats and collapse-all read the note the way the reader sees it", () => {
    const doc = "> [!recall-red]+ Q1\n> a\n\n> [!recall-green]- Q2\n\n> [!note]- Q3";
    const stats = scanRecallStats(doc);
    expect(stats.total).toBe(3);
    expect(stats.red).toBe(1);
    expect(stats.green).toBe(1);
    expect(stats.firstRedLine).toBe(0);
    expect(collapseAllToggles(doc)).not.toContain("]+");
  });

  it("hold-to-pause ignores controls and small finger wobble", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    expect(isIgnoredHoldTarget(btn)).toBe(true);
    expect(isIgnoredHoldTarget(document.createElement("p"))).toBe(false);
    expect(movedTooFar(2, 2)).toBe(false);
    expect(movedTooFar(40, 0)).toBe(true);
  });
});

/* --------------------------- 7. spaced repetition ------------------------- */

describe("audit — scheduling", () => {
  const now = Date.UTC(2026, 0, 10, 12, 0, 0);

  it("SM-2 walks 1 → 6 → interval × ease and never goes backwards", () => {
    let card = gradeCard(newCard(), "good", now);
    expect(card.interval).toBe(1);
    card = gradeCard(card, "good", now);
    expect(card.interval).toBe(6);
    const third = gradeCard(card, "good", now);
    expect(third.interval).toBeGreaterThan(6);
    expect(third.interval).toBeLessThanOrEqual(365);
  });

  it("again restarts the card and records a lapse; easy stretches further than good", () => {
    const mature = gradeCard(gradeCard(gradeCard(newCard(), "good", now), "good", now), "good", now);
    const again = gradeCard(mature, "again", now);
    expect(again.interval).toBe(1);
    expect(again.repetitions).toBe(0);
    expect(again.lapses).toBe(1);
    expect(again.ease).toBeLessThan(mature.ease);
    expect(gradeCard(mature, "easy", now).interval).toBeGreaterThan(gradeCard(mature, "good", now).interval);
    expect(gradeCard(mature, "hard", now).interval).toBeLessThan(gradeCard(mature, "good", now).interval);
  });

  it("due dates line up with whole days and drive the due counters", () => {
    const card = gradeCard(newCard(), "good", now);
    // A 1-day interval is due tomorrow, not again today.
    expect(isDue(card, now)).toBe(false);
    expect(isDue(card, now + 86_400_000)).toBe(true);
    expect(isDue(card, now + 3 * 86_400_000)).toBe(true);
    expect(daysUntilDue(card, now)).toBe(1);
    expect(isDue(undefined, now)).toBe(true); // never reviewed = due
    expect(dueCount({ a: card }, now + 5 * 86_400_000)).toBe(1);
  });

  it("the suggested grade follows the reader's own colour tally", () => {
    expect(suggestGrade({ red: 5, yellow: 0, green: 0 })).toBe("again");
    expect(suggestGrade({ red: 0, yellow: 0, green: 5 })).toBe("easy");
  });

  it("FSRS grades move a card forward and the shuffle route is reproducible", () => {
    const fresh = newFsrsCard(1);
    const good = gradeFsrs(fresh, 3, now);
    const again = gradeFsrs(fresh, 1, now);
    expect(good.stability).toBeGreaterThan(again.stability);
    expect(good.lastReviewedAt).toBe(now);
    const a = buildShuffleOrder([], 5, { seed: 7, now });
    const b = buildShuffleOrder([], 5, { seed: 7, now });
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(buildShuffleOrder([], 5, { seed: 7, now, from: 2, to: 4 }).sort((x, y) => x - y)).toEqual([2, 3, 4]);
    expect(typeof makeRandom(3)()).toBe("number");
  });

  it("maintenance keeps the card store aligned with the vault", () => {
    const store = { "a.md": newCard(), "b.md": newCard() };
    const renamed = renameCardKey(store, "a.md", "c.md");
    expect(Object.keys(renamed.store ?? renamed).sort()).toEqual(["b.md", "c.md"]);
    const removed = removeCardKey(store, "a.md");
    expect(Object.keys(removed.store ?? removed)).toEqual(["b.md"]);
    const pruned = pruneCards(store, ["a.md"]);
    expect(Object.keys(pruned.store ?? pruned)).toEqual(["a.md"]);
  });
});

/* ------------------------ 8. deep links, naming, FAB ---------------------- */

describe("audit — entry points and chrome", () => {
  it("deep links only accept known actions and sane parameters", () => {
    expect(parseDeepLink({ action: "quiz", seconds: "30" })).toMatchObject({ action: "quiz", seconds: 30 });
    expect(parseDeepLink({ action: "autoscroll", speed: "9999" })?.speed).toBe(600);
    expect(parseDeepLink({ action: "stop" })).toMatchObject({ action: "stop" });
    expect(parseDeepLink({ action: "delete-vault" })).toBeNull();
    expect(parseDeepLink({})).toBeNull();
    expect(parseFilterParam("red,green")).toEqual(["red", "green"]);
    expect(parseFilterParam("all")).toEqual([]);
    expect(parseFilterParam("nonsense")).toBeUndefined();
  });

  it("command names stay recognisable in minimal mode", () => {
    expect(isPrimary("smart-quiz")).toBe(true);
    expect(isPrimary("start-autoscroll")).toBe(false);
    // Primary commands keep their own name in both modes.
    expect(commandName("smart-quiz", "Legacy name", true)).toBe(commandName("smart-quiz", "Legacy name", false));
    // Everything else is filed under Advanced only in minimal mode.
    expect(commandName("unknown-id", "Legacy name", false)).toBe("Legacy name");
    expect(commandName("unknown-id", "Legacy name", true)).toBe("Advanced: Legacy name");
    expect(commandName("unknown-id", "Advanced: Legacy name", true)).toBe("Advanced: Legacy name");
  });

  it("the floating button hides wherever a note is not on screen", () => {
    expect(fabShouldShow(true, true, false, true, false)).toBe(true);
    expect(fabShouldShow(false, true, false, true, false)).toBe(false);
    expect(fabShouldShow(true, false, false, true, false)).toBe(false);
    expect(fabShouldShow(true, true, false, false, false)).toBe(false);
    expect(fabShouldShow(true, true, false, true, true)).toBe(false); // modal on top
  });

  it("the autoscroll icon keeps its animated layers and no square plate", () => {
    const icon = buildLayersIcon(false, true);
    expect(icon.tagName.toLowerCase()).toBe("svg");
    expect(icon.querySelectorAll("*").length).toBeGreaterThan(1);
    expect(icon.getAttribute("style") ?? "").not.toContain("background");
  });
});

/* -------------------------- 9. performance report ------------------------- */

describe("audit — deep quiz performance report", () => {
  it("timer accuracy reports the drift the reader actually experienced", () => {
    const t = new TimerAccuracy();
    t.start(0, "Q1", "question", 10_000, 0);
    t.finish(10_050);
    t.start(1, "Q2", "question", 10_000, 10_050);
    t.finish(21_050); // 1s late
    const r = t.report();
    expect(r.questions).toBe(2);
    expect(r.worst?.index).toBe(1);
    expect(Math.abs(r.worst?.driftMs ?? 0)).toBeGreaterThanOrEqual(950);
    expect(r.meanDriftMs).toBeGreaterThan(0);
    expect(r.accuracy).toBeGreaterThan(0.9);
    expect(r.accuracy).toBeLessThanOrEqual(1);
  });

  it("a pause is not counted as drift", () => {
    const t = new TimerAccuracy();
    t.start(0, "Q1", "question", 10_000, 0);
    t.addPause(30_000);
    t.finish(40_000);
    expect(Math.abs(t.report().worst?.driftMs ?? 0)).toBeLessThan(1_000);
  });

  it("freeze detection flags long frame gaps and can be told to ignore one", () => {
    const f = new FreezeDetector();
    for (let i = 0; i < 10; i += 1) f.tick(16, "question", i * 16);
    expect(f.report().count).toBe(0);
    f.tick(1_500, "question", 1_000);
    const r = f.report();
    expect(r.count).toBe(1);
    expect(r.longestMs).toBeGreaterThanOrEqual(1_400);
    f.ignoreNext();
    f.tick(2_000, "question", 4_000);
    expect(f.report().count).toBe(1);
  });

  it("the report the reader copies names every measured thing in plain words", () => {
    const tel = new Telemetry();
    tel.timer.start(0, "Q1", "question", 5_000, 0);
    tel.timer.finish(5_010);
    tel.freezes.tick(16, "question", 16);
    tel.filter.add(2.5);
    tel.badgeRender.add(1.5);
    tel.noteSkipped(2);
    const report: QuizPerfReport = tel.report();
    expect(report.skippedStops).toBe(2);
    expect(report.freezes.count).toBe(0);
    const text = formatQuizReport(report);
    for (const word of ["Timer", "Freeze", "Filter", "skip"]) {
      expect(text.toLowerCase()).toContain(word.toLowerCase());
    }
    expect(perfVerdict(report).length).toBeGreaterThan(3);
  });

  it("filter and render timings are captured per frame", () => {
    const frame = filterFrame({
      filterLabel: "🔴 red",
      found: 40,
      kept: 12,
      colors: { red: 12, yellow: 8, green: 20, other: 0 },
      targetColor: "red",
      targetType: "recall-red",
    });
    expect(frame.stopsFound).toBe(40);
    expect(frame.stopsKept).toBe(12);
    expect(frame.filter).toContain("red");
    expect(frame.colors?.green).toBe(20);
  });
});
