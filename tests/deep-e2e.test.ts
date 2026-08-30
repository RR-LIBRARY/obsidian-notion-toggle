/**
 * v1.4.5 — deep, end-to-end verification across feature boundaries.
 *
 * The existing suites test one module at a time. This file exercises the
 * combinations a real revision session produces: a saved plan surviving a
 * reload, the colour filter feeding route / shuffle ordering, a quiz run with
 * a filter + open-all answers, and the timer's focus guard driving SM-2.
 */
import { describe, expect, it, beforeEach } from "bun:test";
import { Window } from "happy-dom";

import {
  DEFAULT_AUTOSCROLL,
  colorOf,
  colorCounts,
  filterLabel,
  matchesFilter,
  normalizeFilter,
  planStops,
  firstStopFrom,
  frameDelta,
  clampSpeed,
  sameFilter,
  type RecallColor,
  type ToggleStop,
} from "../src/autoscroll";
import {
  buildModeStops,
  orderModeStops,
  effectiveMode,
  inShuffleRange,
  matchesMode,
  modeLabel,
  planSummary,
  parsePicks,
  parseRoute,
  type ModeConfig,
  type ModeItem,
} from "../src/scrollmode";
import {
  collectToggleEls,
  collectToggleElsFiltered,
  toggleTypeOf,
  toggleTitleOf,
} from "../src/toggle-dom";
import {
  DEFAULT_QUIZ,
  startQuiz,
  quizTick,
  revealNow,
  skipQuestion,
  pauseQuiz,
  resumeQuiz,
  advance,
  quizProgressLabel,
  clampQuizSeconds,
  questionMs,
} from "../src/quiz";
import {
  QUIZ_HIDDEN_CLASS,
  QUIZ_SHOWN_CLASS,
  setQuizVisible,
  isQuizVisible,
  snapshotToggles,
} from "../src/quiz-visibility";
import { needsHeal, healQuizEls } from "../src/quiz-heal";
import {
  DEFAULT_POMODORO,
  createState,
  tick,
  nextPhase,
  shouldAutoPause,
  pauseForInactivity,
  resumeAfterAutoPause,
  isIdle,
  phaseDuration,
  formatTime,
} from "../src/timer";
import { gradeCard, newCard, isDue, suggestGrade, DAY_MS } from "../src/srs";

/* ------------------------------------------------------------------ DOM ---- */

let win: Window;
let doc: Document;

const NOTE = `
  <div class="callout recall-red" data-callout="recall-red"><div class="callout-title">Q1 red</div><div class="callout-content">A1</div></div>
  <div class="callout recall-yellow" data-callout="recall-yellow"><div class="callout-title">Q2 yellow</div><div class="callout-content">A2</div></div>
  <div class="callout recall-green" data-callout="recall-green"><div class="callout-title">Q3 green</div><div class="callout-content">A3</div></div>
  <div class="callout" data-callout="note"><div class="callout-title">Plain wrapper</div>
    <details class="recall-red"><summary>Q4 red nested</summary><p>A4</p></details>
  </div>
  <div class="callout recall-yellow" data-callout="recall-yellow"><div class="callout-title">Q5 yellow</div><div class="callout-content">A5</div></div>
`;

beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
  doc.body.innerHTML = NOTE;
});

const colorsInNote = () =>
  collectToggleEls(doc.body as unknown as ParentNode).map((el) => colorOf(toggleTypeOf(el)));

/* ------------------------------------------------- 1. plan persistence ---- */

/**
 * Mirrors the plugin's `loadSettings` sanitiser (main.ts) so a corrupt or
 * hand-edited data.json can be replayed here without booting Obsidian.
 */
const nums = (v: unknown) =>
  Array.isArray(v) ? v.map((n) => Math.floor(Number(n))).filter((n) => n > 0) : [];

