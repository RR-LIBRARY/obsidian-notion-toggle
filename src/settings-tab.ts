/**
 * v1.3.1 — the plugin settings tab, extracted from main.ts.
 *
 * Presentation only: every control reads plugin.settings and calls
 * plugin.saveSettings(). `NotionTogglePlugin` is a type-only import, so there
 * is no runtime cycle with main.ts.
 */
import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type NotionTogglePlugin from "../main";
import type { ToggleFormat } from "./editor-blocks";
import type { StopAnchor } from "./autoscroll";
import { CALLOUT_TYPES, TOGGLE_COLORS } from "./toggle-colors";
import {
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  clampHold,
  clampSpeed,
  filterLabel,
} from "./autoscroll";
import { formatDwell, modeLabel, multiplierFromSpeed } from "./scrollmode";
import { clampScreenOverlap, normalizeAdvanceBy, clampScreenDwellMs, clampViewportPct } from "./screen-stops";
import { renderThinkSettings } from "./think-settings";
import { scheduleStoreSummary } from "./maintenance";
import { hotkeyLabel } from "./guide";
import { QUIZ_SECONDS_MAX, QUIZ_SECONDS_MIN, REVEAL_SECONDS_MAX, clampQuizSeconds, clampRevealSeconds } from "./quiz";
import { HOTKEYS } from "./guide";
import { POMODORO_PRESETS, clampMinutes, resolvePreset } from "./timer";
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

export class NotionToggleSettingTab extends PluginSettingTab {
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
      .setName("Switch to Reading View while scrolling")
      .setDesc("Uses Obsidian's stable reading surface, then restores Source View when the run ends.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollForceReading).onChange(async (v) => {
          this.plugin.settings.scrollForceReading = v;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Restore previous view after scrolling")
      .setDesc("Return to Source View automatically when autoscroll stops.")
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.scrollRestoreMode).onChange(async (v) => {
          this.plugin.settings.scrollRestoreMode = v;
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

    renderThinkSettings(containerEl, this.plugin);

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
      .setName("Advance by")
      .setDesc("Choose whether Reading View pauses on toggles, full screens, or both.")
      .addDropdown((dd) =>
        dd
          .addOptions({ toggles: "Toggles", screens: "Screens", both: "Toggles + screens" })
          .setValue(normalizeAdvanceBy(this.plugin.settings.scrollAdvanceBy))
          .onChange(async (v) => {
            this.plugin.settings.scrollAdvanceBy = normalizeAdvanceBy(v);
            this.plugin.reanchorAfterResize();
            await this.plugin.saveSettings();
          })
      );

    // v1.5.4 — one live read-out of the exact maths, so "Screens" and
    // "Toggles + screens" are no longer a black box.
    const mathSetting = new Setting(containerEl)
      .setName("Screen calculation (live)")
      .setDesc(this.plugin.screenPlanSummary());
    const refreshMath = () => mathSetting.setDesc(this.plugin.screenPlanSummary());

    new Setting(containerEl)
      .setName("Screen overlap")
      .setDesc("Keep this percentage of the previous screen visible while advancing.")
      .addSlider((sl) =>
        sl.setLimits(0, 0.5, 0.05).setValue(clampScreenOverlap(this.plugin.settings.scrollScreenOverlap)).setDynamicTooltip().onChange(async (v) => {
          this.plugin.settings.scrollScreenOverlap = clampScreenOverlap(v);
          this.plugin.reanchorAfterResize();
          await this.plugin.saveSettings();
          refreshMath();
        })
      );

    new Setting(containerEl)
      .setName("Screen pause duration")
      .setDesc("How long each screenful stays still before the next screen (seconds).")
      .addSlider((sl) =>
        sl.setLimits(0.25, 30, 0.25)
          .setValue(clampScreenDwellMs(this.plugin.settings.scrollScreenDwellMs) / 1000)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scrollScreenDwellMs = clampScreenDwellMs(v * 1000);
            await this.plugin.saveSettings();
            this.plugin.reanchorAfterResize();
          })
      );

    new Setting(containerEl)
      .setName("Usable viewport")
      .setDesc("Percentage of the live screen height used for one screenful on mobile and desktop.")
      .addSlider((sl) =>
        sl.setLimits(0.5, 1, 0.05)
          .setValue(clampViewportPct(this.plugin.settings.scrollViewportPct))
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.plugin.settings.scrollViewportPct = clampViewportPct(v);
            await this.plugin.saveSettings();
            this.plugin.reanchorAfterResize();
            refreshMath();
          })
      );


    new Setting(containerEl)
      .setName("Stop position on screen")
      .setDesc(
        "Where an auto-scroll stop parks. Middle keeps the toggle (and its answer) in the centre in portrait and landscape alike."
      )
      .addDropdown((dd) =>
        dd
          .addOptions({ top: "Top edge", third: "Upper third", middle: "Middle (recommended)", lower: "Lower third" })
          .setValue(this.plugin.settings.scrollStopAnchor ?? "middle")
          .onChange(async (v) => {
            this.plugin.settings.scrollStopAnchor = v as StopAnchor;
            this.plugin.reanchorAfterResize();
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

    // v1.4.0 — slider for quick tweaks + number input for anything up to 12h.
    const qRow = new Setting(containerEl)
      .setName("Time per question")
      .setDesc(
        "How long before the answer is revealed (1s–12h). Write ⏱30, ⏱15m or ⏱2h in a toggle title to override it for that question."
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
      },
    });

    const rRow = new Setting(containerEl)
      .setName("Answer time")
      .setDesc("How long the revealed answer stays open before the toggle closes (1s–1h).");
    addSecondsPicker(rRow, {
      sliderMin: 1,
      sliderMax: 60,
      max: REVEAL_SECONDS_MAX,
      get: () => clampRevealSeconds(this.plugin.settings.quizRevealSeconds),
      clamp: clampRevealSeconds,
      save: async (v) => {
        this.plugin.settings.quizRevealSeconds = v;
        await this.plugin.saveSettings();
      },
    });

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

    // v1.4.0 — real-device profiling switch.
    new Setting(containerEl)
      .setName("Log performance to perf-log.md")
      .setDesc(
        'When on, "Performance report" also appends quiz-timer and scroll metrics to perf-log.md in your vault.'
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.perfLog).onChange(async (v) => {
          this.plugin.settings.perfLog = v;
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
