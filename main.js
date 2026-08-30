"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  ANSWER_LINE: () => ANSWER_LINE2,
  CALLOUT_TYPES: () => CALLOUT_TYPES,
  EMPTY_ANSWER_LINE: () => EMPTY_ANSWER_LINE,
  EMPTY_MATCH_ROW: () => EMPTY_MATCH_ROW,
  MATCH_ROW: () => MATCH_ROW,
  MATCH_SEPARATOR: () => MATCH_SEPARATOR,
  MCQ_EMPTY_OPTION: () => MCQ_EMPTY_OPTION,
  MCQ_OPTION: () => MCQ_OPTION2,
  NUMBERED_HEADER: () => NUMBERED_HEADER,
  NUMBERED_SUMMARY: () => NUMBERED_SUMMARY,
  QUIZ_FILTER_OPTIONS: () => QUIZ_FILTER_OPTIONS,
  TOGGLE_COLORS: () => TOGGLE_COLORS,
  TRAFFIC_CYCLE: () => TRAFFIC_CYCLE,
  buildMatchBlock: () => buildMatchBlock,
  buildMcqBlock: () => buildMcqBlock,
  calloutForColor: () => calloutForColor,
  convertCalloutsToDetails: () => convertCalloutsToDetails,
  convertDetailsToCallouts: () => convertDetailsToCallouts,
  default: () => NotionTogglePlugin,
  nextMatchRow: () => nextMatchRow,
  nextToggleNumber: () => nextToggleNumber,
  planBackspace: () => planBackspace,
  planEnter: () => planEnter,
  renumberToggles: () => renumberToggles,
  toggleOptionCheckbox: () => toggleOptionCheckbox
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");

// src/timer.ts
var DEFAULT_POMODORO = {
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
  autoPauseOnLeave: true,
  autoResumeOnReturn: false,
  pinToSessionNote: true,
  idlePauseMinutes: 2,
  autoCollapseOnBreak: false
};
var POMODORO_PRESETS = [
  { id: "classic", label: "Classic 25 / 5", focus: 25, short: 5, long: 15, sessions: 4 },
  { id: "deep", label: "Deep work 50 / 10", focus: 50, short: 10, long: 25, sessions: 3 },
  { id: "quick", label: "Quick recall 15 / 3", focus: 15, short: 3, long: 10, sessions: 4 },
  { id: "custom", label: "Custom (fields below)", focus: 25, short: 5, long: 15, sessions: 4 }
];
function resolvePreset(settings, presetId) {
  const preset = POMODORO_PRESETS.find((p) => p.id === presetId);
  if (!preset || preset.id === "custom")
    return { ...settings, preset: presetId };
  return {
    ...settings,
    preset: preset.id,
    focusMinutes: preset.focus,
    shortBreakMinutes: preset.short,
    longBreakMinutes: preset.long,
    sessionsBeforeLongBreak: preset.sessions
  };
}
function clampMinutes(value, fallback) {
  if (!Number.isFinite(value))
    return fallback;
  return Math.max(1, Math.min(180, Math.round(value)));
}
function phaseDuration(phase, s) {
  const minutes = phase === "focus" ? clampMinutes(s.focusMinutes, 25) : phase === "short" ? clampMinutes(s.shortBreakMinutes, 5) : clampMinutes(s.longBreakMinutes, 15);
  return minutes * 6e4;
}
function phaseLabel(phase) {
  return phase === "focus" ? "Focus" : phase === "short" ? "Short break" : "Long break";
}
function createState(s) {
  return {
    phase: "focus",
    remaining: phaseDuration("focus", s),
    running: false,
    completedInCycle: 0,
    totalFocusSessions: 0,
    totalFocusMinutes: 0,
    autoPaused: false
  };
}
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1e3));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const sec = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function tick(state, elapsed, s) {
  if (!state.running || elapsed <= 0)
    return { state, phaseEnded: false };
  const remaining = state.remaining - elapsed;
  if (remaining > 0)
    return { state: { ...state, remaining }, phaseEnded: false };
  const endedPhase = state.phase;
  const next = nextPhase(state, s);
  return { state: next, phaseEnded: true, endedPhase };
}
function nextPhase(state, s) {
  const cycleSize = Math.max(1, Math.min(8, Math.round(s.sessionsBeforeLongBreak || 4)));
  if (state.phase === "focus") {
    const completed = state.completedInCycle + 1;
    const goLong = completed >= cycleSize;
    const phase = goLong ? "long" : "short";
    return {
      phase,
      remaining: phaseDuration(phase, s),
      running: s.autoStartNext,
      completedInCycle: goLong ? 0 : completed,
      totalFocusSessions: state.totalFocusSessions + 1,
      totalFocusMinutes: state.totalFocusMinutes + clampMinutes(s.focusMinutes, 25)
    };
  }
  return {
    ...state,
    phase: "focus",
    remaining: phaseDuration("focus", s),
    running: s.autoStartNext
  };
}
function resetPhase(state, s) {
  return { ...state, remaining: phaseDuration(state.phase, s), running: false };
}
function sessionSummary(state) {
  return `\u231B ${state.totalFocusSessions} sessions \xB7 ${state.totalFocusMinutes}m`;
}
var HEADER_ANY = /^>\s*\[!([^\]]+)\][+-]/;
function scanRecallStats(doc) {
  const stats = { total: 0, red: 0, yellow: 0, green: 0, firstRedLine: -1 };
  const lines = doc.split("\n");
  lines.forEach((line, i) => {
    const m = line.match(HEADER_ANY);
    if (!m) {
      if (/<summary>/.test(line))
        stats.total += 1;
      return;
    }
    stats.total += 1;
    const type = m[1].toLowerCase();
    if (type === "recall-red") {
      stats.red += 1;
      if (stats.firstRedLine < 0)
        stats.firstRedLine = i;
    } else if (type === "recall-yellow")
      stats.yellow += 1;
    else if (type === "recall-green")
      stats.green += 1;
  });
  return stats;
}
function collapseAllToggles(doc) {
  return doc.split("\n").map(
    (line) => HEADER_ANY.test(line) ? line.replace(/^(>\s*\[![^\]]+\])\+/, "$1-") : line.replace(/^(\s*)<details\s+open>/, "$1<details>")
  ).join("\n");
}
function shouldAutoPause(input) {
  const { state, enabled, visible, onSessionNote, pinned } = input;
  if (!enabled || !state.running)
    return null;
  if (!visible)
    return "hidden";
  if (pinned && !onSessionNote)
    return "other-note";
  return null;
}
function isIdle(lastActivityAt, now, idleMinutes) {
  const minutes = Number.isFinite(idleMinutes) ? idleMinutes : 0;
  if (minutes <= 0)
    return false;
  return now - lastActivityAt >= minutes * 6e4;
}
function pauseForInactivity(state) {
  if (!state.running)
    return state;
  return { ...state, running: false, autoPaused: true };
}
function resumeAfterAutoPause(state) {
  if (!state.autoPaused)
    return state;
  return { ...state, running: true, autoPaused: false };
}
function stopSession(state, s) {
  return {
    ...createState(s),
    totalFocusSessions: state.totalFocusSessions,
    totalFocusMinutes: state.totalFocusMinutes
  };
}
function stopSummary(state) {
  const plural = state.totalFocusSessions === 1 ? "session" : "sessions";
  return `Session stopped \u2014 ${state.totalFocusSessions} focus ${plural} \xB7 ${state.totalFocusMinutes}m total`;
}
function autoPauseNotice(reason2) {
  if (reason2 === "hidden")
    return "\u231B Timer paused \u2014 you left the app.";
  if (reason2 === "other-note")
    return "\u231B Timer paused \u2014 go back to your session note.";
  return "\u231B Timer paused \u2014 no activity.";
}

// src/timer-ui.ts
var EDGE = 8;
var TimerWidget = class {
  constructor(cb, opts) {
    this.cb = cb;
    this.gradeBtns = {};
    this.cleanups = [];
    this.compact = opts.compact;
    this.root = document.createElement("div");
    this.root.className = "notion-toggle-timer";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Recall timer");
    this.build();
    this.applyCompact();
    document.body.appendChild(this.root);
    this.place(opts.x, opts.y, false);
    this.on(window, "resize", () => {
      const rect = this.root.getBoundingClientRect();
      this.place(rect.left, rect.top, false);
    });
    this.on(window, "orientationchange", () => {
      const rect = this.root.getBoundingClientRect();
      this.place(rect.left, rect.top, false);
    });
  }
  build() {
    const head = div(this.root, "ntt-head");
    const grip = div(head, "ntt-grip");
    grip.textContent = "\u22EE\u22EE";
    this.makeDraggable(grip);
    this.makeDraggable(head);
    const info = div(head, "ntt-info");
    this.timeEl = div(info, "ntt-time");
    this.timeEl.textContent = "25:00";
    const meta = div(info, "ntt-meta");
    this.phaseEl = div(meta, "ntt-phase");
    this.phaseEl.textContent = "Focus";
    this.sessionEl = div(meta, "ntt-session");
    this.sessionEl.textContent = "0/4";
    this.compactRunBtn = button(head, "\u25B6", "Start / pause", () => this.cb.onToggleRun());
    this.compactRunBtn.classList.add("ntt-btn-compact");
    const actions = div(this.root, "ntt-actions");
    this.runBtn = button(actions, "\u25B6", "Start / pause", () => this.cb.onToggleRun());
    button(actions, "\u21BA", "Reset phase", () => this.cb.onReset());
    button(actions, "\u23ED", "Skip phase", () => this.cb.onSkip());
    button(actions, "\u25D1", "Compact / expand", () => this.setCompact(!this.compact));
    button(actions, "\u2715", "Hide timer", () => this.cb.onHide());
    const hintRow = div(this.root, "ntt-hint-row");
    this.hintEl = div(hintRow, "ntt-hint");
    this.jumpBtn = button(
      hintRow,
      "\u{1F534}",
      "Jump to first red toggle",
      () => {
        var _a, _b;
        return (_b = (_a = this.cb).onJumpRed) == null ? void 0 : _b.call(_a);
      }
    );
    this.againBtn = button(
      hintRow,
      "\u21BB",
      "Collapse & recall again",
      () => {
        var _a, _b;
        return (_b = (_a = this.cb).onRecallAgain) == null ? void 0 : _b.call(_a);
      }
    );
    setHidden(this.jumpBtn, true);
    setHidden(this.againBtn, true);
    setHidden(hintRow, true);
    this.gradeRow = div(this.root, "ntt-grade-row");
    const grades = [
      ["again", "Again"],
      ["hard", "Hard"],
      ["good", "Good"],
      ["easy", "Easy"]
    ];
    for (const [id, label] of grades) {
      this.gradeBtns[id] = button(
        this.gradeRow,
        label,
        `Grade: ${label}`,
        () => {
          var _a, _b;
          return (_b = (_a = this.cb).onGrade) == null ? void 0 : _b.call(_a, id);
        }
      );
      this.gradeBtns[id].classList.add("ntt-grade", `is-${id}`);
    }
    setHidden(this.gradeRow, true);
    this.scheduleEl = div(this.root, "ntt-schedule");
    setHidden(this.scheduleEl, true);
    this.on(this.timeEl, "click", () => this.setCompact(!this.compact));
  }
  setCompact(compact) {
    this.compact = compact;
    this.applyCompact();
    const rect = this.root.getBoundingClientRect();
    this.place(rect.left, rect.top, false);
    this.cb.onCompactChange(this.compact);
  }
  applyCompact() {
    this.root.classList.toggle("is-compact", this.compact);
  }
  /** Position the widget inside the viewport, optionally snapping to an edge. */
  place(x, y, snap) {
    const rect = this.root.getBoundingClientRect();
    const w = rect.width || 168;
    const h = rect.height || 60;
    let left = clamp(x, EDGE, Math.max(EDGE, window.innerWidth - w - EDGE));
    const top = clamp(y, EDGE, Math.max(EDGE, window.innerHeight - h - EDGE));
    if (snap) {
      const center = left + w / 2;
      left = center < window.innerWidth / 2 ? EDGE : Math.max(EDGE, window.innerWidth - w - EDGE);
    }
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
    return { left: Math.round(left), top: Math.round(top) };
  }
  makeDraggable(handle) {
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let dragging = false;
    const down = (e) => {
      var _a, _b;
      if (((_a = e.target) == null ? void 0 : _a.tagName) === "BUTTON")
        return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = this.root.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      this.root.classList.add("is-dragging");
      (_b = handle.setPointerCapture) == null ? void 0 : _b.call(handle, e.pointerId);
    };
    const move = (e) => {
      if (!dragging)
        return;
      e.preventDefault();
      this.place(originX + (e.clientX - startX), originY + (e.clientY - startY), false);
    };
    const up = () => {
      if (!dragging)
        return;
      dragging = false;
      this.root.classList.remove("is-dragging");
      const rect = this.root.getBoundingClientRect();
      const pos = this.place(rect.left, rect.top, true);
      this.cb.onMove(pos.left, pos.top);
    };
    this.on(handle, "pointerdown", down);
    this.on(window, "pointermove", move);
    this.on(window, "pointerup", up);
    this.on(window, "pointercancel", up);
  }
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn));
  }
  render(data) {
    const { state } = data;
    const label = state.running ? "\u23F8" : "\u25B6";
    this.timeEl.textContent = formatTime(state.remaining);
    this.phaseEl.textContent = phaseLabel(state.phase);
    this.sessionEl.textContent = `${state.completedInCycle}/${data.cycleSize}`;
    this.runBtn.textContent = label;
    this.compactRunBtn.textContent = label;
    this.root.dataset.phase = state.phase;
    this.root.classList.toggle("is-running", state.running);
    this.root.classList.toggle("is-auto-paused", !!state.autoPaused);
    const hintRow = this.hintEl.parentElement;
    if (data.hint) {
      this.hintEl.textContent = data.hint;
      setHidden(hintRow, false);
      setHidden(this.jumpBtn, !data.canJumpRed);
      setHidden(this.againBtn, !data.canRecallAgain);
    } else {
      setHidden(hintRow, true);
    }
    setHidden(this.gradeRow, !data.reviewOpen);
    for (const [id, btn] of Object.entries(this.gradeBtns)) {
      btn.classList.toggle("is-suggested", data.reviewOpen && data.suggestedGrade === id);
    }
    if (data.scheduleLabel) {
      this.scheduleEl.textContent = data.scheduleLabel;
      setHidden(this.scheduleEl, false);
    } else {
      setHidden(this.scheduleEl, true);
    }
  }
  flashPhaseEnd() {
    this.root.classList.remove("ntt-flash");
    void this.root.offsetWidth;
    this.root.classList.add("ntt-flash");
  }
  destroy() {
    for (const fn of this.cleanups)
      fn();
    this.cleanups = [];
    this.root.remove();
  }
};
function clamp(value, min, max) {
  if (!Number.isFinite(value))
    return min;
  return Math.max(min, Math.min(max, value));
}
function div(parent, cls) {
  const el = document.createElement("div");
  el.className = cls;
  parent.appendChild(el);
  return el;
}
function button(parent, label, title, onClick) {
  const el = document.createElement("button");
  el.className = "ntt-btn";
  el.type = "button";
  el.textContent = label;
  el.setAttribute("aria-label", title);
  el.title = title;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  parent.appendChild(el);
  return el;
}
function setHidden(el, hidden) {
  el.classList.toggle("ntt-hidden", hidden);
}

// src/naming.ts
var PRIMARY_IDS = [
  "smart-toggle",
  "smart-colour",
  "smart-recall",
  "smart-review",
  "smart-autoscroll",
  "smart-quiz",
  "scroll-stats"
];
var PRIMARY_NAMES = {
  "smart-toggle": "Toggle (smart add)",
  "smart-colour": "Colour (red \u2192 yellow \u2192 green)",
  "smart-recall": "Recall (start / pause session)",
  "smart-review": "Review (spaced repetition)",
  "smart-autoscroll": "Autoscroll (start / pause revision)",
  "smart-quiz": "Quiz (timed question run)",
  "scroll-stats": "Autoscroll: revision stats (weak toggles)"
};
function isPrimary(id) {
  return PRIMARY_IDS.includes(id);
}
function commandName(id, legacyName, minimal) {
  if (isPrimary(id))
    return PRIMARY_NAMES[id];
  if (!minimal)
    return legacyName;
  if (legacyName.startsWith("Advanced: "))
    return legacyName;
  return `Advanced: ${legacyName}`;
}

// src/smart.ts
var MCQ_OPTION = /^>\s*-\s*\[[ xX]\]/;
var TABLE_ROW = /^>\s*\|.*\|/;
var ANSWER_LINE = /^>\s*(\*\*)?(Answer|Answers|Ans)\b/i;
function smartAction(ctx) {
  if (ctx.selection.trim().length > 0)
    return "wrap-selection";
  if (MCQ_OPTION.test(ctx.line))
    return "mcq-option";
  if (TABLE_ROW.test(ctx.line))
    return "match-row";
  if (ctx.insideToggle && ANSWER_LINE.test(ctx.line))
    return "answer-key";
  return "new-toggle";
}
function smartActionLabel(action) {
  switch (action) {
    case "wrap-selection":
      return "Selection wrapped as toggle";
    case "mcq-option":
      return "Option added";
    case "match-row":
      return "Row added";
    case "answer-key":
      return "Answer key line added";
    default:
      return "New toggle";
  }
}
function blankTableRow(line) {
  const inner = line.replace(/^>\s*/, "").replace(/^\|/, "").replace(/\|\s*$/, "");
  const count = Math.max(2, inner.split("|").length);
  return `> | ${new Array(count).fill("  ").join("| ")}|`;
}

// src/srs.ts
var GRADE_QUALITY = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5
};
var GRADE_LABEL = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy"
};
var MIN_EASE = 1.3;
var MAX_EASE = 2.7;
var DAY_MS = 864e5;
function newCard() {
  return {
    ease: 2.5,
    interval: 0,
    repetitions: 0,
    lapses: 0,
    lastReviewed: 0,
    due: 0
  };
}
function clampEase(ease) {
  if (!Number.isFinite(ease))
    return 2.5;
  return Math.max(MIN_EASE, Math.min(MAX_EASE, Math.round(ease * 100) / 100));
}
function startOfDay(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
function gradeCard(card, grade, now) {
  const base = { ...newCard(), ...card };
  const q = GRADE_QUALITY[grade];
  let { ease, interval, repetitions, lapses } = base;
  ease = clampEase(ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  if (grade === "again") {
    repetitions = 0;
    lapses += 1;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1)
      interval = 1;
    else if (repetitions === 2)
      interval = 6;
    else
      interval = Math.round(interval * ease);
    if (grade === "hard")
      interval = Math.max(1, Math.round(interval * 0.8));
    if (grade === "easy")
      interval = Math.round(interval * 1.3);
  }
  interval = Math.max(1, Math.min(365, interval));
  return {
    ease,
    interval,
    repetitions,
    lapses,
    lastReviewed: now,
    due: startOfDay(now) + interval * DAY_MS
  };
}
function isDue(card, now) {
  if (!card || !card.lastReviewed)
    return true;
  return card.due <= startOfDay(now) + DAY_MS - 1;
}
function daysUntilDue(card, now) {
  if (!card || !card.lastReviewed)
    return 0;
  return Math.round((startOfDay(card.due) - startOfDay(now)) / DAY_MS);
}
var WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function nextDueLabel(card, now) {
  if (!card || !card.lastReviewed)
    return "Not scheduled yet \u2014 grade to start";
  const days = daysUntilDue(card, now);
  if (days <= 0)
    return "Due today";
  const day = WEEKDAYS[new Date(card.due).getDay()];
  if (days === 1)
    return `Next recall: tomorrow (${day})`;
  return `Next recall: ${days} days (${day})`;
}
function dueCount(cards, now) {
  let n = 0;
  for (const key of Object.keys(cards != null ? cards : {})) {
    if (isDue(cards[key], now))
      n += 1;
  }
  return n;
}
function dueNotes(cards, now) {
  return Object.keys(cards != null ? cards : {}).filter((k) => isDue(cards[k], now)).sort((a, b) => {
    var _a, _b, _c, _d;
    return ((_b = (_a = cards[a]) == null ? void 0 : _a.due) != null ? _b : 0) - ((_d = (_c = cards[b]) == null ? void 0 : _c.due) != null ? _d : 0);
  });
}
function suggestGrade(stats) {
  const graded = stats.red + stats.yellow + stats.green;
  if (!graded)
    return "good";
  const redShare = stats.red / graded;
  if (redShare >= 0.5)
    return "again";
  if (redShare > 0 || stats.yellow / graded >= 0.4)
    return "hard";
  if (stats.green === graded)
    return "easy";
  return "good";
}
function dueSummary(cards, now) {
  const n = dueCount(cards, now);
  if (!n)
    return "";
  return ` \xB7 \u23ED ${n} due`;
}

// src/reader/dwellEngine.ts
var DWELL_MIN_SECONDS = 1;
var DWELL_MAX_SECONDS = 3600;
var DWELL_SLIDER_STEPS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  12,
  15,
  20,
  25,
  30,
  40,
  45,
  50,
  60,
  90,
  120,
  150,
  180,
  240,
  300,
  420,
  600,
  900,
  1200,
  1800,
  2400,
  3e3,
  3600
];
var MAX_PAGE_NUMBER = 1e5;
var MAX_LIST_LENGTH = 500;
var DEFAULT_DWELL = {
  enabled: false,
  parity: "odd",
  seconds: 30,
  pages: [],
  route: [],
  loopRoute: false,
  a4: false,
  shuffleFrom: 0,
  shuffleTo: 0
};
var clampDwellSeconds = (n) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(DWELL_MIN_SECONDS, Math.min(DWELL_MAX_SECONDS, Math.round(v))) : DEFAULT_DWELL.seconds;
};
var isPage = (n) => Number.isFinite(n) && n > 0 && n < MAX_PAGE_NUMBER;
var parsePageList = (raw) => {
  const out = /* @__PURE__ */ new Set();
  for (const token of String(raw != null ? raw : "").split(/[^0-9]+/)) {
    if (!token)
      continue;
    const n = parseInt(token, 10);
    if (isPage(n))
      out.add(n);
    if (out.size >= MAX_LIST_LENGTH)
      break;
  }
  return Array.from(out).sort((a, b) => a - b);
};
var parseRouteList = (raw) => {
  const out = [];
  for (const token of String(raw != null ? raw : "").split(/[^0-9]+/)) {
    if (!token)
      continue;
    const n = parseInt(token, 10);
    if (!isPage(n))
      continue;
    if (out.length && out[out.length - 1] === n)
      continue;
    out.push(n);
    if (out.length >= MAX_LIST_LENGTH)
      break;
  }
  return out;
};
var normalizeParity = (p) => p === "even" || p === "all" || p === "custom" || p === "route" || p === "shuffle" ? p : "odd";
var normalizePages = (v) => Array.isArray(v) ? Array.from(new Set(v.map(Number).filter(isPage))).sort((a, b) => a - b).slice(0, MAX_LIST_LENGTH) : [];
var normalizeRoute = (v) => Array.isArray(v) ? v.map(Number).filter(isPage).slice(0, MAX_LIST_LENGTH) : [];
var normalizeBound = (v) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_PAGE_NUMBER) : 0;
};
var normalizeDwell = (v) => ({
  enabled: !!(v == null ? void 0 : v.enabled),
  parity: normalizeParity(v == null ? void 0 : v.parity),
  seconds: clampDwellSeconds(v == null ? void 0 : v.seconds),
  pages: normalizePages(v == null ? void 0 : v.pages),
  route: normalizeRoute(v == null ? void 0 : v.route),
  loopRoute: !!(v == null ? void 0 : v.loopRoute),
  a4: !!(v == null ? void 0 : v.a4),
  shuffleFrom: normalizeBound(v == null ? void 0 : v.shuffleFrom),
  shuffleTo: normalizeBound(v == null ? void 0 : v.shuffleTo)
});
var matchesParity = (cfg, page) => {
  if (cfg.parity === "all")
    return true;
  if (cfg.parity === "custom")
    return cfg.pages.includes(page);
  if (cfg.parity === "route" || cfg.parity === "shuffle")
    return cfg.route.includes(page);
  return cfg.parity === "odd" ? page % 2 === 1 : page % 2 === 0;
};
var isRouteMode = (cfg) => cfg.enabled && cfg.seconds > 0 && (cfg.parity === "route" || cfg.parity === "shuffle") && cfg.route.length > 0;
var waypointReached = (prevPos, pos, target) => (prevPos - target) * (pos - target) <= 0 || Math.abs(pos - target) < 1;
var A4_STOP_OVERLAP = 0.08;
function pageStops(pageTop, pageHeight, viewportHeight) {
  const h = Number(pageHeight) || 0;
  const vh = Number(viewportHeight) || 0;
  if (!(h > 0) || !(vh > 0) || h <= vh + 4)
    return [pageTop];
  const step = Math.max(40, vh * (1 - A4_STOP_OVERLAP));
  const lastOffset = h - vh;
  const out = [];
  for (let o = 0; o < lastOffset - 1; o += step)
    out.push(pageTop + o);
  out.push(pageTop + lastOffset);
  return out;
}
function dwellTargets(boxes, cfg, viewportHeight) {
  const out = [];
  for (const box of boxes) {
    if (!matchesParity(cfg, box.page))
      continue;
    if (!cfg.a4) {
      out.push({ page: box.page, top: box.top, index: 0, key: `${box.page}:0` });
      continue;
    }
    pageStops(box.top, box.height, viewportHeight).forEach((top, index) => {
      out.push({ page: box.page, top, index, key: `${box.page}:${index}` });
    });
  }
  return out.sort((a, b) => a.top - b.top);
}
function crossedTarget(targets, prevPos, pos, dir) {
  const lo = Math.min(prevPos, pos);
  const hi = Math.max(prevPos, pos);
  const hits = targets.filter((t) => t.top > lo + 1e-3 && t.top <= hi + 1e-3);
  return dir < 0 ? hits[hits.length - 1] : hits[0];
}

