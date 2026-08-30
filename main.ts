import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  DEFAULT_POMODORO,
  POMODORO_PRESETS,
  autoPauseNotice,
  clampMinutes,
  collapseAllToggles,
  createState,
  isIdle,
  nextPhase,
  pauseForInactivity,
  phaseDuration,
  phaseLabel,
  resetPhase,
  resolvePreset,
  resumeAfterAutoPause,
  scanRecallStats,
  sessionSummary,
  shouldAutoPause,
  stopSession,
  stopSummary,
  tick,
  type PomodoroSettings,
  type PomodoroState,
} from "./src/timer";

import { TimerWidget } from "./src/timer-ui";
import { commandName } from "./src/naming";
import { blankTableRow, smartAction, smartActionLabel } from "./src/smart";
import {
  GRADE_LABEL,

  dueNotes,
  dueSummary,
  gradeCard,
  newCard,
  nextDueLabel,
  suggestGrade,
  type Grade,
  type SrsCard,
} from "./src/srs";
import {
  DEFAULT_AUTOSCROLL,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
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
  sameFilter,
  reachedTarget,
  sessionLabel,
  targetOffset,
  type AutoScrollSettings,
  type RecallColor,
  type ToggleStop,
} from "./src/autoscroll";
import { ScrollDebugOverlay, filterFrame, type DebugFrame } from "./src/debug-overlay";
import { TRAFFIC_CYCLE, calloutTypeOfLine, nextTrafficColor, recolorHeaderLine } from "./src/recolor";
import { orderExplainer, rowLabel, weakRows } from "./src/stats-panel";
import { ScrollBar } from "./src/autoscroll-ui";
import { HoldPause } from "./src/hold-pause";
import { ScrollFab, markProgrammaticScroll } from "./src/scroll-fab";
import {
  HOTKEYS,
  MSG_NOT_RUNNING,
  MSG_PLAIN_SCROLL,
  TOOLBAR_COMMANDS,
  TOOLBAR_STEPS,
  fabShouldShow,
  guideProgress,
  hotkeyLabel,
  toggleGuideDone,
} from "./src/guide";
import {
  DWELL_PRESETS,
  SPEED_MULTIPLIERS,
  buildModeStops,
  clampDwellSeconds,
  formatDwell,
  matchesMode,
  modeIcon,
  modeLabel,
  multiplierFromSpeed,
  orderModeStops,
  parsePicks,
  parseRoute,
  speedFromMultiplier,
  advancePosition,
  crossedTarget,
  dwellTargets,
  frameFactor,
  isRouteMode,
  legDirection,
  seedStartOffset,
  finishedAtEdge,
  shouldPark,
  pageStops,
  toDwellSettings,
  waypointReached,
  type DwellSettings,
  type DwellTarget,
  type ModeConfig,
  type PageBox,
  type ScrollMode,
} from "./src/scrollmode";
import {
  buildShuffleOrder,
  deckStats,
  deckSummary,
  forecastDue,
  gradeFromDwell,
  loadDeck,
  recordReview,
  resetDeck,
  saveDeck,
  type FsrsCard,
} from "./src/fsrs";
import {
  DEFAULT_QUIZ,
  QUIZ_PRESETS,
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  clampQuizSeconds,
  clampRevealSeconds,
  pauseQuiz,
  questionMs,
  quizProgressLabel,
  quizPhaseRatio,
  quizStartLabel,
  quizSummary,
  quizTick,
  resumeQuiz,
  revealNow,
  skipQuestion,
  startQuiz,
  type QuizSettings,
  type QuizState,
} from "./src/quiz";
import {
  collectToggleEls,
  collectToggleElsFiltered,
  isToggleOpen as isToggleOpenDom,
  restoreToggles,
  setToggleOpen as setToggleOpenDom,
  toggleTitleOf,
  toggleTypeOf,
} from "./src/toggle-dom";
import { QuizBar, paintQuizHud } from "./src/quiz-ui";
import { QuizBoard } from "./src/quiz-badge";
import {
  QUIZ_ACTIVE_CLASS,
  applyQuizVisibilityClasses,
  clearQuizVisibility,
  setQuizVisible,
  snapshotToggles,
  type ToggleSnapshot,
} from "./src/quiz-visibility";
import { healQuizEls, needsHeal, revealLanded } from "./src/quiz-heal";
import { parseDeepLink } from "./src/deeplink";
import { Telemetry, perfVerdict } from "./src/telemetry";
import { anchorScrollTop, anchoredTargets, pickStops, targetsKey } from "./src/scroll-anchor";
import { exportPerfReport, openPerfReport } from "./src/perf-report-modal";

/** High-resolution clock when available, wall clock otherwise (mobile webviews). */
function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof perf?.now === "function" ? perf.now() : Date.now();
}
import {
  pruneCards,
  removeCardKey,
  renameCardKey,
  scheduleStoreSummary,
} from "./src/maintenance";

import { CALLOUT_TYPES, TOGGLE_COLORS, calloutForColor } from "./src/toggle-colors";
import { NotionToggleSettingTab } from "./src/settings-tab";
import {
  ColorPickerModal,
  MobileToolbarGuideModal,
  QUIZ_FILTER_OPTIONS,
  QuickQAModal,
  QuizFilterModal,
  QuizSecondsModal,
  ScrollDwellModal,
  ScrollFilterModal,
  ScrollModeModal,
  ScrollSpeedModal,
  ScrollStatsModal,
} from "./src/modals";
import { ScrollSheetModal } from "./src/sheet-modal";

import {
  ANSWER_LINE,
  EMPTY_ANSWER_LINE,
  EMPTY_MATCH_ROW,
  MATCH_ROW,
  MATCH_SEPARATOR,
  MCQ_EMPTY_OPTION,
  MCQ_OPTION,
  NUMBERED_HEADER,
  NUMBERED_SUMMARY,
  buildMatchBlock,
  buildMcqBlock,
  convertCalloutsToDetails,
  convertDetailsToCallouts,
  nextMatchRow,
  nextToggleNumber,
  planBackspace,
  planEnter,
  renumberToggles,
  toggleOptionCheckbox,
  type EnterOptions,
  type EnterPlan,
  type BackspacePlan,
  type QuestionBlockOptions,
  type ToggleFormat,
} from "./src/editor-blocks";
export * from "./src/editor-blocks";
export { CALLOUT_TYPES, TOGGLE_COLORS, calloutForColor, QUIZ_FILTER_OPTIONS };

interface NotionToggleSettings extends PomodoroSettings, AutoScrollSettings, QuizSettings {
  calloutType: string;
  defaultCollapsed: boolean;
  boldSummary: boolean;
  autoContinue: boolean;
  format: ToggleFormat;
  /** Auto-numbering: new toggles get "1. ", "2. ", ... automatically. */
  numberedByDefault: boolean;
  /** Colour id from TOGGLE_COLORS ("default" = use calloutType). */
  color: string;
  /** How many checkbox options a new MCQ toggle gets. */
  mcqOptionCount: number;
  /** How many rows a new "Match the following" table gets. */
  matchRowCount: number;
  /** Append an "**Answer:** " line inside new MCQ / match toggles. */
  addAnswerLine: boolean;
  /** v1.0.7: keep the command list minimal (4 primary + "Advanced: …"). */
  minimalNames: boolean;
  /** v1.0.7: SM-2 schedule per note path. */
  srs: Record<string, SrsCard>;
  /** v1.0.7: ask for one grade when a focus phase ends. */
  autoReview: boolean;
  /** v1.1.5: show the floating ▶ autoscroll button on open notes. */
  scrollFab: boolean;
  /** v1.1.5: persisted mobile-toolbar guide checklist (command ids ticked off). */
  toolbarGuideDone: string[];
  /** v1.1.8: show the old full control bar instead of the minimal FAB-only UI. */
  scrollBarClassic: boolean;
  /** v1.2.1: quiet mode — only errors pop up, no status notices. */
  scrollQuiet: boolean;
  /** v1.3.0: colours the quiz asks about (empty = every toggle). */
  quizFilter: RecallColor[];
  /** v1.3.0: only the inline ring on the question — no docked control strip. */
  quizMinimalUi: boolean;
  /** v1.4.0: also append the performance report to perf-log.md (real-device profiling). */
  perfLog: boolean;
}

const DEFAULT_SETTINGS: NotionToggleSettings = {
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
  perfLog: false,
};

export { TRAFFIC_CYCLE };

export default class NotionTogglePlugin extends Plugin {
  settings: NotionToggleSettings = DEFAULT_SETTINGS;

  /* v1.0.5 timer state */
  timerState: PomodoroState = createState(DEFAULT_SETTINGS);
  timerWidget: TimerWidget | null = null;
  statusEl: HTMLElement | null = null;
  lastTick = Date.now();
  /* v1.0.6 attention tracking */
  lastActivityAt = Date.now();
  sessionNotePath: string | null = null;
  /* v1.0.7 review state */
  reviewOpen = false;
  reviewSuggestion: Grade = "good";
  /* v1.0.9 auto-scroll state */
  scrollBar: ScrollBar | null = null;
  scrollRunning = false;
  scrollPlan: ToggleStop[] = [];
  /** v1.1.7 — true while a one-shot "view still rendering" retry is pending. */
  scrollRetryPending = false;
  scrollAt = -1;
  scrollHoldUntil = 0;
  scrollLastFrame = 0;
  scrollRaf: number | null = null;
  scrollContainer: HTMLElement | null = null;
  /* v1.1.1 pause-at / memory state */
  scrollOpenedAt = 0;
  scrollSeen: Set<number> = new Set();
  scrollNotePath: string | null = null;
  scrollTotalItems = 0;
  /* v1.1.2 reader-exact loop state (mirrors useAutoScroll refs) */
  /** Authoritative float scroll position — scrollTop snaps to whole pixels. */
  scrollPos = 0;
  /** +1 = down, -1 = up. Route mode owns this per leg. */
  scrollDir = 1;
  scrollRouteIdx = 0;
  scrollRouteStop = 0;
  scrollDwellUntil = 0;
  scrollDwellKey: string | null = null;
  scrollDwellDir = 1;
  /** v1.4.2 — pixels travelled this run; an edge only ends a run that moved. */
  scrollMovedPx = 0;
  scrollBoxes: PageBox[] = [];
  scrollBoxesAt = 0;
  /** v1.2.1 — last time we tried to re-find a scrollable container. */
  scrollRelocateAt = 0;
  /** v1.2.1 — the quick-controls sheet is open (FAB stays pinned). */
  scrollSheetOpen = false;

  scrollElByOrdinal: Map<number, HTMLElement> = new Map();
  scrollTargets: DwellTarget[] = [];
  scrollTargetsKey = "";
  scrollOpenEl: HTMLElement | null = null;
  scrollVisit: { ordinal: number; at: number } | null = null;
  /** v1.1.3 debug overlay + the last loop events it reports. */
  scrollDebugOverlay: ScrollDebugOverlay | null = null;
  scrollLastEvent = "";
  scrollLastGrade = "";
  scrollSmoothEl: HTMLElement | null = null;
  scrollPrevTransform: string | null = null;
  scrollPrevBehavior: string | null = null;
  /** v1.1.5 floating launch button (tap = start, hold = sheet). */
  scrollFabBtn: ScrollFab | null = null;
  /** v1.1.8 hold-anywhere-to-pause. */
  holdPause: HoldPause | null = null;
  scrollHoldPaused = false;
  private scrollHoldAt = 0;

  /* v1.1.0 quiz mode state */
  /** v1.3.3 — lightweight perf telemetry (quiz paint cadence, re-measure latency). */
  readonly perf = new Telemetry();

  /** v1.4.7 — stops already visited on this leg (skip guard, per stop). */
  scrollVisited = new Set<string>();

  quizBar: QuizBar | null = null;
  /** v1.4.2 — one inline countdown badge per question of the run. */
  quizBoard: QuizBoard | null = null;
  quizState: QuizState | null = null;
  quizStops: (ToggleStop & { el?: HTMLElement })[] = [];
  quizTitles: string[] = [];
  quizContainer: HTMLElement | null = null;
  quizLastFrame = 0;
  quizInterval: number | null = null;
  /** v1.1.9: one-shot re-scan guard when the view is still rendering. */
  quizRetryPending = false;
  /** v1.3.0 — pre-quiz state of every toggle, restored on stop. */
  quizSnapshot: ToggleSnapshot[] = [];

