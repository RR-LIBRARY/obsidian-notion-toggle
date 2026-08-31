/**
 * v1.3.1 — every Modal that used to live in main.ts.
 *
 * These are pure presentation shells: they read plugin state, call plugin
 * methods and close. Keeping them out of main.ts is what took the entry file
 * back under 3.5k lines. `NotionTogglePlugin` is imported as a *type only*, so
 * there is no runtime import cycle with main.ts.
 */
import { App, Modal, Notice, Setting } from "obsidian";
import type NotionTogglePlugin from "../main";
import { TOGGLE_COLORS } from "./toggle-colors";
import { CALLOUT_KINDS, clampHold, filterLabel, sameFilter, type RecallColor } from "./autoscroll";
import {
  DWELL_PRESETS,
  SPEED_MULTIPLIERS,
  clampDwellSeconds,
  formatDwell,
  modeLabel,
  planSummary,

  multiplierFromSpeed,
  parsePicks,
  parseRoute,
  speedFromMultiplier,
  type ScrollMode,
} from "./scrollmode";
import { advanceLabel, clampScreenOverlap, normalizeAdvanceBy, type AdvanceBy } from "./screen-stops";
import {
  QUIZ_PRESETS,
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  REVEAL_SECONDS_MAX,
  clampQuizSeconds,
  clampRevealSeconds,
  formatQuizSeconds,
} from "./quiz";
import { TOOLBAR_COMMANDS, TOOLBAR_STEPS, guideProgress, toggleGuideDone } from "./guide";
import { deckSummary } from "./fsrs";
import { nextDueLabel, type SrsCard } from "./srs";
import { orderExplainer, rowLabel, weakRows } from "./stats-panel";
import { breakdownSummary, presentKinds, type KindCount } from "./callout-stats";
import {
  filterGroups,
  flatFilterOptions,
  isEmptyOption,
  optionCount,
} from "./filter-picker";

/**
 * v1.4.0 — slider for the common range + a free number input for anything up
 * to `max` (e.g. 2h = 7200s). Both stay in sync; the slider pins to its max
 * when the stored value is above the slider range.
 */
export function addSecondsPicker(
  setting: Setting,
  opts: {
    sliderMin: number;
    sliderMax: number;
    max: number;
    get(): number;
    clamp(v: number): number;
    save(v: number): Promise<void> | void;
  }
): void {
  let text: import("obsidian").TextComponent | null = null;
  setting.addSlider((sl) =>
    sl
      .setLimits(opts.sliderMin, opts.sliderMax, 1)
      .setValue(Math.min(opts.sliderMax, Math.max(opts.sliderMin, opts.get())))
      .setDynamicTooltip()
      .onChange(async (v) => {
        const value = opts.clamp(v);
        text?.setValue(String(value));
        await opts.save(value);
      })
  );
  setting.addText((txt) => {
    text = txt;
    txt.inputEl.type = "number";
    txt.inputEl.min = String(opts.sliderMin);
    txt.inputEl.max = String(opts.max);
    txt.inputEl.setAttribute("aria-label", "seconds");
    txt.setValue(String(opts.get())).setPlaceholder(`${opts.sliderMin}–${opts.max}s`);
    txt.inputEl.addClass("ntt-seconds-input");
    const commit = async () => {
      const value = opts.clamp(Number(txt.getValue()));
      txt.setValue(String(value));
      await opts.save(value);
      // Pin the paired slider without re-saving.
      const slider = setting.controlEl.querySelector<HTMLInputElement>('input[type="range"]');
      if (slider) slider.value = String(Math.min(opts.sliderMax, Math.max(opts.sliderMin, value)));
    };
    txt.inputEl.addEventListener("change", () => void commit());
  });
}

/* ---------- v1.0.9: autoscroll colour filter ---------- */

/** v1.1.3 — mini stats panel explaining the shuffle priority. */
export class ScrollStatsModal extends Modal {
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