function loadPlan(raw: Record<string, unknown>) {
  const s = { ...DEFAULT_AUTOSCROLL, ...raw } as Record<string, unknown>;
  s.scrollPicks = nums(s.scrollPicks);
  s.scrollRoute = nums(s.scrollRoute);
  s.scrollUserRoute = nums(s.scrollUserRoute);
  if (!(s.scrollUserRoute as number[]).length && s.scrollMode === "route") {
    s.scrollUserRoute = [...(s.scrollRoute as number[])];
  }
  s.scrollLoopRoute = !!s.scrollLoopRoute;
  s.scrollShuffleFrom = Math.max(0, Math.floor(Number(s.scrollShuffleFrom) || 0));
  s.scrollShuffleTo = Math.max(0, Math.floor(Number(s.scrollShuffleTo) || 0));
  return s;
}

describe("plan persistence — survives a reload", () => {
  it("round-trips mode, route, loop and shuffle range through data.json", () => {
    const saved = {
      scrollMode: "route",
      scrollRoute: [7, 2, 9, 2],
      scrollUserRoute: [7, 2, 9, 2],
      scrollLoopRoute: true,
      scrollShuffleFrom: 2,
      scrollShuffleTo: 6,
      scrollFilter: ["red", "yellow"] as RecallColor[],
      scrollReverse: true,
    };
    const reloaded = loadPlan(JSON.parse(JSON.stringify(saved)));
    expect(reloaded.scrollMode).toBe("route");
    expect(reloaded.scrollRoute).toEqual([7, 2, 9, 2]);
    expect(reloaded.scrollLoopRoute).toBe(true);
    expect(reloaded.scrollShuffleFrom).toBe(2);
    expect(reloaded.scrollShuffleTo).toBe(6);
    expect(
      sameFilter(normalizeFilter(reloaded.scrollFilter as RecallColor[]), ["red", "yellow"])
    ).toBe(true);
    expect(reloaded.scrollReverse).toBe(true);
  });

  it("cleans junk written by an older or hand-edited data.json", () => {
    const reloaded = loadPlan({
      scrollMode: "route",
      scrollRoute: ["3", 0, -4, 5.9, "x", null],
      scrollUserRoute: "not-an-array",
      scrollShuffleFrom: "2",
      scrollShuffleTo: -8,
      scrollLoopRoute: "yes",
    });
    expect(reloaded.scrollRoute).toEqual([3, 5]);
    // Empty user route in route mode is backfilled from the live route.
    expect(reloaded.scrollUserRoute).toEqual([3, 5]);
    expect(reloaded.scrollShuffleFrom).toBe(2);
    expect(reloaded.scrollShuffleTo).toBe(0);
    expect(reloaded.scrollLoopRoute).toBe(true);
  });

  it("keeps the typed route when shuffle overwrites the live route", () => {
    const typed = [7, 2, 9, 2];
    const after = loadPlan({
      scrollMode: "shuffle",
      scrollRoute: [4, 1, 8],
      scrollUserRoute: typed,
    });
    expect(after.scrollRoute).toEqual([4, 1, 8]);
    // Switching back to route mode restores the hand-written order.
    expect([...(after.scrollUserRoute as number[])]).toEqual(typed);
  });

  it("ships an empty saved route by default and parses user input into it", () => {
    expect(DEFAULT_AUTOSCROLL.scrollUserRoute).toEqual([]);
    expect(parseRoute("7, 2, 9, 2")).toEqual([7, 2, 9, 2]);
    expect(parsePicks("2, 5, 9")).toEqual([2, 5, 9]);
  });
});

