/**
 * v1.4.6 — logic audit.
 *
 * One assertion set per feature area, written *against the stated contract*
 * of each module rather than against its implementation, so a silent change
 * in behaviour fails here. Findings from this pass are written up in
 * `issue.md`; the strengths / weaknesses read is in `Strongwincode.md`.
 */
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";

import {
  DEFAULT_AUTOSCROLL,
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
  sessionLabel,
  targetOffset,
  type RecallColor,
  type ToggleStop,
} from "../src/autoscroll";

import {
  DWELL_MAX,
  SPEED_MULTIPLIERS,
  advancePosition,
  buildModeStops,
  chunkTops,
  clampDwellSeconds,
  effectiveMode,
  formatDwell,
  inShuffleRange,
  legDirection,
  matchesMode,
  modeLabel,
  multiplierFromSpeed,
  nearestSpeedMultiplier,
  normalizeMode,
  orderModeStops,
  parsePicks,
  parseRoute,
  planSummary,
  speedFromMultiplier,
  type ModeConfig,
  type ModeItem,
} from "../src/scrollmode";

import {
  DEFAULT_QUIZ,
  QUIZ_SECONDS_MAX,
  advance,
  clampQuizSeconds,
  clampRevealSeconds,
  formatQuizSeconds,
  parseQuestionSeconds,
  pauseQuiz,
  quizProgressRatio,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
} from "../src/quiz";

import { healQuizEls, needsHeal } from "../src/quiz-heal";
import { TRAFFIC_CYCLE, calloutTypeOfLine, nextTrafficColor, recolorHeaderLine } from "../src/recolor";
import { TOGGLE_COLORS, calloutForColor } from "../src/toggle-colors";
import { blankTableRow, smartAction } from "../src/smart";
import { parseDeepLink, parseFilterParam } from "../src/deeplink";
import { DEFAULT_POMODORO, createState, nextPhase, phaseDuration, tick } from "../src/timer";
import { GRADES, gradeCard, isDue, newCard, suggestGrade } from "../src/srs";
import { pruneCards, removeCardKey, renameCardKey } from "../src/maintenance";
import { isIgnoredHoldTarget, movedTooFar } from "../src/hold-pause";

const cfg = (over: Partial<ModeConfig> = {}): ModeConfig => ({
  mode: "all",
  picks: [],
  route: [],
  ...over,
});

const items = (count: number, height = 200): ModeItem[] =>
  Array.from({ length: count }, (_, i) => ({ ordinal: i + 1, top: i * 400, height }));

/* ------------------------------ 1. colours ------------------------------ */

describe("audit · colour filters", () => {
  it("maps only the recall- classes to a traffic light, everything else is 'other'", () => {
    expect(colorOf("recall-red")).toBe("red");
    expect(colorOf("callout recall-yellow is-collapsed")).toBe("yellow");
    expect(colorOf("RECALL-GREEN")).toBe("green");
    expect(colorOf("question")).toBe("other");
    expect(colorOf(null)).toBe("other");
    expect(colorOf(undefined)).toBe("other");
  });

  it("an empty filter means every toggle, never zero toggles", () => {
    for (const c of ["red", "yellow", "green", "other"] as RecallColor[]) {
      expect(matchesFilter(c, [])).toBe(true);
    }
  });

  it("selecting one colour excludes the other three", () => {
    expect(matchesFilter("red", ["red"])).toBe(true);
    expect(matchesFilter("yellow", ["red"])).toBe(false);
    expect(matchesFilter("other", ["red", "green"])).toBe(false);
  });

  it("filters are order-insensitive and de-duplicated", () => {
    expect(normalizeFilter(["green", "red", "red"])).toEqual(["red", "green"]);
    expect(sameFilter(["yellow", "red"], ["red", "yellow"])).toBe(true);
    expect(sameFilter(["red"], ["red", "green"])).toBe(false);
    expect(normalizeFilter(null)).toEqual([]);
  });

  it("labels and counts describe the selection the reader made", () => {
    expect(filterLabel([])).toBe("all toggles");
    expect(filterLabel(["green", "red"])).toBe("🔴 🟢");
    expect(colorCounts(["red", "red", "green"])).toEqual({ red: 2, yellow: 0, green: 1, other: 0 });
  });

  it("a filtered plan keeps document order and reverses as a whole", () => {
    const stops: ToggleStop[] = [
      { index: 0, top: 0, color: "red" },
      { index: 1, top: 100, color: "green" },
      { index: 2, top: 200, color: "red" },
      { index: 3, top: 300, color: "other" },
    ];
    expect(planStops(stops, ["red"], false).map((s) => s.top)).toEqual([0, 200]);
    expect(planStops(stops, ["red"], true).map((s) => s.top)).toEqual([200, 0]);
    expect(planStops(stops, [], false)).toHaveLength(4);
    expect(planStops(stops, ["yellow"], false)).toHaveLength(0);
  });

  it("the palette resolves every colour id and falls back for 'default'", () => {
    expect(calloutForColor("red", "question")).toBe("recall-red");
    expect(calloutForColor("default", "question")).toBe("question");
    expect(calloutForColor("nope", "note")).toBe("note");
    for (const c of TOGGLE_COLORS) expect(typeof c.label).toBe("string");
  });

  it("the traffic-light cycle always starts at red and wraps", () => {
    expect(nextTrafficColor("question")).toBe("recall-red");
    expect(nextTrafficColor("recall-red")).toBe("recall-yellow");
    expect(nextTrafficColor("recall-yellow")).toBe("recall-green");
    expect(nextTrafficColor("recall-green")).toBe("recall-red");
    expect(TRAFFIC_CYCLE).toHaveLength(3);
  });

  it("recolouring a header keeps the fold marker and the title", () => {
    expect(calloutTypeOfLine("> [!recall-red]- Q1")).toBe("recall-red");
    expect(recolorHeaderLine("> [!question]- Q1", "recall-green")).toBe("> [!recall-green]- Q1");
    expect(recolorHeaderLine("> [!recall-red]+ Q1", "recall-yellow")).toBe("> [!recall-yellow]+ Q1");
  });
});

