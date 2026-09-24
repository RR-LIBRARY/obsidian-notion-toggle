/**
 * v1.7.0 — the "Web research" section of the settings tab.
 *
 * Presentation only: reads/writes the research settings and calls the
 * service for the connection test. Kept out of settings-tab.ts so that file
 * stays inside its size budget.
 */
import { Notice, Setting } from "obsidian";
import { PLUGIN_KEY_PATTERN, describeError, normalizeBridgeUrl } from "./client";
import type { ResearchService } from "./service";
import {
  EFFORT_LABELS,
  PRESET_LABELS,
  RECALL_STYLE_LABELS,
  SEARCH_MODE_LABELS,
  type Effort,
  type InsertStyle,
  type InsertTarget,
  type RecallStyle,
  type ResearchSettings,
  type SearchMode,
  type TaskPreset,
} from "./types";

export interface ResearchSettingsHost {
  settings: ResearchSettings;
  research: ResearchService;
  saveSettings(): Promise<void>;
}

export function renderResearchSettings(containerEl: HTMLElement, host: ResearchSettingsHost): void {
  const s = host.settings;

  new Setting(containerEl).setName("Web research (v1.7.0)").setHeading();
  containerEl.createDiv({
    cls: "setting-item-description ntt-research-hint",
    text:
      "Ask the web, fact-check, search and turn any text into recall toggles — powered by Parallel and Perplexity through your own research bridge. " +
      "Create a plugin key in the bridge dashboard, paste both values here, then press Test.",
  });

  new Setting(containerEl)
    .setName("Bridge URL")
    .setDesc("The address of your research dashboard, e.g. https://your-bridge.lovable.app")
    .addText((txt) => {
      txt.inputEl.type = "url";
      txt.inputEl.addClass("ntt-research-wide");
      txt.setPlaceholder("https://…").setValue(s.researchBridgeUrl);
      txt.inputEl.addEventListener("change", async () => {
        s.researchBridgeUrl = normalizeBridgeUrl(txt.getValue());
        txt.setValue(s.researchBridgeUrl);
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Plugin key")
    .setDesc("Starts with ntr_. Dashboard → Keys → New key. Revoke it there any time.")
    .addText((txt) => {
      txt.inputEl.type = "password";
      txt.inputEl.autocomplete = "off";
      txt.inputEl.addClass("ntt-research-wide");
      txt.setPlaceholder("ntr_…").setValue(s.researchPluginKey);
      txt.inputEl.addEventListener("change", async () => {
        const v = txt.getValue().trim();
        s.researchPluginKey = v;
        await host.saveSettings();
        if (v && !PLUGIN_KEY_PATTERN.test(v)) new Notice("That does not look like a plugin key (ntr_…). Saved anyway — press Test to check.");
      });
    })
    .addExtraButton((btn) =>
      btn
        .setIcon("eye")
        .setTooltip("Show / hide")
        .onClick(() => {
          const input = containerEl.querySelector<HTMLInputElement>('input[placeholder="ntr_…"]');
          if (input) input.type = input.type === "password" ? "text" : "password";
        })
    );

  const status = new Setting(containerEl)
    .setName("Connection")
    .setDesc(host.research.configured ? "Press Test to check the key and the providers." : "Add the URL and key above first.");
  status.addButton((btn) =>
    btn
      .setButtonText("Test")
      .setCta()
      .onClick(async () => {
        btn.setDisabled(true).setButtonText("Testing…");
        try {
          const h = await host.research.client().health();
          const providers = [h.providers.parallel ? "Parallel ✓" : "Parallel ✗", h.providers.perplexity ? "Perplexity ✓" : "Perplexity ✗", h.providers.ai ? "AI ✓" : "AI ✗"];
          status.setDesc(
            h.key
              ? `Connected as key “${h.key.name}” (${h.key.prefix}…). ${providers.join(" · ")}. Bridge v${h.version}.`
              : `Bridge reachable (v${h.version}) but the key was not recognised. ${providers.join(" · ")}.`
          );
          new Notice(h.key ? "Research bridge connected" : "Bridge reachable — check the plugin key", 5000);
        } catch (err) {
          status.setDesc(describeError(err));
          new Notice(describeError(err), 8000);
        } finally {
          btn.setDisabled(false).setButtonText("Test");
        }
      })
  );
  status.addExtraButton((btn) =>
    btn
      .setIcon("external-link")
      .setTooltip("Open the dashboard")
      .onClick(() => {
        const url = normalizeBridgeUrl(s.researchBridgeUrl);
        if (!url) {
          new Notice("Add the bridge URL first.");
          return;
        }
        window.open(`${url}/dashboard`, "_blank");
      })
  );

  new Setting(containerEl)
    .setName("Insert as")
    .setDesc("Toggle = a collapsible question toggle in your usual style. Markdown = plain text, no toggle.")
    .addDropdown((dd) => {
      dd.addOption("toggle", "Toggle (recommended)").addOption("markdown", "Plain markdown");
      dd.setValue(s.researchInsertStyle).onChange(async (v) => {
        s.researchInsertStyle = v as InsertStyle;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Insert where")
    .setDesc("Below the cursor line, or at the end of the note.")
    .addDropdown((dd) => {
      dd.addOption("cursor", "Below the cursor").addOption("end", "End of the note");
      dd.setValue(s.researchInsertTarget).onChange(async (v) => {
        s.researchInsertTarget = v as InsertTarget;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Sources list")
    .setDesc("Append a numbered Sources list under answers, fact-checks and recall sets.")
    .addToggle((tg) =>
      tg.setValue(s.researchIncludeSources).onChange(async (v) => {
        s.researchIncludeSources = v;
        await host.saveSettings();
      })
    );

  new Setting(containerEl)
    .setName("Search mode")
    .setDesc("Default for “Web search”. Fast is right for almost everything.")
    .addDropdown((dd) => {
      for (const [id, label] of Object.entries(SEARCH_MODE_LABELS)) dd.addOption(id, label);
      dd.setValue(s.researchSearchMode).onChange(async (v) => {
        s.researchSearchMode = v as SearchMode;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Answer effort")
    .setDesc("Default for “Ask the web” and fact-checks.")
    .addDropdown((dd) => {
      for (const [id, label] of Object.entries(EFFORT_LABELS)) dd.addOption(id, label);
      dd.setValue(s.researchEffort).onChange(async (v) => {
        s.researchEffort = v as Effort;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Recall toggles per request")
    .setDesc("How many question toggles “Recall toggles” generates (3–20).")
    .addSlider((sl) => {
      sl.setLimits(3, 20, 1)
        .setDynamicTooltip()
        .setValue(s.researchRecallCount)
        .onChange(async (v) => {
          s.researchRecallCount = v;
          await host.saveSettings();
        });
    });

  new Setting(containerEl)
    .setName("Recall style")
    .setDesc("Q&A toggles, multiple choice with an Answer line, or fill-in-the-blank.")
    .addDropdown((dd) => {
      for (const [id, label] of Object.entries(RECALL_STYLE_LABELS)) dd.addOption(id, label);
      dd.setValue(s.researchRecallStyle).onChange(async (v) => {
        s.researchRecallStyle = v as RecallStyle;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Answer language")
    .setDesc("Leave empty to match the question. e.g. Hindi, Hinglish, English.")
    .addText((txt) => {
      txt.setPlaceholder("auto").setValue(s.researchLanguage);
      txt.inputEl.addEventListener("change", async () => {
        s.researchLanguage = txt.getValue().trim().slice(0, 40);
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("Deep research default shape")
    .setDesc("Preselected in the deep-research dialog.")
    .addDropdown((dd) => {
      for (const [id, label] of Object.entries(PRESET_LABELS)) dd.addOption(id, label);
      dd.setValue(s.researchDefaultPreset).onChange(async (v) => {
        s.researchDefaultPreset = v as TaskPreset;
        await host.saveSettings();
      });
    });

  new Setting(containerEl)
    .setName("On-device cache")
    .setDesc("Repeat searches within 15 minutes are answered instantly without using credits.")
    .addToggle((tg) =>
      tg.setValue(s.researchCache).onChange(async (v) => {
        s.researchCache = v;
        if (!v) host.research.clearCache();
        await host.saveSettings();
      })
    )
    .addExtraButton((btn) =>
      btn
        .setIcon("trash")
        .setTooltip("Clear cache now")
        .onClick(() => {
          host.research.clearCache();
          new Notice("Research cache cleared");
        })
    );

  const active = s.researchRuns.filter((r) => r.status === "queued" || r.status === "running").length;
  const ready = s.researchRuns.filter((r) => r.status === "completed" && !r.consumed).length;
  new Setting(containerEl)
    .setName("Background runs")
    .setDesc(`${active} running · ${ready} ready to insert · ${s.researchRuns.length} remembered (max 20).`)
    .addButton((btn) =>
      btn.setButtonText("Forget finished").onClick(async () => {
        s.researchRuns = s.researchRuns.filter((r) => r.status === "queued" || r.status === "running");
        await host.saveSettings();
        new Notice("Finished runs forgotten");
      })
    );
}
