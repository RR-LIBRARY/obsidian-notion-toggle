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
  EMPTY_ANSWER_LINE: () => EMPTY_ANSWER_LINE,
  EMPTY_MATCH_ROW: () => EMPTY_MATCH_ROW,
  MATCH_ROW: () => MATCH_ROW,
  MATCH_SEPARATOR: () => MATCH_SEPARATOR,
  MCQ_EMPTY_OPTION: () => MCQ_EMPTY_OPTION,
  MCQ_OPTION: () => MCQ_OPTION2,
  NUMBERED_HEADER: () => NUMBERED_HEADER,
  NUMBERED_SUMMARY: () => NUMBERED_SUMMARY,
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
var import_obsidian = require("obsidian");
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
function autoPauseNotice(reason) {
  if (reason === "hidden")
    return "\u231B Timer paused \u2014 you left the app.";
  if (reason === "other-note")
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
  "smart-review"
];
var PRIMARY_NAMES = {
  "smart-toggle": "Toggle (smart add)",
  "smart-colour": "Colour (red \u2192 yellow \u2192 green)",
  "smart-recall": "Recall (start / pause session)",
  "smart-review": "Review (spaced repetition)"
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

// main.ts
var DEFAULT_SETTINGS = {
  ...DEFAULT_POMODORO,
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
  autoReview: true
};
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
var TRAFFIC_CYCLE = ["recall-red", "recall-yellow", "recall-green"];
function calloutForColor(colorId, fallback) {
  const found = TOGGLE_COLORS.find((c) => c.id === colorId);
  return found && found.callout ? found.callout : fallback;
}
var NotionTogglePlugin = class extends import_obsidian.Plugin {
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
          new import_obsidian.Notice("No <details> blocks found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian.Notice("Converted all <details> blocks to callout toggles.");
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
          new import_obsidian.Notice("No foldable callout toggles found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian.Notice("Converted callout toggles to <details> blocks.");
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
            new import_obsidian.Notice("Question is empty \u2014 nothing inserted.");
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
        new import_obsidian.Notice(`Auto-continue on Enter: ${this.settings.autoContinue ? "ON" : "OFF"}`);
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
          new import_obsidian.Notice("Numbering already correct (or no numbered toggles).");
          return;
        }
        const cursor = editor.getCursor();
        editor.setValue(fixed);
        editor.setCursor(cursor);
        new import_obsidian.Notice("Toggles renumbered.");
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
            new import_obsidian.Notice("Cursor is not inside a toggle.");
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
        new import_obsidian.Notice(`Auto-numbering: ${this.settings.numberedByDefault ? "ON" : "OFF"}`);
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
          new import_obsidian.Notice("Cursor is not inside a toggle.");
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
          new import_obsidian.Notice("Cursor is not on a checkbox option.");
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
          new import_obsidian.Notice("Cursor is not inside a toggle.");
          return;
        }
        let last = found.line;
        for (let l = found.line + 1; l < editor.lineCount(); l++) {
          if (!/^>/.test(editor.getLine(l)))
            break;
          if (ANSWER_LINE2.test(editor.getLine(l))) {
            new import_obsidian.Notice("This toggle already has an answer line.");
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
    const updated = found.text.replace(/^>\s*\[![^\]]+\]/, `> [!${callout}]`);
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
        new import_obsidian.Notice("Nothing to wrap \u2014 select the question and answer first.");
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
      new import_obsidian.Notice("Selection is empty.");
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
    var _a, _b;
    const found = this.findHeaderLine(editor);
    if (!found) {
      new import_obsidian.Notice("Cursor is not inside a toggle.");
      return;
    }
    const current = (_b = (_a = found.text.match(/^>\s*\[!([^\]]+)\]/)) == null ? void 0 : _a[1]) != null ? _b : "";
    const idx = TRAFFIC_CYCLE.indexOf(current);
    const next = TRAFFIC_CYCLE[(idx + 1) % TRAFFIC_CYCLE.length];
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
      new import_obsidian.Notice(smartActionLabel(action));
  }
  /** Start, pause or resume the recall session with a single command. */
  runSmartRecall(editor) {
    if (!this.timerWidget || !this.sessionNotePath) {
      this.startRecallSession(editor);
      return;
    }
    if (this.timerState.running) {
      this.timerState = { ...this.timerState, running: false, autoPaused: false };
      new import_obsidian.Notice("\u231B Paused");
    } else {
      this.timerState = { ...this.timerState, running: true, autoPaused: false };
      this.lastTick = Date.now();
      this.lastActivityAt = Date.now();
      new import_obsidian.Notice("\u231B Running");
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
    new import_obsidian.Notice(
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
      new import_obsidian.Notice("Open a note first to schedule its recall.");
      return;
    }
    const card = gradeCard((_b = this.cardFor(path)) != null ? _b : newCard(), grade, Date.now());
    this.settings.srs = { ...(_c = this.settings.srs) != null ? _c : {}, [path]: card };
    await this.saveSettings();
    this.reviewOpen = false;
    this.renderTimer();
    this.updateStatus();
    new import_obsidian.Notice(`${GRADE_LABEL[grade]} \u2192 ${nextDueLabel(card, Date.now())} \xB7 ease ${card.ease}`);
  }
  /** List the notes whose recall is due, newest schedule first. */
  showDueNotes() {
    var _a;
    const due = dueNotes((_a = this.settings.srs) != null ? _a : {}, Date.now());
    if (!due.length) {
      new import_obsidian.Notice("Nothing due \u2014 everything is scheduled ahead.");
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
    new import_obsidian.Notice(summary);
  }
  activeNotePath() {
    var _a, _b, _c;
    return (_c = (_b = (_a = this.app.workspace.activeEditor) == null ? void 0 : _a.file) == null ? void 0 : _b.path) != null ? _c : null;
  }
  /** Auto-pause / auto-resume based on visibility and the session note. */
  evaluateAttention() {
    const reason = shouldAutoPause({
      state: this.timerState,
      enabled: this.settings.autoPauseOnLeave,
      visible: document.visibilityState !== "hidden" && document.hasFocus(),
      onSessionNote: !this.sessionNotePath || this.activeNotePath() === this.sessionNotePath,
      pinned: this.settings.pinToSessionNote
    });
    if (reason) {
      this.timerState = pauseForInactivity(this.timerState);
      this.renderTimer();
      if (this.settings.notifyOnPhaseEnd)
        new import_obsidian.Notice(autoPauseNotice(reason));
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
      new import_obsidian.Notice(`All ${stats.total} toggles collapsed \u2014 recall again \u{1F534} ${stats.red}`);
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
        new import_obsidian.Notice(autoPauseNotice("idle"));
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
        new import_obsidian.Notice(`${ended} done \u2192 ${phaseLabel(this.timerState.phase)} \xB7 ${(_b = this.recallHint()) != null ? _b : ""}`.trim());
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
      new import_obsidian.Notice("Open a note first.");
      return;
    }
    const stats = scanRecallStats(editor.getValue());
    if (stats.firstRedLine < 0) {
      new import_obsidian.Notice("No \u{1F534} red toggles in this note \u2014 nice work.");
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
    this.hideTimer();
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
      new import_obsidian.Notice(
        removed.length ? `Removed ${removed.length} schedule${removed.length === 1 ? "" : "s"} for missing notes.` : "Recall schedule is already clean."
      );
    }
    return removed.length;
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
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
var NotionToggleSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    var _a;
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Toggle colour").setDesc("Traffic-light colours for active recall: red = hard, yellow = revise, green = mastered. Plain = clean black Notion look.").addDropdown((dropdown) => {
      for (const c of TOGGLE_COLORS)
        dropdown.addOption(c.id, c.label);
      dropdown.setValue(this.plugin.settings.color);
      dropdown.onChange(async (value) => {
        this.plugin.settings.color = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Auto-numbering").setDesc('New toggles get 1., 2., 3., ... automatically \u2014 you never type the number. Use "Renumber toggles in note" to fix gaps.').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.numberedByDefault);
      toggle.onChange(async (value) => {
        this.plugin.settings.numberedByDefault = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("MCQ options").setDesc("How many checkbox options a new MCQ toggle gets (2-6).").addSlider((slider) => {
      slider.setLimits(2, 6, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.mcqOptionCount);
      slider.onChange(async (value) => {
        this.plugin.settings.mcqOptionCount = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Match the following rows").setDesc("How many rows a new match table gets (2-8).").addSlider((slider) => {
      slider.setLimits(2, 8, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.matchRowCount);
      slider.onChange(async (value) => {
        this.plugin.settings.matchRowCount = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Auto-add Answer line").setDesc('Add an "**Answer:** " line inside new MCQ / match toggles.').addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.addAnswerLine);
      toggle.onChange(async (value) => {
        this.plugin.settings.addAnswerLine = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default callout type").setDesc("Type used when inserting/wrapping toggles.").addDropdown((dropdown) => {
      for (const t of CALLOUT_TYPES) {
        dropdown.addOption(t, t);
      }
      dropdown.setValue(this.plugin.settings.calloutType);
      dropdown.onChange(async (value) => {
        this.plugin.settings.calloutType = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default collapsed").setDesc("On: toggles start collapsed (answer hidden). Off: expanded.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.defaultCollapsed);
      toggle.onChange(async (value) => {
        this.plugin.settings.defaultCollapsed = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Auto-continue on Enter").setDesc("Inside a toggle, Enter keeps writing the answer; Enter on an empty toggle line starts the NEXT toggle.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoContinue);
      toggle.onChange(async (value) => {
        this.plugin.settings.autoContinue = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Toggle format").setDesc("Native callout (recommended, folds in Obsidian) or HTML <details>.").addDropdown((dropdown) => {
      dropdown.addOption("callout", "Native callout (> [!question]-)");
      dropdown.addOption("details", "HTML <details>");
      dropdown.setValue(this.plugin.settings.format);
      dropdown.onChange(async (value) => {
        this.plugin.settings.format = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Bold the question/summary").setDesc("Auto-wrap the title in **bold** (skips already-bold text).").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.boldSummary);
      toggle.onChange(async (value) => {
        this.plugin.settings.boldSummary = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Recall timer (Pomodoro)").setHeading();
    new import_obsidian.Setting(containerEl).setName("Preset").setDesc("Pick a rhythm, or choose Custom and set your own minutes below.").addDropdown((dropdown) => {
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
      new import_obsidian.Setting(containerEl).setName(name).setDesc(desc).addSlider((slider) => {
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
    new import_obsidian.Setting(containerEl).setName("Sessions before long break").setDesc("How many focus sessions make one cycle (1-8).").addSlider((slider) => {
      slider.setLimits(1, 8, 1).setDynamicTooltip();
      slider.setValue(this.plugin.settings.sessionsBeforeLongBreak);
      slider.onChange(async (value) => {
        this.plugin.settings.sessionsBeforeLongBreak = value;
        await this.plugin.saveSettings();
        this.plugin.renderTimer();
      });
    });
    const boolSetting = (name, desc, get, set) => {
      new import_obsidian.Setting(containerEl).setName(name).setDesc(desc).addToggle((toggle) => {
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
    new import_obsidian.Setting(containerEl).setName("Timer focus guard (v1.0.6)").setHeading();
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
    new import_obsidian.Setting(containerEl).setName("Idle pause (minutes)").setDesc("Pause the focus phase after this much inactivity. 0 turns it off.").addText((text) => {
      text.setPlaceholder("2").setValue(String(this.plugin.settings.idlePauseMinutes)).onChange(async (value) => {
        const n = Number.parseInt(value, 10);
        this.plugin.settings.idlePauseMinutes = Number.isFinite(n) ? Math.max(0, Math.min(120, n)) : 0;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Minimal mode & spaced repetition").setHeading();
    new import_obsidian.Setting(containerEl).setName("Minimal command names").setDesc(
      'Keep 4 primary commands (Toggle, Colour, Recall, Review) clean and prefix everything else with "Advanced:" so the toolbar stays uncluttered. Restart Obsidian to refresh names.'
    ).addToggle(
      (tg) => tg.setValue(this.plugin.settings.minimalNames).onChange(async (v) => {
        this.plugin.settings.minimalNames = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Ask for a grade after each focus phase").setDesc("Shows Again / Hard / Good / Easy on the timer; SM-2 then calculates your next recall date automatically.").addToggle(
      (tg) => tg.setValue(this.plugin.settings.autoReview).onChange(async (v) => {
        this.plugin.settings.autoReview = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Recall schedule").setDesc(
      `${scheduleStoreSummary(Object.keys((_a = this.plugin.settings.srs) != null ? _a : {}).length)} Schedules follow a note when you rename or move it (v1.0.8).`
    ).addButton((btn) => {
      btn.setButtonText("Clean up").onClick(async () => {
        const removed = await this.plugin.pruneSchedule();
        new import_obsidian.Notice(
          removed > 0 ? `Removed ${removed} schedule${removed === 1 ? "" : "s"} for missing notes.` : "Nothing to clean up."
        );
        this.display();
      });
    }).addButton((btn) => {
      btn.setWarning().setButtonText("Clear all").onClick(async () => {
        this.plugin.settings.srs = {};
        await this.plugin.saveSettings();
        new import_obsidian.Notice("Recall schedule cleared.");
        this.display();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Reset timer position").setDesc("Bring the floating timer back to the top-left if it drifted off-screen.").addButton((btn) => {
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
var DueNotesModal = class extends import_obsidian.Modal {
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