describe("plan toast — one-tap resume path", () => {
  const cfg = (over: Partial<ModeConfig> = {}): ModeConfig => ({
    mode: "all",
    picks: [],
    route: [],
    loopRoute: false,
    shuffleFrom: 0,
    shuffleTo: 0,
    ...over,
  });

  it("an empty custom / route plan falls back to every toggle", () => {
    expect(effectiveMode(cfg({ mode: "custom", picks: [] }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "route", route: [] }))).toBe("all");
    expect(effectiveMode(cfg({ mode: "shuffle", route: [] }))).toBe("all");
  });

  it("resume with every toggle produces the plain plan toast", () => {
    expect(planSummary(cfg())).toBe("Plan: every toggle");
    expect(modeLabel(cfg({ mode: "route", route: [1, 2] }))).toBe("route (2)");
  });

  it("names loop and range for every route/shuffle combination", () => {
    expect(planSummary(cfg({ mode: "route", route: [1], loopRoute: true }))).toBe(
      "Plan: route (1) · loop ON"
    );
    expect(
      planSummary(cfg({ mode: "shuffle", route: [1, 2], shuffleFrom: 0, shuffleTo: 5 }))
    ).toContain("range 1–5");
    expect(planSummary(cfg({ mode: "shuffle", route: [1], shuffleFrom: 3 }))).toContain(
      "range 3–end"
    );
  });
});

/* ---------------------------------------------- 2. autoscroll planning ---- */

const items: ModeItem[] = Array.from({ length: 9 }, (_, i) => ({
  ordinal: i + 1,
  top: i * 500,
  height: 200,
}));

describe("autoscroll plans — every pause-at mode", () => {
  const base: ModeConfig = { mode: "all", picks: [], route: [], loopRoute: false };

  it("odd / even / custom pick the right toggles", () => {
    expect(matchesMode({ ...base, mode: "odd" }, 3)).toBe(true);
    expect(matchesMode({ ...base, mode: "odd" }, 4)).toBe(false);
    expect(matchesMode({ ...base, mode: "even" }, 4)).toBe(true);
    expect(matchesMode({ ...base, mode: "custom", picks: [2, 5] }, 5)).toBe(true);
    expect(matchesMode({ ...base, mode: "custom", picks: [2, 5] }, 6)).toBe(false);
  });

  it("route keeps duplicates and its own order, ignoring document order", () => {
    const cfg: ModeConfig = { ...base, mode: "route", route: [7, 2, 9, 2] };
    const order = orderModeStops(buildModeStops(items, cfg, 800, false), cfg, false).map(
      (s) => s.ordinal
    );
    expect(order).toEqual([7, 2, 9, 2]);
  });

  it("reverse flips document order but never a route", () => {
    const all: ModeConfig = { ...base, mode: "all" };
    const asc = orderModeStops(buildModeStops(items, all, 800, false), all, false).map(
      (s) => s.ordinal
    );
    const desc = orderModeStops(buildModeStops(items, all, 800, false), all, true).map(
      (s) => s.ordinal
    );
    expect(desc).toEqual([...asc].reverse());

    const route: ModeConfig = { ...base, mode: "route", route: [3, 1] };
    expect(
      orderModeStops(buildModeStops(items, route, 800, false), route, true).map((s) => s.ordinal)
    ).toEqual([3, 1]);
  });

  it("shuffle range clips both the stops and the visit order", () => {
    const cfg: ModeConfig = {
      ...base,
      mode: "shuffle",
      route: [1, 4, 8, 5],
      shuffleFrom: 3,
      shuffleTo: 6,
    };
    expect(inShuffleRange(cfg, 2)).toBe(false);
    expect(inShuffleRange(cfg, 5)).toBe(true);
    const order = orderModeStops(buildModeStops(items, cfg, 800, false), cfg, false).map(
      (s) => s.ordinal
    );
    expect(order).toEqual([4, 5]);
  });

  it("tall toggles split into screen-by-screen stops when chunking is on", () => {
    const tall: ModeItem[] = [{ ordinal: 1, top: 0, height: 2400 }];
    const cfg: ModeConfig = { ...base, mode: "all" };
    const flat = buildModeStops(tall, cfg, 800, false);
    const chunked = buildModeStops(tall, cfg, 800, true);
    expect(flat.length).toBe(1);
    expect(chunked.length).toBeGreaterThan(1);
    expect(new Set(chunked.map((s) => s.key)).size).toBe(chunked.length);
  });

  it("loop the route replays from leg 0 instead of ending", () => {
    const cfg: ModeConfig = { ...base, mode: "route", route: [2, 5, 9], loopRoute: true };
    const legs = orderModeStops(buildModeStops(items, cfg, 800, false), cfg, false);
    const visits: number[] = [];
    let at = 0;
    for (let i = 0; i < 7; i++) {
      visits.push(legs[at].ordinal);
      const last = at === legs.length - 1;
      at = last ? (cfg.loopRoute ? 0 : at) : at + 1;
    }
    expect(visits).toEqual([2, 5, 9, 2, 5, 9, 2]);
  });

  it("speed and direction stay inside the documented band", () => {
    expect(clampSpeed(0)).toBeGreaterThan(0);
    expect(clampSpeed(1e9)).toBeLessThanOrEqual(1200);
    expect(frameDelta(100, 1000, false)).toBeCloseTo(100, 5);
    expect(frameDelta(100, 1000, true)).toBeCloseTo(-100, 5);
    expect(frameDelta(100, -5, false)).toBe(0);
  });
});