    // v1.5.0 — what this note is actually made of: type, count, percentage.
    const kinds = this.plugin.calloutBreakdown();
    const noteTotal = kinds.reduce((n, r) => n + r.count, 0);
    const box = this.contentEl.createDiv({ cls: "ntt-breakdown" });
    box.createDiv({ cls: "notion-toggle-deck-summary", text: "Callout breakdown" });
    box.createDiv({ cls: "ntt-filter-summary", text: breakdownSummary(kinds, noteTotal) });
    const table = box.createEl("table", { cls: "ntt-breakdown-table" });
    const head = table.createEl("tr");
    for (const h of ["Type", "Callout", "Count", "%"]) head.createEl("th", { text: h });
    for (const row of presentKinds(kinds)) {
      const tr = table.createEl("tr");
      tr.createEl("td", { text: `${row.icon} ${row.name}` });
      tr.createEl("td", { text: row.word });
      tr.createEl("td", { text: String(row.count) });
      tr.createEl("td", { text: `${row.percent}%` });
    }
    if (noteTotal === 0) box.createDiv({ text: "No toggles in this note yet." });
  }


  onClose() {
    this.contentEl.empty();
  }
}

/**
 * v1.5.0 — grouped, expandable picker shared by autoscroll and quiz.
 *
 * Each group is a `<details>`; each row shows the icon, the human name, the
 * callout words it matches and the live count in this note.
 */
function renderFilterPicker(
  host: HTMLElement,
  active: RecallColor[],
  rows: KindCount[],
  onPick: (filter: RecallColor[]) => Promise<void> | void
): void {
  const list = host.createDiv({ cls: "notion-toggle-color-list" });
  for (const group of filterGroups()) {
    const hasActive = group.options.some((o) => sameFilter(o.filter, active));
    const box = list.createEl("details", { cls: "ntt-filter-group" });
    box.open = group.open || hasActive;
    box.createEl("summary", { text: group.label, cls: "ntt-filter-group-title" });
    for (const opt of group.options) {
      const btn = box.createEl("button", { cls: "notion-toggle-color-btn ntt-filter-row" });
      const main = btn.createDiv({ cls: "ntt-filter-main" });
      main.createSpan({ text: opt.label, cls: "ntt-filter-label" });
      const badge = optionCount(opt, rows);
      if (badge) main.createSpan({ text: badge, cls: "ntt-filter-count" });
      if (opt.hint) btn.createDiv({ text: opt.hint, cls: "ntt-filter-hint" });
      if (isEmptyOption(opt, rows)) btn.addClass("is-empty");
      if (sameFilter(opt.filter, active)) btn.addClass("is-suggested");
      btn.onclick = async () => {
        await onPick(opt.filter);
      };
    }
  }
}

