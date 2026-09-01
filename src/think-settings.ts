/**
 * v1.5.9 — the "think time" settings rows.
 *
 * These live in their own module so both the settings tab and the quick-controls
 * sheet render the identical controls, and so settings-tab.ts stays inside its
 * size budget.
 *
 * v1.6.1 — the seconds slider gained a live countdown preview (play the chosen
 * window before committing to it), plus reduced-motion and timing-debug
 * switches, and a note about the per-note frontmatter override.
 */
import { Setting } from "obsidian";
import { addSecondsPicker } from "./modals";
import { formatDwell } from "./scrollmode";
import { THINK_SECONDS_MAX, THINK_SECONDS_MIN, clampThinkSeconds, isIconImage, thinkCountdownLabel } from "./think-gate";

export interface ThinkSettingsHost {
  settings: {
    scrollThinkEnabled: boolean;
    scrollThinkSeconds: number;
    scrollThinkIcon: string;
    scrollFocusChrome: boolean;
    scrollReducedMotion: boolean;
    scrollTimingDebug: boolean;
  };
  saveSettings(): Promise<void>;
}

/** Countdown preview: ticks the chosen window down, in place, without saving. */
export function playCountdownPreview(
  target: HTMLElement,
  seconds: number,
  icon: string,
  win: { setInterval: Window["setInterval"]; clearInterval: Window["clearInterval"] } = window
): () => void {
  const total = Math.max(1, clampThinkSeconds(seconds));
  let left = total * 1000;
  const paint = () => {
    target.empty?.();
    target.textContent = "";
    if (isIconImage(icon)) {
      const img = target.createEl ? target.createEl("img") : target.ownerDocument.createElement("img");
      img.src = icon;
      img.alt = "";
      img.addClass?.("ntt-think-preview-img");
      if (!target.createEl) target.appendChild(img);
      const text = target.ownerDocument.createElement("span");
      text.textContent = ` ${thinkCountdownLabel(left, "")}`.trimEnd();
      target.appendChild(text);
    } else {
      target.textContent = thinkCountdownLabel(left, icon);
    }
  };
  paint();
  const id = win.setInterval(() => {
    left -= 1000;
    if (left <= 0) {
      win.clearInterval(id);
      target.textContent = "answer released ✔";
      return;
    }
    paint();
  }, 1000);
  return () => win.clearInterval(id);
}

/** Renders think-time on/off, seconds + preview, icon, focus, motion, timings. */
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
      `Currently ${formatDwell(clampThinkSeconds(s.scrollThinkSeconds))}. Per-toggle override: put 🤔20s or ?30s in the question title. Per-note override: add "think: 20s" to the note's frontmatter. Tap the question to reveal early.`
    );
  addSecondsPicker(row, {
    sliderMin: Math.max(1, THINK_SECONDS_MIN),
    sliderMax: 60,
    max: THINK_SECONDS_MAX,
    get: () => clampThinkSeconds(s.scrollThinkSeconds),
    clamp: clampThinkSeconds,
    save: async (v) => {
      s.scrollThinkSeconds = v;
      await host.saveSettings();
    },
  });

  // v1.6.1 — see the countdown before you commit to it.
  const preview = new Setting(containerEl)
    .setName("Preview the countdown")
    .setDesc("Plays the selected think window here, with your countdown face.");
  const badge = preview.controlEl.createSpan({ cls: "ntt-think-preview", text: "—" });
  let stop: (() => void) | null = null;
  preview.addButton((b) =>
    b.setButtonText("Play").onClick(() => {
      stop?.();
      stop = playCountdownPreview(badge, s.scrollThinkSeconds, s.scrollThinkIcon ?? "🤔");
    })
  );

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
    .setName("Distraction-free mode")
    .setDesc(
      "Hide the status bar, view header and mobile toolbar during the think countdown and the rest of the run, so opening an answer never makes the screen blink."
    )
    .addToggle((tg) =>
      tg.setValue(s.scrollFocusChrome).onChange(async (v) => {
        s.scrollFocusChrome = v;
        await host.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Reduced motion")
    .setDesc("Countdown and answer reveal become instant — no fades, no transitions.")
    .addToggle((tg) =>
      tg.setValue(s.scrollReducedMotion).onChange(async (v) => {
        s.scrollReducedMotion = v;
        await host.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Timing debug overlay")
    .setDesc("Log the exact toggle-open, countdown-start and answer-release timestamps on screen.")
    .addToggle((tg) =>
      tg.setValue(s.scrollTimingDebug).onChange(async (v) => {
        s.scrollTimingDebug = v;
        await host.saveSettings();
      })
    );
}