// src/scrollmode.ts
var DWELL_PRESETS = DWELL_SLIDER_STEPS;
var DWELL_MAX = DWELL_MAX_SECONDS;
var SPEED_MULTIPLIERS = [
  0.02,
  0.05,
  0.1,
  0.2,
  0.5,
  0.75,
  1,
  1.5,
  2,
  3,
  5,
  7,
  10,
  20
];
var BASE_SPEED = 60;
function clampDwellSeconds2(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n))
    return fallback != null ? fallback : DEFAULT_DWELL.seconds;
  return clampDwellSeconds(n);
}
function nearestSpeedMultiplier(mult) {
  const n = Number.isFinite(mult) ? mult : 1;
  let best = SPEED_MULTIPLIERS[0];
  let dist = Infinity;
  for (const m of SPEED_MULTIPLIERS) {
    const d = Math.abs(m - n);
    if (d < dist) {
      dist = d;
      best = m;
    }
  }
  return best;
}
function speedFromMultiplier(mult) {
  return Math.max(0.6, Math.round(BASE_SPEED * nearestSpeedMultiplier(mult) * 100) / 100);
}
function multiplierFromSpeed(px2) {
  return nearestSpeedMultiplier((Number(px2) || BASE_SPEED) / BASE_SPEED);
}
function formatDwell(seconds) {
  const s = clampDwellSeconds2(seconds);
  if (s >= 3600)
    return `${Math.round(s / 3600)}h`;
  if (s >= 60)
    return s % 60 === 0 ? `${s / 60}m` : `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}
function effectiveMode(cfg) {
  if (cfg.mode === "custom" && cfg.picks.length === 0)
    return "all";
  if ((cfg.mode === "route" || cfg.mode === "shuffle") && cfg.route.length === 0)
    return "all";
  return cfg.mode;
}
function toDwellSettings(cfg, seconds = DEFAULT_DWELL.seconds, a4 = true) {
  var _a, _b;
  return normalizeDwell({
    enabled: true,
    parity: effectiveMode(cfg),
    seconds,
    pages: cfg.picks,
    route: cfg.route,
    loopRoute: !!cfg.loopRoute,
    a4,
    shuffleFrom: (_a = cfg.shuffleFrom) != null ? _a : 0,
    shuffleTo: (_b = cfg.shuffleTo) != null ? _b : 0
  });
}
var parsePicks = parsePageList;
var parseRoute = parseRouteList;
function inShuffleRange(cfg, ordinal) {
  var _a, _b;
  const from = Math.max(0, Math.floor((_a = cfg.shuffleFrom) != null ? _a : 0));
  const to = Math.max(0, Math.floor((_b = cfg.shuffleTo) != null ? _b : 0));
  if (!from && !to)
    return true;
  const lo = from || 1;
  const hi = to || Number.MAX_SAFE_INTEGER;
  return ordinal >= Math.min(lo, hi) && ordinal <= Math.max(lo, hi);
}
function buildModeStops(items, cfg, viewport, chunkTall) {
  const boxes = items.map((i) => ({ page: i.ordinal, top: i.top, height: i.height }));
  const stops = dwellTargets(
    boxes,
    toDwellSettings(cfg, DEFAULT_DWELL.seconds, chunkTall),
    viewport
  ).map((t) => ({ ordinal: t.page, top: t.top, part: t.index, key: t.key }));
  if (effectiveMode(cfg) !== "shuffle")
    return stops;
  return stops.filter((s) => inShuffleRange(cfg, s.ordinal));
}
function orderModeStops(stops, cfg, reverse) {
  var _a;
  const mode = effectiveMode(cfg);
  if (mode === "route" || mode === "shuffle") {
    const byOrdinal = /* @__PURE__ */ new Map();
    for (const s of stops) {
      const list = (_a = byOrdinal.get(s.ordinal)) != null ? _a : [];
      list.push(s);
      byOrdinal.set(s.ordinal, list);
    }
    const out = [];
    for (const ordinal of cfg.route) {
      if (mode === "shuffle" && !inShuffleRange(cfg, ordinal))
        continue;
      const list = byOrdinal.get(ordinal);
      if (list)
        out.push(...list);
    }
    return out;
  }
  const sorted = [...stops].sort((a, b) => a.top - b.top);
  return reverse ? sorted.reverse() : sorted;
}
function modeLabel(cfg) {
  switch (cfg.mode) {
    case "all":
      return "every toggle";
    case "odd":
      return "odd toggles";
    case "even":
      return "even toggles";
    case "custom":
      return `custom (${cfg.picks.length})`;
    case "route":
      return `route (${cfg.route.length})`;
    case "shuffle":
      return `shuffle (${cfg.route.length})`;
  }
}
function planSummary(cfg) {
  const parts = [`Plan: ${modeLabel(cfg)}`];
  const mode = effectiveMode(cfg);
  if (mode === "route" || mode === "shuffle") {
    parts.push(cfg.loopRoute ? "loop ON" : "loop OFF");
  }
  const from = Math.max(0, Math.floor(cfg.shuffleFrom || 0));
  const to = Math.max(0, Math.floor(cfg.shuffleTo || 0));
  if (mode === "shuffle") {
    parts.push(from > 0 || to > 0 ? `range ${from || 1}\u2013${to || "end"}` : "range: whole note");
  }
  return parts.join(" \xB7 ");
}
function modeIcon(mode) {
  return mode === "odd" ? "1\uFE0F\u20E3" : mode === "even" ? "2\uFE0F\u20E3" : mode === "custom" ? "\u270D\uFE0F" : mode === "route" ? "\u{1F9ED}" : mode === "shuffle" ? "\u{1F500}" : "\u221E";
}
function legDirection(target, pos, current) {
  const delta = target - pos;
  if (Math.abs(delta) <= 0.5)
    return current;
  return delta > 0 ? 1 : -1;
}
function advancePosition(pos, perFrame, dt, dir, max) {
  return Math.max(0, Math.min(max, pos + perFrame * dt * dir));
}
function seedStartOffset(scrollTop, max, reverse) {
  const top = Math.max(0, Math.min(Math.max(0, max), scrollTop));
  if (max <= 2)
    return top;
  if (reverse && top <= 1)
    return max;
  if (!reverse && top >= max - 1)
    return 0;
  return top;
}
function finishedAtEdge(pos, max, dir, movedPx) {
  if (movedPx <= 1)
    return false;
  return dir < 0 ? pos <= 1 : pos >= max - 1;
}
function frameFactor(deltaMs) {
  return Math.min(4, Math.max(0, deltaMs) / 16.67);
}
function shouldPark(previousKey, crossed) {
  return !!crossed && previousKey !== crossed.key;
}

// src/autoscroll.ts
var DEFAULT_AUTOSCROLL = {
  scrollSpeed: 60,
  scrollReverse: false,
  scrollHold: 4,
  scrollFilter: [],
  scrollAutoOpen: true,
  scrollAutoClose: true,
  scrollLoop: false,
  scrollMode: "all",
  scrollPicks: [],
  scrollRoute: [],
  scrollUserRoute: [],
  scrollLoopRoute: false,
  scrollDebug: false,
  scrollChunkTall: true,
  scrollShuffleFrom: 0,
  scrollShuffleTo: 0,
  scrollRetention: 0.9,
  scrollNewMix: 0.35,
  scrollAutoGrade: true,
  scrollMemory: {},
  scrollPerNote: {}
};
var SPEED_MIN = 1;
var SPEED_MAX = 1200;
var SPEED_STEP = 20;
function clampSpeed(px2) {
  if (!Number.isFinite(px2))
    return DEFAULT_AUTOSCROLL.scrollSpeed;
  const rounded = Math.round(px2 * 100) / 100;
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, rounded));
}
function clampHold(seconds) {
  if (!Number.isFinite(seconds))
    return DEFAULT_AUTOSCROLL.scrollHold;
  return Math.min(DWELL_MAX, Math.max(0, Math.round(seconds)));
}
function colorOf(calloutType) {
  const t = (calloutType != null ? calloutType : "").toLowerCase();
  if (t.includes("recall-red"))
    return "red";
  if (t.includes("recall-yellow"))
    return "yellow";
  if (t.includes("recall-green"))
    return "green";
  return "other";
}
function matchesFilter(color, filter) {
  if (!filter || filter.length === 0)
    return true;
  return filter.includes(color);
}
function planStops(stops, filter, reverse) {
  const kept = stops.filter((s) => matchesFilter(s.color, filter));
  const sorted = [...kept].sort((a, b) => a.top - b.top);
  return reverse ? sorted.reverse() : sorted;
}
function firstStopFrom(plan, scrollTop, reverse) {
  if (plan.length === 0)
    return -1;
  const hit = plan.findIndex((s) => reverse ? s.top <= scrollTop : s.top >= scrollTop);
  return hit >= 0 ? hit : 0;
}
function targetOffset(stopTop, viewportHeight) {
  return Math.max(0, Math.round(stopTop - viewportHeight * 0.3));
}
var COLOR_ORDER = ["red", "yellow", "green", "other"];
function normalizeFilter(filter) {
  if (!filter || filter.length === 0)
    return [];
  return COLOR_ORDER.filter((c) => filter.includes(c));
}
function sameFilter(a, b) {
  const na = normalizeFilter(a);
  const nb = normalizeFilter(b);
  return na.length === nb.length && na.every((c, i) => c === nb[i]);
}
function colorCounts(colors) {
  const out = { red: 0, yellow: 0, green: 0, other: 0 };
  for (const c of colors)
    out[c] += 1;
  return out;
}
function filterLabel(filter) {
  if (!filter || filter.length === 0)
    return "all toggles";
  const icon = {
    red: "\u{1F534}",
    yellow: "\u{1F7E1}",
    green: "\u{1F7E2}",
    other: "\u26AA"
  };
  return normalizeFilter(filter).map((c) => icon[c]).join(" ");
}
function sessionLabel(s, stops) {
  const dir = s.scrollReverse ? "reverse \u2191" : "forward \u2193";
  return `Autoscroll ${dir} \xB7 ${clampSpeed(s.scrollSpeed)} px/s \xB7 ${filterLabel(
    s.scrollFilter
  )} \xB7 ${stops} stop${stops === 1 ? "" : "s"}`;
}

// src/debug-overlay.ts
var px = (n) => `${Math.round(n)}`;
function debugLines(f) {
  var _a, _b, _c, _d, _e, _f;
  const lines = [
    `pos ${f.pos.toFixed(2)} \u2192 top ${px(f.scrollTop)} / ${px(f.max)}`,
    `dir ${f.dir > 0 ? "down \u2193" : "up \u2191"} \xB7 ${f.speed.toFixed(2)} px/s \xB7 frac ${(f.pos - Math.floor(f.pos)).toFixed(2)}`,
    `mode ${f.mode}${f.routeMode ? " (route legs)" : ""} \xB7 stops ${f.stops}`
  ];
  if (f.routeMode) {
    lines.push(
      `leg ${Math.min(f.routeIdx + 1, f.routeLen)}/${f.routeLen} \u2192 target ${f.target == null ? "\u2014" : px(f.target)}${f.routeStops > 1 ? ` \xB7 screen ${f.routeStop + 1}/${f.routeStops}` : ""}`
    );
  } else {
    lines.push(`stop index ${f.at < 0 ? "\u2014" : f.at}`);
  }
  lines.push(`dwellKey ${(_a = f.dwellKey) != null ? _a : "\u2014"} \xB7 ${f.dwellLeft > 0 ? `paused ${(f.dwellLeft / 1e3).toFixed(1)}s` : "running"}`);
  if (f.filter !== void 0) {
    const c = (_b = f.colors) != null ? _b : { red: 0, yellow: 0, green: 0, other: 0 };
    const found = (_c = f.stopsFound) != null ? _c : 0;
    const kept = (_d = f.stopsKept) != null ? _d : 0;
    lines.push(
      `filter ${f.filter} \xB7 kept ${kept}/${found} (\u{1F534}${c.red} \u{1F7E1}${c.yellow} \u{1F7E2}${c.green} \u26AA${c.other})`
    );
    if (f.filter !== "all toggles" && kept === 0) {
      lines.push(`\u26A0 filter matches 0 of ${found} toggles`);
    }
    lines.push(`target ${(_e = f.targetColor) != null ? _e : "\u2014"} \u2190 "${(_f = f.targetType) != null ? _f : "\u2014"}"`);
  }
  lines.push(`event ${f.lastEvent || "\u2014"}`);
  lines.push(`grade ${f.lastGrade || "\u2014"}`);
  if (f.progress)
    lines.push(f.progress);
  return lines;
}
var ScrollDebugOverlay = class {
  constructor() {
    this.root = null;
    this.body = null;
  }
  mount(parent) {
    if (this.root)
      return;
    const root = parent.createDiv({ cls: "notion-toggle-scroll-debug" });
    root.createDiv({ cls: "notion-toggle-scroll-debug-title", text: "autoscroll debug" });
    this.body = root.createDiv({ cls: "notion-toggle-scroll-debug-body" });
    this.root = root;
  }
  update(frame) {
    if (!this.body)
      return;
    this.body.empty();
    for (const line of debugLines(frame)) {
      this.body.createDiv({ text: line });
    }
  }
  destroy() {
    var _a;
    (_a = this.root) == null ? void 0 : _a.remove();
    this.root = null;
    this.body = null;
  }
};

// src/recolor.ts
var TRAFFIC_CYCLE = ["recall-red", "recall-yellow", "recall-green"];
function calloutTypeOfLine(line) {
  var _a, _b, _c;
  return (_c = (_b = (_a = line.match(/^>\s*\[!([^\]]+)\]/)) == null ? void 0 : _a[1]) == null ? void 0 : _b.trim()) != null ? _c : "";
}
function nextTrafficColor(current) {
  const idx = TRAFFIC_CYCLE.indexOf(current.trim());
  if (idx < 0)
    return TRAFFIC_CYCLE[0];
  return TRAFFIC_CYCLE[(idx + 1) % TRAFFIC_CYCLE.length];
}
function recolorHeaderLine(line, callout) {
  return line.replace(/^(>\s*)\[![^\]]+\]([+-]?)/, `$1[!${callout}]$2`);
}

// src/autoscroll-ui.ts
var ScrollBar = class {
  constructor(cb) {
    this.cb = cb;
    this.root = document.createElement("div");
    this.root.className = "ntt-scroll-bar";
    const row = document.createElement("div");
    row.className = "ntt-scroll-row";
    this.root.appendChild(row);
    const btn = (text, cls, fn) => {
      const b = document.createElement("button");
      b.className = `ntt-btn ntt-scroll-btn ${cls}`;
      b.textContent = text;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      row.appendChild(b);
      return b;
    };
    this.runBtn = btn("\u23F8", "is-run", () => this.cb.onToggleRun());
    btn("\u2212", "is-slower", () => this.cb.onSlower());
    btn("+", "is-faster", () => this.cb.onFaster());
    this.revBtn = btn("\u2193", "is-reverse", () => this.cb.onReverse());
    this.filterBtn = btn("\u{1F534}", "is-filter", () => this.cb.onFilter());
    this.modeBtn = btn("\u221E", "is-mode", () => {
      var _a, _b;
      return (_b = (_a = this.cb).onMode) == null ? void 0 : _b.call(_a);
    });
    this.dwellBtn = btn("\u23F1", "is-dwell", () => {
      var _a, _b;
      return (_b = (_a = this.cb).onDwell) == null ? void 0 : _b.call(_a);
    });
    btn("\u2912", "is-top", () => {
      var _a, _b;
      return (_b = (_a = this.cb).onTop) == null ? void 0 : _b.call(_a);
    });
    btn("\u2715", "is-close", () => this.cb.onClose());
    this.runBtn.addEventListener("dblclick", () => {
      var _a, _b;
      return (_b = (_a = this.cb).onSpeedPresets) == null ? void 0 : _b.call(_a);
    });
    this.infoEl = document.createElement("div");
    this.infoEl.className = "ntt-scroll-info";
    this.root.appendChild(this.infoEl);
    document.body.appendChild(this.root);
  }
  render(d) {
    var _a, _b, _c, _d, _e, _f;
    this.runBtn.textContent = d.running ? "\u23F8" : "\u25B6";
    this.revBtn.textContent = d.reverse ? "\u2191" : "\u2193";
    this.revBtn.setAttribute("aria-label", d.reverse ? "Reverse (up)" : "Forward (down)");
    this.filterBtn.textContent = d.filterLabel === "all toggles" ? "\u26AA" : d.filterLabel;
    this.modeBtn.textContent = (_a = d.modeIcon) != null ? _a : "\u221E";
    this.modeBtn.setAttribute("aria-label", `Pause at: ${(_b = d.modeLabel) != null ? _b : "every toggle"}`);
    this.dwellBtn.textContent = (_c = d.dwellLabel) != null ? _c : "\u23F1";
    this.dwellBtn.setAttribute("aria-label", `Pause for ${(_d = d.dwellLabel) != null ? _d : ""}`);
    this.infoEl.textContent = `${(_e = d.speedLabel) != null ? _e : `${Math.round(d.speed)} px/s`} \xB7 ${(_f = d.modeLabel) != null ? _f : "every toggle"} \xB7 ${d.progress}`;
    this.root.classList.toggle("is-running", d.running);
  }
  destroy() {
    this.root.remove();
  }
};

// src/hold-pause.ts
var HOLD_PAUSE_MS = 250;
var HOLD_MOVE_TOLERANCE_PX = 12;
var HOLD_IGNORE_SELECTOR = ".ntt-fab-wrap, .ntt-scroll-bar, .modal, .modal-container, .menu, .notice, button, a, input, textarea, select";
function isIgnoredHoldTarget(target) {
  const el = target;
  if (!el || typeof el.closest !== "function")
    return false;
  return !!el.closest(HOLD_IGNORE_SELECTOR);
}
function movedTooFar(dx, dy, tolerance = HOLD_MOVE_TOLERANCE_PX) {
  return Math.abs(dx) > tolerance || Math.abs(dy) > tolerance;
}
var HoldPause = class {
  constructor(cb) {
    this.cb = cb;
    this.timer = null;
    this.held = false;
    this.startX = 0;
    this.startY = 0;
    this.attached = false;
    this.doc = null;
    this.down = (e) => {
      var _a;
      if (!this.cb.isActive())
        return;
      if (isIgnoredHoldTarget(e.target))
        return;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.cancel();
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.held = true;
        this.cb.onHold();
      }, (_a = this.cb.holdMs) != null ? _a : HOLD_PAUSE_MS);
    };
    this.move = (e) => {
      if (this.timer === null)
        return;
      if (movedTooFar(e.clientX - this.startX, e.clientY - this.startY))
        this.cancel();
    };
    this.up = () => {
      this.cancel();
      if (!this.held)
        return;
      this.held = false;
      this.cb.onRelease();
    };
  }
  attach(doc = document) {
    if (this.attached)
      return;
    this.attached = true;
    doc.addEventListener("pointerdown", this.down, true);
    doc.addEventListener("pointermove", this.move, true);
    doc.addEventListener("pointerup", this.up, true);
    doc.addEventListener("pointercancel", this.up, true);
    window.addEventListener("blur", this.up);
    this.doc = doc;
  }
  detach() {
    var _a;
    if (!this.attached)
      return;
    this.attached = false;
    const doc = (_a = this.doc) != null ? _a : document;
    doc.removeEventListener("pointerdown", this.down, true);
    doc.removeEventListener("pointermove", this.move, true);
    doc.removeEventListener("pointerup", this.up, true);
    doc.removeEventListener("pointercancel", this.up, true);
    window.removeEventListener("blur", this.up);
    this.cancel();
    if (this.held) {
      this.held = false;
      this.cb.onRelease();
    }
  }
  cancel() {
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
  /** Testing helper. */
  isHolding() {
    return this.held;
  }
};

// src/scroll-fab.ts
var FAB_LONG_PRESS_MS = 500;
var FAB_MOVE_TOLERANCE_PX = 12;
var FAB_AUTO_HIDE_MS = 3e3;
var FAB_PROGRAMMATIC_WINDOW_MS = 150;
var programmaticUntil = 0;
function markProgrammaticScroll(now = Date.now()) {
  programmaticUntil = now + FAB_PROGRAMMATIC_WINDOW_MS;
}
function isProgrammaticScroll(now = Date.now()) {
  return now < programmaticUntil;
}
var SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs))
    el.setAttribute(k, v);
  return el;
}
function buildLayersIcon(reverse = false, running = false) {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "40",
    height: "40",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  svg.classList.add("ntt-fab-layers");
  if (reverse)
    svg.classList.add("is-reverse");
  if (running)
    svg.classList.add("is-stepping");
  const plate = svgEl("path", { d: "M12 2.6 21.2 8 12 13.4 2.8 8Z" });
  plate.classList.add("ntt-layer", "ntt-layer-1");
  const mid = svgEl("path", { d: "M3 12.1 12 17.3 21 12.1" });
  mid.classList.add("ntt-layer", "ntt-layer-2");
  const low = svgEl("path", { d: "M3 16.2 12 21.4 21 16.2" });
  low.classList.add("ntt-layer", "ntt-layer-3");
  svg.appendChild(plate);
  svg.appendChild(mid);
  svg.appendChild(low);
  return svg;
}
function buildPlayIcon(reverse = false) {
  return buildLayersIcon(reverse, false);
}
var ScrollFab = class {
  constructor(cb) {
    this.cb = cb;
    this.pressTimer = null;
    this.startX = 0;
    this.startY = 0;
    this.longFired = false;
    /* v1.1.8 auto-hide state (ported from the reader's useReaderChrome). */
    this.hideTimer = null;
    this.pinned = false;
    this.reverse = false;
    this.running = false;
    this.wake = () => this.show();
    this.wakeScroll = () => {
      if (isProgrammaticScroll())
        return;
      this.show();
    };
    this.wrap = document.createElement("div");
    this.wrap.className = "ntt-fab-wrap";
    this.root = document.createElement("button");
    this.root.className = "ntt-fab";
    this.icon = document.createElement("span");
    this.icon.className = "ntt-fab-icon";
    this.icon.appendChild(buildPlayIcon());
    this.root.appendChild(this.icon);
    this.root.type = "button";
    this.root.setAttribute("aria-label", "Autoscroll \u2014 tap to start, hold for settings");
    this.root.setAttribute("aria-pressed", "false");
    this.root.setAttribute("aria-keyshortcuts", "Control+Shift+S");
    this.root.title = "Autoscroll \u2014 tap to start, hold for settings";
    this.sr = document.createElement("span");
    this.sr.className = "ntt-fab-sr";
    this.sr.setAttribute("aria-live", "polite");
    this.sr.textContent = "Autoscroll stopped";
    this.root.appendChild(this.sr);
    this.setRunning(false);
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (e.shiftKey)
          this.cb.onLongPress();
        else
          this.cb.onTap();
        this.show();
      }
    });
    this.root.addEventListener("focus", () => this.show());
    this.root.addEventListener("pointerdown", (e) => {
      this.longFired = false;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.cancelTimer();
      this.pressTimer = window.setTimeout(() => {
        this.pressTimer = null;
        this.longFired = true;
        this.root.classList.add("is-pressed");
        this.cb.onLongPress();
      }, FAB_LONG_PRESS_MS);
    });
    this.root.addEventListener("pointermove", (e) => {
      if (this.pressTimer === null)
        return;
      const dx = Math.abs(e.clientX - this.startX);
      const dy = Math.abs(e.clientY - this.startY);
      if (dx > FAB_MOVE_TOLERANCE_PX || dy > FAB_MOVE_TOLERANCE_PX) {
        this.cancelTimer();
      }
    });
    const finish = (e) => {
      this.root.classList.remove("is-pressed");
      if (this.pressTimer !== null) {
        this.cancelTimer();
        if (!this.longFired) {
          e.preventDefault();
          this.cb.onTap();
        }
      }
    };
    this.root.addEventListener("pointerup", finish);
    this.root.addEventListener("pointercancel", () => {
      this.cancelTimer();
      this.root.classList.remove("is-pressed");
    });
    this.root.addEventListener("click", (e) => e.preventDefault());
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
    this.wrap.appendChild(this.root);
    document.body.appendChild(this.wrap);
    document.addEventListener("pointerdown", this.wake, true);
    document.addEventListener("scroll", this.wakeScroll, true);
    this.arm();
  }
  cancelTimer() {
    if (this.pressTimer !== null) {
      window.clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
  }
  /** v1.4.2 — direction indicator: the chevron flips while reverse is on. */
  setReverse(reverse) {
    if (this.reverse === reverse)
      return;
    this.reverse = reverse;
    this.setRunning(this.running);
  }
  setRunning(running) {
    var _a;
    this.running = running;
    this.icon.textContent = "";
    this.icon.appendChild(buildLayersIcon(this.reverse, running));
    this.root.classList.toggle("is-reverse", this.reverse);
    this.root.setAttribute("aria-pressed", running ? "true" : "false");
    const dir = this.reverse ? "reverse, upwards" : "forward, downwards";
    if (this.sr) {
      this.sr.textContent = running ? `Autoscroll running ${dir}` : `Autoscroll stopped (${dir})`;
    }
    this.root.classList.toggle("is-running", running);
    this.wrap.classList.toggle("is-running", running);
    this.root.setAttribute(
      "aria-label",
      running ? `Autoscroll running ${dir} \u2014 tap to pause` : `Autoscroll (${dir}) \u2014 tap to start, hold for settings`
    );
    this.root.title = (_a = this.root.getAttribute("aria-label")) != null ? _a : "";
  }
  /* ---------- v1.1.8: auto-hide ---------- */
  clearHide() {
    if (this.hideTimer !== null) {
      window.clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }
  arm() {
    var _a;
    this.clearHide();
    if (this.pinned)
      return;
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = null;
      this.wrap.classList.add("is-hidden");
    }, (_a = this.cb.hideAfterMs) != null ? _a : FAB_AUTO_HIDE_MS);
  }
  /** Show the button and restart the idle timer. */
  show() {
    this.wrap.classList.remove("is-hidden");
    this.arm();
  }
  /** Keep the button on screen regardless of the idle timer (e.g. when paused). */
  setPinned(pinned) {
    this.pinned = pinned;
    if (pinned) {
      this.clearHide();
      this.wrap.classList.remove("is-hidden");
    } else {
      this.arm();
    }
  }
  isHidden() {
    return this.wrap.classList.contains("is-hidden");
  }
  destroy() {
    this.cancelTimer();
    this.clearHide();
    document.removeEventListener("pointerdown", this.wake, true);
    document.removeEventListener("scroll", this.wakeScroll, true);
    this.wrap.remove();
  }
};

// src/guide.ts
var TOOLBAR_COMMANDS = [
  {
    id: "smart-autoscroll",
    name: "Autoscroll (start / pause revision)",
    why: "Ek tap se autoscroll shuru ya pause \u2014 sabse zaroori.",
    priority: 1
  },
  {
    id: "autoscroll-sheet",
    name: "Autoscroll: sheet (all controls)",
    why: "Saare controls \u2014 speed, pause, filter, mode \u2014 ek sheet me.",
    priority: 2
  },
  {
    id: "autoscroll-reverse",
    name: "Autoscroll: reverse direction",
    why: "Fast revision ke liye neeche \u2192 upar scroll.",
    priority: 3
  },
  {
    id: "autoscroll-filter",
    name: "Autoscroll: choose colour filter",
    why: "Sirf \u{1F534} / \u{1F7E1} / \u{1F7E2} toggles par rukna ho to.",
    priority: 4
  },
  {
    id: "autoscroll-mode",
    name: "Autoscroll: pause at (odd / even / custom / route / shuffle)",
    why: "Kaunse toggles par rukna hai \u2014 odd/even/route/shuffle.",
    priority: 5
  },
  {
    id: "autoscroll-dwell",
    name: "Autoscroll: pause for (hold time)",
    why: "Har toggle par kitni der ruke (5s \u2026 1h).",
    priority: 6
  },
  {
    id: "autoscroll-speed-presets",
    name: "Autoscroll: speed presets (0.02x \u2026 20x)",
    why: "Reader wali speed chips \u2014 0.02x se 20x tak.",
    priority: 7
  },
  {
    id: "autoscroll-top",
    name: "Autoscroll: go to first toggle",
    why: "Wapas note ke shuruaat / aakhir par jump.",
    priority: 8
  },
  {
    id: "scroll-stats",
    name: "Autoscroll: revision stats (weak toggles)",
    why: "Shuffle kis ko pehle laata hai aur kyun \u2014 FSRS stats.",
    priority: 9
  },
  {
    id: "autoscroll-stop",
    name: "Autoscroll: stop",
    why: "Session poori tarah band kare (floating bar ka \u2715 bhi yehi karta hai).",
    priority: 10
  },
  {
    id: "smart-quiz",
    name: "Quiz (timed question run)",
    why: "Toolbar se ek tap me quiz mode \u2014 timer, auto reveal, auto next.",
    priority: 11
  },
  {
    id: "quiz-pause",
    name: "Quiz: pause / resume",
    why: "Quiz ke beech me rukna ho to \u2014 wahi tap se resume.",
    priority: 12
  }
];
var TOOLBAR_STEPS = [
  "Obsidian me Settings \u2699\uFE0F kholo.",
  "Mobile section me jao \u2192 Manage toolbar.",
  "Wahan + / Add command dabao aur neeche wali commands ek-ek karke add karo.",
  "Jo add ho gayi, us row par tap karke tick \u2713 kar do \u2014 list yaad rehti hai.",
  "Ab koi note kholo aur toolbar se \u25B6 Autoscroll ya \u2753 Quiz dabao \u2014 bas!"
];
function toggleGuideDone(done, id) {
  const set = new Set(done);
  if (set.has(id))
    set.delete(id);
  else
    set.add(id);
  return TOOLBAR_COMMANDS.filter((c) => set.has(c.id)).map((c) => c.id);
}
function guideProgress(done) {
  const known = new Set(TOOLBAR_COMMANDS.map((c) => c.id));
  const count = done.filter((id) => known.has(id)).length;
  return `${count}/${TOOLBAR_COMMANDS.length}`;
}
function fabShouldShow(enabled, noteOpen, _controlBarVisible = false, markdownViewActive = true, overlayOpen = false) {
  return enabled && noteOpen && markdownViewActive && !overlayOpen;
}
var MSG_NOT_RUNNING = 'Autoscroll band hai \u2014 pehle "Autoscroll (start / pause revision)" chalao (Ctrl/Cmd+Shift+S), ya floating \u25B6 dabao.';
var MSG_PLAIN_SCROLL = "Is note me koi toggle nahi mila \u2014 plain scroll chalu (koi stop nahi). Toggle chahiye to > [!note]- banao.";
var HOTKEYS = [
  { id: "smart-autoscroll", label: "Ctrl/Cmd+Shift+S" },
  { id: "autoscroll-reverse", label: "Ctrl/Cmd+Shift+R" },
  { id: "autoscroll-sheet", label: "Ctrl/Cmd+Shift+A" }
];
function hotkeyLabel(id) {
  var _a, _b;
  return (_b = (_a = HOTKEYS.find((h) => h.id === id)) == null ? void 0 : _a.label) != null ? _b : "";
}

// src/reader/fsrsScheduler.ts
var FSRS_W = [
  0.4072,
  1.1829,
  3.1262,
  15.4722,
  7.2102,
  0.5316,
  1.0651,
  0.0234,
  1.616,
  0.1544,
  1.0824,
  1.9813,
  0.0953,
  0.2975,
  2.2042,
  0.2407,
  2.9466,
  0.5034,
  0.6567
];
var DECAY = -0.5;
var FACTOR = Math.pow(0.9, 1 / DECAY) - 1;
var RETENTION_TARGET = 0.9;
var MS_PER_DAY = 864e5;
var clamp2 = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
var newCard2 = (page) => ({
  page,
  difficulty: 0,
  stability: 0,
  lastReviewedAt: 0,
  reps: 0,
  lapses: 0
});
var isNewCard = (c) => !c.lastReviewedAt || c.stability <= 0;
var elapsedDays = (card, now) => Math.max(0, (now - card.lastReviewedAt) / MS_PER_DAY);
function retrievability(card, now) {
  if (isNewCard(card))
    return 0;
  const t = elapsedDays(card, now);
  return clamp2(Math.pow(1 + FACTOR * (t / card.stability), DECAY), 0, 1);
}
var isDue2 = (card, now, retention = RETENTION_TARGET) => !isNewCard(card) && retrievability(card, now) < retention;
var initialStability = (g) => Math.max(0.1, FSRS_W[g - 1]);
var initialDifficulty = (g) => clamp2(FSRS_W[4] - Math.exp(FSRS_W[5] * (g - 1)) + 1, 1, 10);
var nextDifficulty = (d, g) => {
  const delta = d - FSRS_W[6] * (g - 3);
  const reverted = FSRS_W[7] * initialDifficulty(4) + (1 - FSRS_W[7]) * delta;
  return clamp2(reverted, 1, 10);
};
var recallStability = (d, s, r, g) => {
  const hardPenalty = g === 2 ? FSRS_W[15] : 1;
  const easyBonus = g === 4 ? FSRS_W[16] : 1;
  return s * (1 + Math.exp(FSRS_W[8]) * (11 - d) * Math.pow(s, -FSRS_W[9]) * (Math.exp((1 - r) * FSRS_W[10]) - 1) * hardPenalty * easyBonus);
};
var forgetStability = (d, s, r) => FSRS_W[11] * Math.pow(d, -FSRS_W[12]) * (Math.pow(s + 1, FSRS_W[13]) - 1) * Math.exp((1 - r) * FSRS_W[14]);
function reviewCard(card, grade, now) {
  if (isNewCard(card)) {
    return {
      ...card,
      difficulty: initialDifficulty(grade),
      stability: initialStability(grade),
      lastReviewedAt: now,
      reps: card.reps + 1,
      lapses: card.lapses + (grade === 1 ? 1 : 0)
    };
  }
  const r = retrievability(card, now);
  const d = nextDifficulty(card.difficulty, grade);
  const s = grade === 1 ? Math.min(forgetStability(card.difficulty, card.stability, r), card.stability) : recallStability(card.difficulty, card.stability, r, grade);
  return {
    ...card,
    difficulty: d,
    stability: clamp2(Number.isFinite(s) ? s : card.stability, 0.1, 36500),
    lastReviewedAt: now,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 ? 1 : 0)
  };
}
function inferGrade(ratio, revisited = false) {
  if (revisited)
    return 1;
  if (!Number.isFinite(ratio) || ratio <= 0)
    return 3;
  if (ratio >= 2)
    return 1;
  if (ratio >= 1.3)
    return 2;
  if (ratio >= 0.7)
    return 3;
  return 4;
}
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function interleave(pages, gap = 3) {
  const out = [];
  const pending = [...pages];
  while (pending.length) {
    let pick = 0;
    for (let i = 0; i < pending.length; i++) {
      const clash = out.slice(-gap).some((p) => Math.abs(p - pending[i]) <= 1);
      if (!clash) {
        pick = i;
        break;
      }
    }
    out.push(pending[pick]);
    pending.splice(pick, 1);
  }
  return out;
}
function weave(a, b, mix) {
  if (mix <= 0 || !b.length)
    return [...a, ...b];
  if (mix >= 1 || !a.length)
    return [...b, ...a];
  const out = [];
  let ia = 0;
  let ib = 0;
  let debt = 0;
  while (ia < a.length || ib < b.length) {
    debt += mix;
    if ((debt >= 1 || ia >= a.length) && ib < b.length) {
      out.push(b[ib++]);
      debt -= 1;
    } else if (ia < a.length) {
      out.push(a[ia++]);
    }
  }
  return out;
}
function buildShuffleRoute(cards, totalPages, opts = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const now = (_a = opts.now) != null ? _a : Date.now();
  const limit = Math.max(1, (_b = opts.limit) != null ? _b : 500);
  const rand = seededRandom((_c = opts.seed) != null ? _c : 1);
  const retention = clamp2((_d = opts.retention) != null ? _d : RETENTION_TARGET, 0.7, 0.97);
  const newMix = clamp2((_e = opts.newMix) != null ? _e : 0, 0, 1);
  const leechThreshold = Math.max(2, Math.floor((_f = opts.leechThreshold) != null ? _f : 8));
  const lo = Math.max(1, Math.floor(opts.from || 1));
  const hi = Math.min(
    Math.max(1, Math.floor(totalPages || 0)),
    opts.to && opts.to > 0 ? Math.floor(opts.to) : Number.MAX_SAFE_INTEGER
  );
  if (!(hi >= lo))
    return [];
  const byPage = new Map(cards.map((c) => [c.page, c]));
  const deck = [];
  for (let p = lo; p <= hi; p++)
    deck.push((_g = byPage.get(p)) != null ? _g : newCard2(p));
  const dueAll = deck.filter((c) => isDue2(c, now, retention));
  const leeches = dueAll.filter((c) => c.lapses >= leechThreshold);
  const due = dueAll.filter((c) => c.lapses < leechThreshold);
  const fresh = deck.filter((c) => isNewCard(c));
  const known = deck.filter((c) => !isNewCard(c) && !isDue2(c, now, retention));
  const jitter = () => (rand() - 0.5) * 0.04;
  const byRecall = (a, b) => retrievability(a, now) + jitter() - (retrievability(b, now) + jitter());
  leeches.sort((a, b) => b.lapses - a.lapses || byRecall(a, b));
  due.sort(byRecall);
  known.sort((a, b) => a.stability - b.stability);
  const revision = [...leeches.map((c) => c.page), ...interleave(due.map((c) => c.page))];
  const ordered = [
    ...weave(revision, fresh.map((c) => c.page), newMix),
    ...interleave(known.map((c) => c.page))
  ];
  const capped = opts.sessionLimit && opts.sessionLimit > 0 ? ordered.slice(0, opts.sessionLimit) : ordered;
  return capped.slice(0, limit);
}
function deckStats(cards, totalPages, opts = {}) {
  var _a, _b, _c;
  const now = (_a = opts.now) != null ? _a : Date.now();
  const retention = clamp2((_b = opts.retention) != null ? _b : RETENTION_TARGET, 0.7, 0.97);
  const leechThreshold = Math.max(2, Math.floor((_c = opts.leechThreshold) != null ? _c : 8));
  const lo = Math.max(1, Math.floor(opts.from || 1));
  const hi = Math.min(
    Math.max(0, Math.floor(totalPages || 0)),
    opts.to && opts.to > 0 ? Math.floor(opts.to) : Number.MAX_SAFE_INTEGER
  );
  const total = Math.max(0, hi - lo + 1);
  const byPage = new Map(cards.map((c) => [c.page, c]));
  let dueCount2 = 0;
  let freshCount = 0;
  let leechCount = 0;
  let sum = 0;
  let seen = 0;
  for (let p = lo; p <= hi; p++) {
    const c = byPage.get(p);
    if (!c || isNewCard(c)) {
      freshCount++;
      continue;
    }
    seen++;
    sum += retrievability(c, now);
    if (isDue2(c, now, retention))
      dueCount2++;
    if (c.lapses >= leechThreshold)
      leechCount++;
  }
  return {
    total,
    due: dueCount2,
    fresh: freshCount,
    leeches: leechCount,
    avgRecall: seen ? sum / seen : null
  };
}
function forecastDue(cards, totalPages, days = 7, opts = {}) {
  var _a, _b;
  const now = (_a = opts.now) != null ? _a : Date.now();
  const retention = clamp2((_b = opts.retention) != null ? _b : RETENTION_TARGET, 0.7, 0.97);
  const lo = Math.max(1, Math.floor(opts.from || 1));
  const hi = Math.min(
    Math.max(0, Math.floor(totalPages || 0)),
    opts.to && opts.to > 0 ? Math.floor(opts.to) : Number.MAX_SAFE_INTEGER
  );
  const byPage = new Map(cards.map((c) => [c.page, c]));
  const out = new Array(Math.max(1, days)).fill(0);
  for (let p = lo; p <= hi; p++) {
    const c = byPage.get(p);
    if (!c || isNewCard(c))
      continue;
    for (let d = 0; d < out.length; d++) {
      const at = now + d * MS_PER_DAY;
      const wasDue = d > 0 && isDue2(c, now + (d - 1) * MS_PER_DAY, retention);
      if (!wasDue && isDue2(c, at, retention)) {
        out[d]++;
        break;
      }
    }
  }
  return out;
}

// src/reader/shuffleDeck.ts
var MAX_DECK_PAGES = 500;
var isFinitePositive = (n) => typeof n === "number" && Number.isFinite(n) && n > 0;
function normalizeDeck(raw) {
  if (!Array.isArray(raw))
    return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object")
      continue;
    const c = item;
    if (!isFinitePositive(c.page))
      continue;
    out.push({
      page: Math.floor(c.page),
      difficulty: Number.isFinite(c.difficulty) ? Math.max(0, Math.min(10, c.difficulty)) : 0,
      stability: Number.isFinite(c.stability) ? Math.max(0, c.stability) : 0,
      lastReviewedAt: Number.isFinite(c.lastReviewedAt) ? Math.max(0, c.lastReviewedAt) : 0,
      reps: Number.isFinite(c.reps) ? Math.max(0, Math.floor(c.reps)) : 0,
      lapses: Number.isFinite(c.lapses) ? Math.max(0, Math.floor(c.lapses)) : 0
    });
    if (out.length >= MAX_DECK_PAGES)
      break;
  }
  return out;
}
function loadDeck(store, key) {
  if (!store || !key)
    return [];
  return normalizeDeck(store[key]);
}
function saveDeck(store, key, cards) {
  const next = { ...store != null ? store : {} };
  if (!key)
    return next;
  next[key] = cards.slice(0, MAX_DECK_PAGES);
  return next;
}
function resetDeck(store, key) {
  const next = { ...store != null ? store : {} };
  if (key)
    delete next[key];
  return next;
}
function recordReview(store, key, page, grade, now = Date.now()) {
  if (!key || !isFinitePositive(page))
    return [];
  const deck = loadDeck(store, key);
  const idx = deck.findIndex((c) => c.page === page);
  const current = idx >= 0 ? deck[idx] : newCard2(Math.floor(page));
  const next = reviewCard(current, grade, now);
  if (idx >= 0)
    deck[idx] = next;
  else
    deck.push(next);
  return deck;
}

// src/fsrs.ts
var gradeFromDwell = inferGrade;
var buildShuffleOrder = buildShuffleRoute;
var deckStats2 = deckStats;
function deckSummary(stats) {
  const recall = stats.avgRecall === null ? "\u2014" : `${Math.round(stats.avgRecall * 100)}%`;
  return `${stats.total} toggles \xB7 ${stats.due} due \xB7 ${stats.fresh} new \xB7 ${stats.leeches} hard \xB7 recall ${recall}`;
}

// src/quiz.ts
var DEFAULT_QUIZ = {
  quizSeconds: 20,
  quizRevealSeconds: 5,
  quizAutoNext: true,
  quizCloseAfterReveal: true,
  quizUseColorFilter: true,
  quizLoop: false,
  quizBeepOnTimeUp: true,
  quizKeepAnswersOpen: false
};
var QUIZ_SECONDS_MIN = 1;
var QUIZ_SECONDS_MAX = 43200;
var QUIZ_PRESETS = [10, 30, 60, 300, 900, 3600];
var REVEAL_SECONDS_MAX = 3600;
function clampQuizSeconds(seconds) {
  if (!Number.isFinite(seconds))
    return DEFAULT_QUIZ.quizSeconds;
  return Math.min(QUIZ_SECONDS_MAX, Math.max(QUIZ_SECONDS_MIN, Math.round(seconds)));
}
function clampRevealSeconds(seconds) {
  if (!Number.isFinite(seconds))
    return DEFAULT_QUIZ.quizRevealSeconds;
  return Math.min(REVEAL_SECONDS_MAX, Math.max(1, Math.round(seconds)));
}
function formatQuizSeconds(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60)
    return `${s}s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  if (h > 0)
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  const remS = s % 60;
  return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
}
function unitMultiplier(unit) {
  const u = (unit != null ? unit : "s").toLowerCase();
  return u === "h" ? 3600 : u === "m" ? 60 : 1;
}
function parseQuestionSeconds(title, fallback) {
  const text = title != null ? title : "";
  const unit = "([smh])(?![a-z])";
  const patterns = [
    new RegExp(`\u23F1\\s*(\\d{1,6})\\s*(?:${unit})?`, "i"),
    new RegExp(`\u23F2\\s*(\\d{1,6})\\s*(?:${unit})?`, "i"),
    new RegExp(`\\[\\s*(\\d{1,6})\\s*${unit}\\s*\\]`, "i"),
    new RegExp(`\\(\\s*(\\d{1,6})\\s*${unit}\\s*\\)`, "i"),
    new RegExp(`@\\s*(\\d{1,6})\\s*${unit}`, "i")
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m)
      return clampQuizSeconds(Number(m[1]) * unitMultiplier(m[2]));
  }
  return clampQuizSeconds(fallback);
}
function questionMs(title, s) {
  return parseQuestionSeconds(title, s.quizSeconds) * 1e3;
}
function startQuiz(titles, s) {
  return {
    at: 0,
    phase: titles.length ? "question" : "done",
    remaining: titles.length ? questionMs(titles[0], s) : 0,
    total: titles.length,
    answered: 0,
    running: titles.length > 0,
    elapsedMs: 0
  };
}
function quizTick(state, elapsed, titles, s) {
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
        remaining: clampRevealSeconds(s.quizRevealSeconds) * 1e3,
        elapsedMs
      },
      event: "reveal"
    };
  }
  const answered = state.answered + 1;
  if (!s.quizAutoNext) {
    return {
      state: { ...state, remaining: 0, running: false, answered, elapsedMs },
      event: null
    };
  }
  return { ...advance({ ...state, answered, elapsedMs }, titles, s) };
}
function advance(state, titles, s) {
  const nextAt = state.at + 1;
  if (nextAt >= state.total) {
    if (s.quizLoop && state.total > 0) {
      return {
        state: {
          ...state,
          at: 0,
          phase: "question",
          remaining: questionMs(titles[0], s),
          running: true
        },
        event: "next"
      };
    }
    return {
      state: { ...state, phase: "done", remaining: 0, running: false },
      event: "done"
    };
  }
  return {
    state: {
      ...state,
      at: nextAt,
      phase: "question",
      remaining: questionMs(titles[nextAt], s),
      running: true
    },
    event: "next"
  };
}
function revealNow(state, s) {
  if (state.phase !== "question")
    return { state, event: null };
  return {
    state: {
      ...state,
      phase: "reveal",
      remaining: clampRevealSeconds(s.quizRevealSeconds) * 1e3,
      running: true
    },
    event: "reveal"
  };
}
function skipQuestion(state, titles, s) {
  if (state.phase === "done")
    return { state, event: null };
  return advance({ ...state, answered: state.answered + 1 }, titles, s);
}
function pauseQuiz(state) {
  return state.phase === "done" ? state : { ...state, running: false };
}
function resumeQuiz(state) {
  return state.phase === "done" ? state : { ...state, running: true };
}
function quizProgressLabel(state) {
  if (state.total === 0)
    return "Q 0/0";
  const shown = state.phase === "done" ? state.total : Math.min(state.at + 1, state.total);
  return `Q ${shown}/${state.total}`;
}
function quizPhaseRatio(state, titles, s) {
  if (state.phase === "done")
    return 0;
  const total = state.phase === "reveal" ? clampRevealSeconds(s.quizRevealSeconds) * 1e3 : questionMs(titles[state.at], s);
  if (!(total > 0))
    return 0;
  return Math.min(1, Math.max(0, state.remaining / total));
}
function quizSummary(state) {
  const minutes = Math.round(state.elapsedMs / 6e4);
  const q = state.answered;
  return `Quiz finished \u2014 ${q} question${q === 1 ? "" : "s"} \xB7 ${minutes}m`;
}
function quizStartLabel(count, s) {
  return `Quiz started \u2014 ${count} question${count === 1 ? "" : "s"} \xB7 ${formatQuizSeconds(
    clampQuizSeconds(s.quizSeconds)
  )} each \xB7 reveal ${formatQuizSeconds(clampRevealSeconds(s.quizRevealSeconds))}`;
}

