/**
 * v1.4.3 — the autoscroll quick-controls sheet lives in its own module so
 * `modals.ts` stays inside the architecture size budget. One-way dependency:
 * this file imports the smaller modals, never the other way round.
 */
import { App, Modal, Notice, Setting } from "obsidian";
import type NotionTogglePlugin from "../main";
import { clampHold, filterLabel } from "./autoscroll";
import { formatDwell, modeLabel, multiplierFromSpeed } from "./scrollmode";
import { clampScreenOverlap, normalizeAdvanceBy, clampScreenDwellMs, clampViewportPct } from "./screen-stops";
import {
  QUIZ_SECONDS_MAX,
  QUIZ_SECONDS_MIN,
  REVEAL_SECONDS_MAX,
  clampQuizSeconds,
  clampRevealSeconds,
} from "./quiz";
import {
  MobileToolbarGuideModal,
  QuizFilterModal,
  ScrollDwellModal,
  ScrollFilterModal,
  ScrollModeModal,
  ScrollSpeedModal,
  ScrollStatsModal,
  addSecondsPicker,
} from "./modals";


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
    const qRow = new Setting(this.contentEl)
      .setName("Quiz — time per question")
      .setDesc(
        "Kitne second baad answer khud reveal ho (1s–12h). Title me ⏱30 / ⏱15m / ⏱2h likho to us question par wahi chalega."
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
      },
    });

    const rRow = new Setting(this.contentEl)
      .setName("Quiz — answer time")
      .setDesc("Reveal hone ke baad answer kitni der khula rahe (1s–1h).");
    addSecondsPicker(rRow, {
      sliderMin: 1,
      sliderMax: 60,
      max: REVEAL_SECONDS_MAX,
      get: () => clampRevealSeconds(s.quizRevealSeconds),
      clamp: clampRevealSeconds,
      save: async (v) => {
        s.quizRevealSeconds = v;
        await this.plugin.saveSettings();
      },
    });

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

    // v1.4.3 — answer toggles: open them all in one tap, and an "open with
    // autoquiz" mode where answers stay open for the whole run.
    new Setting(this.contentEl)
      .setName("Answers — open / close all")
      .setDesc("Is note ke sabhi answer toggles ek tap me kholo ya band karo.")
      .addButton((b) =>
        b.setButtonText("Open all").onClick(() => {
          this.plugin.setAllAnswersOpen(true);
        })
      )
      .addButton((b) =>
        b.setButtonText("Close all").onClick(() => {
          this.plugin.setAllAnswersOpen(false);
        })
      );

    new Setting(this.contentEl)
      .setName("Open with auto-quiz (answers stay open)")
      .setDesc("ON = quiz shuru hote hi har answer khula rahega aur band nahi hoga.")
      .addToggle((tg) =>
        tg.setValue(s.quizKeepAnswersOpen).onChange(async (v) => {
          s.quizKeepAnswersOpen = v;
          await this.plugin.saveSettings();
          this.plugin.refreshQuizAnswerVisibility();
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
      .setDesc("Long answers are read one screen at a time before the next toggle.")
      .addToggle((tg) =>
        tg.setValue(s.scrollChunkTall).onChange(async (v) => {
          this.plugin.settings.scrollChunkTall = v;
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
        })
      );

    new Setting(this.contentEl)
      .setName("Advance by")
      .setDesc("Toggles, full screens, or both in Reading View.")
      .addDropdown((dd) =>
        dd.addOptions({ toggles: "Toggles", screens: "Screens", both: "Toggles + screens" })
          .setValue(normalizeAdvanceBy(s.scrollAdvanceBy))
          .onChange(async (v) => {
            this.plugin.settings.scrollAdvanceBy = normalizeAdvanceBy(v);
            await this.plugin.saveSettings();
            this.plugin.refreshScrollPlan();
          })
      );

    // v1.5.4 — same live derivation as the settings tab.
    const mathSetting = new Setting(this.contentEl)
      .setName("Screen calculation (live)")
      .setDesc(this.plugin.screenPlanSummary());
    const refreshMath = () => mathSetting.setDesc(this.plugin.screenPlanSummary());

    new Setting(this.contentEl)
      .setName("Screen overlap")
      .setDesc("Keep part of the previous screen visible between stops.")
      .addSlider((sl) =>
        sl.setLimits(0, 0.5, 0.05).setValue(clampScreenOverlap(s.scrollScreenOverlap)).setDynamicTooltip().onChange(async (v) => {
          this.plugin.settings.scrollScreenOverlap = clampScreenOverlap(v);
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
          refreshMath();
        })
      );

    new Setting(this.contentEl)
      .setName("Screen pause duration")
      .setDesc("Pause on each screenful (seconds).")
      .addSlider((sl) => sl.setLimits(0.25, 30, 0.25)
        .setValue(clampScreenDwellMs(s.scrollScreenDwellMs) / 1000)
        .setDynamicTooltip()
        .onChange(async (v) => {
          this.plugin.settings.scrollScreenDwellMs = clampScreenDwellMs(v * 1000);
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
        }));

    new Setting(this.contentEl)
      .setName("Usable viewport")
      .setDesc("Percentage of live screen height used for one screenful.")
      .addSlider((sl) => sl.setLimits(0.5, 1, 0.05)
        .setValue(clampViewportPct(s.scrollViewportPct))
        .setDynamicTooltip()
        .onChange(async (v) => {
          this.plugin.settings.scrollViewportPct = clampViewportPct(v);
          await this.plugin.saveSettings();
          this.plugin.refreshScrollPlan();
          refreshMath();
        }));


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
