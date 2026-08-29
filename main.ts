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
import { ScrollDebugOverlay, type DebugFrame } from "./src/debug-overlay";
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
import { QuizBar } from "./src/quiz-ui";
import { QuizRing } from "./src/quiz-badge";
import {
  QUIZ_ACTIVE_CLASS,
  applyQuizVisibilityClasses,
  clearQuizVisibility,
  setQuizVisible,
  snapshotToggles,
  type ToggleSnapshot,
} from "./src/quiz-visibility";
import { parseDeepLink } from "./src/deeplink";
import {
  pruneCards,
  removeCardKey,
  renameCardKey,
  scheduleStoreSummary,
} from "./src/maintenance";




type ToggleFormat = "callout" | "details";

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
};

const CALLOUT_TYPES = ["question", "info", "note", "abstract", "tip", "warning", "success"];

/** Notion-like colour palette. Each colour is its own callout type styled in styles.css. */
export const TOGGLE_COLORS: { id: string; label: string; callout: string }[] = [
  { id: "default", label: "Default (callout type below)", callout: "" },
  { id: "red", label: "🔴 Red — hard / stop", callout: "recall-red" },
  { id: "yellow", label: "🟡 Yellow — revise", callout: "recall-yellow" },
  { id: "green", label: "🟢 Green — mastered", callout: "recall-green" },
  { id: "blue", label: "🔵 Blue — concept", callout: "recall-blue" },
  { id: "purple", label: "🟣 Purple — theory", callout: "recall-purple" },
  { id: "orange", label: "🟠 Orange — formula", callout: "recall-orange" },
  { id: "gray", label: "⚪ Gray — extra", callout: "recall-gray" },
  { id: "plain", label: "⬛ Black / plain — clean Notion look", callout: "recall-plain" },
];

export { TRAFFIC_CYCLE };

