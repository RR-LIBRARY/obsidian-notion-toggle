/**
 * v1.7.0 — installs the research features into the plugin.
 *
 * One call from `onload()` builds the service, registers the side panel,
 * the commands, the ribbon icon and the notice styling; one call from
 * `onunload()` tears it down. Keeps main.ts to a handful of lines.
 */
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { openPanel, registerResearchCommands, type ResearchCommandHost } from "./commands";
import { RESEARCH_VIEW_ICON, RESEARCH_VIEW_TYPE, ResearchView } from "./panel";
import { ResearchService, type ResearchHost } from "./service";
import { DEFAULT_RESEARCH_SETTINGS, type ResearchSettings } from "./types";

/** What main.ts must provide; everything else lives in this folder. */
export interface ResearchPluginHost extends Plugin, Omit<ResearchHost, "app" | "registerInterval"> {
  settings: ResearchHost["settings"];
  research: ResearchService;
  /** Wrapped addCommand (applies the plugin's naming rules). */
  addCommand(cmd: Parameters<Plugin["addCommand"]>[0]): ReturnType<Plugin["addCommand"]>;
  /** Open the plugin's own settings tab. */
  openSettings(): void;
}

/**
 * Fill in any research settings missing from a loaded data.json (older
 * installs) without touching values the reader already set.
 */
export function withResearchDefaults<T extends Partial<ResearchSettings>>(settings: T): T & ResearchSettings {
  const out = settings as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_RESEARCH_SETTINGS) as Array<keyof ResearchSettings>) {
    if (out[key] === undefined || out[key] === null) {
      const def = DEFAULT_RESEARCH_SETTINGS[key];
      out[key] = Array.isArray(def) ? [...def] : def;
    }
  }
  return settings as T & ResearchSettings;
}

export function installResearch(plugin: ResearchPluginHost): ResearchService {
  withResearchDefaults(plugin.settings);
  const service = new ResearchService({
    app: plugin.app,
    settings: plugin.settings,
    saveSettings: () => plugin.saveSettings(),
    registerInterval: (id) => plugin.registerInterval(id),
    activeCallout: () => plugin.activeCallout(),
    nextNumberAt: (editor, line) => plugin.nextNumberAt(editor, line),
    clientVersion: plugin.clientVersion,
  });
  plugin.research = service;

  plugin.registerView(RESEARCH_VIEW_TYPE, (leaf: WorkspaceLeaf) => new ResearchView(leaf, plugin));
  plugin.addRibbonIcon(RESEARCH_VIEW_ICON, "Research", () => void openResearchPanel(plugin));
  registerResearchCommands(plugin as unknown as ResearchCommandHost);

  // Resume polling for runs that were still going when Obsidian last closed.
  plugin.app.workspace.onLayoutReady(() => service.ensurePolling());
  return service;
}

export function uninstallResearch(plugin: { research?: ResearchService | null; app: Plugin["app"] }): void {
  plugin.research?.dispose();
  // Obsidian keeps leaves of unregistered views around as "empty"; detaching
  // them is the documented courtesy so the reader is not left with a blank tab.
  plugin.app.workspace.detachLeavesOfType(RESEARCH_VIEW_TYPE);
}

export function openResearchPanel(plugin: Plugin): Promise<void> {
  return openPanel(plugin);
}