/* --------------------------------------------------- 3. colour filters ---- */

describe("colour filters — red / yellow / green on real DOM", () => {
  it("reads the outermost toggles; a nested red belongs to its plain parent", () => {
    expect(colorsInNote()).toEqual(["red", "yellow", "green", "other", "yellow"]);
  });

  it("counts and labels each filter selection", () => {
    const counts = colorCounts(colorsInNote());
    expect(counts.red).toBe(1);
    expect(counts.yellow).toBe(2);
    expect(counts.green).toBe(1);
    expect(counts.other).toBe(1);
    expect(filterLabel(normalizeFilter(["red"]))).toBe("🔴");
    expect(filterLabel(normalizeFilter(["red", "yellow", "green"]))).toBe("🔴 🟡 🟢");
    expect(filterLabel([])).toBe("all toggles");
  });

  it("keeps only the selected colours, in every combination", () => {
    const all = colorsInNote();
    const combos: RecallColor[][] = [
      ["red"],
      ["yellow"],
      ["green"],
      ["red", "green"],
      ["yellow", "green"],
      ["red", "yellow", "green"],
    ];
    const kept = combos.map((f) => all.filter((c) => matchesFilter(c, normalizeFilter(f))).length);
    expect(kept).toEqual([1, 2, 1, 2, 3, 4]);
  });

  it("an empty selection means no filtering, not an empty run", () => {
    const all = colorsInNote();
    expect(all.every((c) => matchesFilter(c, normalizeFilter([])))).toBe(true);
  });

  it("a filter that matches nothing yields zero stops (the warning path)", () => {
    doc.body.innerHTML = `<div class="callout recall-red" data-callout="recall-red"><div class="callout-title">only red</div></div>`;
    const stops: ToggleStop[] = collectToggleEls(doc.body as unknown as ParentNode).map((el, i) => ({
      index: i,
      top: i * 400,
      color: colorOf(toggleTypeOf(el)),
    }));
    expect(planStops(stops, normalizeFilter(["green"]), false)).toHaveLength(0);
  });

  it("nested toggles are collected via the filter, not dropped by the parent", () => {
    const reds = collectToggleElsFiltered(
      doc.body as unknown as ParentNode,
      (el) => colorOf(toggleTypeOf(el)) === "red"
    );
    expect(reds).toHaveLength(2);
    expect(toggleTitleOf(reds[1])).toContain("Q4");
  });

  it("filter + reverse + resume position work together", () => {
    const stops: ToggleStop[] = colorsInNote().map((color, i) => ({
      index: i,
      top: i * 400,
      color,
    }));
    const plan = planStops(stops, normalizeFilter(["red", "yellow"]), false);
    expect(plan.map((s) => s.index)).toEqual([0, 1, 4]);
    const rev = planStops(stops, normalizeFilter(["red", "yellow"]), true);
    expect(rev.map((s) => s.index)).toEqual([4, 1, 0]);
    // Mid-note resume: first stop at or after the current offset.
    expect(firstStopFrom(plan, 500, false)).toBe(2);
    expect(firstStopFrom(rev, 500, true)).toBe(1);
    expect(firstStopFrom([], 0, false)).toBe(-1);
  });

  it("route ordering runs on top of the colour filter", () => {
    const filtered = colorsInNote()
      .map((color, i) => ({ ordinal: i + 1, color }))
      .filter((t) => matchesFilter(t.color, normalizeFilter(["red", "yellow"])))
      .map((t) => t.ordinal);
    expect(filtered).toEqual([1, 2, 5]);
    const cfg: ModeConfig = { mode: "route", picks: [], route: [5, 1, 4], loopRoute: false };
    expect(cfg.route.filter((n) => filtered.includes(n))).toEqual([5, 1]);
  });
});

