/**
 * v1.5.0 — commands that make the callout kinds discoverable:
 *
 * - "Insert callout type playground" writes a note with one live example per
 *   kind, so every filter can be tried in ten seconds.
 * - "Copy callout breakdown" puts this note's type / count / percentage table
 *   on the clipboard.
 *
 * Kept out of main.ts so the entry file stays an orchestrator.
 */
import { Notice, type Plugin } from "obsidian";
import { playgroundMarkdown, playgroundPath } from "./callout-playground";
import { breakdownSummary, breakdownTable, type KindCount } from "./callout-stats";

interface CalloutHost extends Plugin {
  calloutBreakdown(): KindCount[];
}

export function registerCalloutCommands(plugin: CalloutHost): void {
  plugin.addCommand({
    id: "insert-callout-playground",
    name: "Insert callout type playground note",
    callback: async () => {
      const folder = plugin.app.workspace.getActiveFile()?.parent?.path ?? "";
      const dir = folder === "/" ? "" : folder;
      const path = playgroundPath(
        (p) => plugin.app.vault.getAbstractFileByPath(p) !== null,
        dir
      );
      const file = await plugin.app.vault.create(path, playgroundMarkdown());
      await plugin.app.workspace.getLeaf(true).openFile(file);
      new Notice(`Playground note banaya: ${path}`);
    },
  });

  plugin.addCommand({
    id: "copy-callout-breakdown",
    name: "Copy callout breakdown (counts + %)",
    callback: async () => {
      const rows = plugin.calloutBreakdown();
      const total = rows.reduce((n, r) => n + r.count, 0);
      const table = breakdownTable(rows, total);
      await navigator.clipboard.writeText(table);
      new Notice(`Copied — ${breakdownSummary(rows, total)}`);
    },
  });
}
