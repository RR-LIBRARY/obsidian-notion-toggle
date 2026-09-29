/**
 * v1.8.23 — the "Outline with AI" section of the settings tab.
 *
 * Presentation only: address, access key, how many toggles, and a Test
 * button that pings the service's health endpoint.
 */
import { Notice, Setting } from "obsidian";
import { obsidianTransport } from "./outline-command";
import { describeOutlineError, normalizeServiceUrl, testOutlineService, type OutlineSettings, type OutlineTransport } from "./outline-service";

export interface OutlineSettingsHost {
  settings: OutlineSettings;
  saveSettings(): Promise<void>;
}

export function renderOutlineSettings(containerEl: HTMLElement, host: OutlineSettingsHost, transport: OutlineTransport = obsidianTransport): void {
  const s = host.settings;

  new Setting(containerEl).setName("Outline with AI (v1.8.23)").setHeading();
  containerEl.createDiv({
    cls: "setting-item-description",
    text:
      "Select any text in a note and run “Outline selection with AI” — it comes back as a row of same-level toggles you can nest yourself with Indent / Outdent. " +
      "Paste your outline service address and its access key below, then press Test.",
  });

  new Setting(containerEl)
    .setName("Service address")
    .setDesc("e.g. https://your-app.lovable.app")
    .addText((txt) => {
      txt.inputEl.type = "url";
      txt.setPlaceholder("https://…").setValue(s.outlineServiceUrl);
      txt.inputEl.addEventListener("change", async () => {
        s.outlineServiceUrl = normalizeServiceUrl(txt.getValue());
        txt.setValue(s.outlineServiceUrl);
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Access key")
    .setDesc("The key set on the outline service. It never leaves this vault except in the request to that service.")
    .addText((txt) => {
      txt.inputEl.type = "password";
      txt.setPlaceholder("outline key").setValue(s.outlineAccessKey);
      txt.inputEl.addEventListener("change", async () => {
        s.outlineAccessKey = txt.getValue().trim();
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Toggles per run")
    .setDesc("Upper bound; the outline may come back shorter.")
    .addSlider((sl) => {
      sl.setLimits(3, 40, 1)
        .setValue(s.outlineMaxToggles || 12)
        .setDynamicTooltip()
        .onChange(async (v) => {
          s.outlineMaxToggles = v;
          await host.saveSettings();
        });
    });

  new Setting(containerEl).setName("Test the connection").addButton((btn) => {
    btn.setButtonText("Test").onClick(async () => {
      btn.setDisabled(true);
      try {
        new Notice(await testOutlineService(transport, s), 6000);
      } catch (err) {
        new Notice(describeOutlineError(err), 8000);
      } finally {
        btn.setDisabled(false);
      }
    });
  });
}
