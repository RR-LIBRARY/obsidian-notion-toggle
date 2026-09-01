/**
 * v1.5.9 — the "think time" settings rows.
 *
 * These live in their own module so both the settings tab and the quick-controls
 * sheet render the identical three controls, and so settings-tab.ts stays inside
 * its size budget.
 */
import { Setting } from "obsidian";
import { addSecondsPicker } from "./modals";
import { formatDwell } from "./scrollmode";
import { THINK_SECONDS_MAX, THINK_SECONDS_MIN, clampThinkSeconds } from "./think-gate";

export interface ThinkSettingsHost {
  settings: {
    scrollThinkEnabled: boolean;
    scrollThinkSeconds: number;
    scrollThinkIcon: string;
    scrollFocusChrome: boolean;
  };
  saveSettings(): Promise<void>;
}

/** Renders: think-time on/off, think seconds, distraction-free run. */
export function renderThinkSettings(containerEl: HTMLElement, host: ThinkSettingsHost): void {
  const s = host.settings;

  new Setting(containerEl)
    .setName("Think time before the answer")
    .setDesc("Toggle opens showing only the question; the answer is released after the think window.")
    .addToggle((tg) =>
      tg.setValue(s.scrollThinkEnabled).onChange(async (v) => {
        s.scrollThinkEnabled = v;
        await host.saveSettings();
      })
    );

  const row = new Setting(containerEl)
    .setName("Think seconds")
    .setDesc(
      `Currently ${formatDwell(clampThinkSeconds(s.scrollThinkSeconds))}. Per-toggle override: put 🤔20s or ?30s in the question title. Tap the question to reveal early.`
    );
  addSecondsPicker(row, {
    sliderMin: THINK_SECONDS_MIN,
    sliderMax: 60,
    max: THINK_SECONDS_MAX,
    get: () => clampThinkSeconds(s.scrollThinkSeconds),
    clamp: clampThinkSeconds,
    save: async (v) => {
      s.scrollThinkSeconds = v;
      await host.saveSettings();
    },
  });

  new Setting(containerEl)
    .setName("Countdown icon")
    .setDesc("Any emoji or text (🤔, 💭, Think…), or an image path/URL ending in .png, .gif, .svg or .webp.")
    .addText((t) =>
      t
        .setPlaceholder("🤔")
        .setValue(s.scrollThinkIcon ?? "🤔")
        .onChange(async (v) => {
          s.scrollThinkIcon = v.trim() || "🤔";
          await host.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Distraction-free run")
    .setDesc(
      "Hide the status bar, view header and mobile toolbar while a run is going, so opening an answer never makes the screen blink."
    )
    .addToggle((tg) =>
      tg.setValue(s.scrollFocusChrome).onChange(async (v) => {
        s.scrollFocusChrome = v;
        await host.saveSettings();
      })
    );
}