  /**
   * v1.0.7: every command goes through here, so the toolbar list stays short.
   * Four primary commands keep clean names; the rest get an "Advanced: " prefix.
   */
  addCommand(cmd: Parameters<Plugin["addCommand"]>[0]) {
    return super.addCommand({
      ...cmd,
      name: commandName(cmd.id, cmd.name, this.settings.minimalNames),
    });
  }

  async onload() {

    await this.loadSettings();

    /* ---------- v1.0.7: four primary, context-aware commands ---------- */

    // Primary 1: one button that adds whatever fits the cursor.
    this.addCommand({
      id: "smart-toggle",
      icon: "plus-circle",
      name: "Toggle (smart add)",
      editorCallback: (editor) => this.runSmartToggle(editor),
    });

    // Primary 2: traffic-light grading of the toggle under the cursor.
    this.addCommand({
      id: "smart-colour",
      icon: "traffic-cone",
      name: "Colour (red → yellow → green)",
      editorCallback: (editor) => this.cycleColorAtCursor(editor),
    });

    // Primary 3: start / pause / resume the recall session.
    this.addCommand({
      id: "smart-recall",
      icon: "timer",
      name: "Recall (start / pause session)",
      editorCallback: (editor) => this.runSmartRecall(editor),
    });

    // Primary 4: SM-2 review of the current note.
    this.addCommand({
      id: "smart-review",
      icon: "check-circle",
      name: "Review (spaced repetition)",
      editorCallback: (editor) => this.openReview(editor),
    });

    // Command 1: Insert an empty foldable toggle at cursor

    this.addCommand({
      id: "insert-toggle",
      icon: "right-triangle",
      name: "Insert toggle (empty)",
      editorCallback: (editor) => {
        const fold = this.settings.defaultCollapsed ? "-" : "+";
        const type = this.activeCallout();
        const cursor = editor.getCursor();
        // Insert a two-line callout; place cursor on the title line
        editor.replaceRange(`> [!${type}]${fold} \n> \n`, cursor);
        // Move cursor to end of the title line (after the space)
        editor.setCursor({ line: cursor.line, ch: cursor.ch + `> [!${type}]${fold} `.length });
      },
    });

    // Command 2: Wrap current selection (or current line) as a toggle
    this.addCommand({
      id: "wrap-selection-toggle",
      icon: "text-quote",
      name: "Wrap selection as toggle",
      editorCallback: (editor) => this.wrapSelectionAsToggle(editor),
    });

    // Command 3: Convert <details> blocks in the current file to foldable callouts
    this.addCommand({
      id: "convert-details-to-callouts",
      icon: "list-tree",
      name: "Convert <details> blocks to callouts",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertDetailsToCallouts(doc, this.activeCallout(), this.settings.defaultCollapsed, this.settings.boldSummary);
        if (converted === doc) {
          new Notice("No <details> blocks found in this file.");
          return;
        }
        editor.setValue(converted);
        new Notice("Converted all <details> blocks to callout toggles.");
      },
    });