/* -------------------------------------------------------- 4. quiz mode ---- */

describe("quiz mode — full timed run", () => {
  const titles = ["Q1 red", "Q2 yellow", "Q3 green"];

  it("walks question → reveal → next for every question", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 2, quizRevealSeconds: 1, quizAutoNext: true };
    let st = startQuiz(titles, s);
    const events: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = quizTick(st, 1000, titles, s);
      st = r.state;
      if (r.event) events.push(r.event);
      if (st.phase === "done") break;
    }
    expect(events.filter((e) => e === "reveal")).toHaveLength(3);
    expect(events.at(-1)).toBe("done");
    expect(st.answered).toBe(3);
    expect(st.running).toBe(false);
  });

  it("per-question seconds in the title beat the global default", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 20 };
    expect(questionMs("Q1 (45s)", s)).toBe(45_000);
    expect(questionMs("Q1", s)).toBe(20_000);
    expect(clampQuizSeconds(0)).toBeGreaterThan(0);
    expect(clampQuizSeconds(999_999)).toBeLessThanOrEqual(43_200);
  });

  it("pause freezes the countdown and resume continues from the same ms", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 10 };
    let st = startQuiz(titles, s);
    st = quizTick(st, 3000, titles, s).state;
    const frozen = st.remaining;
    st = pauseQuiz(st);
    st = quizTick(st, 5000, titles, s).state;
    expect(st.remaining).toBe(frozen);
    st = resumeQuiz(st);
    st = quizTick(st, 1000, titles, s).state;
    expect(st.remaining).toBe(frozen - 1000);
  });

  it("skip counts the question and never leaves a gap (the Q22 bug)", () => {
    const s = { ...DEFAULT_QUIZ, quizSeconds: 5 };
    let st = startQuiz(titles, s);
    const seen: number[] = [st.at];
    for (let i = 0; i < 2; i++) {
      st = skipQuestion(st, titles, s).state;
      seen.push(st.at);
    }
    expect(seen).toEqual([0, 1, 2]);
    expect(st.answered).toBe(2);
    expect(quizProgressLabel(st)).toContain("3");
  });

  it("loop restarts at Q1 instead of finishing", () => {
    const s = { ...DEFAULT_QUIZ, quizLoop: true };
    const st = advance({ ...startQuiz(titles, s), at: 2 }, titles, s);
    expect(st.state.at).toBe(0);
    expect(st.state.phase).toBe("question");
    expect(st.event).toBe("next");
  });

  it("reveal now jumps to the answer phase only from a question", () => {
    const s = { ...DEFAULT_QUIZ };
    const st = revealNow(startQuiz(titles, s), s);
    expect(st.state.phase).toBe("reveal");
    expect(revealNow(st.state, s).event).toBeNull();
  });

  it("open-all / close-all answers use classes only, never a fold click", () => {
    const els = collectToggleEls(doc.body as unknown as ParentNode);
    const before = snapshotToggles(els);
    for (const el of els) setQuizVisible(el, true);
    expect(els.every((el) => isQuizVisible(el))).toBe(true);
    expect(els.every((el) => el.classList.contains(QUIZ_SHOWN_CLASS))).toBe(true);
    for (const el of els) setQuizVisible(el, false);
    expect(els.every((el) => el.classList.contains(QUIZ_HIDDEN_CLASS))).toBe(true);
    expect(els.some((el) => isQuizVisible(el))).toBe(false);
    expect(before).toHaveLength(els.length);
  });

  it("re-rendered questions heal onto the fresh elements", () => {
    const els = collectToggleEls(doc.body as unknown as ParentNode);
    const titlesNow = els.map((el) => toggleTitleOf(el));
    const detached = doc.createElement("div");
    const broken = [detached as unknown as HTMLElement, ...els.slice(1)];
    expect(needsHeal(broken)).toBe(true);
    const healed = healQuizEls(broken, titlesNow, els, (el) => toggleTitleOf(el));
    expect(needsHeal(healed)).toBe(false);
    expect(healed[0]).toBe(els[0]);
  });

  it("quiz honours the colour filter when picking questions", () => {
    const s = { ...DEFAULT_QUIZ, quizUseColorFilter: true };
    const picked = collectToggleElsFiltered(doc.body as unknown as ParentNode, (el) =>
      s.quizUseColorFilter ? colorOf(toggleTypeOf(el)) === "yellow" : true
    );
    const st = startQuiz(
      picked.map((el) => toggleTitleOf(el)),
      s
    );
    expect(st.total).toBe(2);
    expect(st.running).toBe(true);
  });

  it("an empty question list ends immediately instead of hanging", () => {
    const st = startQuiz([], DEFAULT_QUIZ);
    expect(st.phase).toBe("done");
    expect(st.running).toBe(false);
    expect(quizTick(st, 5000, [], DEFAULT_QUIZ).event).toBeNull();
  });
});