/* --------------------------- 2. autoscroll run --------------------------- */

describe("audit · autoscroll engine", () => {
  it("clamps speed and hold inside their documented ranges", () => {
    expect(clampSpeed(0)).toBe(1);
    expect(clampSpeed(99999)).toBe(1200);
    expect(clampSpeed(1.234)).toBe(1.23);
    expect(clampSpeed(Number.NaN)).toBe(DEFAULT_AUTOSCROLL.scrollSpeed);
    expect(clampHold(-5)).toBe(0);
    expect(clampHold(1e9)).toBe(DWELL_MAX);
  });

  it("frame movement is signed by direction and never negative time", () => {
    expect(frameDelta(60, 1000, false)).toBeCloseTo(60, 5);
    expect(frameDelta(60, 1000, true)).toBeCloseTo(-60, 5);
    expect(frameDelta(60, -50, false)).toBe(0);
  });

  it("targets sit slightly above the middle of the viewport and never below zero", () => {
    expect(targetOffset(1000, 800)).toBe(760);
    expect(targetOffset(10, 800)).toBe(0);
  });

  it("reach and end detection are direction aware", () => {
    expect(reachedTarget(499, 500, false)).toBe(true);
    expect(reachedTarget(400, 500, false)).toBe(false);
    expect(reachedTarget(501, 500, true)).toBe(true);
    expect(atEnd(0, 5000, 800, true)).toBe(true);
    expect(atEnd(4200, 5000, 800, false)).toBe(true);
    expect(atEnd(1000, 5000, 800, false)).toBe(false);
  });

  it("mid-note resume picks the next stop ahead of the reader in both directions", () => {
    const plan: ToggleStop[] = [
      { index: 0, top: 0, color: "red" },
      { index: 1, top: 500, color: "red" },
      { index: 2, top: 900, color: "red" },
    ];
    const rev = [...plan].reverse();
    expect(firstStopFrom(plan, 600, false)).toBe(2);
    expect(firstStopFrom(rev, 600, true)).toBe(1);
    expect(firstStopFrom([], 0, false)).toBe(-1);
  });

  it("v1.4.6 — with nothing ahead, the wrap target is the edge the run heads for", () => {
    const plan: ToggleStop[] = [
      { index: 0, top: 100, color: "red" },
      { index: 1, top: 500, color: "red" },
    ];
    const rev = [...plan].reverse();
    // forward, already past the last stop -> back to the top stop
    expect(firstStopFrom(plan, 9999, false)).toBe(0);
    // reverse, sitting above every stop -> the highest stop, i.e. the last
    // entry of a descending plan (used to be index 0, the bottom-most stop)
    expect(firstStopFrom(rev, 0, true)).toBe(rev.length - 1);
    expect(rev[firstStopFrom(rev, 0, true)]!.top).toBe(100);
  });

  it("the session line reports direction, speed, filter and stop count", () => {
    const label = sessionLabel({ ...DEFAULT_AUTOSCROLL, scrollReverse: true, scrollFilter: ["red"] }, 1);
    expect(label).toContain("reverse ↑");
    expect(label).toContain("🔴");
    expect(label).toContain("1 stop");
  });

  it("float position accumulates and clamps, so slow speeds still move", () => {
    let pos = 0;
    for (let i = 0; i < 10; i += 1) pos = advancePosition(pos, 1.2, 0.1, 1, 1000);
    expect(pos).toBeCloseTo(1.2, 5);
    expect(advancePosition(5, 100, 1, -1, 1000)).toBe(0);
    expect(advancePosition(990, 100, 1, 1, 1000)).toBe(1000);
  });

  it("route legs flip direction toward the waypoint", () => {
    expect(legDirection(900, 100, 1)).toBe(1);
    expect(legDirection(100, 900, 1)).toBe(-1);
    expect(legDirection(100, 100.2, -1)).toBe(-1); // inside the dead zone: unchanged
  });

  it("the speed ladder is the reader's, and round-trips through px/s", () => {
    expect(SPEED_MULTIPLIERS[0]).toBe(0.02);
    expect(SPEED_MULTIPLIERS.at(-1)).toBe(20);
    for (const m of SPEED_MULTIPLIERS) {
      expect(multiplierFromSpeed(speedFromMultiplier(m))).toBe(m);
    }
    expect(nearestSpeedMultiplier(0.9)).toBe(1);
    expect(speedFromMultiplier(0.02)).toBeGreaterThan(0);
  });
});