export class ScrollFilterModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Autoscroll — revise which toggles?");
    const rows = this.plugin.calloutBreakdown();
    this.contentEl.createDiv({
      cls: "ntt-filter-summary",
      text: breakdownSummary(rows, rows.reduce((n, r) => n + r.count, 0)),
    });
    renderFilterPicker(this.contentEl, this.plugin.settings.scrollFilter, rows, async (filter) => {
      await this.plugin.setScrollFilter(filter);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/** v1.3.0 — the same options as a flat list (deep links, tests, legacy callers). */
export const QUIZ_FILTER_OPTIONS: { label: string; filter: RecallColor[] }[] = flatFilterOptions();

export class QuizFilterModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Quiz — ask about which toggles?");
    const rows = this.plugin.calloutBreakdown();
    this.contentEl.createDiv({
      cls: "ntt-filter-summary",
      text: breakdownSummary(rows, rows.reduce((n, r) => n + r.count, 0)),
    });
    renderFilterPicker(this.contentEl, this.plugin.quizFilterColors(), rows, async (filter) => {
      await this.plugin.setQuizFilter(filter);
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}




/* ---------- v1.1.1: pause-at mode, dwell and speed pickers ---------- */

export class ScrollModeModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  private modeBtns: { mode: ScrollMode; btn: HTMLButtonElement }[] = [];
  private hintEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private resumeBtn: HTMLButtonElement | null = null;

  /** Repaint selection + hint without closing the sheet. */
  private paint() {
    const s = this.plugin.settings;
    for (const { mode, btn } of this.modeBtns) btn.toggleClass("is-suggested", s.scrollMode === mode);
    const empty =
      (s.scrollMode === "custom" && (s.scrollPicks ?? []).length === 0) ||
      ((s.scrollMode === "route" || s.scrollMode === "shuffle") &&
        (s.scrollRoute ?? []).length === 0);
    if (this.hintEl) {
      this.hintEl.setText(
        empty
          ? "Add toggle numbers below — until then autoscroll pauses at every toggle."
          : `Autoscroll pauses at: ${modeLabel(this.plugin.modeConfig())}`
      );
      this.hintEl.toggleClass("is-warning", empty);
    }
    // v1.4.3 — one-click way out of the empty-list warning.
    if (this.resumeBtn) this.resumeBtn.toggleClass("is-hidden", !empty);
    if (this.summaryEl) {
      const stats = this.plugin.scrollDeckStats();
      this.summaryEl.setText(stats ? deckSummary(stats) : "");
    }
  }

  /** Save + rebuild the live plan so edits apply to a running scroll. */
  private async commit(toast = false) {
    await this.plugin.saveSettings();
    this.plugin.refreshScrollPlan();
    if (toast && !this.plugin.settings.scrollQuiet) {
      new Notice(planSummary(this.plugin.modeConfig()));
    }
    this.paint();
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
    this.modeBtns = [];
    for (const opt of options) {
      const btn = list.createEl("button", { text: opt.label, cls: "notion-toggle-color-btn" });
      this.modeBtns.push({ mode: opt.mode, btn });
      btn.onclick = async () => {
        if (opt.mode === "shuffle") {
          await this.plugin.rebuildShuffleRoute();
          await this.commit(true);
          return;
        }
        // v1.4.3 — coming back to route mode restores the hand-written order
        // that shuffle overwrote (it survives a vault reload).
        if (opt.mode === "route") {
          const saved = this.plugin.settings.scrollUserRoute ?? [];
          if (saved.length) this.plugin.settings.scrollRoute = [...saved];
        }
        this.plugin.settings.scrollMode = opt.mode;
        await this.commit();
      };
    }

    this.hintEl = this.contentEl.createDiv({ cls: "notion-toggle-mode-hint" });

    // v1.4.3 — the warning hint is now actionable: one tap falls back to
    // "every toggle" and starts autoscroll again.
    this.resumeBtn = this.contentEl.createEl("button", {
      text: "▶ Resume with every toggle",
      cls: "notion-toggle-color-btn ntt-resume-btn",
    });
    this.resumeBtn.onclick = async () => {
      this.plugin.settings.scrollMode = "all";
      await this.commit(true);
      await this.plugin.setAutoScrollEnabled(true);
      this.close();
    };

    new Setting(this.contentEl)
      .setName("Custom list")
      .setDesc("Toggle numbers to stop at, e.g. 2, 5, 9.")
      .addText((t) => {
        t.setPlaceholder("2, 5, 9")
          .setValue((this.plugin.settings.scrollPicks ?? []).join(", "))
          .onChange(async (v) => {
            this.plugin.settings.scrollPicks = parsePicks(v);
            await this.commit();
          });
        t.inputEl.addEventListener("blur", () => void this.commit());
      });

    new Setting(this.contentEl)
      .setName("Route")
      .setDesc("Your own visit order, e.g. 7, 2, 9, 2. Saved across vault reloads.")
      .addText((t) => {
        t.setPlaceholder("7, 2, 9")
          .setValue(
            (this.plugin.settings.scrollRoute ?? this.plugin.settings.scrollUserRoute ?? []).join(
              ", "
            )
          )
          .onChange(async (v) => {
            const route = parseRoute(v);
            this.plugin.settings.scrollRoute = route;
            this.plugin.settings.scrollUserRoute = route;
            await this.commit();
          });
        t.inputEl.addEventListener("blur", () => void this.commit());
      });

    new Setting(this.contentEl)
      .setName("Loop the route")
      .setDesc("Route khatam hone par phir se pehle waypoint se.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollLoopRoute).onChange(async (v) => {
          this.plugin.settings.scrollLoopRoute = v;
          await this.commit(true);
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
            await this.commit(true);
          })
      )
      .addText((t) =>
        t
          .setPlaceholder("to")
          .setValue(String(this.plugin.settings.scrollShuffleTo || ""))
          .onChange(async (v) => {
            this.plugin.settings.scrollShuffleTo = Math.max(0, Math.floor(Number(v) || 0));
            await this.commit(true);
          })
      );


    const stats = this.plugin.scrollDeckStats();
    this.summaryEl = this.contentEl.createDiv({
      cls: "notion-toggle-deck-summary",
      text: stats ? deckSummary(stats) : "",
    });
    if (stats) {
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
          await this.commit();
        })
      );

    new Setting(this.contentEl)
      .setName("Advance by")
      .setDesc("Toggles, full screens, or both in Reading View.")
      .addDropdown((dd) =>
        dd.addOptions({ toggles: "Toggles", screens: "Screens", both: "Toggles + screens" })
          .setValue(normalizeAdvanceBy(this.plugin.settings.scrollAdvanceBy))
          .onChange(async (v) => {
            this.plugin.settings.scrollAdvanceBy = normalizeAdvanceBy(v);
            await this.commit();
            this.plugin.refreshScrollPlan();
          })
      );

    new Setting(this.contentEl)
      .setName("Screen overlap")
      .setDesc("Keep part of the previous screen visible between stops.")
      .addSlider((sl) =>
        sl.setLimits(0, 0.5, 0.05).setValue(clampScreenOverlap(this.plugin.settings.scrollScreenOverlap)).setDynamicTooltip().onChange(async (v) => {
          this.plugin.settings.scrollScreenOverlap = clampScreenOverlap(v);
          await this.commit();
          this.plugin.refreshScrollPlan();
        })
      );

    this.paint();
  }


  onClose() {
    this.contentEl.empty();
  }
}