/* ---------------------------------------------- 5. timer + focus guard ---- */

describe("recall timer — pomodoro, focus guard and SM-2", () => {
  it("counts a focus phase down and rolls into the break", () => {
    const s = { ...DEFAULT_POMODORO };
    const st = { ...createState(s), running: true };
    const half = tick(st, 1000, s);
    expect(half.phaseEnded).toBe(false);
    expect(half.state.remaining).toBe(phaseDuration("focus", s) - 1000);
    const done = tick(st, phaseDuration("focus", s), s);
    expect(done.phaseEnded).toBe(true);
    expect(done.endedPhase).toBe("focus");
    expect(done.state.phase).not.toBe("focus");
    expect(formatTime(90_000)).toBe("01:30");
  });

  it("long break arrives after the configured number of sessions", () => {
    const s = { ...DEFAULT_POMODORO, sessionsBeforeLongBreak: 2 };
    let st = createState(s);
    const phases: string[] = [];
    for (let i = 0; i < 4; i++) {
      st = nextPhase({ ...st, remaining: 0 }, s);
      phases.push(st.phase);
    }
    expect(phases).toContain("long");
  });

  it("auto-pauses when the app is hidden or the reader leaves the note", () => {
    const running = { ...createState(DEFAULT_POMODORO), running: true };
    const base = { state: running, enabled: true, visible: true, onSessionNote: true, pinned: true };
    expect(shouldAutoPause({ ...base, visible: false })).toBe("hidden");
    expect(shouldAutoPause({ ...base, onSessionNote: false })).toBe("other-note");
    expect(shouldAutoPause({ ...base, onSessionNote: false, pinned: false })).toBeNull();
    expect(shouldAutoPause(base)).toBeNull();
    expect(shouldAutoPause({ ...base, visible: false, enabled: false })).toBeNull();
    expect(
      shouldAutoPause({ ...base, state: { ...running, running: false }, visible: false })
    ).toBeNull();
  });

  it("idle detection uses the configured minutes", () => {
    const now = 10 * 60_000;
    expect(isIdle(0, now, 5)).toBe(true);
    expect(isIdle(now - 60_000, now, 5)).toBe(false);
    expect(isIdle(0, now, 0)).toBe(false);
  });

  it("auto-resume only restarts a run the guard itself paused", () => {
    const s = { ...DEFAULT_POMODORO };
    const running = { ...createState(s), running: true };
    const auto = pauseForInactivity(running);
    expect(auto.running).toBe(false);
    expect(resumeAfterAutoPause(auto).running).toBe(true);
    const manual = { ...running, running: false };
    expect(resumeAfterAutoPause(manual).running).toBe(false);
  });

  it("SM-2 grades push the next recall further out for easier cards", () => {
    const now = Date.parse("2026-01-01T00:00:00Z");
    const card = newCard();
    const again = gradeCard(card, "again", now);
    const good = gradeCard(gradeCard(card, "good", now), "good", now + DAY_MS);
    const easy = gradeCard(gradeCard(card, "easy", now), "easy", now + DAY_MS);
    expect(again.interval).toBeLessThanOrEqual(good.interval);
    expect(easy.interval).toBeGreaterThanOrEqual(good.interval);
    expect(isDue(again, now + DAY_MS)).toBe(true);
    expect(isDue(easy, now + DAY_MS)).toBe(false);
  });

  it("grade suggestion follows the note's red/yellow/green mix", () => {
    expect(suggestGrade({ red: 5, yellow: 0, green: 0 })).toBe("again");
    expect(suggestGrade({ red: 0, yellow: 0, green: 5 })).toBe("easy");
  });
});