/* ------------------------------- 3. plans -------------------------------- */

describe("audit · plans, routes and shuffle", () => {
  it("parses picks and routes, keeping route duplicates as separate legs", () => {
    expect(parsePicks("1,3, 5")).toEqual([1, 3, 5]);
    expect(parsePicks("3-5")).toEqual([3, 4, 5]); // v1.4.6 — ranges expand
    expect(parseRoute("6,3,6")).toEqual([6, 3, 6]);
    expect(parsePicks("")).toEqual([]);
    expect(parsePicks("abc")).toEqual([]);
  });

  it("an empty custom / route selection degrades to 'every toggle', never to a dead run", () => {
    expect(effectiveMode(cfg({ mode: "custom" }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "route" }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "shuffle" }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "custom", picks: [2] }))).toBe("custom");
  });

  it("parity and custom picks select the right toggle numbers", () => {
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "odd" }), n))).toEqual([1, 3]);
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "even" }), n))).toEqual([2, 4]);
    expect([1, 2, 3, 4].filter((n) => matchesMode(cfg({ mode: "custom", picks: [2, 4] }), n))).toEqual([2, 4]);
    expect([1, 2, 3].every((n) => matchesMode(cfg(), n))).toBe(true);
  });

  it("unknown modes normalise instead of throwing", () => {
    expect(normalizeMode("nonsense")).toBe("all");
    expect(normalizeMode(undefined)).toBe("all");
    expect(normalizeMode("shuffle")).toBe("shuffle");
  });

  it("route order is the typed order, not document order", () => {
    const stops = buildModeStops(items(8), cfg({ mode: "route", route: [6, 3, 8] }), 800, false);
    const ordered = orderModeStops(stops, cfg({ mode: "route", route: [6, 3, 8] }), false);
    expect(ordered.map((s) => s.ordinal)).toEqual([6, 3, 8]);
  });

  it("reverse flips document-order modes but leaves a route alone", () => {
    const all = cfg();
    const stops = buildModeStops(items(4), all, 800, false);
    expect(orderModeStops(stops, all, true).map((s) => s.ordinal)).toEqual([4, 3, 2, 1]);
    const route = cfg({ mode: "route", route: [2, 4] });
    const rStops = buildModeStops(items(4), route, 800, false);
    expect(orderModeStops(rStops, route, true).map((s) => s.ordinal)).toEqual([2, 4]);
  });

  it("the shuffle range is inclusive, tolerant of reversed bounds and open ends", () => {
    const c = cfg({ mode: "shuffle", route: [1, 2, 3, 4, 5], shuffleFrom: 4, shuffleTo: 2 });
    expect([1, 2, 3, 4, 5].filter((n) => inShuffleRange(c, n))).toEqual([2, 3, 4]);
    expect(inShuffleRange(cfg({ shuffleFrom: 0, shuffleTo: 0 }), 99)).toBe(true);
    expect(inShuffleRange(cfg({ shuffleFrom: 3, shuffleTo: 0 }), 2)).toBe(false);
    expect(inShuffleRange(cfg({ shuffleFrom: 3, shuffleTo: 0 }), 300)).toBe(true);
  });

  it("shuffle drops out-of-range waypoints from both the stops and the order", () => {
    const c = cfg({ mode: "shuffle", route: [5, 1, 3], shuffleFrom: 2, shuffleTo: 4 });
    const stops = buildModeStops(items(6), c, 800, false);
    expect(stops.every((s) => s.ordinal >= 2 && s.ordinal <= 4)).toBe(true);
    expect(orderModeStops(stops, c, false).map((s) => s.ordinal)).toEqual([3]);
  });

  it("tall toggles break into screen-by-screen stops only when chunking is on", () => {
    expect(chunkTops(0, 2400, 800).length).toBeGreaterThan(1);
    expect(chunkTops(0, 300, 800)).toEqual([0]);
    const tall: ModeItem[] = [{ ordinal: 1, top: 0, height: 2400 }];
    expect(buildModeStops(tall, cfg(), 800, true).length).toBeGreaterThan(
      buildModeStops(tall, cfg(), 800, false).length
    );
  });

  it("dwell seconds clamp and format the way the sheet shows them", () => {
    expect(clampDwellSeconds("nonsense")).toBeGreaterThan(0);
    expect(clampDwellSeconds(1e9)).toBe(DWELL_MAX);
    expect(formatDwell(45)).toBe("45s");
    expect(formatDwell(120)).toBe("2m");
    expect(formatDwell(3600)).toBe("1h");
  });

  it("the plan summary states the mode, the loop and the shuffle range", () => {
    expect(modeLabel(cfg({ mode: "custom", picks: [1, 2] }))).toBe("custom (2)");
    const s = planSummary(cfg({ mode: "shuffle", route: [1, 2], loopRoute: true, shuffleFrom: 2, shuffleTo: 5 }));
    expect(s).toContain("shuffle (2)");
    expect(s).toContain("loop ON");
    expect(s).toContain("range 2–5");
    expect(planSummary(cfg())).toBe("Plan: every toggle");
  });
});