export class ScrollDwellModal extends Modal {
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

export class ScrollSpeedModal extends Modal {
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


/* ---------- v1.1.5: in-app guide — which mobile toolbar commands to add ---------- */

export class MobileToolbarGuideModal extends Modal {
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

export class QuizSecondsModal extends Modal {
  constructor(app: App, private plugin: NotionTogglePlugin) {
    super(app);
  }

  onOpen() {
    this.setTitle("Quiz — time per question");
    const list = this.contentEl.createDiv({ cls: "notion-toggle-color-list" });
    const current = clampQuizSeconds(this.plugin.settings.quizSeconds);
    for (const seconds of QUIZ_PRESETS) {
      const btn = list.createEl("button", {
        // v1.4.0 — friendly labels ("10s", "5m", "1h") since presets span units now.
        text: formatQuizSeconds(seconds),
        cls: "notion-toggle-color-btn",
      });
      if (seconds === current) btn.addClass("is-suggested");
      btn.onclick = async () => {
        this.plugin.settings.quizSeconds = clampQuizSeconds(seconds);
        await this.plugin.saveSettings();
        new Notice(`Quiz: ${formatQuizSeconds(clampQuizSeconds(seconds))} per question.`);
        this.close();
      };
    }

    const input = this.contentEl.createEl("input", { cls: "ntt-modal-input" });
    input.type = "number";
    input.min = String(QUIZ_SECONDS_MIN);
    input.max = String(QUIZ_SECONDS_MAX);
    input.value = String(current);
    input.placeholder = `Custom seconds (${QUIZ_SECONDS_MIN}–${QUIZ_SECONDS_MAX})`;

    const actions = this.contentEl.createDiv({ cls: "ntt-modal-actions" });
    const save = actions.createEl("button", { text: "Save" });
    save.addClass("mod-cta");
    save.onclick = async () => {
      const seconds = clampQuizSeconds(Number(input.value));
      this.plugin.settings.quizSeconds = seconds;
      await this.plugin.saveSettings();
      new Notice(`Quiz: ${formatQuizSeconds(seconds)} per question.`);
      this.close();
    };
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ---------- Quick Q&A Modal ---------- */

export class QuickQAModal extends Modal {
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

export class ColorPickerModal extends Modal {
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


/** Simple picker listing notes whose recall is due (v1.0.7). */
export class DueNotesModal extends Modal {
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