export function calloutForColor(colorId: string, fallback: string): string {
  const found = TOGGLE_COLORS.find((c) => c.id === colorId);
  return found && found.callout ? found.callout : fallback;
}


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
  quizBar: QuizBar | null = null;
  /** v1.3.0 — inline Telegram-style countdown that rides on the question. */
  quizRing: QuizRing | null = null;
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
    this.scrollPos = container.scrollTop;
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
    this.scrollDwellKey = null;
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
    this.scrollDwellKey = null;
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
    const found = collectToggleEls(container);
    const target = this.scrollPlan[this.scrollAt] as (ToggleStop & { el?: HTMLElement }) | undefined;
    const rawType = target?.el ? toggleTypeOf(target.el) : null;
    return {
      filter: filterLabel(filter),
      stopsFound: Math.max(found.length, all.length),
      stopsKept: all.filter((s) => matchesFilter(s.color, filter)).length,
      colors: colorCounts(
        (this.collectStops(container) as ToggleStop[]).map((s) => s.color)
      ),
      targetColor: target ? target.color : null,
      targetType: rawType,
    };
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
  }

  /** Cached dwell targets — rebuilt only when the inputs change. */
  private currentTargets(container: HTMLElement, cfg: DwellSettings): DwellTarget[] {
    const key = `${container.clientHeight}|${cfg.a4}|${cfg.parity}|${cfg.pages.join(",")}|${this.scrollBoxes.length}`;
    if (key !== this.scrollTargetsKey) {
      this.scrollTargetsKey = key;
      this.scrollTargets = dwellTargets(this.scrollBoxes, cfg, container.clientHeight);
      this.scrollPlan = this.scrollTargets.map((t) => ({
        index: t.page - 1,
        top: t.top,
        color: "other",
      })) as ToggleStop[];
    }
    return this.scrollTargets;
  }

  /** Open the toggle we just parked on and start its visit clock. */
  private parkOnToggle(ordinal: number, now: number) {
    const el = this.scrollElByOrdinal.get(ordinal);
    if (this.scrollOpenEl && this.scrollOpenEl !== el && this.settings.scrollAutoClose) {
      this.setToggleOpen(this.scrollOpenEl, false);
    }
    if (el && this.settings.scrollAutoOpen) this.setToggleOpen(el, true);
    this.scrollOpenEl = el ?? null;
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
          routeStops = cfg.a4
            ? pageStops(hit.top, hit.height, container.clientHeight)
            : [hit.top];
          routeTarget = routeStops[Math.min(this.scrollRouteStop, routeStops.length - 1)];
          this.scrollDir = legDirection(routeTarget, this.scrollPos, this.scrollDir as 1 | -1);
        }
      } else {
        this.scrollDir = this.settings.scrollReverse ? -1 : 1;
      }

      const prevPos = this.scrollPos;
      this.scrollPos = advancePosition(this.scrollPos, perFrame, dt, this.scrollDir as 1 | -1, max);
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
            if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
      this.scheduleScrollFrame();
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
            if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
      this.scheduleScrollFrame();
            return;
          }
          this.scrollRouteIdx = last ? 0 : this.scrollRouteIdx + 1;
          this.renderScrollBar();
          if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
      this.scheduleScrollFrame();
          return;
        }
      } else {
        // Reverse must be able to pause again on a stop it used going down,
        // so the "already used" guard is scoped to the current direction.
        if (this.scrollDwellDir !== this.scrollDir) {
          this.scrollDwellDir = this.scrollDir;
          this.scrollDwellKey = null;
        }
        const targets = this.currentTargets(container, cfg);
        const crossed = crossedTarget(targets, prevPos, this.scrollPos, this.scrollDir);
        if (shouldPark(this.scrollDwellKey, crossed)) {
          const stop = crossed as DwellTarget;
          this.scrollDwellKey = stop.key;
          this.scrollDwellUntil = ts + cfg.seconds * 1000;
          this.scrollPos = stop.top;
          container.scrollTop = Math.floor(stop.top);
          this.scrollAt = targets.findIndex((t) => t.key === stop.key);
          this.scrollLastEvent = `crossedTarget ${stop.key} @ ${Math.round(stop.top)}`;
          this.parkOnToggle(stop.page, ts);
          this.renderScrollBar();
          if (this.scrollDebugOverlay) this.paintScrollDebug({}, ts);
      this.scheduleScrollFrame();
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

      const atEdge = this.scrollDir < 0 ? this.scrollPos <= 1 : this.scrollPos >= max - 1;
      if (atEdge && !routeMode) {
        if (this.settings.scrollLoop) {
          this.scrollPos = this.scrollDir < 0 ? max : 0;
          container.scrollTop = Math.floor(this.scrollPos);
          this.scrollDwellKey = null;
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
    for (const s of stops) if (s.el) setQuizVisible(s.el, false);
    this.quizState = startQuiz(this.quizTitles, this.settings);

    if (!this.quizRing) this.quizRing = new QuizRing(document);
    if (!this.settings.quizMinimalUi && !this.quizBar) {
      this.quizBar = new QuizBar({
        onTogglePause: () => this.toggleQuizPause(),
        onRevealNow: () => this.quizRevealNow(),
        onNext: () => this.quizNext(),
        onStop: () => this.stopQuiz(true),
      });
    }
    this.scrollQuizTo(0);
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
    this.quizRing?.destroy();
    this.quizRing = null;
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

  /** React to an engine event: open the answer, move on, or finish. */
  private applyQuizEvent(event: "reveal" | "next" | "done" | null) {
    if (!this.quizState) return;
    if (event === "reveal") {
      this.applyQuizVisibility(this.quizState.at, true);
      if (this.settings.quizBeepOnTimeUp && !this.settings.scrollQuiet) {
        new Notice("⏰ Time up — answer revealed.");
      }
    } else if (event === "next") {
      this.scrollQuizTo(this.quizState.at);
    } else if (event === "done") {
      const summary = quizSummary(this.quizState);
      this.stopQuiz(false);
      new Notice(summary);
      return;
    }
    this.renderQuizHud();
  }

  /** Only the current question may show its answer, and only after the reveal. */
  private applyQuizVisibility(index: number, revealed: boolean) {
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
      const top =
        el && el.isConnected
          ? el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
          : stop.top;
      container.scrollTo({ top: targetOffset(top, container.clientHeight), behavior: "smooth" });
      if (el) this.quizRing?.mount(el);
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
    this.quizLastFrame = now;
    const { state, event } = quizTick(this.quizState, dt, this.quizTitles, this.settings);
    this.quizState = state;
    if (event) this.applyQuizEvent(event);
    else this.renderQuizHud();
  }

  /** Paint the inline ring (and the optional dock) from the engine state. */
  private renderQuizHud() {
    const st = this.quizState;
    if (!st) return;
    const el = this.quizStops[st.at]?.el;
    if (el && el.isConnected) this.quizRing?.mount(el);
    this.quizRing?.render({
      remaining: st.remaining,
      ratio: quizPhaseRatio(st, this.quizTitles, this.settings),
      phase: st.phase,
      running: st.running,
      index: st.at + 1,
      total: st.total,
    });
    this.quizBar?.render({
      progress: quizProgressLabel(st),
      running: st.running,
      revealing: st.phase === "reveal",
    });
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
  }


  async saveSettings() {
    await this.saveData(this.settings);
  }
}


/* ---------- v1.0.9: autoscroll colour filter ---------- */

/** v1.1.3 — mini stats panel explaining the shuffle priority. */
class ScrollStatsModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText("Autoscroll revision stats");
    const path = this.plugin.scrollNotePath ?? this.app.workspace.getActiveFile()?.path ?? "";
    const cards = this.plugin.scrollCards(path);
    const stats = this.plugin.scrollDeckStats();
    const total = Math.max(this.plugin.scrollTotalItems, cards.length);
    const rows = weakRows(cards, total, Date.now(), {
      from: this.plugin.settings.scrollShuffleFrom,
      to: this.plugin.settings.scrollShuffleTo,
      retention: this.plugin.settings.scrollRetention,
      limit: 20,
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
        text: `Due next 7 days: ${forecast.join(" · ")}`,
      });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ScrollFilterModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Autoscroll — revise which toggles?");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const options: { label: string; filter: RecallColor[] }[] = [
      { label: "⚪ All toggles", filter: [] },
      { label: "🔴 Red only", filter: ["red"] },
      { label: "🟡 Yellow only", filter: ["yellow"] },
      { label: "🟢 Green only", filter: ["green"] },
      { label: "🔴🟡 Red + Yellow (weak spots)", filter: ["red", "yellow"] },
      { label: "🔴🟡🟢 All graded toggles", filter: ["red", "yellow", "green"] },
    ];
    const active = this.plugin.settings.scrollFilter;
    for (const opt of options) {
      const btn = list.createEl("button", {
        text: opt.label,
        cls: "notion-toggle-color-btn",
      });
      if (sameFilter(opt.filter, active)) btn.addClass("is-suggested");
      btn.onclick = async () => {
        await this.plugin.setScrollFilter(opt.filter);
        this.close();
      };
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** v1.3.0 — the same picker, but for quiz mode. */
export const QUIZ_FILTER_OPTIONS: { label: string; filter: RecallColor[] }[] = [
  { label: "⚪ Default — every toggle", filter: [] },
  { label: "🔴 Red only", filter: ["red"] },
  { label: "🟡 Yellow only", filter: ["yellow"] },
  { label: "🟢 Green only", filter: ["green"] },
  { label: "🔴🟡 Red + Yellow (weak spots)", filter: ["red", "yellow"] },
  { label: "🔴🟡🟢 All graded toggles", filter: ["red", "yellow", "green"] },
];

class QuizFilterModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Quiz — ask about which toggles?");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const active = this.plugin.quizFilterColors();
    for (const opt of QUIZ_FILTER_OPTIONS) {
      const btn = list.createEl("button", { text: opt.label, cls: "notion-toggle-color-btn" });
      if (sameFilter(opt.filter, active)) btn.addClass("is-suggested");
      btn.onclick = async () => {
        await this.plugin.setQuizFilter(opt.filter);
        this.close();
      };
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}



/* ---------- v1.1.1: pause-at mode, dwell and speed pickers ---------- */

class ScrollModeModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Autoscroll — pause at");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const options: { label: string; mode: ScrollMode }[] = [
      { label: "∞ Every toggle", mode: "all" },
      { label: "1️⃣ Odd toggles (1, 3, 5 …)", mode: "odd" },
      { label: "2️⃣ Even toggles (2, 4, 6 …)", mode: "even" },
      { label: "✍️ Custom list", mode: "custom" },
      { label: "🧭 Route (my own order)", mode: "route" },
      { label: "🔀 Shuffle (weakest first)", mode: "shuffle" },
    ];
    for (const opt of options) {
      const btn = list.createEl("button", { text: opt.label, cls: "notion-toggle-color-btn" });
      if (this.plugin.settings.scrollMode === opt.mode) btn.addClass("is-suggested");
      btn.onclick = async () => {
        if (opt.mode === "shuffle") {
          this.close();
          await this.plugin.rebuildShuffleRoute();
          this.plugin.refreshScrollPlan();
          return;
        }
        this.plugin.settings.scrollMode = opt.mode;
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
        new Notice(`Autoscroll pauses at: ${modeLabel(this.plugin.modeConfig())}`);
        this.close();
      };
    }

    new Setting(this.contentEl)
      .setName("Custom list")
      .setDesc("Toggle numbers to stop at, e.g. 2, 5, 9.")
      .addText((t) =>
        t
          .setPlaceholder("2, 5, 9")
          .setValue((this.plugin.settings.scrollPicks ?? []).join(", "))
          .onChange(async (v) => {
            this.plugin.settings.scrollPicks = parsePicks(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.contentEl)
      .setName("Route")
      .setDesc("Your own visit order, e.g. 7, 2, 9, 2.")
      .addText((t) =>
        t
          .setPlaceholder("7, 2, 9")
          .setValue((this.plugin.settings.scrollRoute ?? []).join(", "))
          .onChange(async (v) => {
            this.plugin.settings.scrollRoute = parseRoute(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.contentEl)
      .setName("Loop the route")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollLoopRoute).onChange(async (v) => {
          this.plugin.settings.scrollLoopRoute = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(this.contentEl)
      .setName("Shuffle range")
      .setDesc("Limit shuffle to these toggle numbers (0 = whole note).")
      .addText((t) =>
        t
          .setPlaceholder("from")
          .setValue(String(this.plugin.settings.scrollShuffleFrom || ""))
          .onChange(async (v) => {
            this.plugin.settings.scrollShuffleFrom = Math.max(0, Math.floor(Number(v) || 0));
            await this.plugin.saveSettings();
          })
      )
      .addText((t) =>
        t
          .setPlaceholder("to")
          .setValue(String(this.plugin.settings.scrollShuffleTo || ""))
          .onChange(async (v) => {
            this.plugin.settings.scrollShuffleTo = Math.max(0, Math.floor(Number(v) || 0));
            await this.plugin.saveSettings();
          })
      );

    const stats = this.plugin.scrollDeckStats();
    if (stats) {
      this.contentEl.createDiv({
        cls: "notion-toggle-deck-summary",
        text: deckSummary(stats),
      });
      const forecast = this.plugin.scrollForecast();
      if (forecast.some((n) => n > 0)) {
        this.contentEl.createDiv({
          cls: "notion-toggle-deck-forecast",
          text: `Due next 7 days: ${forecast.join(" · ")}`,
        });
      }
    }

    new Setting(this.contentEl)
      .setName("Tall toggles screen-by-screen")
      .setDesc("Long answers are read one screen at a time before moving on.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollChunkTall).onChange(async (v) => {
          this.plugin.settings.scrollChunkTall = v;
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ScrollDwellModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Autoscroll — pause for");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const quick = [5, 10, 20, 30, 60, 120, 300, 600, 1800, 3600];
    const current = clampHold(this.plugin.settings.scrollHold);
    for (const secs of quick) {
      const btn = list.createEl("button", {
        text: formatDwell(secs),
        cls: "notion-toggle-color-btn",
      });
      if (secs === current) btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.scrollHold = clampDwellSeconds(secs);
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
        new Notice(`Autoscroll pauses for ${formatDwell(secs)}.`);
        this.close();
      };
    }

    new Setting(this.contentEl)
      .setName("Custom seconds")
      .setDesc(`1 – ${DWELL_PRESETS[DWELL_PRESETS.length - 1]} seconds.`)
      .addText((t) =>
        t.setPlaceholder(String(current)).onChange(async (v) => {
          const n = clampDwellSeconds(Number(v), current);
          this.plugin.settings.scrollHold = n;
          await this.plugin.saveSettings();
        })
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

class ScrollSpeedModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Autoscroll speed");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const active = multiplierFromSpeed(this.plugin.settings.scrollSpeed);
    for (const mult of SPEED_MULTIPLIERS) {
      const btn = list.createEl("button", { text: `${mult}x`, cls: "notion-toggle-color-btn" });
      if (mult === active) btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.scrollSpeed = speedFromMultiplier(mult);
        await this.plugin.saveSettings();
        this.plugin.refreshScrollPlan();
        new Notice(`Autoscroll speed: ${mult}x`);
        this.close();
      };
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- v1.1.5: one sheet with every autoscroll control ---------- */

class ScrollSheetModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onClose() {
    this.contentEl.empty();
    this.plugin.scrollSheetOpen = false;
    this.plugin.syncScrollFab();
  }

  onOpen() {
    this.modalEl.addClass("ntt-sheet");
    this.setTitle("Autoscroll — quick controls");
    const s = this.plugin.settings;

    // v1.1.8 — the sheet itself is the on/off switch (long-press ▶ opens it).
    new Setting(this.contentEl)
      .setName("Autoscroll")
      .setDesc("ON = is note par autoscroll chalu, OFF = band. Screen ko dabaye rakho to jab tak hold hai scroll ruka rahega.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.autoScrollActive() && this.plugin.scrollRunning).onChange(async (v) => {
          await this.plugin.setAutoScrollEnabled(v);
          tg.setValue(this.plugin.autoScrollActive() && this.plugin.scrollRunning);
        })
      );

    // v1.1.9 — quiz mode is reachable from the same sheet (no toolbar needed).
    new Setting(this.contentEl)
      .setName("Quiz (timed question run)")
      .setDesc("ON = timed quiz shuru — har toggle par timer, auto reveal, auto next.")
      .addToggle((tg) =>
        tg.setValue(!!this.plugin.quizState).onChange((v) => {
          if (v) this.plugin.startQuizRun();
          else this.plugin.stopQuiz(true);
          tg.setValue(!!this.plugin.quizState);
        })
      );

    // v1.2.1 — quiz timing + auto-next are tunable right here in the sheet.
    new Setting(this.contentEl)
      .setName("Quiz — time per question")
      .setDesc("Seconds before the answer khud reveal ho. Toggle title me ⏱30 / [30s] likho to us question par wahi chalega.")
      .addSlider((sl) =>
        sl
          .setLimits(QUIZ_SECONDS_MIN, 120, 1)
          .setValue(clampQuizSeconds(s.quizSeconds))
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.quizSeconds = clampQuizSeconds(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.contentEl)
      .setName("Quiz — answer time")
      .setDesc("Reveal hone ke baad answer kitne second khula rahe.")
      .addSlider((sl) =>
        sl
          .setLimits(1, 60, 1)
          .setValue(clampRevealSeconds(s.quizRevealSeconds))
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.quizRevealSeconds = clampRevealSeconds(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(this.contentEl)
      .setName("Quiz — auto next")
      .setDesc("ON = answer ke baad agla question khud, OFF = wahin ruk jao.")
      .addToggle((tg) =>
        tg.setValue(s.quizAutoNext).onChange(async (v) => {
          s.quizAutoNext = v;
          await this.plugin.saveSettings();
        })
      );

    // v1.3.0 — quiz ka apna colour filter, autoscroll wale picker jaisa.
    new Setting(this.contentEl)
      .setName("Quiz — kaunse toggle")
      .setDesc(`Abhi ${filterLabel(this.plugin.quizFilterColors())} — default, 🔴, 🟡, 🟢 …`)
      .addButton((b) =>
        b.setButtonText("Filter").onClick(() => {
          this.close();
          new QuizFilterModal(this.app, this.plugin).open();
        })
      );

    new Setting(this.contentEl)
      .setName("Quiz — minimal UI")
      .setDesc("Sirf question par chhota timer ring, koi floating box nahi.")
      .addToggle((tg) =>
        tg.setValue(s.quizMinimalUi).onChange(async (v) => {
          s.quizMinimalUi = v;
          await this.plugin.saveSettings();
        })
      );


    new Setting(this.contentEl)
      .setName("Quiz — loop")
      .setDesc("Aakhri question ke baad phir se question 1 se shuru.")
      .addToggle((tg) =>
        tg.setValue(s.quizLoop).onChange(async (v) => {
          s.quizLoop = v;
          await this.plugin.saveSettings();
        })
      );



    // v1.2.0 — direction moved off the FAB into the sheet (single button UI).
    new Setting(this.contentEl)
      .setName("Direction")
      .setDesc("Forward = neeche ki taraf, Reverse = upar ki taraf scroll.")
      .addToggle((tg) =>
        tg
          .setTooltip("Reverse (upar)")
          .setValue(!!s.scrollReverse)
          .onChange(async (v) => {
            await this.plugin.setScrollReverse(v);
            tg.setValue(!!this.plugin.settings.scrollReverse);
          })
      );

    new Setting(this.contentEl)
      .setName("Speed")
      .setDesc(`Currently ${multiplierFromSpeed(s.scrollSpeed)}x.`)
      .addButton((btn) =>
        btn.setButtonText("Choose").onClick(() => new ScrollSpeedModal(this.app, this.plugin).open())
      );

    new Setting(this.contentEl)
      .setName("Pause for")
      .setDesc(`Hold time — currently ${formatDwell(clampHold(s.scrollHold))}.`)
      .addButton((btn) =>
        btn.setButtonText("Choose").onClick(() => new ScrollDwellModal(this.app, this.plugin).open())
      );

    new Setting(this.contentEl)
      .setName("Pause at")
      .setDesc(`Currently ${modeLabel(this.plugin.modeConfig())}.`)
      .addButton((btn) =>
        btn.setButtonText("Choose").onClick(() => new ScrollModeModal(this.app, this.plugin).open())
      );

    new Setting(this.contentEl)
      .setName("Colour filter")
      .setDesc(`Currently ${filterLabel(s.scrollFilter)}.`)
      .addButton((btn) =>
        btn
          .setButtonText("Choose")
          .onClick(() => new ScrollFilterModal(this.app, this.plugin).open())
      );

    new Setting(this.contentEl).setName("Reverse direction ↑").addToggle((tg) =>
      tg.setValue(s.scrollReverse).onChange(async (v) => {
        await this.plugin.setScrollReverse(v);
      })
    );

    new Setting(this.contentEl).setName("Loop the note").addToggle((tg) =>
      tg.setValue(s.scrollLoop).onChange(async (v) => {
        this.plugin.settings.scrollLoop = v;
        await this.plugin.saveSettings();
      })
    );

    new Setting(this.contentEl).setName("Open toggles automatically").addToggle((tg) =>
      tg.setValue(s.scrollAutoOpen).onChange(async (v) => {
        this.plugin.settings.scrollAutoOpen = v;
        await this.plugin.saveSettings();
      })
    );

    new Setting(this.contentEl).setName("Close them when leaving").addToggle((tg) =>
      tg.setValue(s.scrollAutoClose).onChange(async (v) => {
        this.plugin.settings.scrollAutoClose = v;
        await this.plugin.saveSettings();
      })
    );

    new Setting(this.contentEl)
      .setName("Tall toggles screen-by-screen")
      .addToggle((tg) =>
        tg.setValue(s.scrollChunkTall).onChange(async (v) => {
          this.plugin.settings.scrollChunkTall = v;
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
        })
      );

    new Setting(this.contentEl).setName("Debug overlay").addToggle((tg) =>
      tg.setValue(s.scrollDebug).onChange(async (v) => {
        this.plugin.settings.scrollDebug = v;
        await this.plugin.saveSettings();
        this.plugin.syncScrollDebugOverlay();
      })
    );

    // v1.2.1 — silence the status popups straight from the sheet.
    new Setting(this.contentEl)
      .setName("Quiet mode (no popups)")
      .setDesc("ON = speed / direction / plain-scroll wale notice nahi dikhenge.")
      .addToggle((tg) =>
        tg.setValue(s.scrollQuiet).onChange(async (v) => {
          this.plugin.settings.scrollQuiet = v;
          await this.plugin.saveSettings();
        })
      );


    new Setting(this.contentEl)
      .setName("More")
      .addButton((btn) =>
        btn.setButtonText("Go to first").onClick(() => {
          this.close();
          this.plugin.scrollToStart();
        })
      )
      .addButton((btn) =>
        btn
          .setButtonText("Stats")
          .onClick(() => new ScrollStatsModal(this.app, this.plugin).open())
      )
      .addButton((btn) =>
        btn
          .setButtonText("Toolbar guide")
          .onClick(() => new MobileToolbarGuideModal(this.app, this.plugin).open())
      );
  }



}

/* ---------- v1.1.5: in-app guide — which mobile toolbar commands to add ---------- */

class MobileToolbarGuideModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ntt-guide");
    this.setTitle("Mobile toolbar — Autoscroll setup");

    const progress = this.contentEl.createDiv({ cls: "ntt-guide-progress" });
    progress.setText(
      `Checklist: ${guideProgress(this.plugin.settings.toolbarGuideDone ?? [])} added`
    );

    const steps = this.contentEl.createEl("ol", { cls: "ntt-guide-steps" });
    for (const step of TOOLBAR_STEPS) steps.createEl("li", { text: step });

    new Setting(this.contentEl)
      .setName("Open Obsidian settings")
      .setDesc("Mobile → Manage toolbar me seedha jump (agar version support kare).")
      .addButton((btn) =>
        btn.setButtonText("Open settings").onClick(() => {
          try {
            const setting = (this.app as unknown as { setting?: { open?: () => void; openTabById?: (id: string) => void } }).setting;
            setting?.open?.();
            setting?.openTabById?.("mobile");
          } catch {
            new Notice("Settings manually kholo: ⚙️ → Mobile → Manage toolbar");
          }
        })
      )
      .addButton((btn) =>
        btn.setButtonText("Reset checklist").onClick(async () => {
          this.plugin.settings.toolbarGuideDone = [];
          await this.plugin.saveSettings();
          this.contentEl.empty();
          this.onOpen();
          this.contentEl.scrollTop = 0;
        })
      );

    this.contentEl.createEl("h3", { text: "Ye commands add karo (tap = tick ✓)" });
    const done = new Set(this.plugin.settings.toolbarGuideDone ?? []);
    for (const cmd of [...TOOLBAR_COMMANDS].sort((a, b) => a.priority - b.priority)) {
      const row = new Setting(this.contentEl)
        .setName(cmd.name)
        .setDesc(cmd.why)
        .addToggle((tg) =>
          tg.setValue(done.has(cmd.id)).onChange(async () => {
            this.plugin.settings.toolbarGuideDone = toggleGuideDone(
              this.plugin.settings.toolbarGuideDone ?? [],
              cmd.id
            );
            await this.plugin.saveSettings();
            progress.setText(
              `Checklist: ${guideProgress(this.plugin.settings.toolbarGuideDone)} added`
            );
          })
        );
      row.settingEl.addClass("ntt-guide-row");
      if (done.has(cmd.id)) row.settingEl.addClass("is-done");
    }

    this.contentEl.createDiv({
      cls: "ntt-guide-tip",
      text: "Tip: floating ▶ button pe long-press karne se bhi Autoscroll sheet khul jaati hai — toolbar me sirf start/pause wali command kaafi hai.",
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- v1.1.0: quiz time picker ---------- */

class QuizSecondsModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Quiz — time per question");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const current = clampQuizSeconds(this.plugin.settings.quizSeconds);
    for (const seconds of QUIZ_PRESETS) {
      const btn = list.createEl("button", {
        text: `${seconds} seconds`,
        cls: "notion-toggle-color-btn",
      });
      if (seconds === current) btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.quizSeconds = clampQuizSeconds(seconds);
        await this.plugin.saveSettings();
        new Notice(`Quiz: ${seconds}s per question.`);
        this.close();
      };
    }

    const input = this.contentEl.createEl("input", { cls: "ntt-modal-input" });
    input.type = "number";
    input.min = String(QUIZ_SECONDS_MIN);
    input.max = String(QUIZ_SECONDS_MAX);
    input.value = String(current);
    input.placeholder = "Custom seconds";

    const actions = this.contentEl.createDiv({ cls: "ntt-modal-actions" });
    const save = actions.createEl("button", { text: "Save" });
    save.addClass("mod-cta");
    save.onclick = async () => {
      const seconds = clampQuizSeconds(Number(input.value));
      this.plugin.settings.quizSeconds = seconds;
      await this.plugin.saveSettings();
      new Notice(`Quiz: ${seconds}s per question.`);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- Quick Q&A Modal ---------- */

class QuickQAModal extends Modal {
  plugin: NotionTogglePlugin;
  onSubmit: (result: { question: string; answer: string }) => void;
  questionEl!: HTMLTextAreaElement;
  answerEl!: HTMLTextAreaElement;

  constructor(app: App, plugin: NotionTogglePlugin, onSubmit: (result: { question: string; answer: string }) => void) {
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
        answer: this.answerEl.value,
      });
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- Colour picker ---------- */

class ColorPickerModal extends Modal {
  onPick: (colorId: string) => void;

  constructor(app: App, onPick: (colorId: string) => void) {
    super(app);
    this.onPick = onPick;
  }

  onOpen() {
    const { contentEl } = this;
    this.setTitle("Toggle colour");
    const list = contentEl.createDiv({ cls: "notion-toggle-color-list" });
    for (const color of TOGGLE_COLORS) {
      if (!color.callout) continue;
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
}

/* ---------- Settings Tab ---------- */

class NotionToggleSettingTab extends PluginSettingTab {
  plugin: NotionTogglePlugin;

  constructor(app: App, plugin: NotionTogglePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Toggle colour")
      .setDesc("Traffic-light colours for active recall: red = hard, yellow = revise, green = mastered. Plain = clean black Notion look.")
      .addDropdown((dropdown) => {
        for (const c of TOGGLE_COLORS) dropdown.addOption(c.id, c.label);
        dropdown.setValue(this.plugin.settings.color);
        dropdown.onChange(async (value) => {
          this.plugin.settings.color = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Auto-numbering")
      .setDesc("New toggles get 1., 2., 3., ... automatically — you never type the number. Use \"Renumber toggles in note\" to fix gaps.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.numberedByDefault);
        toggle.onChange(async (value) => {
          this.plugin.settings.numberedByDefault = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("MCQ options")
      .setDesc("How many checkbox options a new MCQ toggle gets (2-6).")
      .addSlider((slider) => {
        slider.setLimits(2, 6, 1).setDynamicTooltip();
        slider.setValue(this.plugin.settings.mcqOptionCount);
        slider.onChange(async (value) => {
          this.plugin.settings.mcqOptionCount = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Match the following rows")
      .setDesc("How many rows a new match table gets (2-8).")
      .addSlider((slider) => {
        slider.setLimits(2, 8, 1).setDynamicTooltip();
        slider.setValue(this.plugin.settings.matchRowCount);
        slider.onChange(async (value) => {
          this.plugin.settings.matchRowCount = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Auto-add Answer line")
      .setDesc("Add an \"**Answer:** \" line inside new MCQ / match toggles.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.addAnswerLine);
        toggle.onChange(async (value) => {
          this.plugin.settings.addAnswerLine = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default callout type")
      .setDesc("Type used when inserting/wrapping toggles.")
      .addDropdown((dropdown) => {
        for (const t of CALLOUT_TYPES) {
          dropdown.addOption(t, t);
        }
        dropdown.setValue(this.plugin.settings.calloutType);
        dropdown.onChange(async (value) => {
          this.plugin.settings.calloutType = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Default collapsed")
      .setDesc("On: toggles start collapsed (answer hidden). Off: expanded.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.defaultCollapsed);
        toggle.onChange(async (value) => {
          this.plugin.settings.defaultCollapsed = value;
          await this.plugin.saveSettings();
        });
      });


    new Setting(containerEl)
      .setName("Auto-continue on Enter")
      .setDesc("Inside a toggle, Enter keeps writing the answer; Enter on an empty toggle line starts the NEXT toggle.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoContinue);
        toggle.onChange(async (value) => {
          this.plugin.settings.autoContinue = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Toggle format")
      .setDesc("Native callout (recommended, folds in Obsidian) or HTML <details>.")
      .addDropdown((dropdown) => {
        dropdown.addOption("callout", "Native callout (> [!question]-)");
        dropdown.addOption("details", "HTML <details>");
        dropdown.setValue(this.plugin.settings.format);
        dropdown.onChange(async (value) => {
          this.plugin.settings.format = value as ToggleFormat;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Bold the question/summary")
      .setDesc("Auto-wrap the title in **bold** (skips already-bold text).")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.boldSummary);
        toggle.onChange(async (value) => {
          this.plugin.settings.boldSummary = value;
          await this.plugin.saveSettings();
        });
      });

    /* ---------- v1.0.5: Recall timer (Pomodoro) ---------- */

    new Setting(containerEl).setName("Recall timer (Pomodoro)").setHeading();

    new Setting(containerEl)
      .setName("Preset")
      .setDesc("Pick a rhythm, or choose Custom and set your own minutes below.")
      .addDropdown((dropdown) => {
        for (const p of POMODORO_PRESETS) dropdown.addOption(p.id, p.label);
        dropdown.setValue(this.plugin.settings.preset);
        dropdown.onChange(async (value) => {
          const resolved = resolvePreset(this.plugin.settings, value);
          Object.assign(this.plugin.settings, resolved);
          await this.plugin.saveSettings();
          this.plugin.refreshTimerDurations();
          this.display();
        });
      });

    const minuteSetting = (
      name: string,
      desc: string,
      get: () => number,
      set: (v: number) => void,
      min: number,
      max: number
    ) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addSlider((slider) => {
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
      (v) => (this.plugin.settings.focusMinutes = v),
      5,
      90
    );
    minuteSetting(
      "Short break minutes",
      "Break after each focus session.",
      () => this.plugin.settings.shortBreakMinutes,
      (v) => (this.plugin.settings.shortBreakMinutes = v),
      1,
      30
    );
    minuteSetting(
      "Long break minutes",
      "Break after a full cycle of focus sessions.",
      () => this.plugin.settings.longBreakMinutes,
      (v) => (this.plugin.settings.longBreakMinutes = v),
      5,
      60
    );

    new Setting(containerEl)
      .setName("Sessions before long break")
      .setDesc("How many focus sessions make one cycle (1-8).")
      .addSlider((slider) => {
        slider.setLimits(1, 8, 1).setDynamicTooltip();
        slider.setValue(this.plugin.settings.sessionsBeforeLongBreak);
        slider.onChange(async (value) => {
          this.plugin.settings.sessionsBeforeLongBreak = value;
          await this.plugin.saveSettings();
          this.plugin.renderTimer();
        });
      });

    const boolSetting = (
      name: string,
      desc: string,
      get: () => boolean,
      set: (v: boolean) => void
    ) => {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((toggle) => {
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
      (v) => (this.plugin.settings.autoStartNext = v)
    );
    boolSetting(
      "Notice on phase end",
      "Show a notice with your 🔴/🟡/🟢 toggle counts when a phase ends.",
      () => this.plugin.settings.notifyOnPhaseEnd,
      (v) => (this.plugin.settings.notifyOnPhaseEnd = v)
    );
    boolSetting(
      "Vibrate / buzz on phase end",
      "Short vibration on mobile when a phase ends.",
      () => this.plugin.settings.soundOnPhaseEnd,
      (v) => (this.plugin.settings.soundOnPhaseEnd = v)
    );
    boolSetting(
      "Show timer on startup",
      "Float the timer as soon as Obsidian opens.",
      () => this.plugin.settings.showOnStartup,
      (v) => (this.plugin.settings.showOnStartup = v)
    );
    boolSetting(
      "Compact timer by default",
      "Show only the clock (small pill) — handy on mobile.",
      () => this.plugin.settings.compactByDefault,
      (v) => (this.plugin.settings.compactByDefault = v)
    );

    /* ---------- v1.0.6: attention-aware behaviour ---------- */
    new Setting(containerEl).setName("Timer focus guard (v1.0.6)").setHeading();

    boolSetting(
      "Auto-pause when you leave",
      "Pause the running timer when Obsidian goes to the background or you switch away.",
      () => this.plugin.settings.autoPauseOnLeave,
      (v) => (this.plugin.settings.autoPauseOnLeave = v)
    );
    boolSetting(
      "Pin session to its note",
      "Only the note where the session started counts as focus time.",
      () => this.plugin.settings.pinToSessionNote,
      (v) => (this.plugin.settings.pinToSessionNote = v)
    );
    boolSetting(
      "Auto-resume when you return",
      "Continue automatically once you are back on the session note.",
      () => this.plugin.settings.autoResumeOnReturn,
      (v) => (this.plugin.settings.autoResumeOnReturn = v)
    );
    boolSetting(
      "Collapse toggles on break",
      "When a focus phase ends, hide every answer again for the next recall round.",
      () => this.plugin.settings.autoCollapseOnBreak,
      (v) => (this.plugin.settings.autoCollapseOnBreak = v)
    );

    new Setting(containerEl)
      .setName("Idle pause (minutes)")
      .setDesc("Pause the focus phase after this much inactivity. 0 turns it off.")
      .addText((text) => {
        text
          .setPlaceholder("2")
          .setValue(String(this.plugin.settings.idlePauseMinutes))
          .onChange(async (value) => {
            const n = Number.parseInt(value, 10);
            this.plugin.settings.idlePauseMinutes = Number.isFinite(n)
              ? Math.max(0, Math.min(120, n))
              : 0;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl).setName("Minimal mode & spaced repetition").setHeading();

    new Setting(containerEl)
      .setName("Minimal command names")
      .setDesc(
        "Keep 4 primary commands (Toggle, Colour, Recall, Review) clean and prefix everything else with \"Advanced:\" so the toolbar stays uncluttered. Restart Obsidian to refresh names."
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.minimalNames).onChange(async (v) => {
          this.plugin.settings.minimalNames = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Ask for a grade after each focus phase")
      .setDesc("Shows Again / Hard / Good / Easy on the timer; SM-2 then calculates your next recall date automatically.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.autoReview).onChange(async (v) => {
          this.plugin.settings.autoReview = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Recall schedule")
      .setDesc(
        `${scheduleStoreSummary(Object.keys(this.plugin.settings.srs ?? {}).length)} Schedules follow a note when you rename or move it (v1.0.8).`
      )
      .addButton((btn) => {
        btn.setButtonText("Clean up").onClick(async () => {
          const removed = await this.plugin.pruneSchedule();
          new Notice(
            removed > 0
              ? `Removed ${removed} schedule${removed === 1 ? "" : "s"} for missing notes.`
              : "Nothing to clean up."
          );
          this.display();
        });
      })
      .addButton((btn) => {
        btn.setWarning().setButtonText("Clear all").onClick(async () => {
          this.plugin.settings.srs = {};
          await this.plugin.saveSettings();
          new Notice("Recall schedule cleared.");
          this.display();
        });
      });


    /* ---------- v1.0.9: auto-scroll revision ---------- */
    new Setting(containerEl).setName("Auto-scroll revision").setHeading();

    /* ---------- v1.1.6: explicit ON / OFF switch ---------- */
    new Setting(containerEl)
      .setName("Autoscroll running")
      .setDesc(
        `ON = active note par autoscroll start, OFF = stop. Hotkey: ${hotkeyLabel(
          "smart-autoscroll"
        )} · reverse: ${hotkeyLabel("autoscroll-reverse")} · sheet: ${hotkeyLabel("autoscroll-sheet")}.`
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.autoScrollActive()).onChange(async (v) => {
          await this.plugin.setAutoScrollEnabled(v);
          tg.setValue(this.plugin.autoScrollActive());
        })
      );

    new Setting(containerEl)
      .setName("Hotkeys")
      .setDesc(
        HOTKEYS.map((h) => `${h.id} → ${h.label}`).join("  ·  ") +
          "  — Settings → Hotkeys me badal sakte ho."
      );

    new Setting(containerEl)
      .setName("Scroll speed")
      .setDesc("Pixels per second while gliding to the next toggle.")
      .addSlider((sl) =>
        sl
          .setLimits(SPEED_MIN, SPEED_MAX, SPEED_STEP)
          .setValue(clampSpeed(this.plugin.settings.scrollSpeed))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scrollSpeed = clampSpeed(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hold time on each toggle")
      .setDesc("Seconds the opened toggle stays visible before moving on.")
      .addSlider((sl) =>
        sl
          .setLimits(0, 30, 1)
          .setValue(clampHold(this.plugin.settings.scrollHold))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scrollHold = clampHold(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Reverse direction")
      .setDesc("Scroll bottom → top for fast backwards revision.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollReverse).onChange(async (v) => {
          this.plugin.settings.scrollReverse = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Colour filter")
      .setDesc(
        `Stop only at these toggles — currently ${filterLabel(this.plugin.settings.scrollFilter)}.`
      )
      .addButton((btn) => {
        btn.setButtonText("Choose colours").onClick(() => {
          new ScrollFilterModal(this.app, this.plugin).open();
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("Open the toggle automatically")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollAutoOpen).onChange(async (v) => {
          this.plugin.settings.scrollAutoOpen = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Close it again when leaving")
      .setDesc("Keeps active recall honest: only one answer is visible at a time.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollAutoClose).onChange(async (v) => {
          this.plugin.settings.scrollAutoClose = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Loop the note")
      .setDesc("Start over from the other end instead of stopping.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollLoop).onChange(async (v) => {
          this.plugin.settings.scrollLoop = v;
          await this.plugin.saveSettings();
        })
      );

    /* ---------- v1.1.1: pause-at + revision memory ---------- */
    new Setting(containerEl)
      .setName("Pause at")
      .setDesc(
        `Which toggles the autoscroll stops at — currently ${modeLabel(this.plugin.modeConfig())}.`
      )
      .addButton((btn) =>
        btn.setButtonText("Choose mode").onClick(() => {
          new ScrollModeModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName("Pause for")
      .setDesc(`Hold time on each stop — currently ${formatDwell(clampHold(this.plugin.settings.scrollHold))}.`)
      .addButton((btn) =>
        btn.setButtonText("Choose time").onClick(() => {
          new ScrollDwellModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName("Speed presets")
      .setDesc(`Multiplier of the reading speed — currently ${multiplierFromSpeed(this.plugin.settings.scrollSpeed)}x.`)
      .addButton((btn) =>
        btn.setButtonText("Choose speed").onClick(() => {
          new ScrollSpeedModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName("Tall toggles screen-by-screen")
      .setDesc("Long answers are read one screen at a time before the next toggle.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollChunkTall).onChange(async (v) => {
          this.plugin.settings.scrollChunkTall = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Loop the route")
      .setDesc("Route / shuffle runs restart from the beginning instead of stopping.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollLoopRoute).onChange(async (v) => {
          this.plugin.settings.scrollLoopRoute = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto-grade during shuffle")
      .setDesc("Toggles you linger on come back sooner; quick ones move further away.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollAutoGrade).onChange(async (v) => {
          this.plugin.settings.scrollAutoGrade = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("New toggles mixed into shuffle")
      .setDesc("0 = only revise old toggles, 1 = new ones first.")
      .addSlider((sl) =>
        sl
          .setLimits(0, 1, 0.05)
          .setValue(this.plugin.settings.scrollNewMix)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scrollNewMix = v;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Weak toggles / priority")
      .setDesc("Why the shuffle picks what it picks — recall, difficulty and lapses per toggle.")
      .addButton((btn) =>
        btn.setButtonText("Show stats").onClick(() => {
          new ScrollStatsModal(this.app, this.plugin).open();
        })
      );

    new Setting(containerEl)
      .setName("Debug overlay")
      .setDesc(
        "Shows the live loop state while autoscroll runs: position, direction, waypointReached / crossedTarget, dwell key and grade."
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollDebug).onChange(async (v) => {
          this.plugin.settings.scrollDebug = v;
          await this.plugin.saveSettings();
          this.plugin.syncScrollDebugOverlay();
        })
      );

    new Setting(containerEl)
      .setName("Revision memory")
      .setDesc("Forget what this note's shuffle learned about you.")
      .addButton((btn) =>
        btn.setButtonText("Reset for this note").onClick(async () => {
          await this.plugin.resetScrollMemory();
        })
      );

    /* ---------- v1.1.5: floating button + mobile guide ---------- */

    new Setting(containerEl)
      .setName("Floating autoscroll button")
      .setDesc(
        "Note khulte hi bottom-right me ▶ button — tap = start / pause, chhota ↑/↓ chip = reverse, long-press = autoscroll sheet. Session chalne par bhi screen par rehta hai."
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollFab).onChange(async (v) => {
          this.plugin.settings.scrollFab = v;
          await this.plugin.saveSettings();
          this.plugin.syncScrollFab();
        })
      );

    new Setting(containerEl)
      .setName("Classic control bar")
      .setDesc(
        "OFF (default) = minimal UI: sirf floating ▶ aur ↑/↓ button. ON = purani poori control bar (−, +, filter, mode, ⏱, ⤒, ✕) bhi dikhegi."
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollBarClassic).onChange(async (v) => {
          this.plugin.settings.scrollBarClassic = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Quiet mode")
      .setDesc(
        "ON (default) = autoscroll ke status popup (speed/direction/filter/plain-scroll) nahi dikhenge; sirf zaroori error notices aayenge."
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollQuiet).onChange(async (v) => {
          this.plugin.settings.scrollQuiet = v;
          await this.plugin.saveSettings();
        })
      );



    new Setting(containerEl)
      .setName("Mobile toolbar guide")
      .setDesc("Kaunsi commands Settings → Mobile → Manage toolbar me add karni hain — one-tap checklist ke saath.")
      .addButton((btn) =>
        btn.setButtonText("Open guide").onClick(() => {
          new MobileToolbarGuideModal(this.app, this.plugin).open();
        })
      );

    /* ---------- v1.1.0: quiz mode ---------- */
    new Setting(containerEl).setName("Quiz mode").setHeading();

    new Setting(containerEl)
      .setName("Time per question")
      .setDesc(
        "Seconds before the answer is revealed. Write ⏱30 (or [30s]) in a toggle title to override it for that question."
      )
      .addSlider((sl) =>
        sl
          .setLimits(QUIZ_SECONDS_MIN, 120, 1)
          .setValue(clampQuizSeconds(this.plugin.settings.quizSeconds))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.quizSeconds = clampQuizSeconds(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Answer time")
      .setDesc("Seconds the revealed answer stays open before the toggle closes.")
      .addSlider((sl) =>
        sl
          .setLimits(1, 60, 1)
          .setValue(clampRevealSeconds(this.plugin.settings.quizRevealSeconds))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.quizRevealSeconds = clampRevealSeconds(v);
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Go to the next question automatically")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizAutoNext).onChange(async (v) => {
          this.plugin.settings.quizAutoNext = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Close the toggle after the answer")
      .setDesc("Only one answer is visible at a time.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizCloseAfterReveal).onChange(async (v) => {
          this.plugin.settings.quizCloseAfterReveal = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Use the colour filter")
      .setDesc("Quiz only the chosen colours instead of every toggle.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizUseColorFilter).onChange(async (v) => {
          this.plugin.settings.quizUseColorFilter = v;
          await this.plugin.saveSettings();
          this.display();
        })
      );

    new Setting(containerEl)
      .setName("Quiz colours")
      .setDesc(`Currently ${filterLabel(this.plugin.quizFilterColors())}.`)
      .addButton((b) =>
        b
          .setButtonText("Choose")
          .onClick(() => new QuizFilterModal(this.app, this.plugin).open())
      );

    new Setting(containerEl)
      .setName("Minimal quiz UI")
      .setDesc("Only the small timer ring on the question — no floating control strip.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizMinimalUi).onChange(async (v) => {
          this.plugin.settings.quizMinimalUi = v;
          await this.plugin.saveSettings();
        })
      );


    new Setting(containerEl)
      .setName("Loop the quiz")
      .setDesc("Start again from the first question instead of finishing.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizLoop).onChange(async (v) => {
          this.plugin.settings.quizLoop = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Notify when the time is up")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.quizBeepOnTimeUp).onChange(async (v) => {
          this.plugin.settings.quizBeepOnTimeUp = v;
          await this.plugin.saveSettings();
        })
      );


    new Setting(containerEl)
      .setName("Reset timer position")
      .setDesc("Bring the floating timer back to the top-left if it drifted off-screen.")
      .addButton((btn) => {
        btn.setButtonText("Reset position").onClick(async () => {
          this.plugin.settings.timerX = 24;
          this.plugin.settings.timerY = 120;
          await this.plugin.saveSettings();
          this.plugin.hideTimer();
          this.plugin.showTimer();
        });
      });
  }
}

/* ---------- Conversion logic ---------- */

/**
 * Convert all <details><summary>...</summary>...</details> blocks in a
 * document to Obsidian foldable callout toggles.
 *
 * Handles:
 *  - <summary><b>Q1. ...</b></summary>  (bold inside summary tag)
 *  - <summary>Q1. ...</summary>        (plain)
 *  - multiline bodies with lists, bold, links
 *  - attributes on <details> tags (e.g. <details open>)
 */
export function convertDetailsToCallouts(
  doc: string,
  calloutType: string,
  collapsed: boolean,
  boldSummary: boolean
): string {
  const fold = collapsed ? "-" : "+";
  // Match a single <details ...> ... </details> block (non-greedy, multiline)
  const detailsRegex = /<details(\s[^>]*)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;

  return doc.replace(detailsRegex, (_match, _attrs: string, summaryRaw: string, bodyRaw: string) => {
    const summary = cleanInlineHtml(summaryRaw).trim();
    const title = boldSummary && !summary.startsWith("**") ? `**${summary}**` : summary;
    const bodyText = bodyRaw.trim();
    if (bodyText.length === 0) {
      return `> [!${calloutType}]${fold} ${title}`;
    }
    const bodyLines = bodyText.split("\n").map((line: string) => {
      const cleaned = cleanInlineHtml(line);
      return cleaned.trim().length === 0 ? ">" : `> ${cleaned}`;
    });
    return `> [!${calloutType}]${fold} ${title}\n${bodyLines.join("\n")}`;
  });
}

/**
 * Reverse: convert foldable callout toggles back to <details> blocks.
 * Only converts callouts that are collapsible (have +/- marker).
 */
export function convertCalloutsToDetails(doc: string): string {
  const lines = doc.split("\n");
  const out: string[] = [];
  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];
    // Match a collapsible callout start:  > [!type]+/- Title...
    const m = line.match(/^>\s*\[!([^\]]+)\]([+-])\s?(.*)$/);
    if (m) {
      const _type = m[1];
      const marker = m[2];
      const title = m[3].trim();
      const body: string[] = [];
      i++;
      // Collect contiguous callout body lines (lines starting with > )
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        // stop if we hit another callout start
        if (/^>\s*\[![^\]]+\][+-]/.test(lines[i])) break;
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

/**
 * Strip a small set of inline HTML that Obsidian's callout renderer doesn't
 * need: <b>/<strong>, <i>/<em>, <br>. Keeps markdown bold/italic/links intact.
 */
function cleanInlineHtml(text: string): string {
  return text
    .replace(/<b>/g, "**")
    .replace(/<\/b>/g, "**")
    .replace(/<strong>/g, "**")
    .replace(/<\/strong>/g, "**")
    .replace(/<i>/g, "*")
    .replace(/<\/i>/g, "*")
    .replace(/<em>/g, "*")
    .replace(/<\/em>/g, "*")
    .replace(/<br\s*\/?>/g, "")
    .trim();
}

/* ---------- Auto-numbering (pure, testable) ---------- */

/** A numbered callout toggle header: "> [!x]- **12. Question**" */
export const NUMBERED_HEADER = /^(>\s*\[![^\]]+\][+-]\s*(?:\*\*)?)(\d+)\.\s?/;
/** A numbered <summary>: "<summary><b>12. Question</b></summary>" */
export const NUMBERED_SUMMARY = /^(\s*<summary>(?:<b>)?)(\d+)\.\s?/;

/** Next number = (last numbered toggle found in these lines) + 1, else 1. */
export function nextToggleNumber(lines: string[]): number {
  let last = 0;
  for (const line of lines) {
    const m = line.match(NUMBERED_HEADER) ?? line.match(NUMBERED_SUMMARY);
    if (m) last = parseInt(m[2], 10);
  }
  return last + 1;
}

/** Rewrite every numbered toggle in the document as 1..N, in order. */
export function renumberToggles(doc: string): string {
  let n = 0;
  const out = doc.split("\n").map((line) => {
    const m = line.match(NUMBERED_HEADER) ?? line.match(NUMBERED_SUMMARY);
    if (!m) return line;
    n += 1;
    return line.replace(m[0], `${m[1]}${n}. `);
  });
  return n === 0 ? doc : out.join("\n");
}

/* ---------- MCQ + Match the following (pure, testable) ---------- */

/** "> - [ ] Something" — a checkbox option line inside a toggle. */
export const MCQ_OPTION = /^>\s*- \[[ xX]\]\s+\S/;
/** "> - [ ] " with nothing typed yet. */
export const MCQ_EMPTY_OPTION = /^>\s*- \[[ xX]\]\s*$/;
/** "> **Answer:** ..." line. */
export const ANSWER_LINE = /^>\s*\*\*Answer:\*\*/;
/** "> **Answer:** " with nothing filled in yet. */
export const EMPTY_ANSWER_LINE = /^>\s*\*\*Answer:\*\*\s*$/;
/** A "Match the following" data row: "> | 2 | A | 2. B |". */
export const MATCH_ROW = /^>\s*\|\s*(\d+)\s*\|(.*)\|\s*$/;
/** A match row where both columns are still blank. */
export const EMPTY_MATCH_ROW = /^>\s*\|\s*\d*\s*\|\s*\|\s*\d*\.?\s*\|\s*$/;
/** The "|---|---|---|" separator row. */
export const MATCH_SEPARATOR = /^>\s*\|[\s-|]+\|\s*$/;

/**
 * Flip "- [ ]" <-> "- [x]" on a checkbox option line.
 * Works for callout lines ("> - [ ] a"), plain list lines and <details> bodies.
 * Non-option lines are returned unchanged.
 */
export function toggleOptionCheckbox(line: string): string {
  const m = line.match(/^(\s*(?:>\s*)?-\s\[)([ xX])(\].*)$/);
  if (!m) return line;
  return `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}`;
}

/** Build the next empty match row after a given row number. */
export function nextMatchRow(rowNumber: number): string {
  const n = rowNumber + 1;
  return `| ${n} |  | ${n}.  |`;
}


export interface QuestionBlockOptions extends EnterOptions {
  /** Options (MCQ) or rows (match) to generate. */
  count: number;
  /** Number prefix to place in the question title (already resolved). */
  number?: number;
  /** Title text for the question line (default empty so the caret starts there). */
  title?: string;
}

/** Shared skeleton builder: header + body lines, with caret inside the title. */
function buildToggleBlock(
  opts: QuestionBlockOptions,
  bodyLines: string[]
): { text: string; cursorOffset: number } {
  const num = opts.numbered && opts.number ? `${opts.number}. ` : "";
  const title = opts.title ?? "";

  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";
    const body = bodyLines.join("\n");
    const head = `<details${openAttr}>\n${sOpen}${num}`;
    const text = `${head}${title}${sClose}\n\n${body}\n\n</details>\n`;
    return { text, cursorOffset: head.length + title.length };
  }

  const fold = opts.collapsed ? "-" : "+";
  const bold = opts.boldSummary ? "**" : "";
  const head = `> [!${opts.calloutType}]${fold} ${bold}${num}`;
  const body = bodyLines.map((l) => (l.length ? `> ${l}` : "> ")).join("\n");
  const text = `${head}${title}${bold}\n${body}\n`;
  return { text, cursorOffset: head.length + title.length };
}

/** MCQ skeleton: question toggle with checkbox options (+ optional answer line). */
export function buildMcqBlock(opts: QuestionBlockOptions): { text: string; cursorOffset: number } {
  const count = Math.max(2, Math.min(6, opts.count || 4));
  const lines: string[] = [];
  for (let i = 0; i < count; i++) lines.push("- [ ] ");
  if (opts.addAnswerLine !== false) {
    lines.push("");
    lines.push("**Answer:** ");
  }
  return buildToggleBlock(opts, lines);
}

/** "Match the following" skeleton: a two-column table inside the toggle. */
export function buildMatchBlock(opts: QuestionBlockOptions): { text: string; cursorOffset: number } {
  const rows = Math.max(2, Math.min(8, opts.count || 4));
  const lines: string[] = ["| # | Column A | Column B |", "|---|---|---|"];
  for (let i = 1; i <= rows; i++) lines.push(`| ${i} |  | ${i}.  |`);
  if (opts.addAnswerLine !== false) {
    lines.push("");
    const key = Array.from({ length: rows }, (_, i) => `${i + 1}-`).join(", ");
    lines.push(`**Answer:** ${key}`);
  }
  return buildToggleBlock({ ...opts, title: opts.title ?? "Match the following" }, lines);
}

/* ---------- Enter-key planning (pure, testable) ---------- */

export interface EnterOptions {
  calloutType: string;
  collapsed: boolean;
  boldSummary: boolean;
  format: ToggleFormat;
  /** Auto-number the next toggle. */
  numbered?: boolean;
  /** Number to use for the next toggle when `numbered` is true. */
  nextNumber?: number;
  /** Add an "**Answer:** " line in MCQ / match skeletons (default true). */
  addAnswerLine?: boolean;
}


export interface EnterPlan {
  /** Replace from the start of the line, or from the cursor (line end). */
  from: "lineStart" | "cursor";
  insert: string;
  cursorOffset: number;
}

/**
 * Decide what Enter should do based on the current line text.
 * Returns null to let Obsidian's default Enter run.
 */
export function planEnter(text: string, opts: EnterOptions): EnterPlan | null {
  const bold = opts.boldSummary ? "**" : "";
  const num = opts.numbered && opts.nextNumber ? `${opts.nextNumber}. ` : "";
  const fold = opts.collapsed ? "-" : "+";
  const calloutHeader = `> [!${opts.calloutType}]${fold} `;

  // --- HTML <details> format ---
  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";

    // Empty summary -> remove the skeleton line (escape to plain text)
    if (/^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/.test(text)) {
      return { from: "lineStart", insert: "", cursorOffset: 0 };
    }

    // Summary with content -> move into the toggle body
    if (/<\/summary>\s*$/.test(text)) {
      return { from: "cursor", insert: "\n", cursorOffset: 1 };
    }

    // MCQ parity inside a <details> body (plain markdown lines, no "> " prefix)
    if (/^\s*-\s\[[ xX]\]\s*$/.test(text)) {
      const insert = opts.addAnswerLine === false ? "" : "**Answer:** ";
      return { from: "lineStart", insert, cursorOffset: insert.length };
    }
    if (/^\s*-\s\[[ xX]\]\s+\S/.test(text)) {
      return { from: "cursor", insert: "\n- [ ] ", cursorOffset: 7 };
    }

    // After </details> -> start the next toggle skeleton
    if (text.trim() === "</details>") {
      const insert = `\n\n<details${openAttr}>\n${sOpen}${num}${sClose}\n\n\n</details>\n`;
      const cursorOffset = `\n\n<details${openAttr}>\n${sOpen}${num}`.length;
      return { from: "cursor", insert, cursorOffset };
    }
    return null;
  }


  // --- Native foldable-callout format ---
  const isCalloutHeader = /^>\s*\[![^\]]+\][+-]/.test(text);
  const isCalloutLine = /^>/.test(text);
  if (!isCalloutLine) return null;

  // Empty toggle header (no question typed) -> drop the toggle, back to plain text
  if (isCalloutHeader && /^>\s*\[![^\]]+\][+-]\s*(\*\*\s*(?:\d+\.\s*)?\*\*)?\s*(?:\d+\.)?\s*$/.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }

  // --- MCQ (checkbox) lines inside a toggle ---
  // Empty option line -> jump to the "**Answer:** " line (or a plain body line)
  if (MCQ_EMPTY_OPTION.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  // Option line with content -> next checkbox option
  if (MCQ_OPTION.test(text)) {
    return { from: "cursor", insert: "\n> - [ ] ", cursorOffset: 9 };
  }
  // Empty "**Answer:** " line -> escape out of the toggle (nothing to fill in)
  if (EMPTY_ANSWER_LINE.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }
  // --- "Match the following" table rows ---
  // Separator row -> start the first data row
  if (MATCH_SEPARATOR.test(text)) {
    const insert = `\n> ${nextMatchRow(0)}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }
  // Blank data row -> leave the table (jump to the answer key / body line)
  if (EMPTY_MATCH_ROW.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  // Filled data row -> next numbered row, caret in Column A
  const rowMatch = text.match(MATCH_ROW);
  if (rowMatch) {
    const insert = `\n> ${nextMatchRow(Number(rowMatch[1]))}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }



  // Empty body line ("> " or ">") -> close this toggle and start the NEXT one
  if (!isCalloutHeader && /^>\s*$/.test(text)) {
    const insert = `\n${calloutHeader}${bold}${num}${bold}`;
    return {
      from: "lineStart",
      insert,
      cursorOffset: 1 + calloutHeader.length + bold.length + num.length,
    };
  }

  // Header with a question -> jump INSIDE the toggle (answer line), Notion-style.
  // Body line with content -> next answer line inside the same toggle.
  return { from: "cursor", insert: "\n> ", cursorOffset: 3 };
}

/* ---------- Backspace planning (pure, testable) ---------- */

export interface BackspacePlan {
  /** Full replacement text for the current line. */
  insert: string;
  /** Caret column inside the new line text. */
  cursorOffset: number;
}

/**
 * Decide what Backspace should do based on the current line and caret column.
 * Returns null to let Obsidian's default Backspace run (nothing is deleted).
 *
 * Rules (Notion parity):
 *  - caret right after an empty "> " answer line  -> drop the prefix (plain text)
 *  - caret right before the question text         -> unwrap the toggle marker
 *  - <details> skeleton lines                     -> same escapes
 */
export function planBackspace(text: string, col: number, opts: EnterOptions): BackspacePlan | null {
  if (opts.format === "details") {
    // Empty <summary></summary> skeleton line -> remove it entirely
    const emptySummary = /^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/;
    if (emptySummary.test(text)) {
      return { insert: "", cursorOffset: 0 };
    }
    // Caret right at the start of the summary text -> unwrap to plain text
    const sm = text.match(/^(\s*<summary>(?:<b>)?)([\s\S]*?)((?:<\/b>)?<\/summary>\s*)$/);
    if (sm && col === sm[1].length && sm[2].length > 0) {
      return { insert: sm[2], cursorOffset: 0 };
    }
    return null;
  }

  const headerMatch = text.match(/^(>\s*\[![^\]]+\][+-]\s*)(\*\*)?([\s\S]*?)(\*\*)?\s*$/);
  const isHeader = /^>\s*\[![^\]]+\][+-]/.test(text);

  // Empty answer line ("> " / ">") -> unwrap to plain empty line
  if (!isHeader && /^>\s*$/.test(text) && col === text.length) {
    return { insert: "", cursorOffset: 0 };
  }

  // Empty checkbox option / empty "**Answer:**" line / blank match row
  // -> drop that scaffolding, keep a plain "> " body line inside the toggle
  if (
    !isHeader &&
    col === text.length &&
    (MCQ_EMPTY_OPTION.test(text) || EMPTY_ANSWER_LINE.test(text) || EMPTY_MATCH_ROW.test(text))
  ) {
    return { insert: "> ", cursorOffset: 2 };
  }

  // Caret right before an option's text -> drop the checkbox marker, keep the text
  const optionMatch = text.match(/^(>\s*-\s\[[ xX]\]\s)(\S[\s\S]*)$/);
  if (!isHeader && optionMatch && col === optionMatch[1].length) {
    return { insert: `> ${optionMatch[2]}`, cursorOffset: 2 };
  }


  if (isHeader && headerMatch) {
    const prefix = headerMatch[1] + (headerMatch[2] ?? "");
    const title = headerMatch[3] ?? "";
    // Empty header (also "**3. **" numbered skeleton) -> remove the toggle line
    if (title.length === 0 || /^\d+\.\s*$/.test(title)) {
      return { insert: "", cursorOffset: 0 };
    }
    // Caret right before the question text -> keep the text, drop the marker
    if (col === prefix.length) {
      return { insert: title, cursorOffset: 0 };
    }
    return null;
  }

  // Answer line with content, caret right after "> " -> unwrap that line only
  const bodyMatch = text.match(/^(>\s)([\s\S]+)$/);
  if (!isHeader && bodyMatch && col === bodyMatch[1].length) {
    return { insert: bodyMatch[2], cursorOffset: 0 };
  }

  return null;
}


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