/* -------------------------------- 4. quiz -------------------------------- */

describe("audit · quiz", () => {
  const titles = ["Q1", "Q2 ⏱30", "Q3 [2m]"];

  it("reads a per-question time from the title in every documented notation", () => {
    expect(parseQuestionSeconds("Q ⏱30", 20)).toBe(30);
    expect(parseQuestionSeconds("Q ⏱ 15m", 20)).toBe(900);
    expect(parseQuestionSeconds("Q [45s]", 20)).toBe(45);
    expect(parseQuestionSeconds("Q (2h)", 20)).toBe(7200);
    expect(parseQuestionSeconds("Q @20s", 20)).toBe(20);
    expect(parseQuestionSeconds("plain question", 25)).toBe(25);
  });

  it("clamps quiz and reveal durations to their published limits", () => {
    expect(clampQuizSeconds(0)).toBe(1);
    expect(clampQuizSeconds(1e9)).toBe(QUIZ_SECONDS_MAX);
    expect(clampQuizSeconds(Number.NaN)).toBe(DEFAULT_QUIZ.quizSeconds);
    expect(clampRevealSeconds(1e9)).toBe(3600);
    expect(formatQuizSeconds(9000)).toBe("2h 30m");
  });

  it("runs question → reveal → next and finishes exactly once", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 10, quizRevealSeconds: 2 };
    let st = startQuiz(titles, s);
    expect(st.phase).toBe("question");
    expect(st.remaining).toBe(10_000);

    let r = quizTick(st, 10_000, titles, s);
    expect(r.event).toBe("reveal");
    expect(r.state.phase).toBe("reveal");

    r = quizTick(r.state, 2_000, titles, s);
    expect(r.event).toBe("next");
    expect(r.state.at).toBe(1);
    expect(r.state.answered).toBe(1);
    expect(r.state.remaining).toBe(30_000); // Q2's own ⏱30

    // run out the rest
    let guard = 0;
    st = r.state;
    while (st.phase !== "done" && guard < 50) {
      st = quizTick(st, 10_000_000, titles, s).state;
      guard += 1;
    }
    expect(st.phase).toBe("done");
    expect(st.answered).toBe(3);
    expect(quizProgressRatio(st)).toBe(1);
  });

  it("an empty note yields a done quiz instead of a stuck one", () => {
    const st = startQuiz([], DEFAULT_QUIZ);
    expect(st.phase).toBe("done");
    expect(st.running).toBe(false);
    expect(quizTick(st, 1000, [], DEFAULT_QUIZ).event).toBe(null);
  });

  it("skip counts the question and lands on the next one — the Q22 class of bug", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 5 };
    let st = startQuiz(titles, s);
    st = skipQuestion(st, titles, s).state;
    expect(st.at).toBe(1);
    expect(st.answered).toBe(1);
    expect(st.phase).toBe("question");
    st = skipQuestion(st, titles, s).state;
    st = skipQuestion(st, titles, s).state;
    expect(st.phase).toBe("done");
  });

  it("reveal-now only applies during the question phase", () => {
    const st = startQuiz(titles, DEFAULT_QUIZ);
    const revealed = revealNow(st, DEFAULT_QUIZ);
    expect(revealed.event).toBe("reveal");
    expect(revealNow(revealed.state, DEFAULT_QUIZ).event).toBe(null);
  });

  it("pause freezes the countdown and resume continues from the same point", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 10 };
    let st = startQuiz(titles, s);
    st = quizTick(st, 3_000, titles, s).state;
    const frozen = pauseQuiz(st);
    expect(quizTick(frozen, 60_000, titles, s).state.remaining).toBe(frozen.remaining);
    expect(resumeQuiz(frozen).running).toBe(true);
    expect(quizTick(resumeQuiz(frozen), 1_000, titles, s).state.remaining).toBe(6_000);
  });

  it("auto-next off stops after the reveal instead of racing on", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 1, quizRevealSeconds: 1, quizAutoNext: false };
    let st = startQuiz(titles, s);
    st = quizTick(st, 1_000, titles, s).state;
    const after = quizTick(st, 1_000, titles, s).state;
    expect(after.running).toBe(false);
    expect(after.at).toBe(0);
  });

  it("loop restarts at the first question instead of finishing", () => {
    const s = { ...DEFAULT_QUIZ, quizLoop: true };
    const st = startQuiz(titles, s);
    const looped = advance({ ...st, at: titles.length - 1 }, titles, s);
    expect(looped.event).toBe("next");
    expect(looped.state.at).toBe(0);
    expect(looped.state.phase).toBe("question");
  });

  it("healing re-maps detached questions by title, one fresh element each", () => {
    const doc = new Window().document as unknown as Document;
    const mk = (t: string) => {
      const el = doc.createElement("div");
      el.textContent = t;
      doc.body.appendChild(el);
      return el;
    };
    const a = mk("Q1");
    const b = mk("Q2");
    const detached = doc.createElement("div");
    detached.textContent = "Q2";
    expect(needsHeal([a, detached])).toBe(true);
    expect(needsHeal([a, b])).toBe(false);
    const healed = healQuizEls([a, detached], ["Q1", "Q2"], [a, b], (el) => el.textContent ?? "");
    expect(healed[1]).toBe(b);
  });
});