/* -------------------------------------- 6. cross-feature session replay ---- */

describe("end-to-end session — plan + filter + quiz + timer together", () => {
  it("survives a reload mid-session and resumes the same plan", () => {
    // 1. Reader builds a plan.
    const saved = {
      scrollMode: "route",
      scrollRoute: parseRoute("5, 1, 4"),
      scrollUserRoute: parseRoute("5, 1, 4"),
      scrollLoopRoute: true,
      scrollFilter: ["red", "yellow"] as RecallColor[],
      scrollReverse: false,
    };
    // 2. Obsidian restarts — data.json is re-read.
    const reloaded = loadPlan(JSON.parse(JSON.stringify(saved)));
    const cfg: ModeConfig = {
      mode: "route",
      picks: [],
      route: reloaded.scrollRoute as number[],
      loopRoute: reloaded.scrollLoopRoute as boolean,
    };
    // 3. The plan rebuilds against the same note and the same filter.
    const filtered = colorsInNote()
      .map((color, i) => ({ ordinal: i + 1, color }))
      .filter((t) => matchesFilter(t.color, normalizeFilter(reloaded.scrollFilter as RecallColor[])))
      .map((t) => t.ordinal);
    const order = orderModeStops(buildModeStops(items, cfg, 800, false), cfg, false)
      .map((s) => s.ordinal)
      .filter((n) => filtered.includes(n));
    expect(order).toEqual([5, 1]);
    // 4. One tap resumes: the plan toast confirms the restored state.
    expect(planSummary(cfg)).toBe("Plan: route (3) · loop ON");
  });

  it("a quiz can run on the filtered subset while the timer keeps counting", () => {
    const quizSettings = { ...DEFAULT_QUIZ, quizSeconds: 2, quizRevealSeconds: 1 };
    const picked = collectToggleElsFiltered(doc.body as unknown as ParentNode, (el) =>
      matchesFilter(colorOf(toggleTypeOf(el)), normalizeFilter(["red"]))
    );
    const titles = picked.map((el) => toggleTitleOf(el));
    let quiz = startQuiz(titles, quizSettings);
    let timer = { ...createState(DEFAULT_POMODORO), running: true };
    for (let i = 0; i < 9 && quiz.phase !== "done"; i++) {
      quiz = quizTick(quiz, 1000, titles, quizSettings).state;
      timer = tick(timer, 1000, DEFAULT_POMODORO).state;
    }
    expect(quiz.phase).toBe("done");
    expect(quiz.answered).toBe(2);
    expect(timer.running).toBe(true);
    expect(timer.remaining).toBeLessThan(phaseDuration("focus", DEFAULT_POMODORO));
    // The note is handed back exactly as it was found.
    for (const el of picked) setQuizVisible(el, false);
    expect(picked.some((el) => isQuizVisible(el))).toBe(false);
  });
});