// src/toggle-dom.ts
var TOGGLE_SELECTOR = ".callout, details, [data-callout]";
function collectToggleElsFiltered(root, keep) {
  const nodes = Array.from(root.querySelectorAll(TOGGLE_SELECTOR)).filter(keep);
  return nodes.filter((el) => !nodes.some((other) => other !== el && other.contains(el)));
}
function collectToggleEls(root) {
  return collectToggleElsFiltered(root, () => true);
}
function toggleTypeOf(el) {
  var _a;
  return (_a = el.getAttribute("data-callout")) != null ? _a : el.className || (el.tagName.toLowerCase() === "details" ? "details" : "");
}
function isToggleOpen(el) {
  if (el.tagName.toLowerCase() === "details")
    return el.open;
  return !el.classList.contains("is-collapsed");
}
function setToggleOpen(el, open) {
  if (el.tagName.toLowerCase() === "details") {
    el.open = open;
    return;
  }
  if (isToggleOpen(el) === open)
    return;
  const title = el.querySelector(".callout-title");
  title == null ? void 0 : title.click();
  if (isToggleOpen(el) !== open)
    el.classList.toggle("is-collapsed", !open);
}
function toggleTitleOf(el) {
  var _a, _b, _c, _d, _e, _f;
  if (el.tagName.toLowerCase() === "details") {
    return (_b = (_a = el.querySelector("summary")) == null ? void 0 : _a.textContent) != null ? _b : "";
  }
  return (_f = (_e = (_c = el.querySelector(".callout-title-inner")) == null ? void 0 : _c.textContent) != null ? _e : (_d = el.querySelector(".callout-title")) == null ? void 0 : _d.textContent) != null ? _f : "";
}

// src/quiz-ui.ts
var SVG_NS2 = "http://www.w3.org/2000/svg";
function svgEl2(tag, attrs) {
  const el = document.createElementNS(SVG_NS2, tag);
  for (const [k, v] of Object.entries(attrs))
    el.setAttribute(k, v);
  return el;
}
function buildQuizIcon(kind) {
  const svg = svgEl2("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    "aria-hidden": "true",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round"
  });
  const path = (d) => svg.appendChild(svgEl2("path", { d }));
  switch (kind) {
    case "pause":
      path("M9 5v14");
      path("M15 5v14");
      break;
    case "play":
      svg.appendChild(
        svgEl2("path", { d: "M7 4.5l12 7.5-12 7.5z", fill: "currentColor", stroke: "none" })
      );
      break;
    case "reveal":
      path("M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z");
      svg.appendChild(svgEl2("circle", { cx: "12", cy: "12", r: "2.6" }));
      break;
    case "next":
      path("M5 5l9 7-9 7z");
      path("M18 5v14");
      break;
    case "stop":
      path("M6 6l12 12");
      path("M18 6L6 18");
      break;
  }
  return svg;
}
var QuizBar = class {
  constructor(cb) {
    this.cb = cb;
    this.root = document.createElement("div");
    this.root.className = "ntt-quiz-dock";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Quiz controls");
    this.progressEl = document.createElement("span");
    this.progressEl.className = "ntt-quiz-dock-progress";
    this.progressEl.textContent = "Q 1/1";
    this.root.appendChild(this.progressEl);
    const btn = (icon, label, cls, fn) => {
      const b = document.createElement("button");
      b.className = `ntt-quiz-dock-btn ${cls}`;
      b.type = "button";
      b.appendChild(buildQuizIcon(icon));
      b.setAttribute("aria-label", label);
      b.title = label;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        fn();
      });
      this.root.appendChild(b);
      return b;
    };
    this.runBtn = btn("pause", "Pause / resume", "is-run", () => this.cb.onTogglePause());
    btn("reveal", "Reveal the answer now", "is-reveal", () => this.cb.onRevealNow());
    btn("next", "Next question", "is-next", () => this.cb.onNext());
    btn("stop", "Stop quiz", "is-stop", () => this.cb.onStop());
    document.body.appendChild(this.root);
  }
  render(d) {
    var _a;
    this.progressEl.textContent = d.progress;
    this.runBtn.textContent = "";
    this.runBtn.appendChild(buildQuizIcon(d.running ? "pause" : "play"));
    this.runBtn.setAttribute("aria-label", d.running ? "Pause quiz" : "Resume quiz");
    this.runBtn.title = (_a = this.runBtn.getAttribute("aria-label")) != null ? _a : "";
    this.runBtn.setAttribute("aria-pressed", String(!d.running));
    this.root.classList.toggle("is-paused", !d.running);
    this.root.classList.toggle("is-reveal", d.revealing);
  }
  destroy() {
    this.root.remove();
  }
};

// src/quiz-badge.ts
var RING_RADIUS = 8;
var RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
function clampRatio(ratio) {
  if (!Number.isFinite(ratio))
    return 0;
  return Math.min(1, Math.max(0, ratio));
}
function ringOffset(ratio) {
  return RING_CIRCUMFERENCE * (1 - clampRatio(ratio));
}
function formatRingTime(ms) {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1e3));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total % 3600 / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function strictTitleRowOf(el) {
  var _a;
  return (_a = el.querySelector(".callout-title")) != null ? _a : el.querySelector("summary");
}
var SVG_NS3 = "http://www.w3.org/2000/svg";
var QuizRing = class {
  constructor(doc = document) {
    this.root = doc.createElement("span");
    this.root.className = "ntt-quiz-ring";
    this.root.setAttribute("role", "timer");
    this.root.setAttribute("aria-live", "polite");
    const size = (RING_RADIUS + 2) * 2;
    const svg = doc.createElementNS(SVG_NS3, "svg");
    svg.setAttribute("class", "ntt-quiz-ring-svg");
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("aria-hidden", "true");
    const circle = (cls) => {
      const c = doc.createElementNS(SVG_NS3, "circle");
      c.setAttribute("class", cls);
      c.setAttribute("cx", String(size / 2));
      c.setAttribute("cy", String(size / 2));
      c.setAttribute("r", String(RING_RADIUS));
      c.setAttribute("fill", "none");
      svg.appendChild(c);
      return c;
    };
    this.track = circle("ntt-quiz-ring-track");
    this.arc = circle("ntt-quiz-ring-arc");
    this.arc.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
    this.arc.setAttribute("stroke-dashoffset", "0");
    this.label = doc.createElement("span");
    this.label.className = "ntt-quiz-ring-time";
    this.label.textContent = "0:00";
    this.root.appendChild(this.label);
    this.root.appendChild(svg);
  }
  /**
   * Move the badge onto `el`'s title row (no-op when it is already there).
   * Returns false when the toggle has no title row — the badge stays off the
   * note rather than floating over body text (v1.4.2).
   */
  mount(el) {
    var _a;
    const row = (_a = strictTitleRowOf(el)) != null ? _a : el.tagName.toLowerCase() === "details" ? null : el;
    if (!row) {
      this.root.remove();
      return false;
    }
    if (this.root.parentElement !== row)
      row.appendChild(this.root);
    return true;
  }
  render(d) {
    var _a;
    this.label.textContent = formatRingTime(d.remaining);
    this.arc.setAttribute("stroke-dashoffset", String(ringOffset(d.ratio)));
    this.root.classList.toggle("is-reveal", d.phase === "reveal");
    this.root.classList.toggle("is-paused", !d.running);
    const state = (_a = d.state) != null ? _a : "active";
    this.root.classList.toggle("is-pending", state === "pending");
    this.root.classList.toggle("is-active", state === "active");
    this.root.classList.toggle("is-done", state === "done");
    const what = state === "pending" ? "waiting" : d.phase === "reveal" ? "answer" : "question";
    this.root.setAttribute(
      "aria-label",
      `Question ${d.index} of ${d.total}, ${what}, ${formatRingTime(d.remaining)} left`
    );
    void this.track;
  }
  destroy() {
    this.root.remove();
  }
};
var QuizBoard = class {
  constructor(doc = document) {
    this.doc = doc;
    this.rings = /* @__PURE__ */ new Map();
  }
  /** Paint every badge from the current run state. */
  render(items, active, live) {
    const total = items.length;
    items.forEach((item, i) => {
      var _a;
      const el = item.el;
      if (!el || !el.isConnected) {
        (_a = this.rings.get(i)) == null ? void 0 : _a.destroy();
        this.rings.delete(i);
        return;
      }
      let ring = this.rings.get(i);
      if (!ring) {
        ring = new QuizRing(this.doc);
        this.rings.set(i, ring);
      }
      if (!ring.mount(el)) {
        ring.destroy();
        this.rings.delete(i);
        return;
      }
      if (i === active) {
        ring.render({ ...live, index: i + 1, total, state: "active" });
      } else {
        const done = i < active;
        ring.render({
          remaining: done ? 0 : item.totalMs,
          ratio: done ? 0 : 1,
          phase: "question",
          running: false,
          index: i + 1,
          total,
          state: done ? "done" : "pending"
        });
      }
    });
    for (const [i, ring] of [...this.rings]) {
      if (i >= items.length) {
        ring.destroy();
        this.rings.delete(i);
      }
    }
  }
  /** How many badges are on screen (tests / telemetry). */
  get size() {
    return this.rings.size;
  }
  destroy() {
    for (const ring of this.rings.values())
      ring.destroy();
    this.rings.clear();
  }
};

// src/quiz-visibility.ts
var QUIZ_HIDDEN_CLASS = "ntt-quiz-hidden";
var QUIZ_SHOWN_CLASS = "ntt-quiz-shown";
var QUIZ_ACTIVE_CLASS = "ntt-quiz-active";
var isDetails = (el) => el.tagName.toLowerCase() === "details";
function snapshotToggle(el) {
  return { open: isDetails(el) ? el.open : false };
}
function snapshotToggles(els) {
  return els.map((el) => el ? snapshotToggle(el) : { open: false });
}
function setQuizVisible(el, visible) {
  if (isDetails(el)) {
    el.open = visible;
    el.classList.toggle(QUIZ_SHOWN_CLASS, visible);
    el.classList.toggle(QUIZ_HIDDEN_CLASS, !visible);
    return;
  }
  el.classList.toggle(QUIZ_SHOWN_CLASS, visible);
  el.classList.toggle(QUIZ_HIDDEN_CLASS, !visible);
}
function applyQuizVisibilityClasses(els, index, revealed, closeOthers) {
  els.forEach((el, i) => {
    if (!el)
      return;
    if (i === index)
      setQuizVisible(el, revealed);
    else if (closeOthers)
      setQuizVisible(el, false);
  });
}
function clearQuizVisibility(els, snapshot = []) {
  els.forEach((el, i) => {
    var _a;
    if (!el)
      return;
    el.classList.remove(QUIZ_HIDDEN_CLASS, QUIZ_SHOWN_CLASS);
    if (isDetails(el))
      el.open = !!((_a = snapshot[i]) == null ? void 0 : _a.open);
  });
}

// src/quiz-heal.ts
function needsHeal(els) {
  return els.some((el) => !el || !el.isConnected);
}
function healQuizEls(current, titles, fresh, titleOf) {
  const used = /* @__PURE__ */ new Set();
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  for (const el of current)
    if (el && el.isConnected)
      used.add(el);
  const sameCount = fresh.length === current.length;
  return current.map((el, i) => {
    var _a;
    if (el && el.isConnected)
      return el;
    const want = norm((_a = titles[i]) != null ? _a : "");
    const hit = want ? fresh.find((f) => !used.has(f) && norm(titleOf(f)) === want) : void 0;
    const chosen = hit != null ? hit : sameCount && fresh[i] && !used.has(fresh[i]) ? fresh[i] : void 0;
    if (chosen)
      used.add(chosen);
    return chosen != null ? chosen : el;
  });
}
function revealLanded(el) {
  var _a;
  if (!el.isConnected)
    return false;
  if (el.tagName.toLowerCase() === "details")
    return el.open;
  const content = el.querySelector(".callout-content");
  if (!content)
    return false;
  const view = (_a = el.ownerDocument) == null ? void 0 : _a.defaultView;
  if (view && typeof view.getComputedStyle === "function") {
    if (view.getComputedStyle(content).display === "none")
      return false;
  }
  return true;
}

// src/deeplink.ts
var COLORS = ["red", "yellow", "green", "other"];
function parseFilterParam(raw) {
  if (raw == null)
    return void 0;
  const text = raw.trim().toLowerCase();
  if (!text || text === "all" || text === "default" || text === "any")
    return [];
  if (text === "graded")
    return normalizeFilter(["red", "yellow", "green"]);
  const picked = text.split(/[,+ ]+/).map((p) => p.trim()).filter((p) => COLORS.includes(p));
  return picked.length ? normalizeFilter(picked) : void 0;
}
function parseDeepLink(params) {
  var _a, _b;
  const action = ((_a = params["action"]) != null ? _a : "").trim().toLowerCase();
  if (action !== "quiz" && action !== "autoscroll" && action !== "stop")
    return null;
  const link = { action };
  const file = (_b = params["file"]) == null ? void 0 : _b.trim();
  if (file)
    link.file = file;
  const filter = parseFilterParam(params["filter"]);
  if (filter)
    link.filter = filter;
  const seconds = Number(params["seconds"]);
  if (Number.isFinite(seconds) && seconds > 0)
    link.seconds = clampQuizSeconds(seconds);
  const speed = Number(params["speed"]);
  if (Number.isFinite(speed) && speed > 0)
    link.speed = Math.min(600, Math.round(speed));
  return link;
}