/* ------------------------------- 5. timer -------------------------------- */

describe("audit · pomodoro timer and SM-2", () => {
  it("a focus phase runs down and hands over to a break", () => {
    const s = { ...DEFAULT_POMODORO, autoStartNext: false };
    const st = createState(s);
    expect(st.phase).toBe("focus");
    const mid = tick({ ...st, running: true }, 1000, s);
    expect(mid.phaseEnded).toBe(false);
    const done = tick({ ...st, running: true, remaining: 500 }, 1000, s);
    expect(done.phaseEnded).toBe(true);
    expect(done.endedPhase).toBe("focus");
    expect(done.state.phase).toBe("short");
    expect(done.state.running).toBe(false); // autoStartNext off
  });

  it("a paused timer ignores elapsed time (the focus guard's pause)", () => {
    const s = DEFAULT_POMODORO;
    const st = { ...createState(s), running: false };
    expect(tick(st, 600_000, s).state.remaining).toBe(st.remaining);
  });

  it("the long break arrives after the configured number of sessions", () => {
    const s = { ...DEFAULT_POMODORO, sessionsBeforeLongBreak: 3, autoStartNext: true };
    let st = createState(s);
    const phases: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      st = nextPhase(st, s); // focus done
      phases.push(st.phase);
      st = nextPhase(st, s); // break done -> focus
    }
    expect(phases).toEqual(["short", "short", "long"]);
    expect(phaseDuration("long", s)).toBeGreaterThan(phaseDuration("short", s));
  });

  it("SM-2 grades move the interval the documented way", () => {
    const now = Date.UTC(2026, 0, 1, 10);
    const fresh = newCard();
    const good1 = gradeCard(fresh, "good", now);
    expect(good1.interval).toBe(1);
    const good2 = gradeCard(good1, "good", now);
    expect(good2.interval).toBe(6);
    const good3 = gradeCard(good2, "good", now);
    expect(good3.interval).toBeGreaterThan(6);
    const again = gradeCard(good3, "again", now);
    expect(again.interval).toBe(1);
    expect(again.repetitions).toBe(0);
    expect(again.lapses).toBe(1);
    expect(gradeCard(good2, "easy", now).interval).toBeGreaterThan(
      gradeCard(good2, "hard", now).interval
    );
    for (const g of GRADES) {
      const c = gradeCard(fresh, g, now);
      expect(c.ease).toBeGreaterThanOrEqual(1.3);
      expect(c.ease).toBeLessThanOrEqual(2.7);
      expect(c.interval).toBeLessThanOrEqual(365);
    }
  });

  it("a never-reviewed card is due, a scheduled one is not", () => {
    const now = Date.UTC(2026, 0, 1, 10);
    expect(isDue(undefined, now)).toBe(true);
    expect(isDue(gradeCard(newCard(), "good", now), now)).toBe(false);
  });

  it("the suggested grade follows the reader's own red/yellow/green counts", () => {
    expect(suggestGrade({ red: 5, yellow: 0, green: 0 })).toBe("again");
    expect(suggestGrade({ red: 0, yellow: 0, green: 5 })).toBe("easy");
  });

  it("card maintenance renames, removes and prunes without losing other notes", () => {
    const store = { "a.md": 1, "b.md": 2 };
    expect(renameCardKey(store, "a.md", "c.md")).toEqual({ store: { "c.md": 1, "b.md": 2 }, moved: true });
    expect(renameCardKey(store, "zz.md", "c.md").moved).toBe(false);
    expect(removeCardKey(store, "a.md")).toEqual({ store: { "b.md": 2 }, removed: true });
    expect(pruneCards(store, ["b.md"])).toEqual({ store: { "b.md": 2 }, removed: ["a.md"] });
  });
});

