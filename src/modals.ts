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
import { clampHold, filterLabel, sameFilter, type RecallColor } from "./autoscroll";
import {
  DWELL_PRESETS,
  SPEED_MULTIPLIERS,
  clampDwellSeconds,
  formatDwell,
  modeLabel,
  multiplierFromSpeed,
  parsePicks,
  parseRoute,
  speedFromMultiplier,
  type ScrollMode,
} from "./scrollmode";
import {
  QUIZ_PRESETS,
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  clampQuizSeconds,
  clampRevealSeconds,
} from "./quiz";
import { TOOLBAR_COMMANDS, TOOLBAR_STEPS, guideProgress, toggleGuideDone } from "./guide";
import { deckSummary } from "./fsrs";
import { orderExplainer, rowLabel, weakRows } from "./stats-panel";

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
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class ScrollFilterModal extends Modal {
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

export class QuizFilterModal extends Modal {
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

export class ScrollModeModal extends Modal {
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

/* ---------- v1.1.5: one sheet with every autoscroll control ---------- */

export class ScrollSheetModal extends Modal {
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