// src/telemetry.ts
var Samples = class {
  constructor(capacity = 120) {
    this.capacity = capacity;
    this.buf = [];
    this.next = 0;
    this.seen = 0;
  }
  add(value) {
    if (!Number.isFinite(value))
      return;
    this.seen++;
    if (this.buf.length < this.capacity)
      this.buf.push(value);
    else {
      this.buf[this.next] = value;
      this.next = (this.next + 1) % this.capacity;
    }
  }
  get count() {
    return this.seen;
  }
  values() {
    return [...this.buf];
  }
  reset() {
    this.buf = [];
    this.next = 0;
    this.seen = 0;
  }
  percentile(p) {
    var _a;
    if (!this.buf.length)
      return 0;
    const sorted = [...this.buf].sort((a, b) => a - b);
    const idx = Math.min(
      sorted.length - 1,
      Math.max(0, Math.round((sorted.length - 1) * Math.min(100, Math.max(0, p)) / 100))
    );
    return (_a = sorted[idx]) != null ? _a : 0;
  }
  get mean() {
    if (!this.buf.length)
      return 0;
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  get max() {
    return this.buf.length ? Math.max(...this.buf) : 0;
  }
};
var RenderStability = class {
  /** @param expectedGap the cadence the caller aims for (quiz loop = 250 ms). */
  constructor(expectedGap = 250) {
    this.expectedGap = expectedGap;
    this.gaps = new Samples(120);
    this.last = null;
    this.paints = 0;
    this.dropped = 0;
  }
  mark(now) {
    if (!Number.isFinite(now))
      return;
    this.paints++;
    if (this.last !== null) {
      const gap = now - this.last;
      if (gap >= 0) {
        this.gaps.add(gap);
        if (gap > this.expectedGap * 2)
          this.dropped++;
      }
    }
    this.last = now;
  }
  reset() {
    this.gaps.reset();
    this.last = null;
    this.paints = 0;
    this.dropped = 0;
  }
  report() {
    const values = this.gaps.values();
    const jitter = values.length ? values.reduce((a, g) => a + Math.abs(g - this.expectedGap), 0) / values.length : 0;
    const score = values.length ? Math.max(0, Math.min(1, 1 - jitter / this.expectedGap)) : 1;
    return {
      paints: this.paints,
      meanGap: round(this.gaps.mean),
      p95Gap: round(this.gaps.percentile(95)),
      jitter: round(jitter),
      dropped: this.dropped,
      score: Math.round(score * 100) / 100
    };
  }
};
var Latency = class {
  constructor() {
    this.s = new Samples(60);
  }
  add(ms) {
    this.s.add(ms);
  }
  /** Time `fn`, record it, return its value. */
  measure(now, fn) {
    const t0 = now();
    try {
      return fn();
    } finally {
      this.add(now() - t0);
    }
  }
  reset() {
    this.s.reset();
  }
  report() {
    return {
      count: this.s.count,
      mean: round(this.s.mean),
      p95: round(this.s.percentile(95)),
      max: round(this.s.max)
    };
  }
};
var Telemetry = class {
  constructor() {
    this.quizRender = new RenderStability(250);
    this.remeasure = new Latency();
    this.quizHeal = new Latency();
  }
  reset() {
    this.quizRender.reset();
    this.remeasure.reset();
    this.quizHeal.reset();
  }
  report() {
    return {
      quizRender: this.quizRender.report(),
      remeasure: this.remeasure.report(),
      quizHeal: this.quizHeal.report()
    };
  }
};
function round(n) {
  return Math.round(n * 10) / 10;
}
function formatTelemetry(r) {
  const q = r.quizRender;
  const line = (name, l) => `${name}: ${l.count}\xD7 \xB7 avg ${l.mean}ms \xB7 p95 ${l.p95}ms \xB7 max ${l.max}ms`;
  return [
    `Quiz timer: ${q.paints} paints \xB7 avg ${q.meanGap}ms \xB7 p95 ${q.p95Gap}ms`,
    `Jitter ${q.jitter}ms \xB7 dropped ${q.dropped} \xB7 stability ${Math.round(q.score * 100)}%`,
    line("Re-measure", r.remeasure),
    line("Quiz heal", r.quizHeal)
  ].join("\n");
}

// src/maintenance.ts
function renameCardKey(store, oldPath, newPath) {
  if (oldPath === newPath)
    return { store, moved: false };
  if (!Object.prototype.hasOwnProperty.call(store, oldPath)) {
    return { store, moved: false };
  }
  const next = {};
  for (const [key, value] of Object.entries(store)) {
    if (key === oldPath)
      continue;
    next[key] = value;
  }
  next[newPath] = store[oldPath];
  return { store: next, moved: true };
}
function removeCardKey(store, path) {
  if (!Object.prototype.hasOwnProperty.call(store, path)) {
    return { store, removed: false };
  }
  const next = {};
  for (const [key, value] of Object.entries(store)) {
    if (key !== path)
      next[key] = value;
  }
  return { store: next, removed: true };
}
function pruneCards(store, existingPaths) {
  const alive = new Set(existingPaths);
  const next = {};
  const removed = [];
  for (const [key, value] of Object.entries(store)) {
    if (alive.has(key))
      next[key] = value;
    else
      removed.push(key);
  }
  return { store: next, removed: removed.sort() };
}
function scheduleStoreSummary(count) {
  if (count <= 0)
    return "No notes scheduled yet.";
  if (count === 1)
    return "1 note scheduled.";
  return `${count} notes scheduled.`;
}

// src/toggle-colors.ts
var CALLOUT_TYPES = ["question", "info", "note", "abstract", "tip", "warning", "success"];
var TOGGLE_COLORS = [
  { id: "default", label: "Default (callout type below)", callout: "" },
  { id: "red", label: "\u{1F534} Red \u2014 hard / stop", callout: "recall-red" },
  { id: "yellow", label: "\u{1F7E1} Yellow \u2014 revise", callout: "recall-yellow" },
  { id: "green", label: "\u{1F7E2} Green \u2014 mastered", callout: "recall-green" },
  { id: "blue", label: "\u{1F535} Blue \u2014 concept", callout: "recall-blue" },
  { id: "purple", label: "\u{1F7E3} Purple \u2014 theory", callout: "recall-purple" },
  { id: "orange", label: "\u{1F7E0} Orange \u2014 formula", callout: "recall-orange" },
  { id: "gray", label: "\u26AA Gray \u2014 extra", callout: "recall-gray" },
  { id: "plain", label: "\u2B1B Black / plain \u2014 clean Notion look", callout: "recall-plain" }
];
function calloutForColor(colorId, fallback) {
  const found = TOGGLE_COLORS.find((c) => c.id === colorId);
  return found && found.callout ? found.callout : fallback;
}

// src/settings-tab.ts
var import_obsidian2 = require("obsidian");

// src/modals.ts
var import_obsidian = require("obsidian");

// src/stats-panel.ts
var pct = (n) => `${Math.round(n * 100)}%`;
function reason(row) {
  if (row.fresh)
    return "never revised \u2014 new toggles get mixed in first";
  if (row.lapses >= 2)
    return `forgotten ${row.lapses}\xD7 \u2014 kept close`;
  if (row.due)
    return `recall ${pct(row.recall)} \u2014 due now`;
  if (row.difficulty >= 7)
    return `hard for you (D ${row.difficulty.toFixed(1)}) \u2014 comes back sooner`;
  if (row.stability >= 21)
    return `solid (${Math.round(row.stability)}d memory) \u2014 pushed far away`;
  return `recall ${pct(row.recall)} \u2014 not due yet`;
}
function weakRows(cards, total, now = Date.now(), opts = {}) {
  const from = Math.max(1, opts.from && opts.from > 0 ? opts.from : 1);
  const to = Math.min(total, opts.to && opts.to > 0 ? opts.to : total);
  const byPage = new Map(cards.map((c) => [c.page, c]));
  const rows = [];
  for (let page = from; page <= to; page++) {
    const card = byPage.get(page);
    if (!card)
      continue;
    const base = {
      ordinal: page,
      recall: retrievability(card, now),
      difficulty: card.difficulty,
      stability: card.stability,
      reps: card.reps,
      lapses: card.lapses,
      daysSince: elapsedDays(card, now),
      due: isDue2(card, now, opts.retention),
      fresh: isNewCard(card)
    };
    rows.push({ ...base, why: reason(base) });
  }
  rows.sort((a, b) => a.recall - b.recall || b.difficulty - a.difficulty || a.ordinal - b.ordinal);
  return typeof opts.limit === "number" ? rows.slice(0, opts.limit) : rows;
}
function rowLabel(row) {
  const bits = [`#${row.ordinal}`];
  bits.push(row.fresh ? "new" : `${pct(row.recall)} recall`);
  if (!row.fresh)
    bits.push(`D ${row.difficulty.toFixed(1)}`);
  if (!row.fresh)
    bits.push(`S ${row.stability.toFixed(1)}d`);
  if (row.lapses > 0)
    bits.push(`${row.lapses} lapse${row.lapses === 1 ? "" : "s"}`);
  return bits.join(" \xB7 ");
}
function orderExplainer(rows) {
  if (rows.length === 0)
    return "No revision history for this note yet \u2014 run a shuffle to build it.";
  const due = rows.filter((r) => r.due && !r.fresh).length;
  const fresh = rows.filter((r) => r.fresh).length;
  const first = rows[0];
  return `Shuffle visits the lowest recall first: #${first.ordinal} (${first.fresh ? "new" : pct(first.recall)}) leads, ${due} due and ${fresh} new toggle${fresh === 1 ? "" : "s"} queued.`;
}

// src/modals.ts
function addSecondsPicker(setting, opts) {
  let text = null;
  setting.addSlider(
    (sl) => sl.setLimits(opts.sliderMin, opts.sliderMax, 1).setValue(Math.min(opts.sliderMax, Math.max(opts.sliderMin, opts.get()))).setDynamicTooltip().onChange(async (v) => {
      const value = opts.clamp(v);
      text == null ? void 0 : text.setValue(String(value));
      await opts.save(value);
    })
  );
  setting.addText((txt) => {
    text = txt;
    txt.inputEl.type = "number";
    txt.inputEl.min = String(opts.sliderMin);
    txt.inputEl.max = String(opts.max);
    txt.inputEl.setAttribute("aria-label", "seconds");
    txt.setValue(String(opts.get())).setPlaceholder(`${opts.sliderMin}\u2013${opts.max}s`);
    txt.inputEl.addClass("ntt-seconds-input");
    const commit = async () => {
      const value = opts.clamp(Number(txt.getValue()));
      txt.setValue(String(value));
      await opts.save(value);
      const slider = setting.controlEl.querySelector('input[type="range"]');
      if (slider)
        slider.value = String(Math.min(opts.sliderMax, Math.max(opts.sliderMin, value)));
    };
    txt.inputEl.addEventListener("change", () => void commit());
  });
}
var ScrollStatsModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    var _a, _b, _c;
    this.titleEl.setText("Autoscroll revision stats");
    const path = (_c = (_b = this.plugin.scrollNotePath) != null ? _b : (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _c : "";
    const cards = this.plugin.scrollCards(path);
    const stats = this.plugin.scrollDeckStats();
    const total = Math.max(this.plugin.scrollTotalItems, cards.length);
    const rows = weakRows(cards, total, Date.now(), {
      from: this.plugin.settings.scrollShuffleFrom,
      to: this.plugin.settings.scrollShuffleTo,
      retention: this.plugin.settings.scrollRetention,
      limit: 20
    });
    if (stats) {
      this.contentEl.createDiv({ cls: "notion-toggle-deck-summary", text: deckSummary(stats) });
    }
    this.contentEl.createDiv({ cls: "notion-toggle-deck-summary", text: orderExplainer(rows) });
    const list = this.contentEl.createDiv({ cls: "notion-toggle-stats-list" });
    for (const row of rows) {
      const item = list.createDiv({ cls: "notion-toggle-stats-row" });
      item.createDiv({ cls: "notion-toggle-stats-head", text: rowLabel(row) });
      item.createDiv({ cls: "notion-toggle-stats-why", text: row.why });
    }
    if (rows.length === 0) {
      list.createDiv({ text: "Run a shuffle session on this note to build its history." });
    }
    const forecast = this.plugin.scrollForecast();
    if (forecast.some((n) => n > 0)) {
      this.contentEl.createDiv({
        cls: "notion-toggle-deck-forecast",
        text: `Due next 7 days: ${forecast.join(" \xB7 ")}`
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ScrollFilterModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Autoscroll \u2014 revise which toggles?");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const options = [
      { label: "\u26AA All toggles", filter: [] },
      { label: "\u{1F534} Red only", filter: ["red"] },
      { label: "\u{1F7E1} Yellow only", filter: ["yellow"] },
      { label: "\u{1F7E2} Green only", filter: ["green"] },
      { label: "\u{1F534}\u{1F7E1} Red + Yellow (weak spots)", filter: ["red", "yellow"] },
      { label: "\u{1F534}\u{1F7E1}\u{1F7E2} All graded toggles", filter: ["red", "yellow", "green"] }
    ];
    const active = this.plugin.settings.scrollFilter;
    for (const opt of options) {
      const btn = list.createEl("button", {
        text: opt.label,
        cls: "notion-toggle-color-btn"
      });
      if (sameFilter(opt.filter, active))
        btn.addClass("is-suggested");
      btn.onclick = async () => {
        await this.plugin.setScrollFilter(opt.filter);
        this.close();
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QUIZ_FILTER_OPTIONS = [
  { label: "\u26AA Default \u2014 every toggle", filter: [] },
  { label: "\u{1F534} Red only", filter: ["red"] },
  { label: "\u{1F7E1} Yellow only", filter: ["yellow"] },
  { label: "\u{1F7E2} Green only", filter: ["green"] },
  { label: "\u{1F534}\u{1F7E1} Red + Yellow (weak spots)", filter: ["red", "yellow"] },
  { label: "\u{1F534}\u{1F7E1}\u{1F7E2} All graded toggles", filter: ["red", "yellow", "green"] }
];
var QuizFilterModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Quiz \u2014 ask about which toggles?");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const active = this.plugin.quizFilterColors();
    for (const opt of QUIZ_FILTER_OPTIONS) {
      const btn = list.createEl("button", { text: opt.label, cls: "notion-toggle-color-btn" });
      if (sameFilter(opt.filter, active))
        btn.addClass("is-suggested");
      btn.onclick = async () => {
        await this.plugin.setQuizFilter(opt.filter);
        this.close();
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ScrollModeModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.modeBtns = [];
    this.hintEl = null;
    this.summaryEl = null;
    this.resumeBtn = null;
  }
  /** Repaint selection + hint without closing the sheet. */
  paint() {
    var _a, _b;
    const s = this.plugin.settings;
    for (const { mode, btn } of this.modeBtns)
      btn.toggleClass("is-suggested", s.scrollMode === mode);
    const empty = s.scrollMode === "custom" && ((_a = s.scrollPicks) != null ? _a : []).length === 0 || (s.scrollMode === "route" || s.scrollMode === "shuffle") && ((_b = s.scrollRoute) != null ? _b : []).length === 0;
    if (this.hintEl) {
      this.hintEl.setText(
        empty ? "Add toggle numbers below \u2014 until then autoscroll pauses at every toggle." : `Autoscroll pauses at: ${modeLabel(this.plugin.modeConfig())}`
      );
      this.hintEl.toggleClass("is-warning", empty);
    }
    if (this.resumeBtn)
      this.resumeBtn.toggleClass("is-hidden", !empty);
    if (this.summaryEl) {
      const stats = this.plugin.scrollDeckStats();
      this.summaryEl.setText(stats ? deckSummary(stats) : "");
    }
  }
  /** Save + rebuild the live plan so edits apply to a running scroll. */
  async commit(toast = false) {
    await this.plugin.saveSettings();
    this.plugin.refreshScrollPlan();
    if (toast && !this.plugin.settings.scrollQuiet) {
      new import_obsidian.Notice(planSummary(this.plugin.modeConfig()));
    }
    this.paint();
  }
  onOpen() {
    this.setTitle("Autoscroll \u2014 pause at");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const options = [
      { label: "\u221E Every toggle", mode: "all" },
      { label: "1\uFE0F\u20E3 Odd toggles (1, 3, 5 \u2026)", mode: "odd" },
      { label: "2\uFE0F\u20E3 Even toggles (2, 4, 6 \u2026)", mode: "even" },
      { label: "\u270D\uFE0F Custom list", mode: "custom" },
      { label: "\u{1F9ED} Route (my own order)", mode: "route" },
      { label: "\u{1F500} Shuffle (weakest first)", mode: "shuffle" }
    ];
    this.modeBtns = [];
    for (const opt of options) {
      const btn = list.createEl("button", { text: opt.label, cls: "notion-toggle-color-btn" });
      this.modeBtns.push({ mode: opt.mode, btn });
      btn.onclick = async () => {
        var _a;
        if (opt.mode === "shuffle") {
          await this.plugin.rebuildShuffleRoute();
          await this.commit(true);
          return;
        }
        if (opt.mode === "route") {
          const saved = (_a = this.plugin.settings.scrollUserRoute) != null ? _a : [];
          if (saved.length)
            this.plugin.settings.scrollRoute = [...saved];
        }
        this.plugin.settings.scrollMode = opt.mode;
        await this.commit();
      };
    }
    this.hintEl = this.contentEl.createDiv({ cls: "notion-toggle-mode-hint" });
    this.resumeBtn = this.contentEl.createEl("button", {
      text: "\u25B6 Resume with every toggle",
      cls: "notion-toggle-color-btn ntt-resume-btn"
    });
    this.resumeBtn.onclick = async () => {
      this.plugin.settings.scrollMode = "all";
      await this.commit(true);
      await this.plugin.setAutoScrollEnabled(true);
      this.close();
    };
    new import_obsidian.Setting(this.contentEl).setName("Custom list").setDesc("Toggle numbers to stop at, e.g. 2, 5, 9.").addText((t) => {
      var _a;
      t.setPlaceholder("2, 5, 9").setValue(((_a = this.plugin.settings.scrollPicks) != null ? _a : []).join(", ")).onChange(async (v) => {
        this.plugin.settings.scrollPicks = parsePicks(v);
        await this.commit();
      });
      t.inputEl.addEventListener("blur", () => void this.commit());
    });
    new import_obsidian.Setting(this.contentEl).setName("Route").setDesc("Your own visit order, e.g. 7, 2, 9, 2. Saved across vault reloads.").addText((t) => {
      var _a, _b;
      t.setPlaceholder("7, 2, 9").setValue(
        ((_b = (_a = this.plugin.settings.scrollRoute) != null ? _a : this.plugin.settings.scrollUserRoute) != null ? _b : []).join(
          ", "
        )
      ).onChange(async (v) => {
        const route = parseRoute(v);
        this.plugin.settings.scrollRoute = route;
        this.plugin.settings.scrollUserRoute = route;
        await this.commit();
      });
      t.inputEl.addEventListener("blur", () => void this.commit());
    });
    new import_obsidian.Setting(this.contentEl).setName("Loop the route").setDesc("Route khatam hone par phir se pehle waypoint se.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollLoopRoute).onChange(async (v) => {
        this.plugin.settings.scrollLoopRoute = v;
        await this.commit(true);
      })
    );
    new import_obsidian.Setting(this.contentEl).setName("Shuffle range").setDesc("Limit shuffle to these toggle numbers (0 = whole note).").addText(
      (t) => t.setPlaceholder("from").setValue(String(this.plugin.settings.scrollShuffleFrom || "")).onChange(async (v) => {
        this.plugin.settings.scrollShuffleFrom = Math.max(0, Math.floor(Number(v) || 0));
        await this.commit(true);
      })
    ).addText(
      (t) => t.setPlaceholder("to").setValue(String(this.plugin.settings.scrollShuffleTo || "")).onChange(async (v) => {
        this.plugin.settings.scrollShuffleTo = Math.max(0, Math.floor(Number(v) || 0));
        await this.commit(true);
      })
    );
    const stats = this.plugin.scrollDeckStats();
    this.summaryEl = this.contentEl.createDiv({
      cls: "notion-toggle-deck-summary",
      text: stats ? deckSummary(stats) : ""
    });
    if (stats) {
      const forecast = this.plugin.scrollForecast();
      if (forecast.some((n) => n > 0)) {
        this.contentEl.createDiv({
          cls: "notion-toggle-deck-forecast",
          text: `Due next 7 days: ${forecast.join(" \xB7 ")}`
        });
      }
    }
    new import_obsidian.Setting(this.contentEl).setName("Tall toggles screen-by-screen").setDesc("Long answers are read one screen at a time before moving on.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollChunkTall).onChange(async (v) => {
        this.plugin.settings.scrollChunkTall = v;
        await this.commit();
      })
    );
    this.paint();
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ScrollDwellModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Autoscroll \u2014 pause for");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const quick = [5, 10, 20, 30, 60, 120, 300, 600, 1800, 3600];
    const current = clampHold(this.plugin.settings.scrollHold);
    for (const secs of quick) {
      const btn = list.createEl("button", {
        text: formatDwell(secs),
        cls: "notion-toggle-color-btn"
      });
      if (secs === current)
        btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.scrollHold = clampDwellSeconds2(secs);
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
        new import_obsidian.Notice(`Autoscroll pauses for ${formatDwell(secs)}.`);
        this.close();
      };
    }
    new import_obsidian.Setting(this.contentEl).setName("Custom seconds").setDesc(`1 \u2013 ${DWELL_PRESETS[DWELL_PRESETS.length - 1]} seconds.`).addText(
      (t) => t.setPlaceholder(String(current)).onChange(async (v) => {
        const n = clampDwellSeconds2(Number(v), current);
        this.plugin.settings.scrollHold = n;
        await this.plugin.saveSettings();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ScrollSpeedModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Autoscroll speed");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const active = multiplierFromSpeed(this.plugin.settings.scrollSpeed);
    for (const mult of SPEED_MULTIPLIERS) {
      const btn = list.createEl("button", { text: `${mult}x`, cls: "notion-toggle-color-btn" });
      if (mult === active)
        btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.scrollSpeed = speedFromMultiplier(mult);
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
        new import_obsidian.Notice(`Autoscroll speed: ${mult}x`);
        this.close();
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var MobileToolbarGuideModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    var _a, _b;
    this.modalEl.addClass("ntt-guide");
    this.setTitle("Mobile toolbar \u2014 Autoscroll setup");
    const progress = this.contentEl.createDiv({ cls: "ntt-guide-progress" });
    progress.setText(
      `Checklist: ${guideProgress((_a = this.plugin.settings.toolbarGuideDone) != null ? _a : [])} added`
    );
    const steps = this.contentEl.createEl("ol", { cls: "ntt-guide-steps" });
    for (const step of TOOLBAR_STEPS)
      steps.createEl("li", { text: step });
    new import_obsidian.Setting(this.contentEl).setName("Open Obsidian settings").setDesc("Mobile \u2192 Manage toolbar me seedha jump (agar version support kare).").addButton(
      (btn) => btn.setButtonText("Open settings").onClick(() => {
        var _a2, _b2;
        try {
          const setting = this.app.setting;
          (_a2 = setting == null ? void 0 : setting.open) == null ? void 0 : _a2.call(setting);
          (_b2 = setting == null ? void 0 : setting.openTabById) == null ? void 0 : _b2.call(setting, "mobile");
        } catch (e) {
          new import_obsidian.Notice("Settings manually kholo: \u2699\uFE0F \u2192 Mobile \u2192 Manage toolbar");
        }
      })
    ).addButton(
      (btn) => btn.setButtonText("Reset checklist").onClick(async () => {
        this.plugin.settings.toolbarGuideDone = [];
        await this.plugin.saveSettings();
        this.contentEl.empty();
        this.onOpen();
        this.contentEl.scrollTop = 0;
      })
    );
    this.contentEl.createEl("h3", { text: "Ye commands add karo (tap = tick \u2713)" });
    const done = new Set((_b = this.plugin.settings.toolbarGuideDone) != null ? _b : []);
    for (const cmd of [...TOOLBAR_COMMANDS].sort((a, b) => a.priority - b.priority)) {
      const row = new import_obsidian.Setting(this.contentEl).setName(cmd.name).setDesc(cmd.why).addToggle(
        (tg) => tg.setValue(done.has(cmd.id)).onChange(async () => {
          var _a2;
          this.plugin.settings.toolbarGuideDone = toggleGuideDone(
            (_a2 = this.plugin.settings.toolbarGuideDone) != null ? _a2 : [],
            cmd.id
          );
          await this.plugin.saveSettings();
          progress.setText(
            `Checklist: ${guideProgress(this.plugin.settings.toolbarGuideDone)} added`
          );
        })
      );
      row.settingEl.addClass("ntt-guide-row");
      if (done.has(cmd.id))
        row.settingEl.addClass("is-done");
    }
    this.contentEl.createDiv({
      cls: "ntt-guide-tip",
      text: "Tip: floating \u25B6 button pe long-press karne se bhi Autoscroll sheet khul jaati hai \u2014 toolbar me sirf start/pause wali command kaafi hai."
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuizSecondsModal = class extends import_obsidian.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.setTitle("Quiz \u2014 time per question");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const current = clampQuizSeconds(this.plugin.settings.quizSeconds);
    for (const seconds of QUIZ_PRESETS) {
      const btn = list.createEl("button", {
        // v1.4.0 — friendly labels ("10s", "5m", "1h") since presets span units now.
        text: formatQuizSeconds(seconds),
        cls: "notion-toggle-color-btn"
      });
      if (seconds === current)
        btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.quizSeconds = clampQuizSeconds(seconds);
        await this.plugin.saveSettings();
        new import_obsidian.Notice(`Quiz: ${formatQuizSeconds(clampQuizSeconds(seconds))} per question.`);
        this.close();
      };
    }
    const input = this.contentEl.createEl("input", { cls: "ntt-modal-input" });
    input.type = "number";
    input.min = String(QUIZ_SECONDS_MIN);
    input.max = String(QUIZ_SECONDS_MAX);
    input.value = String(current);
    input.placeholder = `Custom seconds (${QUIZ_SECONDS_MIN}\u2013${QUIZ_SECONDS_MAX})`;
    const actions = this.contentEl.createDiv({ cls: "ntt-modal-actions" });
    const save = actions.createEl("button", { text: "Save" });
    save.addClass("mod-cta");
    save.onclick = async () => {
      const seconds = clampQuizSeconds(Number(input.value));
      this.plugin.settings.quizSeconds = seconds;
      await this.plugin.saveSettings();
      new import_obsidian.Notice(`Quiz: ${formatQuizSeconds(seconds)} per question.`);
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var QuickQAModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    this.setTitle("Quick Q&A toggle");
    contentEl.createEl("label", { text: "Question" });
    this.questionEl = contentEl.createEl("textarea", { cls: "ntt-modal-input" });
    this.questionEl.rows = 2;
    this.questionEl.placeholder = "Type the question...";
    contentEl.createEl("label", { text: "Answer" });
    this.answerEl = contentEl.createEl("textarea", { cls: "ntt-modal-input" });
    this.answerEl.rows = 4;
    this.answerEl.placeholder = "Type the answer...";
    const buttonContainer = contentEl.createDiv({ cls: "ntt-modal-actions" });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => this.close();
    const submitBtn = buttonContainer.createEl("button", { text: "Insert toggle", cls: "mod-cta" });
    submitBtn.onclick = () => {
      this.onSubmit({
        question: this.questionEl.value,
        answer: this.answerEl.value
      });
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ColorPickerModal = class extends import_obsidian.Modal {
  constructor(app, onPick) {
    super(app);
    this.onPick = onPick;
  }
  onOpen() {
    const { contentEl } = this;
    this.setTitle("Toggle colour");
    const list = contentEl.createDiv({ cls: "notion-toggle-color-list" });
    for (const color of TOGGLE_COLORS) {
      if (!color.callout)
        continue;
      const btn = list.createEl("button", { text: color.label });
      btn.addClass("notion-toggle-color-btn");
      btn.dataset.color = color.callout;
      btn.onclick = () => {
        this.onPick(color.id);
        this.close();
      };
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings-tab.ts
var NotionToggleSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    var _a;
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian2.Setting(containerEl).setName("Toggle colour").setDesc("Traffic-light colours for active recall: red = hard, yellow = revise, green = mastered. Plain = clean black Notion look.").addDropdown((dropdown) => {
      for (const c of TOGGLE_COLORS)
        dropdown.addOption(c.id, c.label);
      dropdown.setValue(this.plugin.settings.color);
      dropdown.onChange(async (value) => {
        this.plugin.settings.color = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Auto-numbering").setDesc('New toggles get 1., 2., 3., ... automatically \u2014 you never type the number. Use "Renumber toggles in note" to fix gaps.').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.numberedByDefault);
      toggle.onChange(async (value) => {
        this.plugin.settings.numberedByDefault = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("MCQ options").setDesc("How many checkbox options a new MCQ toggle gets (2-6).").addSlider((slider) => {
      slider.setLimits(2, 6, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.mcqOptionCount);
      slider.onChange(async (value) => {
        this.plugin.settings.mcqOptionCount = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Match the following rows").setDesc("How many rows a new match table gets (2-8).").addSlider((slider) => {
      slider.setLimits(2, 8, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.matchRowCount);
      slider.onChange(async (value) => {
        this.plugin.settings.matchRowCount = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Auto-add Answer line").setDesc('Add an "**Answer:** " line inside new MCQ / match toggles.').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.addAnswerLine);
      toggle.onChange(async (value) => {
        this.plugin.settings.addAnswerLine = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Default callout type").setDesc("Type used when inserting/wrapping toggles.").addDropdown((dropdown) => {
      for (const t of CALLOUT_TYPES) {
        dropdown.addOption(t, t);
      }
      dropdown.setValue(this.plugin.settings.calloutType);
      dropdown.onChange(async (value) => {
        this.plugin.settings.calloutType = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Default collapsed").setDesc("On: toggles start collapsed (answer hidden). Off: expanded.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.defaultCollapsed);
      toggle.onChange(async (value) => {
        this.plugin.settings.defaultCollapsed = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Auto-continue on Enter").setDesc("Inside a toggle, Enter keeps writing the answer; Enter on an empty toggle line starts the NEXT toggle.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoContinue);
      toggle.onChange(async (value) => {
        this.plugin.settings.autoContinue = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Toggle format").setDesc("Native callout (recommended, folds in Obsidian) or HTML <details>.").addDropdown((dropdown) => {
      dropdown.addOption("callout", "Native callout (> [!question]-)");
      dropdown.addOption("details", "HTML <details>");
      dropdown.setValue(this.plugin.settings.format);
      dropdown.onChange(async (value) => {
        this.plugin.settings.format = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Bold the question/summary").setDesc("Auto-wrap the title in **bold** (skips already-bold text).").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.boldSummary);
      toggle.onChange(async (value) => {
        this.plugin.settings.boldSummary = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Recall timer (Pomodoro)").setHeading();
    new import_obsidian2.Setting(containerEl).setName("Preset").setDesc("Pick a rhythm, or choose Custom and set your own minutes below.").addDropdown((dropdown) => {
      for (const p of POMODORO_PRESETS)
        dropdown.addOption(p.id, p.label);
      dropdown.setValue(this.plugin.settings.preset);
      dropdown.onChange(async (value) => {
        const resolved = resolvePreset(this.plugin.settings, value);
        Object.assign(this.plugin.settings, resolved);
        await this.plugin.saveSettings();
        this.plugin.refreshTimerDurations();
        this.display();
      });
    });
    const minuteSetting = (name, desc, get, set, min, max) => {
      new import_obsidian2.Setting(containerEl).setName(name).setDesc(desc).addSlider((slider) => {
        slider.setLimits(min, max, 1).setDynamicTooltip();
        slider.setValue(get());
        slider.onChange(async (value) => {
          set(clampMinutes(value, get()));
          this.plugin.settings.preset = "custom";
          await this.plugin.saveSettings();
          this.plugin.refreshTimerDurations();
        });
      });
    };
    minuteSetting(
      "Focus minutes",
      "Length of one recall/focus session.",
      () => this.plugin.settings.focusMinutes,
      (v) => this.plugin.settings.focusMinutes = v,
      5,
      90
    );
    minuteSetting(
      "Short break minutes",
      "Break after each focus session.",
      () => this.plugin.settings.shortBreakMinutes,
      (v) => this.plugin.settings.shortBreakMinutes = v,
      1,
      30
    );
    minuteSetting(
      "Long break minutes",
      "Break after a full cycle of focus sessions.",
      () => this.plugin.settings.longBreakMinutes,
      (v) => this.plugin.settings.longBreakMinutes = v,
      5,
      60
    );
    new import_obsidian2.Setting(containerEl).setName("Sessions before long break").setDesc("How many focus sessions make one cycle (1-8).").addSlider((slider) => {
      slider.setLimits(1, 8, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.sessionsBeforeLongBreak);
      slider.onChange(async (value) => {
        this.plugin.settings.sessionsBeforeLongBreak = value;
        await this.plugin.saveSettings();
        this.plugin.renderTimer();
      });
    });
    const boolSetting = (name, desc, get, set) => {
      new import_obsidian2.Setting(containerEl).setName(name).setDesc(desc).addToggle((toggle) => {
        toggle.setValue(get());
        toggle.onChange(async (value) => {
          set(value);
          await this.plugin.saveSettings();
        });
      });
    };
    boolSetting(
      "Auto-start next phase",
      "When a phase ends, the next one starts by itself.",
      () => this.plugin.settings.autoStartNext,
      (v) => this.plugin.settings.autoStartNext = v
    );
    boolSetting(
      "Notice on phase end",
      "Show a notice with your \u{1F534}/\u{1F7E1}/\u{1F7E2} toggle counts when a phase ends.",
      () => this.plugin.settings.notifyOnPhaseEnd,
      (v) => this.plugin.settings.notifyOnPhaseEnd = v
    );
    boolSetting(
      "Vibrate / buzz on phase end",
      "Short vibration on mobile when a phase ends.",
      () => this.plugin.settings.soundOnPhaseEnd,
      (v) => this.plugin.settings.soundOnPhaseEnd = v
    );
    boolSetting(
      "Show timer on startup",
      "Float the timer as soon as Obsidian opens.",
      () => this.plugin.settings.showOnStartup,
      (v) => this.plugin.settings.showOnStartup = v
    );
    boolSetting(
      "Compact timer by default",
      "Show only the clock (small pill) \u2014 handy on mobile.",
      () => this.plugin.settings.compactByDefault,
      (v) => this.plugin.settings.compactByDefault = v
    );
    new import_obsidian2.Setting(containerEl).setName("Timer focus guard (v1.0.6)").setHeading();
    boolSetting(
      "Auto-pause when you leave",
      "Pause the running timer when Obsidian goes to the background or you switch away.",
      () => this.plugin.settings.autoPauseOnLeave,
      (v) => this.plugin.settings.autoPauseOnLeave = v
    );
    boolSetting(
      "Pin session to its note",
      "Only the note where the session started counts as focus time.",
      () => this.plugin.settings.pinToSessionNote,
      (v) => this.plugin.settings.pinToSessionNote = v
    );
    boolSetting(
      "Auto-resume when you return",
      "Continue automatically once you are back on the session note.",
      () => this.plugin.settings.autoResumeOnReturn,
      (v) => this.plugin.settings.autoResumeOnReturn = v
    );
    boolSetting(
      "Collapse toggles on break",
      "When a focus phase ends, hide every answer again for the next recall round.",
      () => this.plugin.settings.autoCollapseOnBreak,
      (v) => this.plugin.settings.autoCollapseOnBreak = v
    );
    new import_obsidian2.Setting(containerEl).setName("Idle pause (minutes)").setDesc("Pause the focus phase after this much inactivity. 0 turns it off.").addText((text) => {
      text.setPlaceholder("2").setValue(String(this.plugin.settings.idlePauseMinutes)).onChange(async (value) => {
        const n = Number.parseInt(value, 10);
        this.plugin.settings.idlePauseMinutes = Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : 0;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Minimal mode & spaced repetition").setHeading();
    new import_obsidian2.Setting(containerEl).setName("Minimal command names").setDesc(
      'Keep 4 primary commands (Toggle, Colour, Recall, Review) clean and prefix everything else with "Advanced:" so the toolbar stays uncluttered. Restart Obsidian to refresh names.'
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.minimalNames).onChange(async (v) => {
        this.plugin.settings.minimalNames = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Ask for a grade after each focus phase").setDesc("Shows Again / Hard / Good / Easy on the timer; SM-2 then calculates your next recall date automatically.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.autoReview).onChange(async (v) => {
        this.plugin.settings.autoReview = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Recall schedule").setDesc(
      `${scheduleStoreSummary(Object.keys((_a = this.plugin.settings.srs) != null ? _a : {}).length)} Schedules follow a note when you rename or move it (v1.0.8).`
    ).addButton((btn) => {
      btn.setButtonText("Clean up").onClick(async () => {
        const removed = await this.plugin.pruneSchedule();
        new import_obsidian2.Notice(
          removed > 0 ? `Removed ${removed} schedule${removed === 1 ? "" : "s"} for missing notes.` : "Nothing to clean up."
        );
        this.display();
      });
    }).addButton((btn) => {
      btn.setWarning().setButtonText("Clear all").onClick(async () => {
        this.plugin.settings.srs = {};
        await this.plugin.saveSettings();
        new import_obsidian2.Notice("Recall schedule cleared.");
        this.display();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Auto-scroll revision").setHeading();
    new import_obsidian2.Setting(containerEl).setName("Autoscroll running").setDesc(
      `ON = active note par autoscroll start, OFF = stop. Hotkey: ${hotkeyLabel(
        "smart-autoscroll"
      )} \xB7 reverse: ${hotkeyLabel("autoscroll-reverse")} \xB7 sheet: ${hotkeyLabel("autoscroll-sheet")}.`
    ).addToggle(
      (tg) => tg.setValue(this.plugin.autoScrollActive()).onChange(async (v) => {
        await this.plugin.setAutoScrollEnabled(v);
        tg.setValue(this.plugin.autoScrollActive());
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Hotkeys").setDesc(
      HOTKEYS.map((h) => `${h.id} \u2192 ${h.label}`).join("  \xB7  ") + "  \u2014 Settings \u2192 Hotkeys me badal sakte ho."
    );
    new import_obsidian2.Setting(containerEl).setName("Scroll speed").setDesc("Pixels per second while gliding to the next toggle.").addSlider(
      (sl) => sl.setLimits(SPEED_MIN, SPEED_MAX, SPEED_STEP).setValue(clampSpeed(this.plugin.settings.scrollSpeed)).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.scrollSpeed = clampSpeed(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Hold time on each toggle").setDesc("Seconds the opened toggle stays visible before moving on.").addSlider(
      (sl) => sl.setLimits(0, 30, 1).setValue(clampHold(this.plugin.settings.scrollHold)).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.scrollHold = clampHold(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Reverse direction").setDesc("Scroll bottom \u2192 top for fast backwards revision.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollReverse).onChange(async (v) => {
        this.plugin.settings.scrollReverse = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Colour filter").setDesc(
      `Stop only at these toggles \u2014 currently ${filterLabel(this.plugin.settings.scrollFilter)}.`
    ).addButton((btn) => {
      btn.setButtonText("Choose colours").onClick(() => {
        new ScrollFilterModal(this.app, this.plugin).open();
        this.display();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Open the toggle automatically").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollAutoOpen).onChange(async (v) => {
        this.plugin.settings.scrollAutoOpen = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Close it again when leaving").setDesc("Keeps active recall honest: only one answer is visible at a time.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollAutoClose).onChange(async (v) => {
        this.plugin.settings.scrollAutoClose = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Loop the note").setDesc("Start over from the other end instead of stopping.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollLoop).onChange(async (v) => {
        this.plugin.settings.scrollLoop = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Pause at").setDesc(
      `Which toggles the autoscroll stops at \u2014 currently ${modeLabel(this.plugin.modeConfig())}.`
    ).addButton(
      (btn) => btn.setButtonText("Choose mode").onClick(() => {
        new ScrollModeModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Pause for").setDesc(`Hold time on each stop \u2014 currently ${formatDwell(clampHold(this.plugin.settings.scrollHold))}.`).addButton(
      (btn) => btn.setButtonText("Choose time").onClick(() => {
        new ScrollDwellModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Speed presets").setDesc(`Multiplier of the reading speed \u2014 currently ${multiplierFromSpeed(this.plugin.settings.scrollSpeed)}x.`).addButton(
      (btn) => btn.setButtonText("Choose speed").onClick(() => {
        new ScrollSpeedModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Tall toggles screen-by-screen").setDesc("Long answers are read one screen at a time before the next toggle.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollChunkTall).onChange(async (v) => {
        this.plugin.settings.scrollChunkTall = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Loop the route").setDesc("Route / shuffle runs restart from the beginning instead of stopping.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollLoopRoute).onChange(async (v) => {
        this.plugin.settings.scrollLoopRoute = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Auto-grade during shuffle").setDesc("Toggles you linger on come back sooner; quick ones move further away.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollAutoGrade).onChange(async (v) => {
        this.plugin.settings.scrollAutoGrade = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("New toggles mixed into shuffle").setDesc("0 = only revise old toggles, 1 = new ones first.").addSlider(
      (sl) => sl.setLimits(0, 1, 0.05).setValue(this.plugin.settings.scrollNewMix).setDynamicTooltip().onChange(async (v) => {
        this.plugin.settings.scrollNewMix = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Weak toggles / priority").setDesc("Why the shuffle picks what it picks \u2014 recall, difficulty and lapses per toggle.").addButton(
      (btn) => btn.setButtonText("Show stats").onClick(() => {
        new ScrollStatsModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Debug overlay").setDesc(
      "Shows the live loop state while autoscroll runs: position, direction, waypointReached / crossedTarget, dwell key and grade."
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollDebug).onChange(async (v) => {
        this.plugin.settings.scrollDebug = v;
        await this.plugin.saveSettings();
        this.plugin.syncScrollDebugOverlay();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Revision memory").setDesc("Forget what this note's shuffle learned about you.").addButton(
      (btn) => btn.setButtonText("Reset for this note").onClick(async () => {
        await this.plugin.resetScrollMemory();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Floating autoscroll button").setDesc(
      "Note khulte hi bottom-right me \u25B6 button \u2014 tap = start / pause, chhota \u2191/\u2193 chip = reverse, long-press = autoscroll sheet. Session chalne par bhi screen par rehta hai."
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollFab).onChange(async (v) => {
        this.plugin.settings.scrollFab = v;
        await this.plugin.saveSettings();
        this.plugin.syncScrollFab();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Classic control bar").setDesc(
      "OFF (default) = minimal UI: sirf floating \u25B6 aur \u2191/\u2193 button. ON = purani poori control bar (\u2212, +, filter, mode, \u23F1, \u2912, \u2715) bhi dikhegi."
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollBarClassic).onChange(async (v) => {
        this.plugin.settings.scrollBarClassic = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Quiet mode").setDesc(
      "ON (default) = autoscroll ke status popup (speed/direction/filter/plain-scroll) nahi dikhenge; sirf zaroori error notices aayenge."
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.scrollQuiet).onChange(async (v) => {
        this.plugin.settings.scrollQuiet = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Mobile toolbar guide").setDesc("Kaunsi commands Settings \u2192 Mobile \u2192 Manage toolbar me add karni hain \u2014 one-tap checklist ke saath.").addButton(
      (btn) => btn.setButtonText("Open guide").onClick(() => {
        new MobileToolbarGuideModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Quiz mode").setHeading();
    const qRow = new import_obsidian2.Setting(containerEl).setName("Time per question").setDesc(
      "How long before the answer is revealed (1s\u201312h). Write \u23F130, \u23F115m or \u23F12h in a toggle title to override it for that question."
    );
    addSecondsPicker(qRow, {
      sliderMin: QUIZ_SECONDS_MIN,
      sliderMax: 120,
      max: QUIZ_SECONDS_MAX,
      get: () => clampQuizSeconds(this.plugin.settings.quizSeconds),
      clamp: clampQuizSeconds,
      save: async (v) => {
        this.plugin.settings.quizSeconds = v;
        await this.plugin.saveSettings();
      }
    });
    const rRow = new import_obsidian2.Setting(containerEl).setName("Answer time").setDesc("How long the revealed answer stays open before the toggle closes (1s\u20131h).");
    addSecondsPicker(rRow, {
      sliderMin: 1,
      sliderMax: 60,
      max: REVEAL_SECONDS_MAX,
      get: () => clampRevealSeconds(this.plugin.settings.quizRevealSeconds),
      clamp: clampRevealSeconds,
      save: async (v) => {
        this.plugin.settings.quizRevealSeconds = v;
        await this.plugin.saveSettings();
      }
    });
    new import_obsidian2.Setting(containerEl).setName("Go to the next question automatically").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizAutoNext).onChange(async (v) => {
        this.plugin.settings.quizAutoNext = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Close the toggle after the answer").setDesc("Only one answer is visible at a time.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizCloseAfterReveal).onChange(async (v) => {
        this.plugin.settings.quizCloseAfterReveal = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Use the colour filter").setDesc("Quiz only the chosen colours instead of every toggle.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizUseColorFilter).onChange(async (v) => {
        this.plugin.settings.quizUseColorFilter = v;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Quiz colours").setDesc(`Currently ${filterLabel(this.plugin.quizFilterColors())}.`).addButton(
      (b) => b.setButtonText("Choose").onClick(() => new QuizFilterModal(this.app, this.plugin).open())
    );
    new import_obsidian2.Setting(containerEl).setName("Minimal quiz UI").setDesc("Only the small timer ring on the question \u2014 no floating control strip.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizMinimalUi).onChange(async (v) => {
        this.plugin.settings.quizMinimalUi = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Loop the quiz").setDesc("Start again from the first question instead of finishing.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizLoop).onChange(async (v) => {
        this.plugin.settings.quizLoop = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Log performance to perf-log.md").setDesc(
      'When on, "Performance report" also appends quiz-timer and scroll metrics to perf-log.md in your vault.'
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.perfLog).onChange(async (v) => {
        this.plugin.settings.perfLog = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Notify when the time is up").addToggle(
      (tg) => tg.setValue(this.plugin.settings.quizBeepOnTimeUp).onChange(async (v) => {
        this.plugin.settings.quizBeepOnTimeUp = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Reset timer position").setDesc("Bring the floating timer back to the top-left if it drifted off-screen.").addButton((btn) => {
      btn.setButtonText("Reset position").onClick(async () => {
        this.plugin.settings.timerX = 24;
        this.plugin.settings.timerY = 120;
        await this.plugin.saveSettings();
        this.plugin.hideTimer();
        this.plugin.showTimer();
      });
    });
  }
};

// src/sheet-modal.ts
var import_obsidian3 = require("obsidian");
var ScrollSheetModal = class extends import_obsidian3.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onClose() {
    this.contentEl.empty();
    this.plugin.scrollSheetOpen = false;
    this.plugin.syncScrollFab();
  }
  onOpen() {
    this.modalEl.addClass("ntt-sheet");
    this.setTitle("Autoscroll \u2014 quick controls");
    const s = this.plugin.settings;
    new import_obsidian3.Setting(this.contentEl).setName("Autoscroll").setDesc("ON = is note par autoscroll chalu, OFF = band. Screen ko dabaye rakho to jab tak hold hai scroll ruka rahega.").addToggle(
      (tg) => tg.setValue(this.plugin.autoScrollActive() && this.plugin.scrollRunning).onChange(async (v) => {
        await this.plugin.setAutoScrollEnabled(v);
        tg.setValue(this.plugin.autoScrollActive() && this.plugin.scrollRunning);
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Quiz (timed question run)").setDesc("ON = timed quiz shuru \u2014 har toggle par timer, auto reveal, auto next.").addToggle(
      (tg) => tg.setValue(!!this.plugin.quizState).onChange((v) => {
        if (v)
          this.plugin.startQuizRun();
        else
          this.plugin.stopQuiz(true);
        tg.setValue(!!this.plugin.quizState);
      })
    );
    const qRow = new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 time per question").setDesc(
      "Kitne second baad answer khud reveal ho (1s\u201312h). Title me \u23F130 / \u23F115m / \u23F12h likho to us question par wahi chalega."
    );
    addSecondsPicker(qRow, {
      sliderMin: QUIZ_SECONDS_MIN,
      sliderMax: 120,
      max: QUIZ_SECONDS_MAX,
      get: () => clampQuizSeconds(s.quizSeconds),
      clamp: clampQuizSeconds,
      save: async (v) => {
        s.quizSeconds = v;
        await this.plugin.saveSettings();
      }
    });
    const rRow = new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 answer time").setDesc("Reveal hone ke baad answer kitni der khula rahe (1s\u20131h).");
    addSecondsPicker(rRow, {
      sliderMin: 1,
      sliderMax: 60,
      max: REVEAL_SECONDS_MAX,
      get: () => clampRevealSeconds(s.quizRevealSeconds),
      clamp: clampRevealSeconds,
      save: async (v) => {
        s.quizRevealSeconds = v;
        await this.plugin.saveSettings();
      }
    });
    new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 auto next").setDesc("ON = answer ke baad agla question khud, OFF = wahin ruk jao.").addToggle(
      (tg) => tg.setValue(s.quizAutoNext).onChange(async (v) => {
        s.quizAutoNext = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 kaunse toggle").setDesc(`Abhi ${filterLabel(this.plugin.quizFilterColors())} \u2014 default, \u{1F534}, \u{1F7E1}, \u{1F7E2} \u2026`).addButton(
      (b) => b.setButtonText("Filter").onClick(() => {
        this.close();
        new QuizFilterModal(this.app, this.plugin).open();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 minimal UI").setDesc("Sirf question par chhota timer ring, koi floating box nahi.").addToggle(
      (tg) => tg.setValue(s.quizMinimalUi).onChange(async (v) => {
        s.quizMinimalUi = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Quiz \u2014 loop").setDesc("Aakhri question ke baad phir se question 1 se shuru.").addToggle(
      (tg) => tg.setValue(s.quizLoop).onChange(async (v) => {
        s.quizLoop = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Answers \u2014 open / close all").setDesc("Is note ke sabhi answer toggles ek tap me kholo ya band karo.").addButton(
      (b) => b.setButtonText("Open all").onClick(() => {
        this.plugin.setAllAnswersOpen(true);
      })
    ).addButton(
      (b) => b.setButtonText("Close all").onClick(() => {
        this.plugin.setAllAnswersOpen(false);
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Open with auto-quiz (answers stay open)").setDesc("ON = quiz shuru hote hi har answer khula rahega aur band nahi hoga.").addToggle(
      (tg) => tg.setValue(s.quizKeepAnswersOpen).onChange(async (v) => {
        s.quizKeepAnswersOpen = v;
        await this.plugin.saveSettings();
        this.plugin.refreshQuizAnswerVisibility();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Direction").setDesc("Forward = neeche ki taraf, Reverse = upar ki taraf scroll.").addToggle(
      (tg) => tg.setTooltip("Reverse (upar)").setValue(!!s.scrollReverse).onChange(async (v) => {
        await this.plugin.setScrollReverse(v);
        tg.setValue(!!this.plugin.settings.scrollReverse);
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Speed").setDesc(`Currently ${multiplierFromSpeed(s.scrollSpeed)}x.`).addButton(
      (btn) => btn.setButtonText("Choose").onClick(() => new ScrollSpeedModal(this.app, this.plugin).open())
    );
    new import_obsidian3.Setting(this.contentEl).setName("Pause for").setDesc(`Hold time \u2014 currently ${formatDwell(clampHold(s.scrollHold))}.`).addButton(
      (btn) => btn.setButtonText("Choose").onClick(() => new ScrollDwellModal(this.app, this.plugin).open())
    );
    new import_obsidian3.Setting(this.contentEl).setName("Pause at").setDesc(`Currently ${modeLabel(this.plugin.modeConfig())}.`).addButton(
      (btn) => btn.setButtonText("Choose").onClick(() => new ScrollModeModal(this.app, this.plugin).open())
    );
    new import_obsidian3.Setting(this.contentEl).setName("Colour filter").setDesc(`Currently ${filterLabel(s.scrollFilter)}.`).addButton(
      (btn) => btn.setButtonText("Choose").onClick(() => new ScrollFilterModal(this.app, this.plugin).open())
    );
    new import_obsidian3.Setting(this.contentEl).setName("Reverse direction \u2191").addToggle(
      (tg) => tg.setValue(s.scrollReverse).onChange(async (v) => {
        await this.plugin.setScrollReverse(v);
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Loop the note").addToggle(
      (tg) => tg.setValue(s.scrollLoop).onChange(async (v) => {
        this.plugin.settings.scrollLoop = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Open toggles automatically").addToggle(
      (tg) => tg.setValue(s.scrollAutoOpen).onChange(async (v) => {
        this.plugin.settings.scrollAutoOpen = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Close them when leaving").addToggle(
      (tg) => tg.setValue(s.scrollAutoClose).onChange(async (v) => {
        this.plugin.settings.scrollAutoClose = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Tall toggles screen-by-screen").addToggle(
      (tg) => tg.setValue(s.scrollChunkTall).onChange(async (v) => {
        this.plugin.settings.scrollChunkTall = v;
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Debug overlay").addToggle(
      (tg) => tg.setValue(s.scrollDebug).onChange(async (v) => {
        this.plugin.settings.scrollDebug = v;
        await this.plugin.saveSettings();
        this.plugin.syncScrollDebugOverlay();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("Quiet mode (no popups)").setDesc("ON = speed / direction / plain-scroll wale notice nahi dikhenge.").addToggle(
      (tg) => tg.setValue(s.scrollQuiet).onChange(async (v) => {
        this.plugin.settings.scrollQuiet = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian3.Setting(this.contentEl).setName("More").addButton(
      (btn) => btn.setButtonText("Go to first").onClick(() => {
        this.close();
        this.plugin.scrollToStart();
      })
    ).addButton(
      (btn) => btn.setButtonText("Stats").onClick(() => new ScrollStatsModal(this.app, this.plugin).open())
    ).addButton(
      (btn) => btn.setButtonText("Toolbar guide").onClick(() => new MobileToolbarGuideModal(this.app, this.plugin).open())
    );
  }
};

// src/editor-blocks.ts
function convertDetailsToCallouts(doc, calloutType, collapsed, boldSummary) {
  const fold = collapsed ? "-" : "+";
  const detailsRegex = /<details(\s[^>]*)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  return doc.replace(detailsRegex, (_match, _attrs, summaryRaw, bodyRaw) => {
    const summary = cleanInlineHtml(summaryRaw).trim();
    const title = boldSummary && !summary.startsWith("**") ? `**${summary}**` : summary;
    const bodyText = bodyRaw.trim();
    if (bodyText.length === 0) {
      return `> [!${calloutType}]${fold} ${title}`;
    }
    const bodyLines = bodyText.split("\n").map((line) => {
      const cleaned = cleanInlineHtml(line);
      return cleaned.trim().length === 0 ? ">" : `> ${cleaned}`;
    });
    return `> [!${calloutType}]${fold} ${title}
${bodyLines.join("\n")}`;
  });
}
function convertCalloutsToDetails(doc) {
  const lines = doc.split("\n");
  const out = [];
  let i = 0;
  let changed = false;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^>\s*\[!([^\]]+)\]([+-])\s?(.*)$/);
    if (m) {
      const _type = m[1];
      const marker = m[2];
      const title = m[3].trim();
      const body = [];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        if (/^>\s*\[![^\]]+\][+-]/.test(lines[i]))
          break;
        const bodyLine = lines[i].replace(/^>\s?/, "");
        body.push(bodyLine);
        i++;
      }
      const openAttr = marker === "+" ? " open" : "";
      const summary = title.length > 0 ? `<summary>${title}</summary>` : "<summary></summary>";
      const bodyHtml = body.length > 0 ? "\n\n" + body.join("\n") : "";
      out.push(`<details${openAttr}>`);
      out.push(summary);
      out.push(bodyHtml);
      out.push("</details>");
      changed = true;
      continue;
    }
    out.push(line);
    i++;
  }
  return changed ? out.join("\n") : doc;
}
function cleanInlineHtml(text) {
  return text.replace(/<b>/g, "**").replace(/<\/b>/g, "**").replace(/<strong>/g, "**").replace(/<\/strong>/g, "**").replace(/<i>/g, "*").replace(/<\/i>/g, "*").replace(/<em>/g, "*").replace(/<\/em>/g, "*").replace(/<br\s*\/?>/g, "").trim();
}
var NUMBERED_HEADER = /^(>\s*\[![^\]]+\][+-]\s*(?:\*\*)?)(\d+)\.\s?/;
var NUMBERED_SUMMARY = /^(\s*<summary>(?:<b>)?)(\d+)\.\s?/;
function nextToggleNumber(lines) {
  var _a;
  let last = 0;
  for (const line of lines) {
    const m = (_a = line.match(NUMBERED_HEADER)) != null ? _a : line.match(NUMBERED_SUMMARY);
    if (m)
      last = parseInt(m[2], 10);
  }
  return last + 1;
}
function renumberToggles(doc) {
  let n = 0;
  const out = doc.split("\n").map((line) => {
    var _a;
    const m = (_a = line.match(NUMBERED_HEADER)) != null ? _a : line.match(NUMBERED_SUMMARY);
    if (!m)
      return line;
    n += 1;
    return line.replace(m[0], `${m[1]}${n}. `);
  });
  return n === 0 ? doc : out.join("\n");
}
var MCQ_OPTION2 = /^>\s*- \[[ xX]\]\s+\S/;
var MCQ_EMPTY_OPTION = /^>\s*- \[[ xX]\]\s*$/;
var ANSWER_LINE2 = /^>\s*\*\*Answer:\*\*/;
var EMPTY_ANSWER_LINE = /^>\s*\*\*Answer:\*\*\s*$/;
var MATCH_ROW = /^>\s*\|\s*(\d+)\s*\|(.*)\|\s*$/;
var EMPTY_MATCH_ROW = /^>\s*\|\s*\d*\s*\|\s*\|\s*\d*\.?\s*\|\s*$/;
var MATCH_SEPARATOR = /^>\s*\|[\s-|]+\|\s*$/;
function toggleOptionCheckbox(line) {
  const m = line.match(/^(\s*(?:>\s*)?-\s\[)([ xX])(\].*)$/);
  if (!m)
    return line;
  return `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}`;
}
function nextMatchRow(rowNumber) {
  const n = rowNumber + 1;
  return `| ${n} |  | ${n}.  |`;
}
function buildToggleBlock(opts, bodyLines) {
  var _a;
  const num = opts.numbered && opts.number ? `${opts.number}. ` : "";
  const title = (_a = opts.title) != null ? _a : "";
  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";
    const body2 = bodyLines.join("\n");
    const head2 = `<details${openAttr}>
${sOpen}${num}`;
    const text2 = `${head2}${title}${sClose}

${body2}

</details>
`;
    return { text: text2, cursorOffset: head2.length + title.length };
  }
  const fold = opts.collapsed ? "-" : "+";
  const bold = opts.boldSummary ? "**" : "";
  const head = `> [!${opts.calloutType}]${fold} ${bold}${num}`;
  const body = bodyLines.map((l) => l.length ? `> ${l}` : "> ").join("\n");
  const text = `${head}${title}${bold}
${body}
`;
  return { text, cursorOffset: head.length + title.length };
}
function buildMcqBlock(opts) {
  const count = Math.max(2, Math.min(6, opts.count || 4));
  const lines = [];
  for (let i = 0; i < count; i++)
    lines.push("- [ ] ");
  if (opts.addAnswerLine !== false) {
    lines.push("");
    lines.push("**Answer:** ");
  }
  return buildToggleBlock(opts, lines);
}
function buildMatchBlock(opts) {
  var _a;
  const rows = Math.max(2, Math.min(8, opts.count || 4));
  const lines = ["| # | Column A | Column B |", "|---|---|---|"];
  for (let i = 1; i <= rows; i++)
    lines.push(`| ${i} |  | ${i}.  |`);
  if (opts.addAnswerLine !== false) {
    lines.push("");
    const key = Array.from({ length: rows }, (_, i) => `${i + 1}-`).join(", ");
    lines.push(`**Answer:** ${key}`);
  }
  return buildToggleBlock({ ...opts, title: (_a = opts.title) != null ? _a : "Match the following" }, lines);
}
function planEnter(text, opts) {
  const bold = opts.boldSummary ? "**" : "";
  const num = opts.numbered && opts.nextNumber ? `${opts.nextNumber}. ` : "";
  const fold = opts.collapsed ? "-" : "+";
  const calloutHeader = `> [!${opts.calloutType}]${fold} `;
  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";
    if (/^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/.test(text)) {
      return { from: "lineStart", insert: "", cursorOffset: 0 };
    }
    if (/<\/summary>\s*$/.test(text)) {
      return { from: "cursor", insert: "\n", cursorOffset: 1 };
    }
    if (/^\s*-\s\[[ xX]\]\s*$/.test(text)) {
      const insert = opts.addAnswerLine === false ? "" : "**Answer:** ";
      return { from: "lineStart", insert, cursorOffset: insert.length };
    }
    if (/^\s*-\s\[[ xX]\]\s+\S/.test(text)) {
      return { from: "cursor", insert: "\n- [ ] ", cursorOffset: 7 };
    }
    if (text.trim() === "</details>") {
      const insert = `

<details${openAttr}>
${sOpen}${num}${sClose}


</details>
`;
      const cursorOffset = `

<details${openAttr}>
${sOpen}${num}`.length;
      return { from: "cursor", insert, cursorOffset };
    }
    return null;
  }
  const isCalloutHeader = /^>\s*\[![^\]]+\][+-]/.test(text);
  const isCalloutLine = /^>/.test(text);
  if (!isCalloutLine)
    return null;
  if (isCalloutHeader && /^>\s*\[![^\]]+\][+-]\s*(\*\*\s*(?:\d+\.\s*)?\*\*)?\s*(?:\d+\.)?\s*$/.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }
  if (MCQ_EMPTY_OPTION.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  if (MCQ_OPTION2.test(text)) {
    return { from: "cursor", insert: "\n> - [ ] ", cursorOffset: 9 };
  }
  if (EMPTY_ANSWER_LINE.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }
  if (MATCH_SEPARATOR.test(text)) {
    const insert = `
> ${nextMatchRow(0)}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }
  if (EMPTY_MATCH_ROW.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  const rowMatch = text.match(MATCH_ROW);
  if (rowMatch) {
    const insert = `
> ${nextMatchRow(Number(rowMatch[1]))}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }
  if (!isCalloutHeader && /^>\s*$/.test(text)) {
    const insert = `
${calloutHeader}${bold}${num}${bold}`;
    return {
      from: "lineStart",
      insert,
      cursorOffset: 1 + calloutHeader.length + bold.length + num.length
    };
  }
  return { from: "cursor", insert: "\n> ", cursorOffset: 3 };
}
function planBackspace(text, col, opts) {
  var _a, _b;
  if (opts.format === "details") {
    const emptySummary = /^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/;
    if (emptySummary.test(text)) {
      return { insert: "", cursorOffset: 0 };
    }
    const sm = text.match(/^(\s*<summary>(?:<b>)?)([\s\S]*?)((?:<\/b>)?<\/summary>\s*)$/);
    if (sm && col === sm[1].length && sm[2].length > 0) {
      return { insert: sm[2], cursorOffset: 0 };
    }
    return null;
  }
  const headerMatch = text.match(/^(>\s*\[![^\]]+\][+-]\s*)(\*\*)?([\s\S]*?)(\*\*)?\s*$/);
  const isHeader = /^>\s*\[![^\]]+\][+-]/.test(text);
  if (!isHeader && /^>\s*$/.test(text) && col === text.length) {
    return { insert: "", cursorOffset: 0 };
  }
  if (!isHeader && col === text.length && (MCQ_EMPTY_OPTION.test(text) || EMPTY_ANSWER_LINE.test(text) || EMPTY_MATCH_ROW.test(text))) {
    return { insert: "> ", cursorOffset: 2 };
  }
  const optionMatch = text.match(/^(>\s*-\s\[[ xX]\]\s)(\S[\s\S]*)$/);
  if (!isHeader && optionMatch && col === optionMatch[1].length) {
    return { insert: `> ${optionMatch[2]}`, cursorOffset: 2 };
  }
  if (isHeader && headerMatch) {
    const prefix = headerMatch[1] + ((_a = headerMatch[2]) != null ? _a : "");
    const title = (_b = headerMatch[3]) != null ? _b : "";
    if (title.length === 0 || /^\d+\.\s*$/.test(title)) {
      return { insert: "", cursorOffset: 0 };
    }
    if (col === prefix.length) {
      return { insert: title, cursorOffset: 0 };
    }
    return null;
  }
  const bodyMatch = text.match(/^(>\s)([\s\S]+)$/);
  if (!isHeader && bodyMatch && col === bodyMatch[1].length) {
    return { insert: bodyMatch[2], cursorOffset: 0 };
  }
  return null;
}

// main.ts
function nowMs() {
  const perf = globalThis.performance;
  return typeof (perf == null ? void 0 : perf.now) === "function" ? perf.now() : Date.now();
}
var DEFAULT_SETTINGS = {
  ...DEFAULT_POMODORO,
  ...DEFAULT_AUTOSCROLL,
  ...DEFAULT_QUIZ,
  calloutType: "question",
  defaultCollapsed: true,
  boldSummary: true,
  autoContinue: true,
  format: "callout",
  numberedByDefault: false,
  color: "default",
  mcqOptionCount: 4,
  matchRowCount: 4,
  addAnswerLine: true,
  minimalNames: true,
  srs: {},
  autoReview: true,
  scrollFab: true,
  toolbarGuideDone: [],
  scrollBarClassic: false,
  scrollQuiet: true,
  quizFilter: [],
  quizMinimalUi: true,
  perfLog: false
};
var NotionTogglePlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    /* v1.0.5 timer state */
    this.timerState = createState(DEFAULT_SETTINGS);
    this.timerWidget = null;
    this.statusEl = null;
    this.lastTick = Date.now();
    /* v1.0.6 attention tracking */
    this.lastActivityAt = Date.now();
    this.sessionNotePath = null;
    /* v1.0.7 review state */
    this.reviewOpen = false;
    this.reviewSuggestion = "good";
    /* v1.0.9 auto-scroll state */
    this.scrollBar = null;
    this.scrollRunning = false;
    this.scrollPlan = [];
    /** v1.1.7 — true while a one-shot "view still rendering" retry is pending. */
    this.scrollRetryPending = false;
    this.scrollAt = -1;
    this.scrollHoldUntil = 0;
    this.scrollLastFrame = 0;
    this.scrollRaf = null;
    this.scrollContainer = null;
    /* v1.1.1 pause-at / memory state */
    this.scrollOpenedAt = 0;
    this.scrollSeen = /* @__PURE__ */ new Set();
    this.scrollNotePath = null;
    this.scrollTotalItems = 0;
    /* v1.1.2 reader-exact loop state (mirrors useAutoScroll refs) */
    /** Authoritative float scroll position — scrollTop snaps to whole pixels. */
    this.scrollPos = 0;
    /** +1 = down, -1 = up. Route mode owns this per leg. */
    this.scrollDir = 1;
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.scrollDwellUntil = 0;
    this.scrollDwellKey = null;
    this.scrollDwellDir = 1;
    /** v1.4.2 — pixels travelled this run; an edge only ends a run that moved. */
    this.scrollMovedPx = 0;
    this.scrollBoxes = [];
    this.scrollBoxesAt = 0;
    /** v1.2.1 — last time we tried to re-find a scrollable container. */
    this.scrollRelocateAt = 0;
    /** v1.2.1 — the quick-controls sheet is open (FAB stays pinned). */
    this.scrollSheetOpen = false;
    this.scrollElByOrdinal = /* @__PURE__ */ new Map();
    this.scrollTargets = [];
    this.scrollTargetsKey = "";
    this.scrollOpenEl = null;
    this.scrollVisit = null;
    /** v1.1.3 debug overlay + the last loop events it reports. */
    this.scrollDebugOverlay = null;
    this.scrollLastEvent = "";
    this.scrollLastGrade = "";
    this.scrollSmoothEl = null;
    this.scrollPrevTransform = null;
    this.scrollPrevBehavior = null;
    /** v1.1.5 floating launch button (tap = start, hold = sheet). */
    this.scrollFabBtn = null;
    /** v1.1.8 hold-anywhere-to-pause. */
    this.holdPause = null;
    this.scrollHoldPaused = false;
    this.scrollHoldAt = 0;
    /* v1.1.0 quiz mode state */
    /** v1.3.3 — lightweight perf telemetry (quiz paint cadence, re-measure latency). */
    this.perf = new Telemetry();
    this.quizBar = null;
    /** v1.4.2 — one inline countdown badge per question of the run. */
    this.quizBoard = null;
    this.quizState = null;
    this.quizStops = [];
    this.quizTitles = [];
    this.quizContainer = null;
    this.quizLastFrame = 0;
    this.quizInterval = null;
    /** v1.1.9: one-shot re-scan guard when the view is still rendering. */
    this.quizRetryPending = false;
    /** v1.3.0 — pre-quiz state of every toggle, restored on stop. */
    this.quizSnapshot = [];
  }
  /**
   * v1.4.0 — real-device profiling: copies the telemetry report to the
   * clipboard (falls back to a Notice) and, when Settings → "Log performance
   * to perf-log.md" is on, appends it to the note for later analysis.
   */
  async exportPerfReport() {
    var _a, _b;
    const note = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.basename) != null ? _b : "no note";
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 19);
    const body = formatTelemetry(this.perf.report());
    const report = `# Performance report \u2014 ${note} \xB7 ${stamp} UTC

${body}
`;
    try {
      await navigator.clipboard.writeText(report);
      new import_obsidian4.Notice("Performance report copied to clipboard.", 5e3);
    } catch (e) {
      new import_obsidian4.Notice(body, 12e3);
    }
    if (!this.settings.perfLog)
      return;
    try {
      const path = "perf-log.md";
      const entry = `
## ${note} \u2014 ${stamp} UTC

${body}
`;
      if (await this.app.vault.adapter.exists(path)) {
        await this.app.vault.adapter.append(path, entry);
      } else {
        await this.app.vault.adapter.write(path, `# Autoscroll performance log
${entry}`);
      }
      new import_obsidian4.Notice(`Performance report appended to ${path}.`, 4e3);
    } catch (err) {
      console.error("[notion-toggle] perf log", err);
      new import_obsidian4.Notice("Could not write perf-log.md (see console).", 6e3);
    }
  }
  /**
   * v1.0.7: every command goes through here, so the toolbar list stays short.
   * Four primary commands keep clean names; the rest get an "Advanced: " prefix.
   */
  addCommand(cmd) {
    return super.addCommand({
      ...cmd,
      name: commandName(cmd.id, cmd.name, this.settings.minimalNames)
    });
  }
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "smart-toggle",
      icon: "plus-circle",
      name: "Toggle (smart add)",
      editorCallback: (editor) => this.runSmartToggle(editor)
    });
    this.addCommand({
      id: "smart-colour",
      icon: "traffic-cone",
      name: "Colour (red \u2192 yellow \u2192 green)",
      editorCallback: (editor) => this.cycleColorAtCursor(editor)
    });
    this.addCommand({
      id: "smart-recall",
      icon: "timer",
      name: "Recall (start / pause session)",
      editorCallback: (editor) => this.runSmartRecall(editor)
    });
    this.addCommand({
      id: "smart-review",
      icon: "check-circle",
      name: "Review (spaced repetition)",
      editorCallback: (editor) => this.openReview(editor)
    });
    this.addCommand({
      id: "insert-toggle",
      icon: "right-triangle",
      name: "Insert toggle (empty)",
      editorCallback: (editor) => {
        const fold = this.settings.defaultCollapsed ? "-" : "+";
        const type = this.activeCallout();
        const cursor = editor.getCursor();
        editor.replaceRange(`> [!${type}]${fold} 
> 
`, cursor);
        editor.setCursor({ line: cursor.line, ch: cursor.ch + `> [!${type}]${fold} `.length });
      }
    });
    this.addCommand({
      id: "wrap-selection-toggle",
      icon: "text-quote",
      name: "Wrap selection as toggle",
      editorCallback: (editor) => this.wrapSelectionAsToggle(editor)
    });
    this.addCommand({
      id: "convert-details-to-callouts",
      icon: "list-tree",
      name: "Convert <details> blocks to callouts",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertDetailsToCallouts(doc, this.activeCallout(), this.settings.defaultCollapsed, this.settings.boldSummary);
        if (converted === doc) {
          new import_obsidian4.Notice("No <details> blocks found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian4.Notice("Converted all <details> blocks to callout toggles.");
      }
    });
    this.addCommand({
      id: "convert-callouts-to-details",
      icon: "code",
      name: "Convert callouts to <details> blocks",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertCalloutsToDetails(doc);
        if (converted === doc) {
          new import_obsidian4.Notice("No foldable callout toggles found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian4.Notice("Converted callout toggles to <details> blocks.");
      }
    });
    this.addCommand({
      id: "quick-qa-toggle",
      icon: "message-square-plus",
      name: "Quick Q&A toggle (prompt)",
      editorCallback: (editor) => {
        new QuickQAModal(this.app, this, (result) => {
          const type = this.activeCallout();
          const fold = this.settings.defaultCollapsed ? "-" : "+";
          const q = result.question.trim();
          const a = result.answer.trim();
          if (q.length === 0) {
            new import_obsidian4.Notice("Question is empty \u2014 nothing inserted.");
            return;
          }
          const title = this.maybeBold(q);
          const body = a.length > 0 ? "\n" + a.split("\n").map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n") : "";
          editor.replaceRange(`> [!${type}]${fold} ${title}${body}
`, editor.getCursor());
        }).open();
      }
    });
    this.addCommand({
      id: "new-toggle-below",
      icon: "right-triangle",
      name: "New toggle below",
      editorCallback: (editor) => this.insertNewToggleBelow(editor)
    });
    this.addCommand({
      id: "toggle-auto-continue",
      icon: "corner-down-left",
      name: "Toggle auto-continue on Enter",
      callback: async () => {
        this.settings.autoContinue = !this.settings.autoContinue;
        await this.saveSettings();
        new import_obsidian4.Notice(`Auto-continue on Enter: ${this.settings.autoContinue ? "ON" : "OFF"}`);
      }
    });
    this.addCommand({
      id: "insert-numbered-toggle",
      icon: "list-ordered",
      name: "Insert numbered toggle",
      editorCallback: (editor) => this.insertNewToggleBelow(editor, true)
    });
    this.addCommand({
      id: "renumber-toggles",
      icon: "list-ordered",
      name: "Renumber toggles in note",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const fixed = renumberToggles(doc);
        if (fixed === doc) {
          new import_obsidian4.Notice("Numbering already correct (or no numbered toggles).");
          return;
        }
        const cursor = editor.getCursor();
        editor.setValue(fixed);
        editor.setCursor(cursor);
        new import_obsidian4.Notice("Toggles renumbered.");
      }
    });
    this.addCommand({
      id: "set-toggle-color",
      icon: "palette",
      name: "Set toggle colour",
      editorCallback: (editor) => {
        new ColorPickerModal(this.app, (colorId) => {
          const callout = calloutForColor(colorId, this.settings.calloutType);
          if (!this.recolorToggleAtCursor(editor, callout)) {
            new import_obsidian4.Notice("Cursor is not inside a toggle.");
          }
        }).open();
      }
    });
    this.addCommand({
      id: "cycle-toggle-color",
      icon: "traffic-cone",
      name: "Cycle toggle colour (red \u2192 yellow \u2192 green)",
      editorCallback: (editor) => this.cycleColorAtCursor(editor)
    });
    this.addCommand({
      id: "toggle-auto-numbering",
      icon: "list-ordered",
      name: "Toggle auto-numbering",
      callback: async () => {
        this.settings.numberedByDefault = !this.settings.numberedByDefault;
        await this.saveSettings();
        new import_obsidian4.Notice(`Auto-numbering: ${this.settings.numberedByDefault ? "ON" : "OFF"}`);
      }
    });
    this.addCommand({
      id: "insert-mcq-toggle",
      icon: "list-checks",
      name: "Insert MCQ toggle (checkbox options)",
      editorCallback: (editor) => this.insertQuestionBlock(editor, "mcq")
    });
    this.addCommand({
      id: "add-mcq-option",
      icon: "plus-circle",
      name: "Add MCQ option",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        if (!/^>/.test(line)) {
          new import_obsidian4.Notice("Cursor is not inside a toggle.");
          return;
        }
        editor.replaceRange(`
> - [ ] `, { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: 8 });
      }
    });
    this.addCommand({
      id: "toggle-option-checkbox",
      icon: "check-square",
      name: "Toggle option checkbox",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const next = toggleOptionCheckbox(line);
        if (next === line) {
          new import_obsidian4.Notice("Cursor is not on a checkbox option.");
          return;
        }
        editor.setLine(cursor.line, next);
        editor.setCursor(cursor);
      }
    });
    this.addCommand({
      id: "insert-match-toggle",
      icon: "table",
      name: "Insert Match the following toggle",
      editorCallback: (editor) => this.insertQuestionBlock(editor, "match")
    });
    this.addCommand({
      id: "insert-match-answer-row",
      icon: "key",
      name: "Insert answer key line",
      editorCallback: (editor) => {
        const found = this.findHeaderLine(editor);
        if (!found) {
          new import_obsidian4.Notice("Cursor is not inside a toggle.");
          return;
        }
        let last = found.line;
        for (let l = found.line + 1; l < editor.lineCount(); l++) {
          if (!/^>/.test(editor.getLine(l)))
            break;
          if (ANSWER_LINE2.test(editor.getLine(l))) {
            new import_obsidian4.Notice("This toggle already has an answer line.");
            return;
          }
          last = l;
        }
        editor.replaceRange(`
> 
> **Answer:** `, {
          line: last,
          ch: editor.getLine(last).length
        });
        editor.setCursor({ line: last + 2, ch: 14 });
      }
    });
    this.timerState = createState(this.settings);
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("notion-toggle-status");
    this.statusEl.setText(sessionSummary(this.timerState));
    this.addRibbonIcon("timer", "Recall timer", () => this.toggleTimer());
    this.addCommand({
      id: "toggle-recall-timer",
      icon: "timer",
      name: "Timer: show / hide",
      callback: () => this.toggleTimer()
    });
    this.addCommand({
      id: "recall-timer-start-pause",
      icon: "play",
      name: "Timer: start / pause",
      callback: () => {
        this.showTimer();
        const running = !this.timerState.running;
        this.timerState = { ...this.timerState, running, autoPaused: false };
        if (running && !this.sessionNotePath)
          this.sessionNotePath = this.activeNotePath();
        this.lastTick = Date.now();
        this.lastActivityAt = Date.now();
        this.renderTimer();
      }
    });
    this.addCommand({
      id: "recall-timer-reset",
      icon: "rotate-ccw",
      name: "Timer: reset phase",
      callback: () => {
        this.timerState = resetPhase(this.timerState, this.settings);
        this.renderTimer();
      }
    });
    this.addCommand({
      id: "recall-timer-skip",
      icon: "skip-forward",
      name: "Timer: skip phase",
      callback: () => {
        this.timerState = nextPhase(this.timerState, this.settings);
        this.lastTick = Date.now();
        this.renderTimer();
        this.updateStatus();
      }
    });
    this.addCommand({
      id: "recall-session-this-note",
      icon: "brain",
      name: "Timer: start recall session on this note",
      editorCallback: (editor) => this.startRecallSession(editor)
    });
    this.addCommand({
      id: "recall-timer-stop",
      icon: "square",
      name: "Timer: stop session",
      callback: () => this.stopTimerSession()
    });
    this.addCommand({
      id: "smart-autoscroll",
      icon: "chevrons-down",
      name: `Autoscroll (start / pause revision) \u2014 ${hotkeyLabel("smart-autoscroll")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
      callback: () => this.toggleAutoScroll()
    });
    this.addCommand({
      id: "autoscroll-reverse",
      icon: "chevrons-up",
      name: `Autoscroll: reverse direction \u2014 ${hotkeyLabel("autoscroll-reverse")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "R" }],
      callback: () => this.setScrollReverse(!this.settings.scrollReverse)
    });
    this.addCommand({
      id: "autoscroll-filter",
      icon: "filter",
      name: "Autoscroll: choose colour filter",
      callback: () => new ScrollFilterModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-faster",
      icon: "gauge",
      name: "Autoscroll: faster",
      callback: () => {
        if (!this.requireScrollRunning())
          return;
        this.nudgeScrollSpeed(SPEED_STEP);
      }
    });
    this.addCommand({
      id: "autoscroll-slower",
      icon: "gauge",
      name: "Autoscroll: slower",
      callback: () => {
        if (!this.requireScrollRunning())
          return;
        this.nudgeScrollSpeed(-SPEED_STEP);
      }
    });
    this.addCommand({
      id: "autoscroll-stop",
      icon: "square",
      name: "Autoscroll: stop",
      callback: () => {
        if (!this.requireScrollRunning())
          return;
        this.stopAutoScroll(true);
      }
    });
    this.addCommand({
      id: "autoscroll-sheet",
      icon: "sliders-horizontal",
      name: `Autoscroll: sheet (all controls) \u2014 ${hotkeyLabel("autoscroll-sheet")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "A" }],
      callback: () => new ScrollSheetModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-toolbar-guide",
      icon: "smartphone",
      name: "Autoscroll: mobile toolbar guide",
      callback: () => new MobileToolbarGuideModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-mode",
      icon: "list-filter",
      name: "Autoscroll: pause at (odd / even / custom / route / shuffle)",
      callback: () => new ScrollModeModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-dwell",
      icon: "timer",
      name: "Autoscroll: pause for (hold time)",
      callback: () => new ScrollDwellModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-speed-presets",
      icon: "gauge",
      name: "Autoscroll: speed presets (0.02x \u2026 20x)",
      callback: () => new ScrollSpeedModal(this.app, this).open()
    });
    this.addCommand({
      id: "autoscroll-top",
      icon: "arrow-up-to-line",
      name: "Autoscroll: go to first toggle",
      callback: () => this.scrollToStart()
    });
    this.addCommand({
      id: "autoscroll-shuffle",
      icon: "shuffle",
      name: "Autoscroll: smart shuffle (weakest toggles first)",
      callback: () => void this.rebuildShuffleRoute()
    });
    this.addCommand({
      id: "autoscroll-reset-memory",
      icon: "eraser",
      name: "Autoscroll: reset revision memory for this note",
      callback: () => void this.resetScrollMemory()
    });
    this.addCommand({
      id: "scroll-stats",
      icon: "bar-chart-3",
      name: "Autoscroll: revision stats (weak toggles)",
      callback: () => new ScrollStatsModal(this.app, this).open()
    });
    this.addCommand({
      id: "smart-quiz",
      icon: "list-checks",
      name: "Quiz (timed question run)",
      callback: () => this.toggleQuiz()
    });
    this.addCommand({
      id: "quiz-pause",
      icon: "pause",
      name: "Quiz: pause / resume",
      callback: () => this.toggleQuizPause()
    });
    this.addCommand({
      id: "answers-open-all",
      icon: "unfold-vertical",
      name: "Answers: open all toggles",
      callback: () => this.setAllAnswersOpen(true)
    });
    this.addCommand({
      id: "answers-close-all",
      icon: "fold-vertical",
      name: "Answers: close all toggles",
      callback: () => this.setAllAnswersOpen(false)
    });
    this.addCommand({
      id: "quiz-reveal-now",
      icon: "eye",
      name: "Quiz: reveal the answer now",
      callback: () => this.quizRevealNow()
    });
    this.addCommand({
      id: "quiz-next",
      icon: "skip-forward",
      name: "Quiz: next question",
      callback: () => this.quizNext()
    });
    this.addCommand({
      id: "quiz-stop",
      icon: "square",
      name: "Quiz: stop",
      callback: () => this.stopQuiz(true)
    });
    this.addCommand({
      id: "quiz-filter",
      icon: "filter",
      name: "Quiz: choose colour filter",
      callback: () => new QuizFilterModal(this.app, this).open()
    });
    this.addCommand({
      id: "quiz-seconds",
      icon: "timer-reset",
      name: "Quiz: set time per question",
      callback: () => new QuizSecondsModal(this.app, this).open()
    });
    this.addCommand({
      id: "perf-report",
      icon: "activity",
      name: "Performance report (quiz timer + re-measure)",
      // v1.4.0 — copies to clipboard and optionally appends to perf-log.md.
      callback: () => void this.exportPerfReport()
    });
    this.addCommand({
      id: "show-due-notes",
      icon: "calendar-clock",
      name: "Show notes due for recall",
      callback: () => this.showDueNotes()
    });
    this.lastTick = Date.now();
    this.registerInterval(
      window.setInterval(() => this.onTimerTick(), 250)
    );
    const bumpActivity = () => {
      this.lastActivityAt = Date.now();
    };
    for (const evt of ["keydown", "pointerdown", "touchstart", "wheel"]) {
      this.registerDomEvent(document, evt, bumpActivity, { passive: true });
    }
    this.registerDomEvent(document, "visibilitychange", () => this.evaluateAttention());
    this.registerDomEvent(window, "blur", () => this.evaluateAttention());
    this.registerDomEvent(window, "focus", () => this.evaluateAttention());
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        bumpActivity();
        this.evaluateAttention();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        var _a;
        const { store, moved } = renameCardKey((_a = this.settings.srs) != null ? _a : {}, oldPath, file.path);
        if (!moved)
          return;
        this.settings.srs = store;
        await this.saveSettings();
        this.renderTimer();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        var _a;
        const { store, removed } = removeCardKey((_a = this.settings.srs) != null ? _a : {}, file.path);
        if (!removed)
          return;
        this.settings.srs = store;
        await this.saveSettings();
        this.renderTimer();
      })
    );
    void this.pruneSchedule(true);
    if (this.settings.showOnStartup)
      this.showTimer();
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.syncScrollFab())
    );
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncScrollFab()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncScrollFab()));
    this.app.workspace.onLayoutReady(() => this.syncScrollFab());
    const overlayObserver = new MutationObserver(() => this.syncScrollFab());
    overlayObserver.observe(document.body, { childList: true });
    this.register(() => overlayObserver.disconnect());
    this.registerObsidianProtocolHandler("notion-toggle", async (params) => {
      const link = parseDeepLink(params);
      if (!link) {
        new import_obsidian4.Notice("Unknown notion-toggle link (use action=quiz | autoscroll | stop).");
        return;
      }
      if (link.action === "stop") {
        this.stopQuiz(false);
        if (this.scrollRunning)
          this.stopAutoScroll(false);
        return;
      }
      if (link.file) {
        await this.app.workspace.openLinkText(link.file, "", false);
        await new Promise((r) => window.setTimeout(r, 350));
      }
      if (link.filter) {
        if (link.action === "quiz")
          await this.setQuizFilter(link.filter);
        else
          await this.setScrollFilter(link.filter);
      }
      if (link.seconds) {
        this.settings.quizSeconds = clampQuizSeconds(link.seconds);
        await this.saveSettings();
      }
      if (link.speed) {
        this.settings.scrollSpeed = link.speed;
        await this.saveSettings();
      }
      if (link.action === "quiz")
        this.startQuizRun();
      else
        this.startAutoScroll();
    });
    this.registerEditorExtension(
      import_state.Prec.highest(
        import_view.keymap.of([
          {
            key: "Enter",
            run: (view) => {
              if (!this.settings.autoContinue)
                return false;
              return this.handleEnter(view);
            }
          },
          {
            key: "Backspace",
            run: (view) => {
              if (!this.settings.autoContinue)
                return false;
              return this.handleBackspace(view);
            }
          }
        ])
      )
    );
    this.addSettingTab(new NotionToggleSettingTab(this.app, this));
  }
  /** Callout type actually used, honouring the colour setting. */
  activeCallout() {
    return calloutForColor(this.settings.color, this.settings.calloutType);
  }
  /** Build a fresh toggle header string (no trailing newline). */
  toggleHeader(title = "") {
    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const inner = this.settings.boldSummary ? `<b>${title}</b>` : title;
      return `<details${openAttr}>
<summary>${inner}</summary>

`;
    }
    const fold = this.settings.defaultCollapsed ? "-" : "+";
    return `> [!${this.activeCallout()}]${fold} ${title}`;
  }
  /** Find the toggle header line at/above the cursor (callout or <summary>). */
  findHeaderLine(editor) {
    const cursor = editor.getCursor();
    for (let l = cursor.line; l >= 0 && l >= cursor.line - 40; l--) {
      const text = editor.getLine(l);
      if (/^>\s*\[![^\]]+\][+-]/.test(text))
        return { line: l, text };
      if (!/^>/.test(text) && l !== cursor.line)
        break;
    }
    return null;
  }
  /** Swap the callout type (colour) of the toggle at the cursor. */
  recolorToggleAtCursor(editor, callout) {
    const found = this.findHeaderLine(editor);
    if (!found)
      return false;
    const updated = recolorHeaderLine(found.text, callout);
    editor.setLine(found.line, updated);
    return true;
  }
  /** Insert an empty toggle on the line below the cursor and place the caret in its summary. */
  insertNewToggleBelow(editor, forceNumbered = false) {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const prefix = currentLine.trim().length === 0 ? "" : "\n";
    const numbered = forceNumbered || this.settings.numberedByDefault;
    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const openTag = `<details${openAttr}>`;
      const summaryOpen = this.settings.boldSummary ? "<summary><b>" : "<summary>";
      const summaryClose = this.settings.boldSummary ? "</b></summary>" : "</summary>";
      const num2 = numbered ? `${this.nextNumberAt(editor, cursor.line)}. ` : "";
      const block2 = `${prefix}${openTag}
${summaryOpen}${num2}${summaryClose}


</details>
`;
      editor.replaceRange(block2, { line: cursor.line, ch: currentLine.length });
      const summaryLine = cursor.line + (prefix ? 2 : 1);
      editor.setCursor({ line: summaryLine, ch: summaryOpen.length + num2.length });
      return;
    }
    const header = this.toggleHeader("");
    const num = numbered ? `${this.nextNumberAt(editor, cursor.line)}. ` : "";
    const bold = this.settings.boldSummary ? "**" : "";
    const block = `${prefix}${header}${bold}${num}${bold}
> 
`;
    editor.replaceRange(block, { line: cursor.line, ch: currentLine.length });
    const headerLine = cursor.line + (prefix ? 1 : 0);
    editor.setCursor({
      line: headerLine,
      ch: header.length + bold.length + num.length
    });
  }
  /** Next auto-number, based on the last numbered toggle above `line`. */
  nextNumberAt(editor, line) {
    const above = [];
    for (let l = 0; l <= line; l++)
      above.push(editor.getLine(l));
    return nextToggleNumber(above);
  }
  /** Insert an MCQ or "Match the following" skeleton below the cursor. */
  insertQuestionBlock(editor, kind) {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const prefix = currentLine.trim().length === 0 ? "" : "\n";
    const numbered = this.settings.numberedByDefault;
    const opts = {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format,
      numbered,
      number: numbered ? this.nextNumberAt(editor, cursor.line) : void 0,
      addAnswerLine: this.settings.addAnswerLine,
      count: kind === "mcq" ? this.settings.mcqOptionCount : this.settings.matchRowCount
    };
    const built = kind === "mcq" ? buildMcqBlock(opts) : buildMatchBlock(opts);
    editor.replaceRange(`${prefix}${built.text}`, { line: cursor.line, ch: currentLine.length });
    const startLine = cursor.line + (prefix ? 1 : 0);
    const headLines = built.text.slice(0, built.cursorOffset).split("\n");
    editor.setCursor({
      line: startLine + headLines.length - 1,
      ch: headLines[headLines.length - 1].length
    });
  }
  /**
   * Enter inside a toggle:
   *  - callout body line with content  -> new "> " body line
   *  - empty "> " body line            -> start the NEXT toggle
   *  - line after </details>           -> start the next <details> skeleton
   * Returns true when handled (default Enter suppressed).
   */
  handleEnter(view) {
    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty)
      return false;
    const line = state.doc.lineAt(sel.head);
    const text = line.text;
    const atLineEnd = sel.head === line.to;
    if (!atLineEnd) {
      if (this.settings.format === "callout" && /^>/.test(text)) {
        const prefix = MCQ_OPTION2.test(text) || MCQ_EMPTY_OPTION.test(text) ? "\n> - [ ] " : "\n> ";
        view.dispatch({
          changes: { from: sel.head, to: sel.head, insert: prefix },
          selection: { anchor: sel.head + prefix.length },
          scrollIntoView: true,
          userEvent: "input"
        });
        return true;
      }
      return false;
    }
    const linesAbove = [];
    for (let n = 1; n <= line.number; n++)
      linesAbove.push(state.doc.line(n).text);
    const hasNumbered = linesAbove.some((l) => NUMBERED_HEADER.test(l));
    const numbered = this.settings.numberedByDefault || hasNumbered;
    const plan = planEnter(text, {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format,
      numbered,
      nextNumber: numbered ? nextToggleNumber(linesAbove) : void 0,
      addAnswerLine: this.settings.addAnswerLine
    });
    if (!plan)
      return false;
    view.dispatch({
      changes: { from: plan.from === "lineStart" ? line.from : sel.head, to: line.to, insert: plan.insert },
      selection: { anchor: (plan.from === "lineStart" ? line.from : sel.head) + plan.cursorOffset },
      scrollIntoView: true,
      userEvent: "input"
    });
    return true;
  }
  /**
   * Backspace inside a toggle:
   *  - empty "> " answer line   -> drop the prefix, back to plain text
   *  - caret right before the question text -> unwrap the toggle marker
   *  - <details> equivalents
   * Returns true when handled.
   */
  handleBackspace(view) {
    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty)
      return false;
    const line = state.doc.lineAt(sel.head);
    const plan = planBackspace(line.text, sel.head - line.from, {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format
    });
    if (!plan)
      return false;
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: plan.insert },
      selection: { anchor: line.from + plan.cursorOffset },
      scrollIntoView: true,
      userEvent: "delete.backward"
    });
    return true;
  }
  maybeBold(text) {
    if (!this.settings.boldSummary)
      return text;
    if (text.startsWith("**") && text.endsWith("**"))
      return text;
    return `**${text}**`;
  }
  /* ---------- v1.0.7: smart commands + SM-2 review ---------- */
  /** Wrap the selection (or current line) in a toggle. */
  wrapSelectionAsToggle(editor) {
    const selection = editor.getSelection();
    const type = this.activeCallout();
    const fold = this.settings.defaultCollapsed ? "-" : "+";
    if (selection.trim().length === 0) {
      const line = editor.getLine(editor.getCursor().line);
      if (line.trim().length === 0) {
        new import_obsidian4.Notice("Nothing to wrap \u2014 select the question and answer first.");
        return;
      }
      const title2 = this.maybeBold(line.trim());
      editor.replaceRange(
        `> [!${type}]${fold} ${title2}
> 
`,
        { line: editor.getCursor().line, ch: 0 },
        { line: editor.getCursor().line, ch: line.length }
      );
      return;
    }
    const lines = selection.split("\n");
    let titleLine = "";
    let bodyStart = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().length > 0) {
        titleLine = lines[i].trim();
        bodyStart = i + 1;
        break;
      }
    }
    if (titleLine.length === 0) {
      new import_obsidian4.Notice("Selection is empty.");
      return;
    }
    const title = this.maybeBold(titleLine);
    const bodyLines = lines.slice(bodyStart);
    while (bodyLines.length > 0 && bodyLines[0].trim().length === 0)
      bodyLines.shift();
    const body = bodyLines.length > 0 ? "\n" + bodyLines.map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n") : "";
    editor.replaceSelection(`> [!${type}]${fold} ${title}${body}
`);
  }
  /** Cycle the toggle at the cursor through red → yellow → green. */
  cycleColorAtCursor(editor) {
    const found = this.findHeaderLine(editor);
    if (!found) {
      new import_obsidian4.Notice("Cursor is not inside a toggle.");
      return;
    }
    const next = nextTrafficColor(calloutTypeOfLine(found.text));
    this.recolorToggleAtCursor(editor, next);
  }
  /** One button, five outcomes — decided by the cursor context. */
  runSmartToggle(editor) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const action = smartAction({
      selection: editor.getSelection(),
      line,
      insideToggle: !!this.findHeaderLine(editor)
    });
    switch (action) {
      case "wrap-selection":
        this.wrapSelectionAsToggle(editor);
        break;
      case "mcq-option":
        editor.replaceRange("\n> - [ ] ", { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: 8 });
        break;
      case "match-row": {
        const row = blankTableRow(line);
        editor.replaceRange(`
${row}`, { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: 4 });
        break;
      }
      case "answer-key":
        editor.replaceRange("\n> **Answer key:** ", { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: 18 });
        break;
      default:
        this.insertNewToggleBelow(editor);
    }
    if (action !== "new-toggle")
      new import_obsidian4.Notice(smartActionLabel(action));
  }
  /** Start, pause or resume the recall session with a single command. */
  runSmartRecall(editor) {
    if (!this.timerWidget || !this.sessionNotePath) {
      this.startRecallSession(editor);
      return;
    }
    if (this.timerState.running) {
      this.timerState = { ...this.timerState, running: false, autoPaused: false };
      new import_obsidian4.Notice("\u231B Paused");
    } else {
      this.timerState = { ...this.timerState, running: true, autoPaused: false };
      this.lastTick = Date.now();
      this.lastActivityAt = Date.now();
      new import_obsidian4.Notice("\u231B Running");
    }
    this.renderTimer();
  }
  /** Collapse all answers, show the timer and start a focus phase on this note. */
  startRecallSession(editor) {
    const doc = editor.getValue();
    const collapsed = collapseAllToggles(doc);
    if (collapsed !== doc) {
      const cursor = editor.getCursor();
      editor.setValue(collapsed);
      editor.setCursor(cursor);
    }
    const stats = scanRecallStats(collapsed);
    this.showTimer();
    this.sessionNotePath = this.activeNotePath();
    this.timerState = {
      ...resetPhase(createState(this.settings), this.settings),
      running: true
    };
    this.lastTick = Date.now();
    this.lastActivityAt = Date.now();
    this.renderTimer();
    new import_obsidian4.Notice(
      `Recall session started \u2014 ${stats.total} toggles (\u{1F534} ${stats.red} \xB7 \u{1F7E1} ${stats.yellow} \xB7 \u{1F7E2} ${stats.green})`
    );
  }
  /** The SM-2 card for a note path. */
  cardFor(path) {
    var _a;
    if (!path)
      return void 0;
    return (_a = this.settings.srs) == null ? void 0 : _a[path];
  }
  /** Show the grading row (Again / Hard / Good / Easy) for the current note. */
  openReview(editor) {
    var _a;
    this.showTimer();
    const doc = (_a = editor == null ? void 0 : editor.getValue()) != null ? _a : "";
    const stats = doc ? scanRecallStats(doc) : { total: 0, red: 0, yellow: 0, green: 0, firstRedLine: -1 };
    this.reviewSuggestion = suggestGrade(stats);
    this.reviewOpen = true;
    this.renderTimer();
  }
  /** Apply a grade to the active note and store the next due date. */
  async applyGrade(grade) {
    var _a, _b, _c;
    const path = (_a = this.sessionNotePath) != null ? _a : this.activeNotePath();
    if (!path) {
      new import_obsidian4.Notice("Open a note first to schedule its recall.");
      return;
    }
    const card = gradeCard((_b = this.cardFor(path)) != null ? _b : newCard(), grade, Date.now());
    this.settings.srs = { ...(_c = this.settings.srs) != null ? _c : {}, [path]: card };
    await this.saveSettings();
    this.reviewOpen = false;
    this.renderTimer();
    this.updateStatus();
    new import_obsidian4.Notice(`${GRADE_LABEL[grade]} \u2192 ${nextDueLabel(card, Date.now())} \xB7 ease ${card.ease}`);
  }
  /** List the notes whose recall is due, newest schedule first. */
  showDueNotes() {
    var _a;
    const due = dueNotes((_a = this.settings.srs) != null ? _a : {}, Date.now());
    if (!due.length) {
      new import_obsidian4.Notice("Nothing due \u2014 everything is scheduled ahead.");
      return;
    }
    const rows = due.map((path) => ({ path, card: this.settings.srs[path] }));
    new DueNotesModal(this.app, rows, (path) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file)
        void this.app.workspace.openLinkText(path, "", false);
    }).open();
  }
  /* ---------- v1.0.5: timer plumbing ---------- */
  toggleTimer() {
    if (this.timerWidget) {
      this.hideTimer();
      return;
    }
    this.showTimer();
  }
  showTimer() {
    if (this.timerWidget)
      return;
    this.timerWidget = new TimerWidget(
      {
        onToggleRun: () => {
          const running = !this.timerState.running;
          this.timerState = { ...this.timerState, running, autoPaused: false };
          if (running && !this.sessionNotePath)
            this.sessionNotePath = this.activeNotePath();
          this.lastTick = Date.now();
          this.lastActivityAt = Date.now();
          this.renderTimer();
        },
        onReset: () => {
          this.timerState = resetPhase(this.timerState, this.settings);
          this.renderTimer();
        },
        onSkip: () => {
          this.timerState = nextPhase(this.timerState, this.settings);
          this.lastTick = Date.now();
          this.renderTimer();
          this.updateStatus();
        },
        onHide: () => this.hideTimer(),
        onJumpRed: () => this.jumpToFirstRed(),
        onRecallAgain: () => this.collapseActiveNote(true),
        onGrade: (grade) => void this.applyGrade(grade),
        onMove: (x, y) => {
          this.settings.timerX = x;
          this.settings.timerY = y;
          void this.saveSettings();
        },
        onCompactChange: (compact) => {
          this.settings.compactByDefault = compact;
          void this.saveSettings();
        }
      },
      { x: this.settings.timerX, y: this.settings.timerY, compact: this.settings.compactByDefault }
    );
    this.renderTimer();
  }
  hideTimer() {
    var _a;
    (_a = this.timerWidget) == null ? void 0 : _a.destroy();
    this.timerWidget = null;
  }
  /** Stop the session completely: paused fresh focus phase + summary. */
  stopTimerSession() {
    const summary = stopSummary(this.timerState);
    this.timerState = stopSession(this.timerState, this.settings);
    this.sessionNotePath = null;
    this.renderTimer();
    this.updateStatus();
    new import_obsidian4.Notice(summary);
  }
  activeNotePath() {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.file) == null ? void 0 : _b.path) != null ? _c : null;
  }
  /** Auto-pause / auto-resume based on visibility and the session note. */
  evaluateAttention() {
    const reason2 = shouldAutoPause({
      state: this.timerState,
      enabled: this.settings.autoPauseOnLeave,
      visible: document.visibilityState !== "hidden" && document.hasFocus(),
      onSessionNote: !this.sessionNotePath || this.activeNotePath() === this.sessionNotePath,
      pinned: this.settings.pinToSessionNote
    });
    if (reason2) {
      this.timerState = pauseForInactivity(this.timerState);
      this.renderTimer();
      if (this.settings.notifyOnPhaseEnd)
        new import_obsidian4.Notice(autoPauseNotice(reason2));
      return;
    }
    if (this.settings.autoResumeOnReturn && this.timerState.autoPaused && document.visibilityState !== "hidden") {
      const onNote = !this.sessionNotePath || !this.settings.pinToSessionNote || this.activeNotePath() === this.sessionNotePath;
      if (onNote) {
        this.timerState = resumeAfterAutoPause(this.timerState);
        this.lastTick = Date.now();
        this.lastActivityAt = Date.now();
        this.renderTimer();
      }
    }
  }
  /** Collapse every toggle in the active note (used on breaks / "recall again"). */
  collapseActiveNote(notify = false) {
    var _a;
    const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
    if (!editor)
      return;
    const doc = editor.getValue();
    const collapsed = collapseAllToggles(doc);
    if (collapsed !== doc) {
      const cursor = editor.getCursor();
      editor.setValue(collapsed);
      editor.setCursor(cursor);
    }
    if (notify) {
      const stats = scanRecallStats(collapsed);
      new import_obsidian4.Notice(`All ${stats.total} toggles collapsed \u2014 recall again \u{1F534} ${stats.red}`);
    }
  }
  onTimerTick() {
    var _a, _b, _c;
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    if (!this.timerState.running)
      return;
    if (this.timerState.phase === "focus" && isIdle(this.lastActivityAt, now, this.settings.idlePauseMinutes)) {
      this.timerState = pauseForInactivity(this.timerState);
      this.renderTimer();
      if (this.settings.notifyOnPhaseEnd)
        new import_obsidian4.Notice(autoPauseNotice("idle"));
      return;
    }
    const result = tick(this.timerState, elapsed, this.settings);
    this.timerState = result.state;
    this.renderTimer();
    if (result.phaseEnded) {
      this.updateStatus();
      (_a = this.timerWidget) == null ? void 0 : _a.flashPhaseEnd();
      if (this.settings.notifyOnPhaseEnd) {
        const ended = result.endedPhase === "focus" ? "Focus" : "Break";
        new import_obsidian4.Notice(`${ended} done \u2192 ${phaseLabel(this.timerState.phase)} \xB7 ${(_b = this.recallHint()) != null ? _b : ""}`.trim());
      }
      if (this.settings.soundOnPhaseEnd)
        this.buzz();
      if (result.endedPhase === "focus" && this.settings.autoCollapseOnBreak) {
        this.collapseActiveNote();
      }
      if (result.endedPhase === "focus" && this.settings.autoReview) {
        const doc = (_c = this.activeDoc()) != null ? _c : "";
        this.reviewSuggestion = suggestGrade(scanRecallStats(doc));
        this.reviewOpen = true;
        this.renderTimer();
      }
    }
  }
  buzz() {
    var _a;
    try {
      (_a = navigator.vibrate) == null ? void 0 : _a.call(navigator, [80, 60, 80]);
    } catch (e) {
    }
  }
  /** Colour stats of the active note, used for the break hint. */
  recallHint() {
    const doc = this.activeDoc();
    if (!doc)
      return void 0;
    const stats = scanRecallStats(doc);
    if (stats.total === 0)
      return void 0;
    return `\u{1F534} ${stats.red} \xB7 \u{1F7E1} ${stats.yellow} \xB7 \u{1F7E2} ${stats.green} of ${stats.total}`;
  }
  activeDoc() {
    var _a;
    const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
    return editor ? editor.getValue() : null;
  }
  jumpToFirstRed() {
    var _a;
    const editor = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.editor;
    if (!editor) {
      new import_obsidian4.Notice("Open a note first.");
      return;
    }
    const stats = scanRecallStats(editor.getValue());
    if (stats.firstRedLine < 0) {
      new import_obsidian4.Notice("No \u{1F534} red toggles in this note \u2014 nice work.");
      return;
    }
    editor.setCursor({ line: stats.firstRedLine, ch: 0 });
    editor.scrollIntoView(
      { from: { line: stats.firstRedLine, ch: 0 }, to: { line: stats.firstRedLine, ch: 0 } },
      true
    );
  }
  renderTimer() {
    if (!this.timerWidget)
      return;
    const breakPhase = this.timerState.phase !== "focus";
    const recall = this.recallHint();
    const hint = this.timerState.autoPaused ? "Paused \u2014 tap \u25B6 to resume" : breakPhase ? recall : void 0;
    this.timerWidget.render({
      state: this.timerState,
      cycleSize: Math.max(1, Math.min(8, this.settings.sessionsBeforeLongBreak)),
      hint,
      canJumpRed: breakPhase && !!recall,
      canRecallAgain: breakPhase && !!recall,
      reviewOpen: this.reviewOpen,
      suggestedGrade: this.reviewSuggestion,
      scheduleLabel: this.scheduleLabel()
    });
  }
  updateStatus() {
    var _a, _b;
    const due = dueSummary((_a = this.settings.srs) != null ? _a : {}, Date.now());
    (_b = this.statusEl) == null ? void 0 : _b.setText(`${sessionSummary(this.timerState)}${due ? ` \xB7 ${due}` : ""}`);
  }
  /** "Next recall: …" line for the current note, if it has been graded before. */
  scheduleLabel() {
    var _a;
    const card = this.cardFor((_a = this.sessionNotePath) != null ? _a : this.activeNotePath());
    return card ? `Next recall: ${nextDueLabel(card, Date.now())}` : void 0;
  }
  /** Re-apply durations after a settings change without losing progress. */
  refreshTimerDurations() {
    if (!this.timerState.running) {
      this.timerState = {
        ...this.timerState,
        remaining: phaseDuration(this.timerState.phase, this.settings)
      };
    }
    this.renderTimer();
  }
  onunload() {
    var _a, _b;
    this.hideTimer();
    this.stopAutoScroll(false);
    this.stopQuiz(false);
    (_a = this.scrollFabBtn) == null ? void 0 : _a.destroy();
    this.scrollFabBtn = null;
    (_b = this.holdPause) == null ? void 0 : _b.detach();
    this.holdPause = null;
  }
  /**
   * v1.1.5 — show / hide the floating launch button.
   * Visible only when the setting is on, a note is open and the running
   * control bar is not on screen (tap = start/pause, long-press = sheet).
   */
  syncScrollFab() {
    var _a;
    const mdView = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    const overlayOpen = !this.scrollSheetOpen && !!document.body.querySelector(".modal-container, .modal-bg");
    const want = fabShouldShow(
      !!this.settings.scrollFab,
      !!this.app.workspace.getActiveFile(),
      !!this.scrollBar,
      !!mdView,
      overlayOpen
    );
    if (!want) {
      (_a = this.scrollFabBtn) == null ? void 0 : _a.destroy();
      this.scrollFabBtn = null;
      return;
    }
    if (!this.scrollFabBtn) {
      this.scrollFabBtn = new ScrollFab({
        onTap: () => this.toggleAutoScroll(),
        onLongPress: () => {
          this.scrollSheetOpen = true;
          this.syncScrollFab();
          new ScrollSheetModal(this.app, this).open();
        }
      });
    }
    this.scrollFabBtn.setReverse(!!this.settings.scrollReverse);
    this.scrollFabBtn.setRunning(this.scrollRunning);
    this.scrollFabBtn.setPinned(!this.scrollRunning || this.scrollSheetOpen);
  }
  /**
   * v1.1.6 — guard for actions that only make sense mid-session.
   * Shows the exact command to run instead of failing silently.
   */
  requireScrollRunning() {
    if (this.scrollPlan.length > 0)
      return true;
    new import_obsidian4.Notice(MSG_NOT_RUNNING, 6e3);
    return false;
  }
  /** v1.1.6 — settings ON/OFF switch: start or stop the session. */
  async setAutoScrollEnabled(on) {
    if (on) {
      if (this.scrollPlan.length === 0)
        this.startAutoScroll();
      else if (!this.scrollRunning)
        this.toggleAutoScroll();
    } else if (this.scrollPlan.length > 0) {
      this.stopAutoScroll(true);
    }
    this.syncScrollFab();
  }
  /** Is a session currently live (running or paused)? */
  autoScrollActive() {
    return this.scrollRunning;
  }
  /* ==================== v1.0.9: auto-scroll + auto-toggle ==================== */
  /**
   * The scroll container of the active markdown view (reading or live preview).
   * v1.1.7 — go through the MarkdownView API first; the old document-wide
   * querySelector could land on a hidden background-tab preview (or an
   * unrendered view on mobile) and report "no toggles" while the note on
   * screen clearly has them.
   */
  /**
   * v1.2.1 — status notice that respects "quiet mode". Errors keep using
   * `new Notice(...)` directly so they are never swallowed.
   */
  say(message, ms = 3e3) {
    if (this.settings.scrollQuiet)
      return;
    new import_obsidian4.Notice(message, ms);
  }
  findScrollContainer() {
    var _a, _b, _c, _d;
    const scrollable = (el) => {
      const h = el;
      return !!h && h.scrollHeight - h.clientHeight > 2;
    };
    const visible = (el) => !!el && el.offsetParent !== null;
    const candidates = [];
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    if (view) {
      const root = (_b = (_a = view.previewMode) == null ? void 0 : _a.containerEl) != null ? _b : view.contentEl;
      candidates.push(
        root == null ? void 0 : root.querySelector(".markdown-preview-view"),
        view.contentEl.querySelector(".markdown-preview-view"),
        root,
        view.contentEl.querySelector(".cm-scroller"),
        view.contentEl
      );
    }
    const leaf = (_c = document.querySelector(".workspace-leaf.mod-active")) != null ? _c : document;
    candidates.push(
      leaf.querySelector(".markdown-preview-view"),
      leaf.querySelector(".cm-scroller"),
      ...Array.from(document.querySelectorAll(".markdown-preview-view")),
      ...Array.from(document.querySelectorAll(".cm-scroller"))
    );
    for (const el of candidates)
      if (scrollable(el) && visible(el))
        return el;
    for (const el of candidates)
      if (scrollable(el))
        return el;
    for (const el of candidates)
      if (visible(el != null ? el : null))
        return el;
    return (_d = candidates.find(Boolean)) != null ? _d : null;
  }
  /**
   * v1.1.7 — does the active note's *source* contain toggles? Used when the
   * DOM scan finds nothing: if the source has toggles the view is probably
   * still rendering (or showing a stale container), so we retry once.
   */
  sourceHasToggles() {
    var _a, _b, _c;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian4.MarkdownView);
    const text = (_c = (_b = (_a = view == null ? void 0 : view.editor) == null ? void 0 : _a.getValue) == null ? void 0 : _b.call(_a)) != null ? _c : "";
    return /^>\s*\[![^\]]+\][+-]?/m.test(text) || /<details[\s>]/i.test(text);
  }
  /** Every rendered toggle in the active note, with its offset and colour. */
  collectStops(container, filter = []) {
    return this.perf.remeasure.measure(() => nowMs(), () => this.collectStopsNow(container, filter));
  }
  collectStopsNow(container, filter = []) {
    const nodes = filter.length === 0 ? collectToggleEls(container) : collectToggleElsFiltered(
      container,
      (el) => matchesFilter(colorOf(toggleTypeOf(el)), filter)
    );
    const base = container.getBoundingClientRect().top - container.scrollTop;
    return nodes.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        top: Math.max(0, Math.round(rect.top - base)),
        height: Math.round(rect.height),
        color: colorOf(toggleTypeOf(el)),
        el
      };
    });
  }
  /** v1.2.0 — is this toggle currently expanded? */
  isToggleOpen(el) {
    return isToggleOpen(el);
  }
  setToggleOpen(el, open) {
    setToggleOpen(el, open);
  }
  /**
   * v1.4.3 — open (or close) every answer toggle in the active note in one go.
   * Works during a quiz too: the quiz's own classes are updated so the run
   * does not fight the reader.
   */
  setAllAnswersOpen(open) {
    const container = this.findScrollContainer();
    if (!container) {
      new import_obsidian4.Notice("Open a note first.");
      return;
    }
    const stops = this.collectStops(container);
    let n = 0;
    for (const s of stops) {
      if (!s.el)
        continue;
      if (this.quizState)
        setQuizVisible(s.el, open);
      else
        this.setToggleOpen(s.el, open);
      n++;
    }
    if (!this.settings.scrollQuiet) {
      new import_obsidian4.Notice(`${open ? "Opened" : "Closed"} ${n} answer toggle${n === 1 ? "" : "s"}.`);
    }
  }
  /** Re-apply the quiz answer rule after the "keep answers open" switch flips. */
  refreshQuizAnswerVisibility() {
    if (!this.quizState)
      return;
    this.applyQuizVisibility(this.quizState.at, this.quizState.phase === "reveal");
  }
  /**
   * v1.1.8 — freeze the loop while a finger is held anywhere on the note.
   * `scrollRunning` stays true, so this never touches the user's own pause.
   */
  holdPauseStart() {
    var _a;
    if (!this.scrollRunning || this.scrollHoldPaused)
      return;
    this.scrollHoldPaused = true;
    this.scrollHoldAt = performance.now();
    if (this.scrollRaf !== null) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    (_a = this.scrollFabBtn) == null ? void 0 : _a.setPinned(true);
  }
  /** Resume at exactly the same speed / direction / dwell state. */
  holdPauseEnd() {
    var _a;
    if (!this.scrollHoldPaused)
      return;
    this.scrollHoldPaused = false;
    const held = Math.max(0, performance.now() - this.scrollHoldAt);
    if (this.scrollDwellUntil)
      this.scrollDwellUntil += held;
    if (this.scrollHoldUntil)
      this.scrollHoldUntil += held;
    if (this.scrollOpenedAt)
      this.scrollOpenedAt += held;
    this.scrollHoldAt = 0;
    this.scrollLastFrame = 0;
    if (this.scrollContainer)
      this.scrollPos = this.scrollContainer.scrollTop;
    (_a = this.scrollFabBtn) == null ? void 0 : _a.setPinned(!this.scrollRunning);
    if (this.scrollRunning)
      this.scheduleScrollFrame();
  }
  /** Attach / detach the document-level hold listener with the session. */
  syncHoldPause() {
    const want = this.scrollPlan.length > 0;
    if (want && !this.holdPause) {
      this.holdPause = new HoldPause({
        isActive: () => this.scrollRunning,
        onHold: () => this.holdPauseStart(),
        onRelease: () => this.holdPauseEnd()
      });
      this.holdPause.attach();
    } else if (!want && this.holdPause) {
      this.holdPause.detach();
      this.holdPause = null;
      this.scrollHoldPaused = false;
    }
  }
  toggleAutoScroll() {
    if (this.scrollRunning) {
      this.scrollRunning = false;
      this.renderScrollBar();
      this.syncScrollFab();
      new import_obsidian4.Notice(`Autoscroll paused \u2014 ${hotkeyLabel("smart-autoscroll")} se resume.`);
      return;
    }
    if (this.scrollPlan.length === 0)
      this.startAutoScroll();
    else {
      this.scrollRunning = true;
      this.scrollLastFrame = 0;
      this.scheduleScrollFrame();
      this.renderScrollBar();
      this.syncScrollFab();
    }
  }
  /** v1.1.1 — the current pause-at configuration. */
  modeConfig() {
    var _a, _b, _c, _d;
    return {
      mode: this.settings.scrollMode,
      picks: (_a = this.settings.scrollPicks) != null ? _a : [],
      route: (_b = this.settings.scrollRoute) != null ? _b : [],
      loopRoute: !!this.settings.scrollLoopRoute,
      shuffleFrom: (_c = this.settings.scrollShuffleFrom) != null ? _c : 0,
      shuffleTo: (_d = this.settings.scrollShuffleTo) != null ? _d : 0
    };
  }
  /** FSRS cards for the active note. */
  scrollCards(path = ((_c) => (_c = ((_b) => (_b = this.scrollNotePath) != null ? _b : ((_a) => (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path)())()) != null ? _c : "")()) {
    if (!path)
      return [];
    return loadDeck(this.settings.scrollMemory, path);
  }
  async saveScrollCards(path, cards) {
    this.settings.scrollMemory = saveDeck(this.settings.scrollMemory, path, cards);
    await this.saveSettings();
  }
  /**
   * v1.1.1 — build the plan: colour filter first, then the pause-at mode
   * (every / odd / even / custom / route / shuffle) and tall-toggle chunking.
   */
  buildScrollPlan(container) {
    const all = this.collectStops(container, this.settings.scrollFilter);
    const kept = all.filter((s) => matchesFilter(s.color, this.settings.scrollFilter));
    this.scrollTotalItems = kept.length;
    const cfg = this.modeConfig();
    const items = kept.map((s, i) => ({ ordinal: i + 1, top: s.top, height: s.height }));
    const stops = buildModeStops(items, cfg, container.clientHeight, this.settings.scrollChunkTall);
    const ordered = orderModeStops(stops, cfg, this.settings.scrollReverse);
    return ordered.map((ms) => {
      const src = kept[ms.ordinal - 1];
      return {
        index: src.index,
        top: ms.top,
        color: src.color,
        el: src.el,
        ordinal: ms.ordinal,
        part: ms.part
      };
    });
  }
  /** Rebuild the shuffle route from this note's FSRS memory. */
  async rebuildShuffleRoute(notify = true) {
    var _a, _b, _c;
    const container = this.findScrollContainer();
    const path = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : "";
    if (!container || !path) {
      new import_obsidian4.Notice("Open a note first \u2014 shuffle needs a note view.");
      return;
    }
    this.measureScrollBoxes(container);
    const total = this.scrollTotalItems;
    if (total === 0) {
      new import_obsidian4.Notice("No toggles found in this note.");
      return;
    }
    const order = buildShuffleOrder(this.scrollCards(path), total, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      seed: Date.now() & 65535,
      retention: this.settings.scrollRetention,
      newMix: this.settings.scrollNewMix
    });
    const typed = (_c = this.settings.scrollRoute) != null ? _c : [];
    if (this.settings.scrollMode === "route" && typed.length) {
      this.settings.scrollUserRoute = [...typed];
    }
    this.settings.scrollMode = "shuffle";
    this.settings.scrollRoute = order;
    await this.saveSettings();
    if (notify) {
      new import_obsidian4.Notice(
        `\u{1F500} Shuffle ready \u2014 ${order.length} toggles.
${deckSummary(
          deckStats2(this.scrollCards(path), total, { retention: this.settings.scrollRetention })
        )}`
      );
    }
  }
  /** Deck summary for the current note, or null when nothing is measured yet. */
  scrollDeckStats() {
    var _a, _b, _c;
    const path = (_c = (_b = this.scrollNotePath) != null ? _b : (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _c : "";
    if (!path)
      return null;
    const total = this.scrollTotalItems || this.scrollBoxes.length;
    if (!total)
      return null;
    return deckStats2(this.scrollCards(path), total, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      retention: this.settings.scrollRetention
    });
  }
  /** How many toggles fall due on each of the next 7 days. */
  scrollForecast() {
    var _a, _b, _c;
    const path = (_c = (_b = this.scrollNotePath) != null ? _b : (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _c : "";
    const total = this.scrollTotalItems || this.scrollBoxes.length;
    if (!path || !total)
      return [];
    return forecastDue(this.scrollCards(path), total, 7, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      retention: this.settings.scrollRetention
    });
  }
  async resetScrollMemory() {
    var _a, _b;
    const path = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : "";
    if (!path)
      return;
    this.settings.scrollMemory = resetDeck(this.settings.scrollMemory, path);
    await this.saveSettings();
    new import_obsidian4.Notice("Revision memory reset \u2014 every toggle is new again.");
  }
  /** Auto-grade the toggle we are leaving (shuffle mode only). */
  async gradeLeavingStop(ordinal, openedMs) {
    if (!this.settings.scrollAutoGrade || this.settings.scrollMode !== "shuffle")
      return;
    const path = this.scrollNotePath;
    if (!path || !ordinal)
      return;
    const planned = Math.max(1, clampHold(this.settings.scrollHold)) * 1e3;
    const grade = gradeFromDwell(openedMs / planned, this.scrollSeen.has(ordinal));
    this.scrollSeen.add(ordinal);
    const cards = recordReview(this.settings.scrollMemory, path, ordinal, grade);
    const names = ["", "Again", "Hard", "Good", "Easy"];
    this.scrollLastGrade = `toggle ${ordinal} \xB7 ${(openedMs / 1e3).toFixed(1)}s \u2192 ${names[grade]} (${grade})`;
    await this.saveScrollCards(path, cards);
  }
  startAutoScroll() {
    var _a, _b;
    const container = this.findScrollContainer();
    if (!container) {
      new import_obsidian4.Notice("Open a note first \u2014 autoscroll needs a note view.");
      return;
    }
    this.scrollContainer = container;
    this.scrollNotePath = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : null;
    this.scrollSeen = /* @__PURE__ */ new Set();
    this.applyPerNoteScrollPrefs();
    const plan = this.buildScrollPlan(container);
    if (plan.length === 0) {
      const anyToggle = this.collectStops(container).length > 0;
      if (!anyToggle && !this.scrollRetryPending && this.sourceHasToggles()) {
        this.scrollRetryPending = true;
        window.setTimeout(() => {
          this.scrollRetryPending = false;
          if (!this.scrollRunning && this.scrollPlan.length === 0)
            this.startAutoScroll();
        }, 700);
        return;
      }
      if (anyToggle || this.sourceHasToggles()) {
        new import_obsidian4.Notice(
          `No toggles match this selection (${filterLabel(this.settings.scrollFilter)} \xB7 ${modeLabel(
            this.modeConfig()
          )}) \u2014 filter ya pause-at mode badlo.`,
          6e3
        );
        this.syncScrollFab();
        return;
      }
      this.say(MSG_PLAIN_SCROLL, 4e3);
    }
    this.scrollPlan = plan;
    const routed = this.settings.scrollMode === "route" || this.settings.scrollMode === "shuffle";
    this.scrollAt = routed ? 0 : firstStopFrom(plan, container.scrollTop, this.settings.scrollReverse);
    this.scrollHoldUntil = 0;
    this.scrollOpenedAt = 0;
    this.scrollRunning = true;
    this.scrollLastFrame = 0;
    this.scrollPos = seedStartOffset(
      container.scrollTop,
      container.scrollHeight - container.clientHeight,
      this.settings.scrollReverse
    );
    if (Math.floor(this.scrollPos) !== container.scrollTop) {
      container.scrollTop = Math.floor(this.scrollPos);
    }
    this.scrollMovedPx = 0;
    this.scrollDir = this.settings.scrollReverse ? -1 : 1;
    this.scrollDwellDir = this.scrollDir;
    this.scrollDwellUntil = 0;
    this.scrollDwellKey = null;
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.scrollBoxes = [];
    this.scrollBoxesAt = 0;
    this.scrollTargetsKey = "";
    this.scrollVisit = null;
    this.scrollOpenEl = null;
    this.scrollPrevBehavior = container.style.scrollBehavior;
    container.style.scrollBehavior = "auto";
    if (!this.scrollBar && this.settings.scrollBarClassic) {
      this.scrollBar = new ScrollBar({
        onToggleRun: () => this.toggleAutoScroll(),
        onSlower: () => this.nudgeScrollSpeed(-SPEED_STEP),
        onFaster: () => this.nudgeScrollSpeed(SPEED_STEP),
        onReverse: () => this.setScrollReverse(!this.settings.scrollReverse),
        onFilter: () => new ScrollFilterModal(this.app, this).open(),
        onMode: () => new ScrollModeModal(this.app, this).open(),
        onDwell: () => new ScrollDwellModal(this.app, this).open(),
        onSpeedPresets: () => new ScrollSpeedModal(this.app, this).open(),
        onTop: () => this.scrollToStart(),
        onClose: () => this.stopAutoScroll(true)
      });
    }
    this.scrollLastEvent = "";
    this.scrollLastGrade = "";
    this.syncScrollDebugOverlay();
    this.say(sessionLabel(this.settings, plan.length));
    this.renderScrollBar();
    this.syncScrollFab();
    this.syncHoldPause();
    this.scheduleScrollFrame();
  }
  /** Reader parity: speed / direction / hold are remembered per note. */
  applyPerNoteScrollPrefs() {
    var _a;
    const path = this.scrollNotePath;
    if (!path)
      return;
    const saved = (_a = this.settings.scrollPerNote) == null ? void 0 : _a[path];
    if (!saved)
      return;
    this.settings.scrollSpeed = clampSpeed(saved.speed);
    this.settings.scrollReverse = !!saved.reverse;
    this.settings.scrollHold = clampHold(saved.hold);
  }
  async rememberPerNoteScrollPrefs() {
    var _a, _b, _c, _d;
    const path = (_c = (_b = this.scrollNotePath) != null ? _b : (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _c : null;
    if (!path)
      return;
    this.settings.scrollPerNote = {
      ...(_d = this.settings.scrollPerNote) != null ? _d : {},
      [path]: {
        speed: clampSpeed(this.settings.scrollSpeed),
        reverse: this.settings.scrollReverse,
        hold: clampHold(this.settings.scrollHold)
      }
    };
    await this.saveSettings();
  }
  /** "Go to first page" — jump to the start (or end in reverse) and continue. */
  scrollToStart() {
    var _a;
    const container = (_a = this.scrollContainer) != null ? _a : this.findScrollContainer();
    if (!container)
      return;
    container.scrollTop = this.settings.scrollReverse ? container.scrollHeight : 0;
    this.scrollPos = container.scrollTop;
    this.scrollDwellKey = null;
    this.scrollDwellUntil = 0;
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.scrollAt = 0;
    this.scrollHoldUntil = 0;
    this.renderScrollBar();
  }
  stopAutoScroll(notify) {
    var _a, _b;
    this.scrollRunning = false;
    this.closeScrollVisit();
    if (this.scrollOpenEl && this.settings.scrollAutoClose) {
      this.setToggleOpen(this.scrollOpenEl, false);
    }
    this.scrollOpenEl = null;
    this.restoreScrollSmoothing();
    this.scrollDwellUntil = 0;
    this.scrollDwellKey = null;
    this.scrollBoxes = [];
    this.scrollTargets = [];
    this.scrollTargetsKey = "";
    if (this.scrollRaf !== null) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    this.scrollPlan = [];
    this.scrollAt = -1;
    (_a = this.scrollBar) == null ? void 0 : _a.destroy();
    this.scrollBar = null;
    (_b = this.scrollDebugOverlay) == null ? void 0 : _b.destroy();
    this.scrollDebugOverlay = null;
    this.scrollHoldPaused = false;
    this.syncScrollFab();
    this.syncHoldPause();
    if (notify)
      this.say("Autoscroll stopped.");
  }
  async setScrollReverse(reverse) {
    this.settings.scrollReverse = reverse;
    await this.saveSettings();
    if (this.scrollPlan.length && this.scrollContainer) {
      this.refreshScrollPlan();
      const container = this.scrollContainer;
      const max = container.scrollHeight - container.clientHeight;
      this.scrollPos = seedStartOffset(container.scrollTop, max, reverse);
      if (Math.floor(this.scrollPos) !== container.scrollTop) {
        container.scrollTop = Math.floor(this.scrollPos);
      }
      this.scrollDir = reverse ? -1 : 1;
      this.scrollDwellDir = this.scrollDir;
      this.scrollDwellKey = null;
      this.scrollDwellUntil = 0;
      this.scrollMovedPx = 0;
      this.scrollAt = firstStopFrom(this.scrollPlan, this.scrollPos, reverse);
    }
    await this.rememberPerNoteScrollPrefs();
    this.renderScrollBar();
    this.syncScrollFab();
    this.say(reverse ? "Autoscroll: reverse \u2191" : "Autoscroll: forward \u2193");
  }
  async setScrollFilter(filter) {
    this.settings.scrollFilter = normalizeFilter(filter);
    await this.saveSettings();
    if (this.scrollContainer && this.scrollPlan.length) {
      this.refreshScrollPlan();
    }
    this.renderScrollBar();
    this.say(`Autoscroll filter: ${filterLabel(filter)}`);
  }
  async nudgeScrollSpeed(delta) {
    this.settings.scrollSpeed = clampSpeed(this.settings.scrollSpeed + delta);
    await this.saveSettings();
    await this.rememberPerNoteScrollPrefs();
    this.renderScrollBar();
  }
  /** Recompute the plan mid-session (filter / mode / direction changed). */
  refreshScrollPlan() {
    const container = this.scrollContainer;
    if (!container)
      return;
    this.scrollPlan = this.buildScrollPlan(container);
    this.scrollAt = 0;
    this.scrollBoxes = [];
    this.scrollBoxesAt = 0;
    this.scrollTargetsKey = "";
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.scrollDwellKey = null;
    this.scrollDwellUntil = 0;
    this.scrollDir = this.settings.scrollReverse ? -1 : 1;
    this.scrollDwellDir = this.scrollDir;
    this.scrollHoldUntil = 0;
    this.renderScrollBar();
  }
  /** "3/12" — route legs in route/shuffle mode, dwell stops otherwise. */
  scrollProgressLabel() {
    var _a;
    const route = (_a = this.settings.scrollRoute) != null ? _a : [];
    if ((this.settings.scrollMode === "route" || this.settings.scrollMode === "shuffle") && route.length) {
      return `${Math.min(this.scrollRouteIdx + 1, route.length)}/${route.length}`;
    }
    const total = this.scrollTargets.length || this.scrollPlan.length;
    return total ? `${Math.min(this.scrollAt + 1, total)}/${total}` : "0/0";
  }
  /** Mount or drop the debug overlay to match the setting. */
  syncScrollDebugOverlay() {
    var _a;
    if (this.settings.scrollDebug && this.scrollRunning) {
      if (!this.scrollDebugOverlay) {
        this.scrollDebugOverlay = new ScrollDebugOverlay();
        this.scrollDebugOverlay.mount(document.body);
      }
    } else {
      (_a = this.scrollDebugOverlay) == null ? void 0 : _a.destroy();
      this.scrollDebugOverlay = null;
    }
  }
  paintScrollDebug(frame, ts) {
    var _a;
    const overlay = this.scrollDebugOverlay;
    const container = this.scrollContainer;
    if (!overlay || !container)
      return;
    overlay.update({
      pos: this.scrollPos,
      scrollTop: container.scrollTop,
      max: Math.max(0, container.scrollHeight - container.clientHeight),
      speed: clampSpeed(this.settings.scrollSpeed),
      dir: this.scrollDir,
      mode: this.settings.scrollMode,
      routeMode: false,
      target: null,
      routeIdx: this.scrollRouteIdx,
      routeLen: ((_a = this.settings.scrollRoute) != null ? _a : []).length,
      routeStop: this.scrollRouteStop,
      routeStops: 1,
      stops: this.scrollTargets.length,
      at: this.scrollAt,
      dwellKey: this.scrollDwellKey,
      dwellLeft: this.scrollDwellUntil ? Math.max(0, this.scrollDwellUntil - ts) : 0,
      lastEvent: this.scrollLastEvent,
      lastGrade: this.scrollLastGrade,
      progress: `progress ${this.scrollProgressLabel()}`,
      ...this.filterTelemetry(container),
      ...frame
    });
  }
  /**
   * v1.2.5 — colour-filter read-out for the debug overlay: what was found,
   * what survived the filter, and which raw type the current target was
   * graded from. This is what makes a "Red only finds nothing" report
   * diagnosable from the phone screen.
   */
  filterTelemetry(container) {
    const filter = this.settings.scrollFilter;
    const all = this.collectStops(container, filter);
    const found = collectToggleEls(container);
    const target = this.scrollPlan[this.scrollAt];
    const rawType = (target == null ? void 0 : target.el) ? toggleTypeOf(target.el) : null;
    return {
      filter: filterLabel(filter),
      stopsFound: Math.max(found.length, all.length),
      stopsKept: all.filter((s) => matchesFilter(s.color, filter)).length,
      colors: colorCounts(
        this.collectStops(container).map((s) => s.color)
      ),
      targetColor: target ? target.color : null,
      targetType: rawType
    };
  }
  renderScrollBar() {
    var _a;
    (_a = this.scrollBar) == null ? void 0 : _a.render({
      running: this.scrollRunning,
      speed: this.settings.scrollSpeed,
      reverse: this.settings.scrollReverse,
      filterLabel: filterLabel(this.settings.scrollFilter),
      progress: this.scrollProgressLabel(),
      modeIcon: modeIcon(this.settings.scrollMode),
      modeLabel: modeLabel(this.modeConfig()),
      dwellLabel: formatDwell(clampHold(this.settings.scrollHold)),
      speedLabel: `${multiplierFromSpeed(this.settings.scrollSpeed)}x`
    });
  }
  /* ---------- v1.1.2: the reader's own loop mechanics ---------- */
  /** Current pause rules in the reader's DwellSettings shape. */
  dwellCfg() {
    return {
      ...toDwellSettings(
        this.modeConfig(),
        clampHold(this.settings.scrollHold),
        this.settings.scrollChunkTall
      ),
      loopRoute: this.settings.scrollLoopRoute
    };
  }
  /** Measure the colour-filtered toggles as page boxes in content space. */
  measureScrollBoxes(container) {
    const all = this.collectStops(container, this.settings.scrollFilter);
    const kept = all.filter((st) => matchesFilter(st.color, this.settings.scrollFilter));
    this.scrollTotalItems = kept.length;
    this.scrollElByOrdinal = /* @__PURE__ */ new Map();
    this.scrollBoxes = kept.map((st, i) => {
      this.scrollElByOrdinal.set(i + 1, st.el);
      return { page: i + 1, top: st.top, height: st.height };
    }).sort((a, b) => a.top - b.top);
    this.scrollTargetsKey = "";
  }
  /** Cached dwell targets — rebuilt only when the inputs change. */
  currentTargets(container, cfg) {
    const key = `${container.clientHeight}|${cfg.a4}|${cfg.parity}|${cfg.pages.join(",")}|${this.scrollBoxes.length}`;
    if (key !== this.scrollTargetsKey) {
      this.scrollTargetsKey = key;
      this.scrollTargets = dwellTargets(this.scrollBoxes, cfg, container.clientHeight);
      this.scrollPlan = this.scrollTargets.map((t) => ({
        index: t.page - 1,
        top: t.top,
        color: "other"
      }));
    }
    return this.scrollTargets;
  }
  /** Open the toggle we just parked on and start its visit clock. */
  parkOnToggle(ordinal, now) {
    const el = this.scrollElByOrdinal.get(ordinal);
    if (this.scrollOpenEl && this.scrollOpenEl !== el && this.settings.scrollAutoClose) {
      this.setToggleOpen(this.scrollOpenEl, false);
    }
    if (el && this.settings.scrollAutoOpen)
      this.setToggleOpen(el, true);
    this.scrollOpenEl = el != null ? el : null;
    this.noteScrollVisit(ordinal, now);
  }
  /** Reader parity: a visit opens here and is graded when the pause ends. */
  noteScrollVisit(ordinal, now = Date.now()) {
    if (!Number.isFinite(ordinal) || ordinal <= 0)
      return;
    if (this.settings.scrollMode !== "shuffle")
      return;
    const open = this.scrollVisit;
    if (open && open.ordinal !== ordinal) {
      this.scrollVisit = null;
      void this.gradeLeavingStop(open.ordinal, Date.now() - open.at);
    }
    if (!this.scrollVisit)
      this.scrollVisit = { ordinal, at: Date.now() };
  }
  closeScrollVisit() {
    const open = this.scrollVisit;
    if (!open || this.settings.scrollMode !== "shuffle")
      return;
    this.scrollVisit = null;
    void this.gradeLeavingStop(open.ordinal, Date.now() - open.at);
  }
  /** Element that carries the sub-pixel remainder while running. */
  pickSmoothEl(container) {
    var _a;
    try {
      if ((_a = window.matchMedia) == null ? void 0 : _a.call(window, "(prefers-reduced-motion: reduce)").matches)
        return null;
      const candidate = Array.from(container.children).find((c) => {
        if (!(c instanceof HTMLElement))
          return false;
        const pos = getComputedStyle(c).position;
        return pos !== "sticky" && pos !== "fixed";
      });
      if (!candidate)
        return null;
      const t = getComputedStyle(candidate).transform;
      if (t && t !== "none")
        return null;
      return candidate;
    } catch (e) {
      return null;
    }
  }
  restoreScrollSmoothing() {
    var _a;
    if (this.scrollSmoothEl) {
      this.scrollSmoothEl.style.transform = (_a = this.scrollPrevTransform) != null ? _a : "";
      this.scrollSmoothEl.style.willChange = "";
    }
    this.scrollSmoothEl = null;
    this.scrollPrevTransform = null;
    if (this.scrollContainer && this.scrollPrevBehavior !== null) {
      this.scrollContainer.style.scrollBehavior = this.scrollPrevBehavior;
    }
    this.scrollPrevBehavior = null;
  }
  scheduleScrollFrame() {
    if (this.scrollHoldPaused)
      return;
    if (this.scrollRaf !== null)
      window.cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = window.requestAnimationFrame((ts) => this.autoScrollFrame(ts));
  }
  /**
   * v1.1.2 — ported from the reader's `useAutoScroll` same-origin loop:
   * float position, per-leg route direction, `crossedTarget` dwell guard and
   * the sub-pixel `translate3d` remainder.
   */
  autoScrollFrame(ts) {
    this.scrollRaf = null;
    if (!this.scrollRunning || this.scrollHoldPaused)
      return;
    const container = this.scrollContainer;
    if (!container || !container.isConnected) {
      this.stopAutoScroll(false);
      return;
    }
    if (!this.scrollLastFrame)
      this.scrollLastFrame = ts;
    const dt = frameFactor(ts - this.scrollLastFrame);
    this.scrollLastFrame = ts;
    const perFrame = clampSpeed(this.settings.scrollSpeed) / 60;
    if (this.scrollDwellUntil && ts < this.scrollDwellUntil) {
      this.scrollPos = container.scrollTop;
      if (this.scrollDebugOverlay)
        this.paintScrollDebug({}, ts);
      this.scheduleScrollFrame();
      return;
    }
    if (this.scrollDwellUntil && ts >= this.scrollDwellUntil) {
      this.scrollDwellUntil = 0;
      this.closeScrollVisit();
      if (this.scrollOpenEl && this.settings.scrollAutoClose) {
        this.setToggleOpen(this.scrollOpenEl, false);
        this.scrollOpenEl = null;
      }
      this.renderScrollBar();
    }
    const max = container.scrollHeight - container.clientHeight;
    markProgrammaticScroll();
    if (max > 2) {
      if (Math.abs(container.scrollTop - this.scrollPos) > 2)
        this.scrollPos = container.scrollTop;
      const cfg = this.dwellCfg();
      const routeMode = isRouteMode(cfg);
      if (ts - this.scrollBoxesAt > 500 || this.scrollBoxes.length === 0) {
        this.scrollBoxesAt = ts;
        this.measureScrollBoxes(container);
      }
      let routeTarget = null;
      let routeStops = [];
      if (routeMode) {
        const wanted = cfg.route[this.scrollRouteIdx % cfg.route.length];
        const hit = this.scrollBoxes.find((b) => b.page === wanted);
        if (hit) {
          routeStops = cfg.a4 ? pageStops(hit.top, hit.height, container.clientHeight) : [hit.top];
          routeTarget = routeStops[Math.min(this.scrollRouteStop, routeStops.length - 1)];
          this.scrollDir = legDirection(routeTarget, this.scrollPos, this.scrollDir);
        }
      } else {
        this.scrollDir = this.settings.scrollReverse ? -1 : 1;
      }
      const prevPos = this.scrollPos;
      this.scrollPos = advancePosition(this.scrollPos, perFrame, dt, this.scrollDir, max);
      this.scrollMovedPx += Math.abs(this.scrollPos - prevPos);
      const whole = Math.floor(this.scrollPos);
      container.scrollTop = whole;
      if (routeMode) {
        if (routeTarget != null && waypointReached(prevPos, this.scrollPos, routeTarget)) {
          this.scrollPos = routeTarget;
          container.scrollTop = Math.floor(routeTarget);
          this.scrollDwellUntil = ts + cfg.seconds * 1e3;
          const ordinal = cfg.route[this.scrollRouteIdx % cfg.route.length];
          this.scrollLastEvent = `waypointReached toggle ${ordinal} @ ${Math.round(routeTarget)}`;
          this.parkOnToggle(ordinal, ts);
          if (this.scrollRouteStop < routeStops.length - 1) {
            this.scrollRouteStop += 1;
            if (this.scrollDebugOverlay)
              this.paintScrollDebug({}, ts);
            this.scheduleScrollFrame();
            return;
          }
          this.scrollRouteStop = 0;
          const last = this.scrollRouteIdx >= cfg.route.length - 1;
          if (last && !cfg.loopRoute) {
            new import_obsidian4.Notice(
              this.settings.scrollMode === "shuffle" ? "Shuffle finished \u2014 every scheduled toggle revised." : "Route finished \u2014 every waypoint visited."
            );
            this.scrollRunning = false;
            this.renderScrollBar();
            if (this.scrollDebugOverlay)
              this.paintScrollDebug({}, ts);
            this.scheduleScrollFrame();
            return;
          }
          this.scrollRouteIdx = last ? 0 : this.scrollRouteIdx + 1;
          this.renderScrollBar();
          if (this.scrollDebugOverlay)
            this.paintScrollDebug({}, ts);
          this.scheduleScrollFrame();
          return;
        }
      } else {
        if (this.scrollDwellDir !== this.scrollDir) {
          this.scrollDwellDir = this.scrollDir;
          this.scrollDwellKey = null;
        }
        const targets = this.currentTargets(container, cfg);
        const crossed = crossedTarget(targets, prevPos, this.scrollPos, this.scrollDir);
        if (shouldPark(this.scrollDwellKey, crossed)) {
          const stop = crossed;
          this.scrollDwellKey = stop.key;
          this.scrollDwellUntil = ts + cfg.seconds * 1e3;
          this.scrollPos = stop.top;
          container.scrollTop = Math.floor(stop.top);
          this.scrollAt = targets.findIndex((t) => t.key === stop.key);
          this.scrollLastEvent = `crossedTarget ${stop.key} @ ${Math.round(stop.top)}`;
          this.parkOnToggle(stop.page, ts);
          this.renderScrollBar();
          if (this.scrollDebugOverlay)
            this.paintScrollDebug({}, ts);
          this.scheduleScrollFrame();
          return;
        }
      }
      if (!this.scrollSmoothEl) {
        const cand = this.pickSmoothEl(container);
        if (cand) {
          this.scrollSmoothEl = cand;
          this.scrollPrevTransform = cand.style.transform;
          cand.style.willChange = "transform";
        }
      }
      if (this.scrollSmoothEl) {
        const frac = this.scrollPos - whole;
        this.scrollSmoothEl.style.transform = `translate3d(0, ${-frac}px, 0)`;
      }
      const atEdge = finishedAtEdge(this.scrollPos, max, this.scrollDir, this.scrollMovedPx);
      if (atEdge && !routeMode) {
        if (this.settings.scrollLoop) {
          this.scrollPos = this.scrollDir < 0 ? max : 0;
          container.scrollTop = Math.floor(this.scrollPos);
          this.scrollDwellKey = null;
          this.scrollMovedPx = 0;
        } else {
          this.say("Autoscroll finished \u2014 every selected toggle revised.");
          this.stopAutoScroll(false);
          return;
        }
      }
    } else if (ts - this.scrollRelocateAt > 400) {
      this.scrollRelocateAt = ts;
      const better = this.findScrollContainer();
      if (better && better !== container && better.scrollHeight - better.clientHeight > 2) {
        this.restoreScrollSmoothing();
        this.scrollContainer = better;
        this.scrollPrevBehavior = better.style.scrollBehavior;
        better.style.scrollBehavior = "auto";
        this.scrollPos = better.scrollTop;
        this.scrollBoxes = [];
        this.scrollBoxesAt = 0;
        this.scrollSmoothEl = null;
      }
    }
    if (this.scrollDebugOverlay)
      this.paintScrollDebug({}, ts);
    this.scheduleScrollFrame();
  }
  /* ==================== v1.1.0: quiz mode ==================== */
  /** Visible title text of a toggle, used for the per-question "⏱30" marker. */
  quizTitleOf(el) {
    return toggleTitleOf(el);
  }
  /** v1.3.0 — colours the quiz asks about. */
  quizFilterColors() {
    return normalizeFilter(
      this.settings.quizUseColorFilter ? this.settings.quizFilter.length ? this.settings.quizFilter : this.settings.scrollFilter : []
    );
  }
  async setQuizFilter(filter) {
    this.settings.quizFilter = normalizeFilter(filter);
    this.settings.quizUseColorFilter = true;
    await this.saveSettings();
    if (!this.settings.scrollQuiet)
      new import_obsidian4.Notice(`Quiz filter: ${filterLabel(this.settings.quizFilter)}`);
  }
  /** Primary command: start, pause or resume the quiz. */
  toggleQuiz() {
    if (this.quizState && this.quizState.phase !== "done") {
      this.toggleQuizPause();
      return;
    }
    this.startQuizRun();
  }
  startQuizRun() {
    const container = this.findScrollContainer();
    if (!container) {
      new import_obsidian4.Notice("Open a note first \u2014 quiz mode needs a note view.");
      return;
    }
    const filter = this.quizFilterColors();
    const stops = planStops(
      this.collectStops(container, filter),
      filter,
      this.settings.scrollReverse
    );
    if (stops.length === 0) {
      if (this.collectStops(container).length === 0 && !this.quizRetryPending && this.sourceHasToggles()) {
        this.quizRetryPending = true;
        window.setTimeout(() => {
          this.quizRetryPending = false;
          if (!this.quizState)
            this.startQuizRun();
        }, 700);
        return;
      }
      new import_obsidian4.Notice(`No toggles match the filter (${filterLabel(filter)}).`);
      return;
    }
    this.quizContainer = container;
    this.quizStops = stops;
    this.quizTitles = stops.map((s) => s.el ? this.quizTitleOf(s.el) : "");
    this.quizSnapshot = snapshotToggles(stops.map((s) => s.el));
    document.body.classList.add(QUIZ_ACTIVE_CLASS);
    for (const s of stops) {
      if (s.el)
        setQuizVisible(s.el, this.settings.quizKeepAnswersOpen);
    }
    this.quizState = startQuiz(this.quizTitles, this.settings);
    if (!this.quizBoard)
      this.quizBoard = new QuizBoard(document);
    if (!this.settings.quizMinimalUi && !this.quizBar) {
      this.quizBar = new QuizBar({
        onTogglePause: () => this.toggleQuizPause(),
        onRevealNow: () => this.quizRevealNow(),
        onNext: () => this.quizNext(),
        onStop: () => this.stopQuiz(true)
      });
    }
    this.scrollQuizTo(0);
    if (!this.settings.scrollQuiet)
      new import_obsidian4.Notice(quizStartLabel(stops.length, this.settings));
    this.renderQuizHud();
    this.startQuizLoop();
  }
  stopQuiz(notify) {
    var _a, _b;
    if (this.quizInterval !== null) {
      window.clearInterval(this.quizInterval);
      this.quizInterval = null;
    }
    const summary = this.quizState ? quizSummary(this.quizState) : "";
    clearQuizVisibility(
      this.quizStops.map((s) => s.el),
      this.quizSnapshot
    );
    document.body.classList.remove(QUIZ_ACTIVE_CLASS);
    this.quizState = null;
    this.quizSnapshot = [];
    this.quizStops = [];
    this.quizTitles = [];
    this.quizContainer = null;
    (_a = this.quizBoard) == null ? void 0 : _a.destroy();
    this.quizBoard = null;
    (_b = this.quizBar) == null ? void 0 : _b.destroy();
    this.quizBar = null;
    if (notify)
      new import_obsidian4.Notice(summary || "Quiz stopped.");
  }
  toggleQuizPause() {
    if (!this.quizState) {
      this.startQuizRun();
      return;
    }
    this.quizState = this.quizState.running ? pauseQuiz(this.quizState) : resumeQuiz(this.quizState);
    this.quizLastFrame = Date.now();
    this.renderQuizHud();
    if (!this.settings.scrollQuiet) {
      new import_obsidian4.Notice(this.quizState.running ? "Quiz resumed." : "Quiz paused.");
    }
  }
  quizRevealNow() {
    if (!this.quizState)
      return;
    const { state, event } = revealNow(this.quizState, this.settings);
    this.quizState = state;
    this.applyQuizEvent(event);
  }
  quizNext() {
    if (!this.quizState)
      return;
    const { state, event } = skipQuestion(this.quizState, this.quizTitles, this.settings);
    this.quizState = state;
    this.applyQuizEvent(event);
  }
  /**
   * v1.3.2 — re-map the captured questions onto the elements that are in the
   * document right now. Obsidian re-renders reading-view sections while the
   * quiz scrolls; without this a re-rendered question is revealed on a
   * detached node and looks skipped (the Q21 → Q23 report).
   */
  ensureQuizEls() {
    const container = this.quizContainer;
    if (!container || !this.quizStops.length)
      return;
    if (!needsHeal(this.quizStops.map((s) => s.el)))
      return;
    const healStart = nowMs();
    const fresh = this.collectStops(container, this.quizFilterColors()).map((s) => s.el).filter((el) => !!el);
    const healed = healQuizEls(
      this.quizStops.map((s) => s.el),
      this.quizTitles,
      fresh,
      (el) => this.quizTitleOf(el)
    );
    this.quizStops = this.quizStops.map((s, i) => ({ ...s, el: healed[i] }));
    this.perf.quizHeal.add(nowMs() - healStart);
  }
  /** React to an engine event: open the answer, move on, or finish. */
  applyQuizEvent(event) {
    var _a;
    if (!this.quizState)
      return;
    if (event === "reveal") {
      this.ensureQuizEls();
      this.applyQuizVisibility(this.quizState.at, true);
      const el = (_a = this.quizStops[this.quizState.at]) == null ? void 0 : _a.el;
      if (el && el.isConnected && !revealLanded(el))
        this.setToggleOpen(el, true);
      if (this.settings.quizBeepOnTimeUp && !this.settings.scrollQuiet) {
        new import_obsidian4.Notice("\u23F0 Time up \u2014 answer revealed.");
      }
    } else if (event === "next") {
      this.ensureQuizEls();
      this.scrollQuizTo(this.quizState.at);
    } else if (event === "done") {
      const summary = quizSummary(this.quizState);
      this.stopQuiz(false);
      new import_obsidian4.Notice(summary);
      return;
    }
    this.renderQuizHud();
  }
  /** Only the current question may show its answer, and only after the reveal. */
  applyQuizVisibility(index, revealed) {
    if (this.settings.quizKeepAnswersOpen) {
      for (const s of this.quizStops)
        if (s.el)
          setQuizVisible(s.el, true);
      return;
    }
    applyQuizVisibilityClasses(
      this.quizStops.map((s) => s.el),
      index,
      revealed,
      this.settings.quizCloseAfterReveal
    );
  }
  /** Close every other toggle and bring question `index` into view. */
  scrollQuizTo(index) {
    const container = this.quizContainer;
    const stop = this.quizStops[index];
    if (!container || !stop)
      return;
    this.applyQuizVisibility(index, false);
    const el = stop.el;
    const scroll = () => {
      var _a, _b;
      this.ensureQuizEls();
      const live = (_b = (_a = this.quizStops[index]) == null ? void 0 : _a.el) != null ? _b : el;
      const top = live && live.isConnected ? live.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop : stop.top;
      container.scrollTo({ top: targetOffset(top, container.clientHeight), behavior: "smooth" });
      this.renderQuizHud();
    };
    if (typeof window.requestAnimationFrame === "function")
      window.requestAnimationFrame(scroll);
    else
      scroll();
  }
  startQuizLoop() {
    if (this.quizInterval !== null)
      window.clearInterval(this.quizInterval);
    this.quizLastFrame = Date.now();
    this.quizInterval = window.setInterval(() => this.quizFrame(), 250);
    this.registerInterval(this.quizInterval);
  }
  quizFrame() {
    if (!this.quizState)
      return;
    const container = this.quizContainer;
    if (!container || !container.isConnected) {
      this.stopQuiz(false);
      return;
    }
    const now = Date.now();
    const dt = Math.min(2e3, now - this.quizLastFrame);
    this.quizLastFrame = now;
    const { state, event } = quizTick(this.quizState, dt, this.quizTitles, this.settings);
    this.quizState = state;
    if (event)
      this.applyQuizEvent(event);
    else
      this.renderQuizHud();
  }
  /** Paint the inline ring (and the optional dock) from the engine state. */
  renderQuizHud() {
    var _a, _b;
    const st = this.quizState;
    if (!st)
      return;
    this.perf.quizRender.mark(nowMs());
    this.ensureQuizEls();
    (_a = this.quizBoard) == null ? void 0 : _a.render(
      this.quizStops.map((s, i) => {
        var _a2;
        return {
          el: s.el,
          totalMs: questionMs((_a2 = this.quizTitles[i]) != null ? _a2 : "", this.settings)
        };
      }),
      st.at,
      {
        remaining: st.remaining,
        ratio: quizPhaseRatio(st, this.quizTitles, this.settings),
        phase: st.phase,
        running: st.running,
        index: st.at + 1,
        total: st.total
      }
    );
    (_b = this.quizBar) == null ? void 0 : _b.render({
      progress: quizProgressLabel(st),
      running: st.running,
      revealing: st.phase === "reveal"
    });
  }
  /**
   * Remove schedule entries whose note no longer exists.
   * Returns how many were removed; `silent` skips the notice (startup).
   */
  async pruneSchedule(silent = false) {
    var _a;
    const existing = this.app.vault.getMarkdownFiles().map((f) => f.path);
    const { store, removed } = pruneCards((_a = this.settings.srs) != null ? _a : {}, existing);
    if (removed.length) {
      this.settings.srs = store;
      await this.saveSettings();
      this.renderTimer();
    }
    if (!silent) {
      new import_obsidian4.Notice(
        removed.length ? `Removed ${removed.length} schedule${removed.length === 1 ? "" : "s"} for missing notes.` : "Recall schedule is already clean."
      );
    }
    return removed.length;
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    const nums = (v) => Array.isArray(v) ? v.map((n) => Math.floor(Number(n))).filter((n) => n > 0) : [];
    this.settings.scrollPicks = nums(this.settings.scrollPicks);
    this.settings.scrollRoute = nums(this.settings.scrollRoute);
    this.settings.scrollUserRoute = nums(this.settings.scrollUserRoute);
    if (!this.settings.scrollUserRoute.length && this.settings.scrollMode === "route") {
      this.settings.scrollUserRoute = [...this.settings.scrollRoute];
    }
    this.settings.scrollLoopRoute = !!this.settings.scrollLoopRoute;
    this.settings.scrollShuffleFrom = Math.max(0, Math.floor(Number(this.settings.scrollShuffleFrom) || 0));
    this.settings.scrollShuffleTo = Math.max(0, Math.floor(Number(this.settings.scrollShuffleTo) || 0));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var DueNotesModal = class extends import_obsidian4.Modal {
  constructor(app, due, onPick) {
    super(app);
    this.due = due;
    this.onPick = onPick;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(`Due for recall (${this.due.length})`);
    for (const { path, card } of this.due) {
      const row = contentEl.createDiv({ cls: "ntt-due-row" });
      const btn = row.createEl("button", { text: path.replace(/\.md$/, "") });
      btn.addClass("ntt-due-btn");
      row.createSpan({ text: ` ${nextDueLabel(card, Date.now())} \xB7 ease ${card.ease}` });
      btn.addEventListener("click", () => {
        this.close();
        this.onPick(path);
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