/* ---------------------------- 6. input / links ---------------------------- */

describe("audit · gestures, smart add and deep links", () => {
  it("hold-to-pause ignores controls and cancels on a real scroll", () => {
    const doc = new Window().document as unknown as Document;
    const btn = doc.createElement("button");
    doc.body.appendChild(btn);
    expect(isIgnoredHoldTarget(btn)).toBe(true);
    expect(isIgnoredHoldTarget(doc.body)).toBe(false);
    expect(movedTooFar(0, 4)).toBe(false);
    expect(movedTooFar(0, 40)).toBe(true);
  });

  it("smart add picks the action from the cursor context", () => {
    expect(smartAction({ selection: "text", line: "", insideToggle: false })).toBe("wrap-selection");
    expect(smartAction({ selection: "", line: "> - [ ] option", insideToggle: true })).toBe("mcq-option");
    expect(smartAction({ selection: "", line: "> | a | b |", insideToggle: true })).toBe("match-row");
    expect(smartAction({ selection: "", line: "> **Answer** x", insideToggle: true })).toBe("answer-key");
    expect(smartAction({ selection: "", line: "plain", insideToggle: false })).toBe("new-toggle");
    expect(blankTableRow("> | a | b |").split("|").length).toBeGreaterThan(2);
  });

  it("deep links parse the documented actions and reject anything else", () => {
    expect(parseDeepLink({ action: "stop" })).toEqual({ action: "stop" });
    expect(parseDeepLink({ action: "nope" })).toBe(null);
    const link = parseDeepLink({ action: "quiz", file: "Bio.md", filter: "red,green", seconds: "30" });
    expect(link).toEqual({ action: "quiz", file: "Bio.md", filter: ["red", "green"], seconds: 30 });
    expect(parseFilterParam("all")).toEqual([]);
    expect(parseFilterParam("graded")).toEqual(["red", "yellow", "green"]);
    expect(parseFilterParam("purple")).toBe(undefined);
  });
});
