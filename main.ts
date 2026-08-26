import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import {
  DEFAULT_POMODORO,
  POMODORO_PRESETS,
  clampMinutes,
  collapseAllToggles,
  createState,
  nextPhase,
  phaseDuration,
  phaseLabel,
  resetPhase,
  resolvePreset,
  scanRecallStats,
  sessionSummary,
  tick,
  type PomodoroSettings,
  type PomodoroState,
} from "./src/timer";
import { TimerWidget } from "./src/timer-ui";


type ToggleFormat = "callout" | "details";

interface NotionToggleSettings extends PomodoroSettings {
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
}

const DEFAULT_SETTINGS: NotionToggleSettings = {
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

/** Traffic-light order used by the "Cycle colour" command. */
export const TRAFFIC_CYCLE = ["recall-red", "recall-yellow", "recall-green"];

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

  async onload() {
    await this.loadSettings();

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
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        const type = this.activeCallout();
        const fold = this.settings.defaultCollapsed ? "-" : "+";

        if (selection.trim().length === 0) {
          // No selection: wrap the current line
          const line = editor.getLine(editor.getCursor().line);
          if (line.trim().length === 0) {
            new Notice("Nothing to wrap — select the question and answer first.");
            return;
          }
          const title = this.maybeBold(line.trim());
          editor.replaceRange(`> [!${type}]${fold} ${title}\n> \n`, {
            line: editor.getCursor().line,
            ch: 0,
          }, {
            line: editor.getCursor().line,
            ch: line.length,
          });
          return;
        }

        // Selection present: first non-empty line = title, rest = body
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
        // Drop leading blank lines of the body
        while (bodyLines.length > 0 && bodyLines[0].trim().length === 0) {
          bodyLines.shift();
        }
        const body = bodyLines.length > 0
          ? "\n" + bodyLines.map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n")
          : "";
        const block = `> [!${type}]${fold} ${title}${body}\n`;

        editor.replaceSelection(block);
      },
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
      editorCallback: (editor) => {
        const found = this.findHeaderLine(editor);
        if (!found) {
          new Notice("Cursor is not inside a toggle.");
          return;
        }
        const current = found.text.match(/^>\s*\[!([^\]]+)\]/)?.[1] ?? "";
        const idx = TRAFFIC_CYCLE.indexOf(current);
        const next = TRAFFIC_CYCLE[(idx + 1) % TRAFFIC_CYCLE.length];
        this.recolorToggleAtCursor(editor, next);
      },
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
      name: "Toggle recall timer (show / hide)",
      callback: () => this.toggleTimer(),
    });

    this.addCommand({
      id: "recall-timer-start-pause",
      icon: "play",
      name: "Recall timer: start / pause",
      callback: () => {
        this.showTimer();
        this.timerState = { ...this.timerState, running: !this.timerState.running };
        this.lastTick = Date.now();
        this.renderTimer();
      },
    });

    this.addCommand({
      id: "recall-timer-reset",
      icon: "rotate-ccw",
      name: "Recall timer: reset phase",
      callback: () => {
        this.timerState = resetPhase(this.timerState, this.settings);
        this.renderTimer();
      },
    });

    this.addCommand({
      id: "recall-timer-skip",
      icon: "skip-forward",
      name: "Recall timer: skip phase",
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
      name: "Start recall session on this note (collapse all answers)",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const collapsed = collapseAllToggles(doc);
        if (collapsed !== doc) {
          const cursor = editor.getCursor();
          editor.setValue(collapsed);
          editor.setCursor(cursor);
        }
        const stats = scanRecallStats(collapsed);
        this.showTimer();
        this.timerState = { ...resetPhase(createState(this.settings), this.settings), running: true };
        this.lastTick = Date.now();
        this.renderTimer();
        new Notice(
          `Recall session started — ${stats.total} toggles (🔴 ${stats.red} · 🟡 ${stats.yellow} · 🟢 ${stats.green})`
        );
      },
    });

    // 250 ms tick, registered so Obsidian clears it on unload.
    this.lastTick = Date.now();
    this.registerInterval(
      window.setInterval(() => this.onTimerTick(), 250) as unknown as number
    );

    if (this.settings.showOnStartup) this.showTimer();





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
    const updated = found.text.replace(/^>\s*\[![^\]]+\]/, `> [!${callout}]`);
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
          this.timerState = { ...this.timerState, running: !this.timerState.running };
          this.lastTick = Date.now();
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

  private onTimerTick() {
    const now = Date.now();
    const elapsed = now - this.lastTick;
    this.lastTick = now;
    if (!this.timerState.running) return;

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
    const hint = breakPhase ? this.recallHint() : undefined;
    this.timerWidget.render({
      state: this.timerState,
      cycleSize: Math.max(1, Math.min(8, this.settings.sessionsBeforeLongBreak)),
      hint,
      canJumpRed: breakPhase && !!hint,
    });
  }

  updateStatus() {
    this.statusEl?.setText(sessionSummary(this.timerState));
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
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
    contentEl.createEl("h2", { text: "Quick Q&A Toggle" });

    contentEl.createEl("label", { text: "Question" });
    this.questionEl = contentEl.createEl("textarea");
    this.questionEl.rows = 2;
    this.questionEl.style.width = "100%";
    this.questionEl.style.marginBottom = "12px";
    this.questionEl.placeholder = "Type the question...";

    contentEl.createEl("label", { text: "Answer" });
    this.answerEl = contentEl.createEl("textarea");
    this.answerEl.rows = 4;
    this.answerEl.style.width = "100%";
    this.answerEl.style.marginBottom = "12px";
    this.answerEl.placeholder = "Type the answer...";

    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";

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
    contentEl.createEl("h2", { text: "Toggle colour" });
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

    containerEl.createEl("h3", { text: "Recall timer (Pomodoro)" });

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