    // Command 4: Reverse — callout toggles back to <details>
    this.addCommand({
      id: "convert-callouts-to-details",
      icon: "code",
      name: "Convert callouts to <details> blocks",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertCalloutsToDetails(doc);
        if (converted === doc) {
          new Notice("No foldable callout toggles found in this file.");
          return;
        }
        editor.setValue(converted);
        new Notice("Converted callout toggles to <details> blocks.");
      },
    });

    // Command 5: Quick Q&A toggle via modal (type question + answer in a box)
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
            new Notice("Question is empty — nothing inserted.");
            return;
          }
          const title = this.maybeBold(q);
          const body = a.length > 0
            ? "\n" + a.split("\n").map((l: string) => `> ${l}`.replace(/>\s+$/, ">")).join("\n")
            : "";
          editor.replaceRange(`> [!${type}]${fold} ${title}${body}\n`, editor.getCursor());
        }).open();
      },
    });

    // Command 6: New toggle below (one tap — great for the mobile toolbar)
    this.addCommand({
      id: "new-toggle-below",
      icon: "right-triangle",
      name: "New toggle below",
      editorCallback: (editor) => this.insertNewToggleBelow(editor),
    });

    // Command 7: Turn Enter auto-continue on/off
    this.addCommand({
      id: "toggle-auto-continue",
      icon: "corner-down-left",
      name: "Toggle auto-continue on Enter",
      callback: async () => {
        this.settings.autoContinue = !this.settings.autoContinue;
        await this.saveSettings();
        new Notice(`Auto-continue on Enter: ${this.settings.autoContinue ? "ON" : "OFF"}`);
      },
    });

    // Command 8: Numbered toggle (numbering continues automatically)
    this.addCommand({
      id: "insert-numbered-toggle",
      icon: "list-ordered",
      name: "Insert numbered toggle",
      editorCallback: (editor) => this.insertNewToggleBelow(editor, true),
    });

    // Command 9: Renumber every numbered toggle in the note (1..N)
    this.addCommand({
      id: "renumber-toggles",
      icon: "list-ordered",
      name: "Renumber toggles in note",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const fixed = renumberToggles(doc);
        if (fixed === doc) {
          new Notice("Numbering already correct (or no numbered toggles).");
          return;
        }
        const cursor = editor.getCursor();
        editor.setValue(fixed);
        editor.setCursor(cursor);
        new Notice("Toggles renumbered.");
      },
    });

    // Command 10: Set the colour of the toggle at the cursor
    this.addCommand({
      id: "set-toggle-color",
      icon: "palette",
      name: "Set toggle colour",
      editorCallback: (editor) => {
        new ColorPickerModal(this.app, (colorId) => {
          const callout = calloutForColor(colorId, this.settings.calloutType);
          if (!this.recolorToggleAtCursor(editor, callout)) {
            new Notice("Cursor is not inside a toggle.");
          }
        }).open();
      },
    });

    // Command 11: Cycle red → yellow → green (active-recall grading)
    this.addCommand({
      id: "cycle-toggle-color",
      icon: "traffic-cone",
      name: "Cycle toggle colour (red → yellow → green)",
      editorCallback: (editor) => this.cycleColorAtCursor(editor),

    });

    // Command 12: Turn auto-numbering on/off
    this.addCommand({
      id: "toggle-auto-numbering",
      icon: "list-ordered",
      name: "Toggle auto-numbering",
      callback: async () => {
        this.settings.numberedByDefault = !this.settings.numberedByDefault;
        await this.saveSettings();
        new Notice(`Auto-numbering: ${this.settings.numberedByDefault ? "ON" : "OFF"}`);
      },
    });

    // Command 13: MCQ toggle — question toggle with checkbox options
    this.addCommand({
      id: "insert-mcq-toggle",
      icon: "list-checks",
      name: "Insert MCQ toggle (checkbox options)",
      editorCallback: (editor) => this.insertQuestionBlock(editor, "mcq"),
    });

    // Command 14: Add one more checkbox option to the MCQ at the cursor
    this.addCommand({
      id: "add-mcq-option",
      icon: "plus-circle",
      name: "Add MCQ option",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        if (!/^>/.test(line)) {
          new Notice("Cursor is not inside a toggle.");
          return;
        }
        editor.replaceRange(`\n> - [ ] `, { line: cursor.line, ch: line.length });
        editor.setCursor({ line: cursor.line + 1, ch: 8 });
      },
    });

    // Command 14b: Tick / untick the checkbox option at the cursor
    this.addCommand({
      id: "toggle-option-checkbox",
      icon: "check-square",
      name: "Toggle option checkbox",
      editorCallback: (editor) => {
        const cursor = editor.getCursor();
        const line = editor.getLine(cursor.line);
        const next = toggleOptionCheckbox(line);
        if (next === line) {
          new Notice("Cursor is not on a checkbox option.");
          return;
        }
        editor.setLine(cursor.line, next);
        editor.setCursor(cursor);
      },
    });

    // Command 15: Match the following toggle
    this.addCommand({
      id: "insert-match-toggle",
      icon: "table",
      name: "Insert Match the following toggle",
      editorCallback: (editor) => this.insertQuestionBlock(editor, "match"),
    });

    // Command 16: Add the answer-key line to the toggle at the cursor
    this.addCommand({
      id: "insert-match-answer-row",
      icon: "key",
      name: "Insert answer key line",
      editorCallback: (editor) => {
        const found = this.findHeaderLine(editor);
        if (!found) {
          new Notice("Cursor is not inside a toggle.");
          return;
        }
        let last = found.line;
        for (let l = found.line + 1; l < editor.lineCount(); l++) {
          if (!/^>/.test(editor.getLine(l))) break;
          if (ANSWER_LINE.test(editor.getLine(l))) {
            new Notice("This toggle already has an answer line.");
            return;
          }
          last = l;
        }
        editor.replaceRange(`\n> \n> **Answer:** `, {
          line: last,
          ch: editor.getLine(last).length,
        });
        editor.setCursor({ line: last + 2, ch: 14 });
      },
    });

    /* ---------- v1.0.5: floating recall timer (Pomodoro) ---------- */

    this.timerState = createState(this.settings);
    this.statusEl = this.addStatusBarItem();
    this.statusEl.addClass("notion-toggle-status");
    this.statusEl.setText(sessionSummary(this.timerState));

    this.addRibbonIcon("timer", "Recall timer", () => this.toggleTimer());

    this.addCommand({
      id: "toggle-recall-timer",
      icon: "timer",
      name: "Timer: show / hide",
      callback: () => this.toggleTimer(),
    });

    this.addCommand({
      id: "recall-timer-start-pause",
      icon: "play",
      name: "Timer: start / pause",
      callback: () => {
        this.showTimer();
        const running = !this.timerState.running;
        this.timerState = { ...this.timerState, running, autoPaused: false };
        if (running && !this.sessionNotePath) this.sessionNotePath = this.activeNotePath();
        this.lastTick = Date.now();
        this.lastActivityAt = Date.now();
        this.renderTimer();
      },
    });

    this.addCommand({
      id: "recall-timer-reset",
      icon: "rotate-ccw",
      name: "Timer: reset phase",
      callback: () => {
        this.timerState = resetPhase(this.timerState, this.settings);
        this.renderTimer();
      },
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
      },
    });

    this.addCommand({
      id: "recall-session-this-note",
      icon: "brain",
      name: "Timer: start recall session on this note",
      editorCallback: (editor) => this.startRecallSession(editor),
    });

    this.addCommand({
      id: "recall-timer-stop",
      icon: "square",
      name: "Timer: stop session",
      callback: () => this.stopTimerSession(),
    });

    // Primary 5: auto-scroll revision — scrolls the note and opens toggles for you.
    this.addCommand({
      id: "smart-autoscroll",
      icon: "chevrons-down",
      name: `Autoscroll (start / pause revision) — ${hotkeyLabel("smart-autoscroll")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "S" }],
      callback: () => this.toggleAutoScroll(),
    });

    this.addCommand({
      id: "autoscroll-reverse",
      icon: "chevrons-up",
      name: `Autoscroll: reverse direction — ${hotkeyLabel("autoscroll-reverse")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "R" }],
      callback: () => this.setScrollReverse(!this.settings.scrollReverse),
    });

    this.addCommand({
      id: "autoscroll-filter",
      icon: "filter",
      name: "Autoscroll: choose colour filter",
      callback: () => new ScrollFilterModal(this.app, this).open(),
    });

    this.addCommand({
      id: "autoscroll-faster",
      icon: "gauge",
      name: "Autoscroll: faster",
      callback: () => {
        if (!this.requireScrollRunning()) return;
        this.nudgeScrollSpeed(SPEED_STEP);
      },
    });

    this.addCommand({
      id: "autoscroll-slower",
      icon: "gauge",
      name: "Autoscroll: slower",
      callback: () => {
        if (!this.requireScrollRunning()) return;
        this.nudgeScrollSpeed(-SPEED_STEP);
      },
    });

    this.addCommand({
      id: "autoscroll-stop",
      icon: "square",
      name: "Autoscroll: stop",
      callback: () => {
        if (!this.requireScrollRunning()) return;
        this.stopAutoScroll(true);
      },
    });

    /* ---------- v1.1.5: floating button, sheet, toolbar guide ---------- */

    this.addCommand({
      id: "autoscroll-sheet",
      icon: "sliders-horizontal",
      name: `Autoscroll: sheet (all controls) — ${hotkeyLabel("autoscroll-sheet")}`,
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "A" }],
      callback: () => new ScrollSheetModal(this.app, this).open(),
    });

    this.addCommand({
      id: "autoscroll-toolbar-guide",
      icon: "smartphone",
      name: "Autoscroll: mobile toolbar guide",
      callback: () => new MobileToolbarGuideModal(this.app, this).open(),
    });

    /* ---------- v1.1.1: pause-at modes, dwell, speed presets, memory ---------- */

    this.addCommand({
      id: "autoscroll-mode",
      icon: "list-filter",
      name: "Autoscroll: pause at (odd / even / custom / route / shuffle)",
      callback: () => new ScrollModeModal(this.app, this).open(),
    });

    this.addCommand({
      id: "autoscroll-dwell",
      icon: "timer",
      name: "Autoscroll: pause for (hold time)",
      callback: () => new ScrollDwellModal(this.app, this).open(),
    });

    this.addCommand({
      id: "autoscroll-speed-presets",
      icon: "gauge",
      name: "Autoscroll: speed presets (0.02x … 20x)",
      callback: () => new ScrollSpeedModal(this.app, this).open(),
    });

    this.addCommand({
      id: "autoscroll-top",
      icon: "arrow-up-to-line",
      name: "Autoscroll: go to first toggle",
      callback: () => this.scrollToStart(),
    });

    this.addCommand({
      id: "autoscroll-shuffle",
      icon: "shuffle",
      name: "Autoscroll: smart shuffle (weakest toggles first)",
      callback: () => void this.rebuildShuffleRoute(),
    });

    this.addCommand({
      id: "autoscroll-reset-memory",
      icon: "eraser",
      name: "Autoscroll: reset revision memory for this note",
      callback: () => void this.resetScrollMemory(),
    });

    /* ---------- v1.1.0: quiz mode (timed question run) ---------- */

    // Primary 6: timed run through the toggles — question timer, auto reveal,
    // auto close, auto next (Telegram-quiz style).
    // v1.1.3: explain the shuffle order from the FSRS history.
    this.addCommand({
      id: "scroll-stats",
      icon: "bar-chart-3",
      name: "Autoscroll: revision stats (weak toggles)",
      callback: () => new ScrollStatsModal(this.app, this).open(),
    });

    this.addCommand({
      id: "smart-quiz",
      icon: "list-checks",
      name: "Quiz (timed question run)",
      callback: () => this.toggleQuiz(),
    });

    this.addCommand({
      id: "quiz-pause",
      icon: "pause",
      name: "Quiz: pause / resume",
      callback: () => this.toggleQuizPause(),
    });

    // v1.4.3 — one-tap answer control, usable from the mobile toolbar too.
    this.addCommand({
      id: "answers-open-all",
      icon: "unfold-vertical",
      name: "Answers: open all toggles",
      callback: () => this.setAllAnswersOpen(true),
    });

    this.addCommand({
      id: "answers-close-all",
      icon: "fold-vertical",
      name: "Answers: close all toggles",
      callback: () => this.setAllAnswersOpen(false),
    });

    this.addCommand({
      id: "quiz-reveal-now",
      icon: "eye",
      name: "Quiz: reveal the answer now",
      callback: () => this.quizRevealNow(),
    });

    this.addCommand({
      id: "quiz-next",
      icon: "skip-forward",
      name: "Quiz: next question",
      callback: () => this.quizNext(),
    });

    this.addCommand({
      id: "quiz-stop",
      icon: "square",
      name: "Quiz: stop",
      callback: () => this.stopQuiz(true),
    });

    this.addCommand({
      id: "quiz-filter",
      icon: "filter",
      name: "Quiz: choose colour filter",
      callback: () => new QuizFilterModal(this.app, this).open(),
    });

    this.addCommand({
      id: "quiz-seconds",
      icon: "timer-reset",
      name: "Quiz: set time per question",
      callback: () => new QuizSecondsModal(this.app, this).open(),
    });

    this.addCommand({
      id: "perf-report",
      icon: "activity",
      name: "Performance report (quiz timer + re-measure)",
      // v1.4.0 — copies to clipboard and optionally appends to perf-log.md.
      callback: () => void exportPerfReport(this),
    });

    this.addCommand({
      id: "quiz-perf-report",
      icon: "gauge",
      name: "Quiz: performance report (timers, freezes, render)",
      callback: () => openPerfReport(this),
    });

    this.addCommand({
      id: "show-due-notes",
      icon: "calendar-clock",
      name: "Show notes due for recall",
      callback: () => this.showDueNotes(),
    });

    // 250 ms tick, registered so Obsidian clears it on unload.
    this.lastTick = Date.now();
    this.registerInterval(
      window.setInterval(() => this.onTimerTick(), 250) as unknown as number
    );

    /* ---------- v1.0.6: attention-aware auto-pause ---------- */
    const bumpActivity = () => {
      this.lastActivityAt = Date.now();
    };
    for (const evt of ["keydown", "pointerdown", "touchstart", "wheel"] as const) {
      this.registerDomEvent(document, evt, bumpActivity, { passive: true });
    }
    // v1.4.7 — rotation changes the viewport height, so every anchored stop moves.
    for (const evt of ["resize", "orientationchange"] as const) {
      this.registerDomEvent(window, evt, () => this.reanchorAfterResize());
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

    /* ---------- v1.0.8: keep the recall schedule in sync with the vault ---------- */
    this.registerEvent(
      this.app.vault.on("rename", async (file, oldPath) => {
        const { store, moved } = renameCardKey(this.settings.srs ?? {}, oldPath, file.path);
        if (!moved) return;
        this.settings.srs = store;
        await this.saveSettings();
        this.renderTimer();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", async (file) => {
        const { store, removed } = removeCardKey(this.settings.srs ?? {}, file.path);
        if (!removed) return;
        this.settings.srs = store;
        await this.saveSettings();
        this.renderTimer();
      })
    );
    // Drop cards whose note vanished (deleted outside Obsidian, or pre-v1.0.8).
    void this.pruneSchedule(true);

    if (this.settings.showOnStartup) this.showTimer();

    /* ---------- v1.1.5: floating autoscroll button follows the active note ---------- */
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.syncScrollFab())
    );
    this.registerEvent(this.app.workspace.on("file-open", () => this.syncScrollFab()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.syncScrollFab()));
    this.app.workspace.onLayoutReady(() => this.syncScrollFab());
    // v1.2.4 — Settings / any modal opens without a workspace event, so watch
    // the DOM for overlay layers and re-evaluate visibility.
    const overlayObserver = new MutationObserver(() => this.syncScrollFab());
    overlayObserver.observe(document.body, { childList: true });
    this.register(() => overlayObserver.disconnect());

    /* ---------- v1.3.0: deep links ----------
       obsidian://notion-toggle?action=quiz&file=Bio/Alleles.md&filter=red&seconds=30 */
    this.registerObsidianProtocolHandler("notion-toggle", async (params) => {
      const link = parseDeepLink(params as Record<string, string | undefined>);
      if (!link) {
        new Notice("Unknown notion-toggle link (use action=quiz | autoscroll | stop).");
        return;
      }
      if (link.action === "stop") {
        this.stopQuiz(false);
        if (this.scrollRunning) this.stopAutoScroll(false);
        return;
      }
      if (link.file) {
        await this.app.workspace.openLinkText(link.file, "", false);
        await new Promise((r) => window.setTimeout(r, 350));
      }
      if (link.filter) {
        if (link.action === "quiz") await this.setQuizFilter(link.filter);
        else await this.setScrollFilter(link.filter);
      }
      if (link.seconds) {
        this.settings.quizSeconds = clampQuizSeconds(link.seconds);
        await this.saveSettings();
      }
      if (link.speed) {
        this.settings.scrollSpeed = link.speed;
        await this.saveSettings();
      }
      if (link.action === "quiz") this.startQuizRun();
      else this.startAutoScroll();
    });

    // Enter / Backspace handling: continue, create or unwrap toggles
    this.registerEditorExtension(
      Prec.highest(
        keymap.of([
          {
            key: "Enter",
            run: (view) => {
              if (!this.settings.autoContinue) return false;
              return this.handleEnter(view);
            },
          },
          {
            key: "Backspace",
            run: (view) => {
              if (!this.settings.autoContinue) return false;
              return this.handleBackspace(view);
            },
          },
        ])
      )
    );

    this.addSettingTab(new NotionToggleSettingTab(this.app, this));
  }

  /** Callout type actually used, honouring the colour setting. */
  activeCallout(): string {
    return calloutForColor(this.settings.color, this.settings.calloutType);
  }

  /** Build a fresh toggle header string (no trailing newline). */
  toggleHeader(title = ""): string {
    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const inner = this.settings.boldSummary ? `<b>${title}</b>` : title;
      return `<details${openAttr}>\n<summary>${inner}</summary>\n\n`;
    }
    const fold = this.settings.defaultCollapsed ? "-" : "+";
    return `> [!${this.activeCallout()}]${fold} ${title}`;
  }

  /** Find the toggle header line at/above the cursor (callout or <summary>). */
  findHeaderLine(editor: Editor): { line: number; text: string } | null {
    const cursor = editor.getCursor();
    for (let l = cursor.line; l >= 0 && l >= cursor.line - 40; l--) {
      const text = editor.getLine(l);
      if (/^>\s*\[![^\]]+\][+-]/.test(text)) return { line: l, text };
      if (!/^>/.test(text) && l !== cursor.line) break;
    }
    return null;
  }

  /** Swap the callout type (colour) of the toggle at the cursor. */
  recolorToggleAtCursor(editor: Editor, callout: string): boolean {
    const found = this.findHeaderLine(editor);
    if (!found) return false;
    const updated = recolorHeaderLine(found.text, callout);
    editor.setLine(found.line, updated);
    return true;
  }

  /** Insert an empty toggle on the line below the cursor and place the caret in its summary. */
  insertNewToggleBelow(editor: Editor, forceNumbered = false) {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const prefix = currentLine.trim().length === 0 ? "" : "\n";
    const numbered = forceNumbered || this.settings.numberedByDefault;

    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const openTag = `<details${openAttr}>`;
      const summaryOpen = this.settings.boldSummary ? "<summary><b>" : "<summary>";
      const summaryClose = this.settings.boldSummary ? "</b></summary>" : "</summary>";
      const num = numbered ? `${this.nextNumberAt(editor, cursor.line)}. ` : "";
      const block = `${prefix}${openTag}\n${summaryOpen}${num}${summaryClose}\n\n\n</details>\n`;
      editor.replaceRange(block, { line: cursor.line, ch: currentLine.length });
      const summaryLine = cursor.line + (prefix ? 2 : 1);
      editor.setCursor({ line: summaryLine, ch: summaryOpen.length + num.length });
      return;
    }

    const header = this.toggleHeader("");
    const num = numbered ? `${this.nextNumberAt(editor, cursor.line)}. ` : "";
    const bold = this.settings.boldSummary ? "**" : "";
    const block = `${prefix}${header}${bold}${num}${bold}\n> \n`;
    editor.replaceRange(block, { line: cursor.line, ch: currentLine.length });
    const headerLine = cursor.line + (prefix ? 1 : 0);
    editor.setCursor({
      line: headerLine,
      ch: header.length + bold.length + num.length,
    });
  }

  /** Next auto-number, based on the last numbered toggle above `line`. */
  nextNumberAt(editor: Editor, line: number): number {
    const above: string[] = [];
    for (let l = 0; l <= line; l++) above.push(editor.getLine(l));
    return nextToggleNumber(above);
  }

  /** Insert an MCQ or "Match the following" skeleton below the cursor. */
  insertQuestionBlock(editor: Editor, kind: "mcq" | "match") {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const prefix = currentLine.trim().length === 0 ? "" : "\n";
    const numbered = this.settings.numberedByDefault;
    const opts: QuestionBlockOptions = {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format,
      numbered,
      number: numbered ? this.nextNumberAt(editor, cursor.line) : undefined,
      addAnswerLine: this.settings.addAnswerLine,
      count: kind === "mcq" ? this.settings.mcqOptionCount : this.settings.matchRowCount,
    };
    const built = kind === "mcq" ? buildMcqBlock(opts) : buildMatchBlock(opts);
    editor.replaceRange(`${prefix}${built.text}`, { line: cursor.line, ch: currentLine.length });

    const startLine = cursor.line + (prefix ? 1 : 0);
    const headLines = built.text.slice(0, built.cursorOffset).split("\n");
    editor.setCursor({
      line: startLine + headLines.length - 1,
      ch: headLines[headLines.length - 1].length,
    });
  }

  /**
   * Enter inside a toggle:
   *  - callout body line with content  -> new "> " body line
   *  - empty "> " body line            -> start the NEXT toggle
   *  - line after </details>           -> start the next <details> skeleton
   * Returns true when handled (default Enter suppressed).
   */
  handleEnter(view: { state: any; dispatch: (tr: any) => void }): boolean {
    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty) return false;

    const line = state.doc.lineAt(sel.head);
    const text: string = line.text;
    const atLineEnd = sel.head === line.to;

    // Mid-line Enter inside a callout: don't split the block — push the rest
    // of the text onto a fresh "> " answer line (Notion-like behaviour).
    if (!atLineEnd) {
      if (this.settings.format === "callout" && /^>/.test(text)) {
        // Mid-line Enter on a checkbox option keeps the checkbox scaffolding.
        const prefix = MCQ_OPTION.test(text) || MCQ_EMPTY_OPTION.test(text) ? "\n> - [ ] " : "\n> ";
        view.dispatch({
          changes: { from: sel.head, to: sel.head, insert: prefix },
          selection: { anchor: sel.head + prefix.length },
          scrollIntoView: true,
          userEvent: "input",
        });
        return true;
      }
      return false;
    }

    // Auto-numbering: continue the sequence when the setting is on OR when the
    // toggles above are already numbered (so numbering never has to be typed).
    const linesAbove: string[] = [];
    for (let n = 1; n <= line.number; n++) linesAbove.push(state.doc.line(n).text);
    const hasNumbered = linesAbove.some((l) => NUMBERED_HEADER.test(l));
    const numbered = this.settings.numberedByDefault || hasNumbered;

    const plan = planEnter(text, {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format,
      numbered,
      nextNumber: numbered ? nextToggleNumber(linesAbove) : undefined,
      addAnswerLine: this.settings.addAnswerLine,
    });
    if (!plan) return false;

    view.dispatch({
      changes: { from: plan.from === "lineStart" ? line.from : sel.head, to: line.to, insert: plan.insert },
      selection: { anchor: (plan.from === "lineStart" ? line.from : sel.head) + plan.cursorOffset },
      scrollIntoView: true,
      userEvent: "input",
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
  handleBackspace(view: { state: any; dispatch: (tr: any) => void }): boolean {
    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty) return false;

    const line = state.doc.lineAt(sel.head);
    const plan = planBackspace(line.text, sel.head - line.from, {
      calloutType: this.activeCallout(),
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format,
    });
    if (!plan) return false;

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: plan.insert },
      selection: { anchor: line.from + plan.cursorOffset },
      scrollIntoView: true,
      userEvent: "delete.backward",
    });
    return true;
  }

  private maybeBold(text: string): string {
    if (!this.settings.boldSummary) return text;
    // Don't double-bold already-bold text
    if (text.startsWith("**") && text.endsWith("**")) return text;
    return `**${text}**`;
  }

  /* ---------- v1.0.7: smart commands + SM-2 review ---------- */

  /** Wrap the selection (or current line) in a toggle. */
  wrapSelectionAsToggle(editor: Editor) {
    const selection = editor.getSelection();
    const type = this.activeCallout();
    const fold = this.settings.defaultCollapsed ? "-" : "+";

    if (selection.trim().length === 0) {
      const line = editor.getLine(editor.getCursor().line);
      if (line.trim().length === 0) {
        new Notice("Nothing to wrap — select the question and answer first.");
        return;
      }
      const title = this.maybeBold(line.trim());
      editor.replaceRange(
        `> [!${type}]${fold} ${title}\n> \n`,
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
      new Notice("Selection is empty.");
      return;
    }
    const title = this.maybeBold(titleLine);
    const bodyLines = lines.slice(bodyStart);
    while (bodyLines.length > 0 && bodyLines[0].trim().length === 0) bodyLines.shift();
    const body =
      bodyLines.length > 0
        ? "\n" + bodyLines.map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n")
        : "";
    editor.replaceSelection(`> [!${type}]${fold} ${title}${body}\n`);
  }

  /** Cycle the toggle at the cursor through red → yellow → green. */
  cycleColorAtCursor(editor: Editor) {
    const found = this.findHeaderLine(editor);
    if (!found) {
      new Notice("Cursor is not inside a toggle.");
      return;
    }
    const next = nextTrafficColor(calloutTypeOfLine(found.text));
    this.recolorToggleAtCursor(editor, next);
  }

  /** One button, five outcomes — decided by the cursor context. */
  runSmartToggle(editor: Editor) {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const action = smartAction({
      selection: editor.getSelection(),
      line,
      insideToggle: !!this.findHeaderLine(editor),
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
        editor.replaceRange(`\n${row}`, { line: cursor.line, ch: line.length });
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
    if (action !== "new-toggle") new Notice(smartActionLabel(action));
  }

  /** Start, pause or resume the recall session with a single command. */
  runSmartRecall(editor: Editor) {
    if (!this.timerWidget || !this.sessionNotePath) {
      this.startRecallSession(editor);
      return;
    }
    if (this.timerState.running) {
      this.timerState = { ...this.timerState, running: false, autoPaused: false };
      new Notice("⌛ Paused");
    } else {
      this.timerState = { ...this.timerState, running: true, autoPaused: false };
      this.lastTick = Date.now();
      this.lastActivityAt = Date.now();
      new Notice("⌛ Running");
    }
    this.renderTimer();
  }

  /** Collapse all answers, show the timer and start a focus phase on this note. */
  startRecallSession(editor: Editor) {
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
      running: true,
    };
    this.lastTick = Date.now();
    this.lastActivityAt = Date.now();
    this.renderTimer();
    new Notice(
      `Recall session started — ${stats.total} toggles (🔴 ${stats.red} · 🟡 ${stats.yellow} · 🟢 ${stats.green})`
    );
  }

  /** The SM-2 card for a note path. */
  cardFor(path: string | null): SrsCard | undefined {
    if (!path) return undefined;
    return this.settings.srs?.[path];
  }

  /** Show the grading row (Again / Hard / Good / Easy) for the current note. */
  openReview(editor?: Editor) {
    this.showTimer();
    const doc = editor?.getValue() ?? "";
    const stats = doc ? scanRecallStats(doc) : { total: 0, red: 0, yellow: 0, green: 0, firstRedLine: -1 };
    this.reviewSuggestion = suggestGrade(stats);
    this.reviewOpen = true;
    this.renderTimer();
  }

  /** Apply a grade to the active note and store the next due date. */
  async applyGrade(grade: Grade) {
    const path = this.sessionNotePath ?? this.activeNotePath();
    if (!path) {
      new Notice("Open a note first to schedule its recall.");
      return;
    }
    const card = gradeCard(this.cardFor(path) ?? newCard(), grade, Date.now());
    this.settings.srs = { ...(this.settings.srs ?? {}), [path]: card };
    await this.saveSettings();
    this.reviewOpen = false;
    this.renderTimer();
    this.updateStatus();
    new Notice(`${GRADE_LABEL[grade]} → ${nextDueLabel(card, Date.now())} · ease ${card.ease}`);
  }

  /** List the notes whose recall is due, newest schedule first. */
  showDueNotes() {
    const due = dueNotes(this.settings.srs ?? {}, Date.now());
    if (!due.length) {
      new Notice("Nothing due — everything is scheduled ahead.");
      return;
    }
    const rows = due.map((path) => ({ path, card: this.settings.srs[path] }));
    new DueNotesModal(this.app, rows, (path) => {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) void this.app.workspace.openLinkText(path, "", false);
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
    if (this.timerWidget) return;
    this.timerWidget = new TimerWidget(
      {
        onToggleRun: () => {
          const running = !this.timerState.running;
          this.timerState = { ...this.timerState, running, autoPaused: false };
          if (running && !this.sessionNotePath) this.sessionNotePath = this.activeNotePath();
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
        onGrade: (grade) => void this.applyGrade(grade as Grade),
        onMove: (x, y) => {
          this.settings.timerX = x;
          this.settings.timerY = y;
          void this.saveSettings();
        },
        onCompactChange: (compact) => {
          this.settings.compactByDefault = compact;
          void this.saveSettings();
        },
      },
      { x: this.settings.timerX, y: this.settings.timerY, compact: this.settings.compactByDefault }
    );
    this.renderTimer();
  }

  hideTimer() {
    this.timerWidget?.destroy();
    this.timerWidget = null;
  }

  /** Stop the session completely: paused fresh focus phase + summary. */
  stopTimerSession() {
    const summary = stopSummary(this.timerState);
    this.timerState = stopSession(this.timerState, this.settings);
    this.sessionNotePath = null;
    this.renderTimer();
    this.updateStatus();
    new Notice(summary);
  }

  private activeNotePath(): string | null {
    return this.app.workspace.activeEditor?.file?.path ?? null;
  }

  /** Auto-pause / auto-resume based on visibility and the session note. */
  private evaluateAttention() {
    const reason = shouldAutoPause({
      state: this.timerState,
      enabled: this.settings.autoPauseOnLeave,
      visible: document.visibilityState !== "hidden" && document.hasFocus(),
      onSessionNote: !this.sessionNotePath || this.activeNotePath() === this.sessionNotePath,
      pinned: this.settings.pinToSessionNote,
    });

    if (reason) {
      this.timerState = pauseForInactivity(this.timerState);
      this.renderTimer();
      if (this.settings.notifyOnPhaseEnd) new Notice(autoPauseNotice(reason));
      return;
    }

    if (
      this.settings.autoResumeOnReturn &&
      this.timerState.autoPaused &&
      document.visibilityState !== "hidden"
    ) {
      const onNote =
        !this.sessionNotePath ||
        !this.settings.pinToSessionNote ||
        this.activeNotePath() === this.sessionNotePath;
      if (onNote) {
        this.timerState = resumeAfterAutoPause(this.timerState);
        this.lastTick = Date.now();
        this.lastActivityAt = Date.now();
        this.renderTimer();
      }
    }
  }

  /** Collapse every toggle in the active note (used on breaks / "recall again"). */
  private collapseActiveNote(notify = false) {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) return;
    const doc = editor.getValue();
    const collapsed = collapseAllToggles(doc);
    if (collapsed !== doc) {
      const cursor = editor.getCursor();
      editor.setValue(collapsed);
      editor.setCursor(cursor);
    }
    if (notify) {
      const stats = scanRecallStats(collapsed);
      new Notice(`All ${stats.total} toggles collapsed — recall again 🔴 ${stats.red}`);
    }
  }

  private onTimerTick() {
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    if (!this.timerState.running) return;

    // Idle auto-pause (focus phase only — breaks are meant to be idle).
    if (
      this.timerState.phase === "focus" &&
      isIdle(this.lastActivityAt, now, this.settings.idlePauseMinutes)
    ) {
      this.timerState = pauseForInactivity(this.timerState);
      this.renderTimer();
      if (this.settings.notifyOnPhaseEnd) new Notice(autoPauseNotice("idle"));
      return;
    }

    const result = tick(this.timerState, elapsed, this.settings);
    this.timerState = result.state;
    this.renderTimer();

    if (result.phaseEnded) {
      this.updateStatus();
      this.timerWidget?.flashPhaseEnd();
      if (this.settings.notifyOnPhaseEnd) {
        const ended = result.endedPhase === "focus" ? "Focus" : "Break";
        new Notice(`${ended} done → ${phaseLabel(this.timerState.phase)} · ${this.recallHint() ?? ""}`.trim());
      }
      if (this.settings.soundOnPhaseEnd) this.buzz();
      if (result.endedPhase === "focus" && this.settings.autoCollapseOnBreak) {
        this.collapseActiveNote();
      }
      // v1.0.7: after a focus phase, ask for one grade so SM-2 can schedule the next recall.
      if (result.endedPhase === "focus" && this.settings.autoReview) {
        const doc = this.activeDoc() ?? "";
        this.reviewSuggestion = suggestGrade(scanRecallStats(doc));
        this.reviewOpen = true;
        this.renderTimer();
      }
    }
  }

  private buzz() {
    try {
      (navigator as unknown as { vibrate?: (p: number[]) => void }).vibrate?.([80, 60, 80]);
    } catch {
      /* vibration unsupported — ignore */
    }
  }

  /** Colour stats of the active note, used for the break hint. */
  private recallHint(): string | undefined {
    const doc = this.activeDoc();
    if (!doc) return undefined;
    const stats = scanRecallStats(doc);
    if (stats.total === 0) return undefined;
    return `🔴 ${stats.red} · 🟡 ${stats.yellow} · 🟢 ${stats.green} of ${stats.total}`;
  }

  private activeDoc(): string | null {
    const editor = this.app.workspace.activeEditor?.editor;
    return editor ? editor.getValue() : null;
  }

  private jumpToFirstRed() {
    const editor = this.app.workspace.activeEditor?.editor;
    if (!editor) {
      new Notice("Open a note first.");
      return;
    }
    const stats = scanRecallStats(editor.getValue());
    if (stats.firstRedLine < 0) {
      new Notice("No 🔴 red toggles in this note — nice work.");
      return;
    }
    editor.setCursor({ line: stats.firstRedLine, ch: 0 });
    editor.scrollIntoView(
      { from: { line: stats.firstRedLine, ch: 0 }, to: { line: stats.firstRedLine, ch: 0 } },
      true
    );
  }

  renderTimer() {
    if (!this.timerWidget) return;
    const breakPhase = this.timerState.phase !== "focus";
    const recall = this.recallHint();
    const hint = this.timerState.autoPaused
      ? "Paused — tap ▶ to resume"
      : breakPhase
        ? recall
        : undefined;
    this.timerWidget.render({
      state: this.timerState,
      cycleSize: Math.max(1, Math.min(8, this.settings.sessionsBeforeLongBreak)),
      hint,
      canJumpRed: breakPhase && !!recall,
      canRecallAgain: breakPhase && !!recall,
      reviewOpen: this.reviewOpen,
      suggestedGrade: this.reviewSuggestion,
      scheduleLabel: this.scheduleLabel(),
    });
  }

  updateStatus() {
    const due = dueSummary(this.settings.srs ?? {}, Date.now());
    this.statusEl?.setText(`${sessionSummary(this.timerState)}${due ? ` · ${due}` : ""}`);
  }

  /** "Next recall: …" line for the current note, if it has been graded before. */
  scheduleLabel(): string | undefined {
    const card = this.cardFor(this.sessionNotePath ?? this.activeNotePath());
    return card ? `Next recall: ${nextDueLabel(card, Date.now())}` : undefined;
  }

  /** Re-apply durations after a settings change without losing progress. */
  refreshTimerDurations() {
    if (!this.timerState.running) {
      this.timerState = {
        ...this.timerState,
        remaining: phaseDuration(this.timerState.phase, this.settings),
      };
    }
    this.renderTimer();
  }

  onunload() {
    this.hideTimer();
    this.stopAutoScroll(false);
    this.stopQuiz(false);
    this.scrollFabBtn?.destroy();
    this.scrollFabBtn = null;
    this.holdPause?.detach();
    this.holdPause = null;
  }

  /**
   * v1.1.5 — show / hide the floating launch button.
   * Visible only when the setting is on, a note is open and the running
   * control bar is not on screen (tap = start/pause, long-press = sheet).
   */
  syncScrollFab() {
    // v1.2.4 — only float over a real markdown note, never over Settings,
    // Search, Graph, Canvas or any other modal layer.
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const overlayOpen =
      !this.scrollSheetOpen && !!document.body.querySelector(".modal-container, .modal-bg");
    const want = fabShouldShow(
      !!this.settings.scrollFab,
      !!this.app.workspace.getActiveFile(),
      !!this.scrollBar,
      !!mdView,
      overlayOpen
    );

    if (!want) {
      this.scrollFabBtn?.destroy();
      this.scrollFabBtn = null;
      return;
    }
    if (!this.scrollFabBtn) {
      this.scrollFabBtn = new ScrollFab({
        onTap: () => this.toggleAutoScroll(),
        onLongPress: () => {
          // v1.2.1 — keep the button on screen while the sheet is open.
          this.scrollSheetOpen = true;
          this.syncScrollFab();
          new ScrollSheetModal(this.app, this).open();
        },
      });
    }
    this.scrollFabBtn.setReverse(!!this.settings.scrollReverse);
    this.scrollFabBtn.setRunning(this.scrollRunning);
    // v1.1.8 — auto-hide only while it is actually scrolling; when idle or
    // paused the button stays put so start / resume is one tap away.
    this.scrollFabBtn.setPinned(!this.scrollRunning || this.scrollSheetOpen);
  }

  /**
   * v1.1.6 — guard for actions that only make sense mid-session.
   * Shows the exact command to run instead of failing silently.
   */
  requireScrollRunning(): boolean {
    if (this.scrollPlan.length > 0) return true;
    new Notice(MSG_NOT_RUNNING, 6000);
    return false;
  }

  /** v1.1.6 — settings ON/OFF switch: start or stop the session. */
  async setAutoScrollEnabled(on: boolean) {
    if (on) {
      if (this.scrollPlan.length === 0) this.startAutoScroll();
      else if (!this.scrollRunning) this.toggleAutoScroll();
    } else if (this.scrollPlan.length > 0) {
      this.stopAutoScroll(true);
    }
    this.syncScrollFab();
  }

  /** Is a session currently live (running or paused)? */
  autoScrollActive(): boolean {
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
  say(message: string, ms = 3000) {
    if (this.settings.scrollQuiet) return;
    new Notice(message, ms);
  }

  private findScrollContainer(): HTMLElement | null {
    // v1.2.1 — only an element that can actually scroll is useful: in reading
    // mode `previewMode.containerEl` is a wrapper, and writing `scrollTop` on
    // it silently does nothing (autoscroll "runs" but the page never moves).
    const scrollable = (el: Element | null | undefined): el is HTMLElement => {
      const h = el as HTMLElement | null | undefined;
      return !!h && h.scrollHeight - h.clientHeight > 2;
    };
    const visible = (el: Element | null): el is HTMLElement =>
      !!el && (el as HTMLElement).offsetParent !== null;

    const candidates: (Element | null | undefined)[] = [];
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view) {
      const root = (view.previewMode?.containerEl as HTMLElement | undefined) ?? view.contentEl;
      candidates.push(
        root?.querySelector(".markdown-preview-view"),
        view.contentEl.querySelector(".markdown-preview-view"),
        root,
        view.contentEl.querySelector(".cm-scroller"),
        view.contentEl
      );
    }
    const leaf = document.querySelector(".workspace-leaf.mod-active") ?? document;
    candidates.push(
      leaf.querySelector(".markdown-preview-view"),
      leaf.querySelector(".cm-scroller"),
      ...Array.from(document.querySelectorAll(".markdown-preview-view")),
      ...Array.from(document.querySelectorAll(".cm-scroller"))
    );

    for (const el of candidates) if (scrollable(el) && visible(el)) return el;
    for (const el of candidates) if (scrollable(el)) return el;
    for (const el of candidates) if (visible(el ?? null)) return el as HTMLElement;
    return (candidates.find(Boolean) as HTMLElement | undefined) ?? null;
  }

  /**
   * v1.1.7 — does the active note's *source* contain toggles? Used when the
   * DOM scan finds nothing: if the source has toggles the view is probably
   * still rendering (or showing a stale container), so we retry once.
   */
  private sourceHasToggles(): boolean {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const text = view?.editor?.getValue?.() ?? "";
    return /^>\s*\[![^\]]+\][+-]?/m.test(text) || /<details[\s>]/i.test(text);
  }

  /** Every rendered toggle in the active note, with its offset and colour. */
  private collectStops(container: HTMLElement, filter: RecallColor[] = []): ToggleStop[] {
    return this.perf.remeasure.measure(() => nowMs(), () => this.collectStopsNow(container, filter));
  }

  private collectStopsNow(container: HTMLElement, filter: RecallColor[] = []): ToggleStop[] {
    // v1.2.5 — apply the colour filter *while* resolving nesting, so a 🔴
    // toggle nested inside a plain !note is not swallowed by its parent.
    const nodes =
      filter.length === 0
        ? collectToggleEls(container)
        : collectToggleElsFiltered(container, (el) =>
            matchesFilter(colorOf(toggleTypeOf(el)), filter)
          );
    const base = container.getBoundingClientRect().top - container.scrollTop;
    return nodes.map((el, index) => {
      const rect = el.getBoundingClientRect();
      return {
        index,
        top: Math.max(0, Math.round(rect.top - base)),
        height: Math.round(rect.height),
        color: colorOf(toggleTypeOf(el)),
        el,
      } as ToggleStop & { el: HTMLElement; height: number };
    });
  }

  /** v1.2.0 — is this toggle currently expanded? */
  private isToggleOpen(el: HTMLElement): boolean {
    return isToggleOpenDom(el);
  }

  private setToggleOpen(el: HTMLElement, open: boolean) {
    setToggleOpenDom(el, open);
  }

  /**
   * v1.4.3 — open (or close) every answer toggle in the active note in one go.
   * Works during a quiz too: the quiz's own classes are updated so the run
   * does not fight the reader.
   */
  setAllAnswersOpen(open: boolean) {
    const container = this.findScrollContainer();
    if (!container) {
      new Notice("Open a note first.");
      return;
    }
    const stops = this.collectStops(container) as (ToggleStop & { el?: HTMLElement })[];
    let n = 0;
    for (const s of stops) {
      if (!s.el) continue;
      if (this.quizState) setQuizVisible(s.el, open);
      else this.setToggleOpen(s.el, open);
      n++;
    }
    if (!this.settings.scrollQuiet) {
      new Notice(`${open ? "Opened" : "Closed"} ${n} answer toggle${n === 1 ? "" : "s"}.`);
    }
  }

  /** Re-apply the quiz answer rule after the "keep answers open" switch flips. */
  refreshQuizAnswerVisibility() {
    if (!this.quizState) return;
    this.applyQuizVisibility(this.quizState.at, this.quizState.phase === "reveal");
  }

  /**
   * v1.1.8 — freeze the loop while a finger is held anywhere on the note.
   * `scrollRunning` stays true, so this never touches the user's own pause.
   */
  holdPauseStart() {
    if (!this.scrollRunning || this.scrollHoldPaused) return;
    this.scrollHoldPaused = true;
    this.scrollHoldAt = performance.now();
    if (this.scrollRaf !== null) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    this.scrollFabBtn?.setPinned(true);
  }

  /** Resume at exactly the same speed / direction / dwell state. */
  holdPauseEnd() {
    if (!this.scrollHoldPaused) return;
    this.scrollHoldPaused = false;
    // Shift the absolute dwell deadlines by the held time so a pause never
    // silently eats a toggle's reading time.
    const held = Math.max(0, performance.now() - this.scrollHoldAt);
    if (this.scrollDwellUntil) this.scrollDwellUntil += held;
    if (this.scrollHoldUntil) this.scrollHoldUntil += held;
    if (this.scrollOpenedAt) this.scrollOpenedAt += held;
    this.scrollHoldAt = 0;
    this.scrollLastFrame = 0;
    if (this.scrollContainer) this.scrollPos = this.scrollContainer.scrollTop;
    this.scrollFabBtn?.setPinned(!this.scrollRunning);
    if (this.scrollRunning) this.scheduleScrollFrame();
  }

  /** Attach / detach the document-level hold listener with the session. */
  syncHoldPause() {
    const want = this.scrollPlan.length > 0;
    if (want && !this.holdPause) {
      this.holdPause = new HoldPause({
        isActive: () => this.scrollRunning,
        onHold: () => this.holdPauseStart(),
        onRelease: () => this.holdPauseEnd(),
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
      new Notice(`Autoscroll paused — ${hotkeyLabel("smart-autoscroll")} se resume.`);
      return;
    }
    if (this.scrollPlan.length === 0) this.startAutoScroll();
    else {
      this.scrollRunning = true;
      this.scrollLastFrame = 0;
      this.scheduleScrollFrame();
      this.renderScrollBar();
      this.syncScrollFab();
    }
  }

  /** v1.1.1 — the current pause-at configuration. */
  modeConfig(): ModeConfig {
    return {
      mode: this.settings.scrollMode,
      picks: this.settings.scrollPicks ?? [],
      route: this.settings.scrollRoute ?? [],
      loopRoute: !!this.settings.scrollLoopRoute,
      shuffleFrom: this.settings.scrollShuffleFrom ?? 0,
      shuffleTo: this.settings.scrollShuffleTo ?? 0,
    };
  }

  /** FSRS cards for the active note. */
  scrollCards(path = this.scrollNotePath ?? this.app.workspace.getActiveFile()?.path ?? ""): FsrsCard[] {
    if (!path) return [];
    return loadDeck(this.settings.scrollMemory, path);
  }

  private async saveScrollCards(path: string, cards: FsrsCard[]) {
    this.settings.scrollMemory = saveDeck(this.settings.scrollMemory, path, cards);
    await this.saveSettings();
  }

  /**
   * v1.1.1 — build the plan: colour filter first, then the pause-at mode
   * (every / odd / even / custom / route / shuffle) and tall-toggle chunking.
   */
  private buildScrollPlan(container: HTMLElement) {
    const all = this.collectStops(container, this.settings.scrollFilter) as (ToggleStop & {
      el: HTMLElement;
      height: number;
    })[];
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
        part: ms.part,
      } as ToggleStop & { el: HTMLElement; ordinal: number; part: number };
    });
  }

  /** Rebuild the shuffle route from this note's FSRS memory. */
  async rebuildShuffleRoute(notify = true) {
    const container = this.findScrollContainer();
    const path = this.app.workspace.getActiveFile()?.path ?? "";
    if (!container || !path) {
      new Notice("Open a note first — shuffle needs a note view.");
      return;
    }
    this.measureScrollBoxes(container);
    const total = this.scrollTotalItems;
    if (total === 0) {
      new Notice("No toggles found in this note.");
      return;
    }
    const order = buildShuffleOrder(this.scrollCards(path), total, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      seed: Date.now() & 65535,
      retention: this.settings.scrollRetention,
      newMix: this.settings.scrollNewMix,
    });
    // v1.4.3 — keep the hand-written route so route mode can restore it later.
    const typed = this.settings.scrollRoute ?? [];
    if (this.settings.scrollMode === "route" && typed.length) {
      this.settings.scrollUserRoute = [...typed];
    }
    this.settings.scrollMode = "shuffle";
    this.settings.scrollRoute = order;
    await this.saveSettings();

    if (notify) {
      new Notice(
        `🔀 Shuffle ready — ${order.length} toggles.\n${deckSummary(
          deckStats(this.scrollCards(path), total, { retention: this.settings.scrollRetention })
        )}`
      );
    }
  }

  /** Deck summary for the current note, or null when nothing is measured yet. */
  scrollDeckStats() {
    const path = this.scrollNotePath ?? this.app.workspace.getActiveFile()?.path ?? "";
    if (!path) return null;
    const total = this.scrollTotalItems || this.scrollBoxes.length;
    if (!total) return null;
    return deckStats(this.scrollCards(path), total, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      retention: this.settings.scrollRetention,
    });
  }

  /** How many toggles fall due on each of the next 7 days. */
  scrollForecast(): number[] {
    const path = this.scrollNotePath ?? this.app.workspace.getActiveFile()?.path ?? "";
    const total = this.scrollTotalItems || this.scrollBoxes.length;
    if (!path || !total) return [];
    return forecastDue(this.scrollCards(path), total, 7, {
      from: this.settings.scrollShuffleFrom,
      to: this.settings.scrollShuffleTo,
      retention: this.settings.scrollRetention,
    });
  }

  async resetScrollMemory() {
    const path = this.app.workspace.getActiveFile()?.path ?? "";
    if (!path) return;
    this.settings.scrollMemory = resetDeck(this.settings.scrollMemory, path);
    await this.saveSettings();
    new Notice("Revision memory reset — every toggle is new again.");
  }

  /** Auto-grade the toggle we are leaving (shuffle mode only). */
  private async gradeLeavingStop(ordinal: number, openedMs: number) {
    if (!this.settings.scrollAutoGrade || this.settings.scrollMode !== "shuffle") return;
    const path = this.scrollNotePath;
    if (!path || !ordinal) return;
    const planned = Math.max(1, clampHold(this.settings.scrollHold)) * 1000;
    const grade = gradeFromDwell(openedMs / planned, this.scrollSeen.has(ordinal));
    this.scrollSeen.add(ordinal);
    const cards = recordReview(this.settings.scrollMemory, path, ordinal, grade);
    const names = ["", "Again", "Hard", "Good", "Easy"];
    this.scrollLastGrade = `toggle ${ordinal} · ${(openedMs / 1000).toFixed(1)}s → ${names[grade]} (${grade})`;
    await this.saveScrollCards(path, cards);
  }

  startAutoScroll() {
    const container = this.findScrollContainer();
    if (!container) {
      new Notice("Open a note first — autoscroll needs a note view.");
      return;
    }
    this.scrollContainer = container;
    this.scrollNotePath = this.app.workspace.getActiveFile()?.path ?? null;
    this.scrollSeen = new Set();
    this.applyPerNoteScrollPrefs();
    const plan = this.buildScrollPlan(container);
    if (plan.length === 0) {
      const anyToggle = this.collectStops(container).length > 0;
      // v1.1.7 — the view may still be rendering (or we scanned a stale
      // container). If the source clearly has toggles, retry once after a
      // short delay instead of wrongly claiming the note has none.
      if (!anyToggle && !this.scrollRetryPending && this.sourceHasToggles()) {
        this.scrollRetryPending = true;
        window.setTimeout(() => {
          this.scrollRetryPending = false;
          if (!this.scrollRunning && this.scrollPlan.length === 0) this.startAutoScroll();
        }, 700);
        return;
      }
      if (anyToggle || this.sourceHasToggles()) {
        // Toggles exist, but the current filter / pause-at mode hides them all.
        new Notice(
          `No toggles match this selection (${filterLabel(this.settings.scrollFilter)} · ${modeLabel(
            this.modeConfig()
          )}) — filter ya pause-at mode badlo.`,
          6000
        );
        this.syncScrollFab();
        return;
      }
      // v1.2.0 — plain note (no toggles at all): still scroll it end to end
      // instead of refusing to start. No stops, no dwell, just smooth reading.
      this.say(MSG_PLAIN_SCROLL, 4000);
    }
    this.scrollPlan = plan;
    const routed = this.settings.scrollMode === "route" || this.settings.scrollMode === "shuffle";
    this.scrollAt = routed
      ? 0
      : firstStopFrom(plan, container.scrollTop, this.settings.scrollReverse);
    this.scrollHoldUntil = 0;
    this.scrollOpenedAt = 0;
    this.scrollRunning = true;
    this.scrollLastFrame = 0;
    // v1.4.2 — a reverse run started at the top (or a forward run at the very
    // bottom) used to clamp on frame one and report "finished" immediately.
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
    this.resetDwell();
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
        onClose: () => this.stopAutoScroll(true),
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
  private applyPerNoteScrollPrefs() {
    const path = this.scrollNotePath;
    if (!path) return;
    const saved = this.settings.scrollPerNote?.[path];
    if (!saved) return;
    this.settings.scrollSpeed = clampSpeed(saved.speed);
    this.settings.scrollReverse = !!saved.reverse;
    this.settings.scrollHold = clampHold(saved.hold);
  }

  async rememberPerNoteScrollPrefs() {
    const path = this.scrollNotePath ?? this.app.workspace.getActiveFile()?.path ?? null;
    if (!path) return;
    this.settings.scrollPerNote = {
      ...(this.settings.scrollPerNote ?? {}),
      [path]: {
        speed: clampSpeed(this.settings.scrollSpeed),
        reverse: this.settings.scrollReverse,
        hold: clampHold(this.settings.scrollHold),
      },
    };
    await this.saveSettings();
  }

  /** "Go to first page" — jump to the start (or end in reverse) and continue. */
  scrollToStart() {
    const container = this.scrollContainer ?? this.findScrollContainer();
    if (!container) return;
    container.scrollTop = this.settings.scrollReverse ? container.scrollHeight : 0;
    this.scrollPos = container.scrollTop;
    this.resetDwell();
    this.scrollDwellUntil = 0;
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.scrollAt = 0;
    this.scrollHoldUntil = 0;
    this.renderScrollBar();
  }

  stopAutoScroll(notify: boolean) {
    this.scrollRunning = false;
    this.closeScrollVisit();
    if (this.scrollOpenEl && this.settings.scrollAutoClose) {
      this.setToggleOpen(this.scrollOpenEl, false);
    }
    this.scrollOpenEl = null;
    this.restoreScrollSmoothing();
    this.scrollDwellUntil = 0;
    this.resetDwell();
    this.scrollBoxes = [];
    this.scrollTargets = [];
    this.scrollTargetsKey = "";
    if (this.scrollRaf !== null) {
      window.cancelAnimationFrame(this.scrollRaf);
      this.scrollRaf = null;
    }
    this.scrollPlan = [];
    this.scrollAt = -1;
    this.scrollBar?.destroy();
    this.scrollBar = null;
    this.scrollDebugOverlay?.destroy();
    this.scrollDebugOverlay = null;
    this.scrollHoldPaused = false;
    this.syncScrollFab();
    this.syncHoldPause();
    if (notify) this.say("Autoscroll stopped.");
  }

  async setScrollReverse(reverse: boolean) {
    this.settings.scrollReverse = reverse;
    await this.saveSettings();
    if (this.scrollPlan.length && this.scrollContainer) {
      this.refreshScrollPlan();
      // v1.4.2 — flipping direction mid-run: re-seed from the live position
      // (jumping off the edge when needed) and let stops fire the other way.
      const container = this.scrollContainer;
      const max = container.scrollHeight - container.clientHeight;
      this.scrollPos = seedStartOffset(container.scrollTop, max, reverse);
      if (Math.floor(this.scrollPos) !== container.scrollTop) {
        container.scrollTop = Math.floor(this.scrollPos);
      }
      this.scrollDir = reverse ? -1 : 1;
      this.scrollDwellDir = this.scrollDir;
      this.resetDwell();
      this.scrollDwellUntil = 0;
      this.scrollMovedPx = 0;
      this.scrollAt = firstStopFrom(this.scrollPlan, this.scrollPos, reverse);
    }
    await this.rememberPerNoteScrollPrefs();
    this.renderScrollBar();
    this.syncScrollFab();
    this.say(reverse ? "Autoscroll: reverse ↑" : "Autoscroll: forward ↓");
  }

  async setScrollFilter(filter: RecallColor[]) {
    this.settings.scrollFilter = normalizeFilter(filter);
    await this.saveSettings();
    if (this.scrollContainer && this.scrollPlan.length) {
      this.refreshScrollPlan();
    }
    this.renderScrollBar();
    this.say(`Autoscroll filter: ${filterLabel(filter)}`);
  }

  async nudgeScrollSpeed(delta: number) {
    this.settings.scrollSpeed = clampSpeed(this.settings.scrollSpeed + delta);
    await this.saveSettings();
    await this.rememberPerNoteScrollPrefs();
    this.renderScrollBar();
  }

  /** Recompute the plan mid-session (filter / mode / direction changed). */
  refreshScrollPlan() {
    const container = this.scrollContainer;
    if (!container) return;
    this.scrollPlan = this.buildScrollPlan(container);
    this.scrollAt = 0;
    this.scrollBoxes = [];
    this.scrollBoxesAt = 0;
    this.scrollTargetsKey = "";
    this.scrollRouteIdx = 0;
    this.scrollRouteStop = 0;
    this.resetDwell();
    this.scrollDwellUntil = 0;
    this.scrollDir = this.settings.scrollReverse ? -1 : 1;
    this.scrollDwellDir = this.scrollDir;
    this.scrollHoldUntil = 0;
    this.renderScrollBar();
  }

  /** "3/12" — route legs in route/shuffle mode, dwell stops otherwise. */
  private scrollProgressLabel(): string {
    const route = this.settings.scrollRoute ?? [];
    if ((this.settings.scrollMode === "route" || this.settings.scrollMode === "shuffle") && route.length) {
      return `${Math.min(this.scrollRouteIdx + 1, route.length)}/${route.length}`;
    }
    const total = this.scrollTargets.length || this.scrollPlan.length;
    return total ? `${Math.min(this.scrollAt + 1, total)}/${total}` : "0/0";
  }

  /** Mount or drop the debug overlay to match the setting. */
  syncScrollDebugOverlay() {
    if (this.settings.scrollDebug && this.scrollRunning) {
      if (!this.scrollDebugOverlay) {
        this.scrollDebugOverlay = new ScrollDebugOverlay();
        this.scrollDebugOverlay.mount(document.body);
      }
    } else {
      this.scrollDebugOverlay?.destroy();
      this.scrollDebugOverlay = null;
    }
  }

  private paintScrollDebug(frame: Partial<DebugFrame>, ts: number) {
    const overlay = this.scrollDebugOverlay;
    const container = this.scrollContainer;
    if (!overlay || !container) return;
    overlay.update({
      pos: this.scrollPos,
      scrollTop: container.scrollTop,
      max: Math.max(0, container.scrollHeight - container.clientHeight),
      speed: clampSpeed(this.settings.scrollSpeed),
      dir: this.scrollDir as 1 | -1,
      mode: this.settings.scrollMode,
      routeMode: false,
      target: null,
      routeIdx: this.scrollRouteIdx,
      routeLen: (this.settings.scrollRoute ?? []).length,
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
      ...frame,
    });
  }

  /**
   * v1.2.5 — colour-filter read-out for the debug overlay: what was found,
   * what survived the filter, and which raw type the current target was
   * graded from. This is what makes a "Red only finds nothing" report
   * diagnosable from the phone screen.
   */
  private filterTelemetry(container: HTMLElement): Partial<DebugFrame> {
    const filter = this.settings.scrollFilter;
    const all = this.collectStops(container, filter) as (ToggleStop & { el?: HTMLElement })[];
    const target = this.scrollPlan[this.scrollAt] as (ToggleStop & { el?: HTMLElement }) | undefined;
    return filterFrame({
      filterLabel: filterLabel(filter),
      found: Math.max(collectToggleEls(container).length, all.length),
      kept: all.filter((s) => matchesFilter(s.color, filter)).length,
      colors: colorCounts((this.collectStops(container) as ToggleStop[]).map((s) => s.color)),
      targetColor: target ? target.color : null,
      targetType: target?.el ? toggleTypeOf(target.el) : null,
    });
  }

  private renderScrollBar() {
    this.scrollBar?.render({
      running: this.scrollRunning,
      speed: this.settings.scrollSpeed,
      reverse: this.settings.scrollReverse,
      filterLabel: filterLabel(this.settings.scrollFilter),
      progress: this.scrollProgressLabel(),
      modeIcon: modeIcon(this.settings.scrollMode),
      modeLabel: modeLabel(this.modeConfig()),
      dwellLabel: formatDwell(clampHold(this.settings.scrollHold)),
      speedLabel: `${multiplierFromSpeed(this.settings.scrollSpeed)}x`,
    });
  }

  /* ---------- v1.1.2: the reader's own loop mechanics ---------- */

  /** Current pause rules in the reader's DwellSettings shape. */
  private dwellCfg(): DwellSettings {
    return {
      ...toDwellSettings(
        this.modeConfig(),
        clampHold(this.settings.scrollHold),
        this.settings.scrollChunkTall
      ),
      loopRoute: this.settings.scrollLoopRoute,
    };
  }

  /** Measure the colour-filtered toggles as page boxes in content space. */
  private measureScrollBoxes(container: HTMLElement) {
    const t0 = nowMs();
    const all = this.collectStops(container, this.settings.scrollFilter) as (ToggleStop & {
      el: HTMLElement;
      height: number;
    })[];
    const kept = all.filter((st) => matchesFilter(st.color, this.settings.scrollFilter));
    this.scrollTotalItems = kept.length;
    this.scrollElByOrdinal = new Map();
    this.scrollBoxes = kept
      .map((st, i) => {
        this.scrollElByOrdinal.set(i + 1, st.el);
        return { page: i + 1, top: st.top, height: st.height };
      })
      .sort((a, b) => a.top - b.top);
    this.scrollTargetsKey = "";
    this.perf.filter.add(nowMs() - t0);
  }

  /** v1.4.7 — drop the cache so the next frame re-anchors for the new viewport. */
  reanchorAfterResize(): void {
    this.scrollTargetsKey = "";
    this.scrollBoxesAt = 0;
  }

  /** Cached dwell targets — rebuilt only when the inputs change. */
  private currentTargets(container: HTMLElement, cfg: DwellSettings): DwellTarget[] {
    // v1.4.7 — keyed on stop *positions* and the anchor, not just the count.
    const anchor = this.settings.scrollStopAnchor;
    const key = targetsKey(container, cfg, anchor, this.scrollBoxes);
    if (key !== this.scrollTargetsKey) {
      this.scrollTargetsKey = key;
      this.scrollTargets = anchoredTargets(this.scrollBoxes, cfg, container, anchor);
      this.scrollPlan = this.scrollTargets.map((t) => ({
        index: t.page - 1,
        top: t.top,
        color: "other",
      })) as ToggleStop[];
    }
    return this.scrollTargets;
  }

  /** v1.4.7 — a fresh leg: no stop is "already used" any more. */
  private resetDwell() {
    this.resetDwell();
  }

  /** Repaint the debug overlay (when on) and queue the next frame. */
  private endScrollFrame(ts: number) {
    if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
    this.scheduleScrollFrame();
  }

  /** Open the toggle we just parked on and start its visit clock. */
  private parkOnToggle(ordinal: number, now: number) {
    const el = this.scrollElByOrdinal.get(ordinal);
    if (this.scrollOpenEl && this.scrollOpenEl !== el && this.settings.scrollAutoClose) {
      this.setToggleOpen(this.scrollOpenEl, false);
    }
    if (el && this.settings.scrollAutoOpen) this.setToggleOpen(el, true);
    this.scrollOpenEl = el ?? null;
    this.scrollBoxesAt = 0; // v1.4.7 — the layout just changed: re-measure next frame.
    this.noteScrollVisit(ordinal, now);
  }

  /** Reader parity: a visit opens here and is graded when the pause ends. */
  private noteScrollVisit(ordinal: number, now = Date.now()) {
    if (!Number.isFinite(ordinal) || ordinal <= 0) return;
    if (this.settings.scrollMode !== "shuffle") return;
    const open = this.scrollVisit;
    if (open && open.ordinal !== ordinal) {
      this.scrollVisit = null;
      void this.gradeLeavingStop(open.ordinal, Date.now() - open.at);
    }
    if (!this.scrollVisit) this.scrollVisit = { ordinal, at: Date.now() };
  }

  private closeScrollVisit() {
    const open = this.scrollVisit;
    if (!open || this.settings.scrollMode !== "shuffle") return;
    this.scrollVisit = null;
    void this.gradeLeavingStop(open.ordinal, Date.now() - open.at);
  }

  /** Element that carries the sub-pixel remainder while running. */
  private pickSmoothEl(container: HTMLElement): HTMLElement | null {
    try {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
      const candidate = Array.from(container.children).find((c) => {
        if (!(c instanceof HTMLElement)) return false;
        const pos = getComputedStyle(c).position;
        return pos !== "sticky" && pos !== "fixed";
      }) as HTMLElement | undefined;
      if (!candidate) return null;
      const t = getComputedStyle(candidate).transform;
      if (t && t !== "none") return null;
      return candidate;
    } catch {
      return null;
    }
  }

  private restoreScrollSmoothing() {
    if (this.scrollSmoothEl) {
      this.scrollSmoothEl.style.transform = this.scrollPrevTransform ?? "";
      this.scrollSmoothEl.style.willChange = "";
    }
    this.scrollSmoothEl = null;
    this.scrollPrevTransform = null;
    if (this.scrollContainer && this.scrollPrevBehavior !== null) {
      this.scrollContainer.style.scrollBehavior = this.scrollPrevBehavior;
    }
    this.scrollPrevBehavior = null;
  }

  private scheduleScrollFrame() {
    if (this.scrollHoldPaused) return;
    if (this.scrollRaf !== null) window.cancelAnimationFrame(this.scrollRaf);
    this.scrollRaf = window.requestAnimationFrame((ts) => this.autoScrollFrame(ts));
  }

  /**
   * v1.1.2 — ported from the reader's `useAutoScroll` same-origin loop:
   * float position, per-leg route direction, `crossedTarget` dwell guard and
   * the sub-pixel `translate3d` remainder.
   */
  private autoScrollFrame(ts: number) {
    this.scrollRaf = null;
    if (!this.scrollRunning || this.scrollHoldPaused) return;
    const container = this.scrollContainer;
    if (!container || !container.isConnected) {
      this.stopAutoScroll(false);
      return;
    }

    if (!this.scrollLastFrame) this.scrollLastFrame = ts;
    // speed is px/s in settings; the reader's loop speaks px per 16.67ms frame.
    const dt = frameFactor(ts - this.scrollLastFrame);
    this.scrollLastFrame = ts;
    const perFrame = clampSpeed(this.settings.scrollSpeed) / 60;

    // Parked on a stop: hold this frame, then grade + release.
    if (this.scrollDwellUntil && ts < this.scrollDwellUntil) {
      this.scrollPos = container.scrollTop;
      if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
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
    // v1.2.1 — our own writes must not wake the auto-hiding FAB.
    markProgrammaticScroll();

    if (max > 2) {
      // The user scrolled out from under us — re-seed instead of fighting them.
      if (Math.abs(container.scrollTop - this.scrollPos) > 2) this.scrollPos = container.scrollTop;

      const cfg = this.dwellCfg();
      const routeMode = isRouteMode(cfg);
      if (ts - this.scrollBoxesAt > 500 || this.scrollBoxes.length === 0) {
        this.scrollBoxesAt = ts;
        this.measureScrollBoxes(container);
      }

      // Route / shuffle mode owns the direction: each leg heads to its waypoint.
      let routeTarget: number | null = null;
      let routeStops: number[] = [];
      if (routeMode) {
        const wanted = cfg.route[this.scrollRouteIdx % cfg.route.length];
        const hit = this.scrollBoxes.find((b) => b.page === wanted);
        if (hit) {
          const anchor = this.settings.scrollStopAnchor;
          routeStops = (cfg.a4 ? pageStops(hit.top, hit.height, container.clientHeight) : [hit.top]).map(
            (top, i) =>
              anchorScrollTop(container, top, cfg.a4 && i > 0 ? container.clientHeight : hit.height, anchor)
          );
          routeTarget = routeStops[Math.min(this.scrollRouteStop, routeStops.length - 1)];
          this.scrollDir = legDirection(routeTarget, this.scrollPos, this.scrollDir as 1 | -1);
        }
      } else {
        this.scrollDir = this.settings.scrollReverse ? -1 : 1;
      }

      const prevPos = this.scrollPos;
      this.scrollPos = advancePosition(this.scrollPos, perFrame, dt, this.scrollDir as 1 | -1, max);
      this.scrollMovedPx += Math.abs(this.scrollPos - prevPos);
      const whole = Math.floor(this.scrollPos);
      container.scrollTop = whole;

      if (routeMode) {
        if (routeTarget != null && waypointReached(prevPos, this.scrollPos, routeTarget)) {
          this.scrollPos = routeTarget;
          container.scrollTop = Math.floor(routeTarget);
          this.scrollDwellUntil = ts + cfg.seconds * 1000;
          const ordinal = cfg.route[this.scrollRouteIdx % cfg.route.length];
          this.scrollLastEvent = `waypointReached toggle ${ordinal} @ ${Math.round(routeTarget)}`;
          this.parkOnToggle(ordinal, ts);
          // More screenfuls left on this toggle → stay on this waypoint.
          if (this.scrollRouteStop < routeStops.length - 1) {
            this.scrollRouteStop += 1;
            this.endScrollFrame(ts);
            return;
          }
          this.scrollRouteStop = 0;
          const last = this.scrollRouteIdx >= cfg.route.length - 1;
          if (last && !cfg.loopRoute) {
            new Notice(
              this.settings.scrollMode === "shuffle"
                ? "Shuffle finished — every scheduled toggle revised."
                : "Route finished — every waypoint visited."
            );
            this.scrollRunning = false;
            this.renderScrollBar();
            this.endScrollFrame(ts);
            return;
          }
          this.scrollRouteIdx = last ? 0 : this.scrollRouteIdx + 1;
          this.renderScrollBar();
          this.endScrollFrame(ts);
          return;
        }
      } else {
        // Reverse must be able to pause again on a stop it used going down,
        // so the "already used" guard is scoped to the current direction.
        if (this.scrollDwellDir !== this.scrollDir) {
          this.scrollDwellDir = this.scrollDir;
          this.resetDwell();
        }
        const targets = this.currentTargets(container, cfg);
        // v1.4.7 — every stop crossed by this frame, plus any stop a re-measure
        // pushed behind the playhead: nothing is skipped, only deferred.
        const pick = pickStops(targets, prevPos, this.scrollPos, this.scrollDir, this.scrollVisited);
        if (pick.missed.length) this.perf.noteSkipped(pick.missed.length);
        const crossed = pick.stop;
        if (shouldPark(this.scrollDwellKey, crossed)) {
          const stop = crossed as DwellTarget;
          this.scrollDwellKey = stop.key;
          this.scrollVisited.add(stop.key);
          this.scrollDwellUntil = ts + cfg.seconds * 1000;
          this.scrollPos = stop.top;
          container.scrollTop = Math.floor(stop.top);
          this.scrollAt = targets.findIndex((t) => t.key === stop.key);
          this.scrollLastEvent = `crossedTarget ${stop.key} @ ${Math.round(stop.top)}`;
          this.parkOnToggle(stop.page, ts);
          this.renderScrollBar();
          this.endScrollFrame(ts);
          return;
        }
      }

      // Sub-pixel remainder, so 0.02x-0.2x actually creeps forward.
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

      const atEdge = finishedAtEdge(this.scrollPos, max, this.scrollDir as 1 | -1, this.scrollMovedPx);
      if (atEdge && !routeMode) {
        if (this.settings.scrollLoop) {
          this.scrollPos = this.scrollDir < 0 ? max : 0;
          container.scrollTop = Math.floor(this.scrollPos);
          this.resetDwell();
          this.scrollMovedPx = 0;
        } else {
          this.say("Autoscroll finished — every selected toggle revised.");
          this.stopAutoScroll(false);
          return;
        }
      }
    } else if (ts - this.scrollRelocateAt > 400) {
      // v1.2.1 — the container we latched onto cannot scroll (wrapper element,
      // or the view re-rendered). Look for the real scroller and carry on.
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

    if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
    this.scheduleScrollFrame();
  }

  /* ==================== v1.1.0: quiz mode ==================== */

  /** Visible title text of a toggle, used for the per-question "⏱30" marker. */
  private quizTitleOf(el: HTMLElement): string {
    return toggleTitleOf(el);
  }

  /** v1.3.0 — colours the quiz asks about. */
  quizFilterColors(): RecallColor[] {
    return normalizeFilter(
      this.settings.quizUseColorFilter
        ? this.settings.quizFilter.length
          ? this.settings.quizFilter
          : this.settings.scrollFilter
        : []
    );
  }

  async setQuizFilter(filter: RecallColor[]) {
    this.settings.quizFilter = normalizeFilter(filter);
    this.settings.quizUseColorFilter = true;
    await this.saveSettings();
    if (!this.settings.scrollQuiet) new Notice(`Quiz filter: ${filterLabel(this.settings.quizFilter)}`);
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
      new Notice("Open a note first — quiz mode needs a note view.");
      return;
    }
    const filter = this.quizFilterColors();
    const stops = planStops(
      this.collectStops(container, filter),
      filter,
      this.settings.scrollReverse
    ) as (ToggleStop & { el?: HTMLElement })[];
    if (stops.length === 0) {
      // v1.1.9 — same one-shot retry as autoscroll: the reading view may still
      // be rendering on mobile, so don't claim "no toggles" too early.
      if (
        this.collectStops(container).length === 0 &&
        !this.quizRetryPending &&
        this.sourceHasToggles()
      ) {
        this.quizRetryPending = true;
        window.setTimeout(() => {
          this.quizRetryPending = false;
          if (!this.quizState) this.startQuizRun();
        }, 700);
        return;
      }
      new Notice(`No toggles match the filter (${filterLabel(filter)}).`);
      return;
    }

    this.quizContainer = container;
    this.quizStops = stops;
    this.quizTitles = stops.map((s) => (s.el ? this.quizTitleOf(s.el) : ""));
    // v1.3.0 — remember the note's own shape, then hide every answer with
    // plugin classes only (Obsidian's fold state stays untouched: no blink,
    // no rewritten reading view).
    this.quizSnapshot = snapshotToggles(stops.map((s) => s.el));
    document.body.classList.add(QUIZ_ACTIVE_CLASS);
    for (const s of stops) {
      if (s.el) setQuizVisible(s.el, this.settings.quizKeepAnswersOpen);
    }

    this.quizState = startQuiz(this.quizTitles, this.settings);

    if (!this.quizBoard) this.quizBoard = new QuizBoard(document);
    if (!this.settings.quizMinimalUi && !this.quizBar) {
      this.quizBar = new QuizBar({
        onTogglePause: () => this.toggleQuizPause(),
        onRevealNow: () => this.quizRevealNow(),
        onNext: () => this.quizNext(),
        onStop: () => this.stopQuiz(true),
      });
    }
    this.scrollQuizTo(0);
    this.perf.reset(); // v1.4.7 — one report per run.
    const first = this.quizTitles[0] ?? "";
    this.perf.timer.start(1, first, "question", questionMs(first, this.settings), Date.now());
    if (!this.settings.scrollQuiet) new Notice(quizStartLabel(stops.length, this.settings));
    this.renderQuizHud();
    this.startQuizLoop();
  }

  stopQuiz(notify: boolean) {
    if (this.quizInterval !== null) {
      window.clearInterval(this.quizInterval);
      this.quizInterval = null;
    }
    const summary = this.quizState ? quizSummary(this.quizState) : "";
    // v1.3.0 — drop every quiz class so the note is exactly what it was before
    // the run; the reader never loses their own open/closed state.
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
    this.quizBoard?.destroy();
    this.quizBoard = null;
    this.quizBar?.destroy();
    this.quizBar = null;
    if (notify) new Notice(summary || "Quiz stopped.");
  }

  toggleQuizPause() {
    if (!this.quizState) {
      this.startQuizRun();
      return;
    }
    this.quizState = this.quizState.running
      ? pauseQuiz(this.quizState)
      : resumeQuiz(this.quizState);
    // v1.4.7 — a deliberate pause is never drift and never a freeze.
    if (this.quizState.running) this.perf.timer.addPause(Date.now() - this.quizLastFrame);
    this.perf.freezes.ignoreNext();
    this.quizLastFrame = Date.now();
    this.renderQuizHud();
    if (!this.settings.scrollQuiet) {
      new Notice(this.quizState.running ? "Quiz resumed." : "Quiz paused.");
    }
  }

  quizRevealNow() {
    if (!this.quizState) return;
    const { state, event } = revealNow(this.quizState, this.settings);
    this.quizState = state;
    this.applyQuizEvent(event);
  }

  quizNext() {
    if (!this.quizState) return;
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
  private ensureQuizEls(): void {
    const container = this.quizContainer;
    if (!container || !this.quizStops.length) return;
    if (!needsHeal(this.quizStops.map((s) => s.el))) return;
    const healStart = nowMs();
    const fresh = (
      this.collectStops(container, this.quizFilterColors()) as (ToggleStop & {
        el?: HTMLElement;
      })[]
    )
      .map((s) => s.el)
      .filter((el): el is HTMLElement => !!el);
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
  private applyQuizEvent(event: "reveal" | "next" | "done" | null) {
    if (!this.quizState) return;
    if (event) this.markQuizPhase(event);
    if (event === "reveal") {
      this.ensureQuizEls();
      this.applyQuizVisibility(this.quizState.at, true);
      // Safety net: if the class-only reveal did not land (re-rendered callout
      // that came back with the theme's collapsed markup), open it for real so
      // a question can never be silently skipped.
      const el = this.quizStops[this.quizState.at]?.el;
      if (el && el.isConnected && !revealLanded(el)) this.setToggleOpen(el, true);
      if (this.settings.quizBeepOnTimeUp && !this.settings.scrollQuiet) {
        new Notice("⏰ Time up — answer revealed.");
      }
    } else if (event === "next") {
      this.ensureQuizEls();
      this.scrollQuizTo(this.quizState.at);
    } else if (event === "done") {
      const summary = quizSummary(this.quizState);
      this.stopQuiz(false);
      new Notice(`${summary}\n${perfVerdict(this.perf.report())}`, 9000);
      return;
    }
    this.renderQuizHud();
  }

  /** Only the current question may show its answer, and only after the reveal. */
  private applyQuizVisibility(index: number, revealed: boolean) {
    // v1.4.3 — "open with auto-quiz": every answer stays open the whole run.
    if (this.settings.quizKeepAnswersOpen) {
      for (const s of this.quizStops) if (s.el) setQuizVisible(s.el, true);
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
  private scrollQuizTo(index: number) {
    const container = this.quizContainer;
    const stop = this.quizStops[index];
    if (!container || !stop) return;
    this.applyQuizVisibility(index, false);
    const el = stop.el;
    // v1.3.0 — measure *after* the visibility change has landed, and read the
    // element directly instead of re-scanning the whole note: that re-scan on
    // every question is what made the page jump mid-animation.
    const scroll = () => {
      // The section may have re-rendered during the smooth scroll.
      this.ensureQuizEls();
      const live = this.quizStops[index]?.el ?? el;
      const top =
        live && live.isConnected
          ? live.getBoundingClientRect().top -
            container.getBoundingClientRect().top +
            container.scrollTop
          : stop.top;
      const h = live && live.isConnected ? live.getBoundingClientRect().height : 0;
      container.scrollTo({
        top: anchorScrollTop(container, top, h, this.settings.scrollStopAnchor),
        behavior: "smooth",
      });
      this.renderQuizHud();
    };
    if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(scroll);
    else scroll();
  }

  private startQuizLoop() {
    if (this.quizInterval !== null) window.clearInterval(this.quizInterval);
    this.quizLastFrame = Date.now();
    this.quizInterval = window.setInterval(() => this.quizFrame(), 250);
    this.registerInterval(this.quizInterval);
  }

  private quizFrame() {
    if (!this.quizState) return;
    const container = this.quizContainer;
    if (!container || !container.isConnected) {
      this.stopQuiz(false);
      return;
    }
    const now = Date.now();
    const dt = Math.min(2000, now - this.quizLastFrame);
    if (this.quizState.running) this.perf.freezes.tick(now - this.quizLastFrame, this.quizState.phase, now);
    this.quizLastFrame = now;
    const { state, event } = quizTick(this.quizState, dt, this.quizTitles, this.settings);
    this.quizState = state;
    if (event) this.applyQuizEvent(event);
    else this.renderQuizHud();
  }

  /** v1.4.7 — close the phase that just ended, open the next one for the report. */
  private markQuizPhase(event: "reveal" | "next" | "done") {
    const st = this.quizState;
    if (!st) return;
    this.perf.timer.finish(Date.now());
    if (event === "done") return;
    const title = this.quizTitles[st.at] ?? "";
    const reveal = event === "reveal";
    const ms = reveal ? clampRevealSeconds(this.settings.quizRevealSeconds) * 1000 : questionMs(title, this.settings);
    this.perf.timer.start(st.at + 1, title, reveal ? "reveal" : "question", ms, Date.now());
  }

  /** Paint the inline ring (and the optional dock) from the engine state. */
  private renderQuizHud() {
    const st = this.quizState;
    if (!st) return;
    const paintAt = nowMs();
    this.perf.quizRender.mark(paintAt);
    this.ensureQuizEls();
    paintQuizHud({
      board: this.quizBoard,
      bar: this.quizBar,
      els: this.quizStops.map((s) => s.el),
      totals: this.quizTitles.map((t) => questionMs(t, this.settings)),
      at: st.at,
      remaining: st.remaining,
      ratio: quizPhaseRatio(st, this.quizTitles, this.settings),
      phase: st.phase,
      running: st.running,
      total: st.total,
      progress: quizProgressLabel(st),
    });
    this.perf.badgeRender.add(nowMs() - paintAt);
  }

  /**
   * Remove schedule entries whose note no longer exists.
   * Returns how many were removed; `silent` skips the notice (startup).
   */
  async pruneSchedule(silent = false): Promise<number> {
    const existing = this.app.vault.getMarkdownFiles().map((f) => f.path);
    const { store, removed } = pruneCards(this.settings.srs ?? {}, existing);
    if (removed.length) {
      this.settings.srs = store;
      await this.saveSettings();
      this.renderTimer();
    }
    if (!silent) {
      new Notice(
        removed.length
          ? `Removed ${removed.length} schedule${removed.length === 1 ? "" : "s"} for missing notes.`
          : "Recall schedule is already clean."
      );
    }
    return removed.length;
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    // v1.4.3 — the saved plan must come back exactly as it was typed, even if
    // an older/edited data.json stored junk in those arrays.
    const nums = (v: unknown) =>
      Array.isArray(v) ? v.map((n) => Math.floor(Number(n))).filter((n) => n > 0) : [];
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
}

/* ---------- Settings Tab ---------- */

/** Simple picker listing notes whose recall is due (v1.0.7). */
class DueNotesModal extends Modal {
  constructor(
    app: App,
    private due: { path: string; card: SrsCard }[],
    private onPick: (path: string) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle(`Due for recall (${this.due.length})`);
    for (const { path, card } of this.due) {
      const row = contentEl.createDiv({ cls: "ntt-due-row" });
      const btn = row.createEl("button", { text: path.replace(/\.md$/, "") });
      btn.addClass("ntt-due-btn");
      row.createSpan({ text: ` ${nextDueLabel(card, Date.now())} · ease ${card.ease}` });
      btn.addEventListener("click", () => {
        this.close();
        this.onPick(path);
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
