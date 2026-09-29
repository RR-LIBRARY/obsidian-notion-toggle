/** Group registered plugin commands without changing their IDs or shortcuts. */
import { Modal, Notice, Setting, type App } from "obsidian";

export type ToolGroup = "Toggle & layout" | "Writing & MCQ" | "Recall & quiz" | "Autoscroll" | "Research" | "Settings";
export const TOOL_GROUPS: ToolGroup[] = ["Toggle & layout", "Writing & MCQ", "Recall & quiz", "Autoscroll", "Research", "Settings"];

export function toolGroup(id: string): ToolGroup {
  if (["autoscroll-toolbar-guide", "diagnose-top-padding"].includes(id)) return "Settings";
  if (id.startsWith("research-")) return "Research";
  if (id.startsWith("autoscroll-") || ["smart-autoscroll", "scroll-stats"].includes(id)) return "Autoscroll";
  if (id.startsWith("quiz-") || id.startsWith("recall-") || ["smart-quiz", "smart-recall", "smart-review", "toggle-recall-timer", "show-due-notes", "perf-report"].includes(id)) return "Recall & quiz";
  if (id.startsWith("insert-mcq-") || id.startsWith("add-mcq-") || id.startsWith("insert-match-") || id.startsWith("quick-qa-") || id === "toggle-option-checkbox" || id.startsWith("insert-callout-") || id === "copy-callout-breakdown") return "Writing & MCQ";
  return "Toggle & layout";
}

interface ToolCommand { id: string; name: string; icon?: string }
interface CommandRegistry { commands: Record<string, ToolCommand>; executeCommandById(id: string): boolean }

export class ToolsMenuModal extends Modal {
  private query = "";
  constructor(app: App, private pluginId: string) { super(app); }

  onOpen(): void {
    this.modalEl.addClass("ntt-tools-menu");
    this.setTitle("Tools");
    const search = this.contentEl.createEl("input", { type: "search", placeholder: "Find an action…", attr: { "aria-label": "Find an action" } });
    const results = this.contentEl.createDiv({ cls: "ntt-tools-results" });
    const render = () => {
      results.empty();
      const registry = (this.app as App & { commands?: CommandRegistry }).commands;
      if (!registry) {
        results.createEl("p", { text: "Commands are not available right now." });
        return;
      }
      const commands = Object.values(registry.commands).filter((cmd) =>
        cmd.id.startsWith(`${this.pluginId}:`) && !["tools-menu", "toggle-list"].includes(cmd.id.slice(this.pluginId.length + 1))
      );
      let count = 0;
      for (const group of TOOL_GROUPS) {
        const matches = commands.filter((cmd) => {
          const id = cmd.id.slice(this.pluginId.length + 1);
          return toolGroup(id) === group && `${cmd.name} ${id} ${group}`.toLocaleLowerCase().includes(this.query);
        });
        if (!matches.length) continue;
        results.createEl("h3", { text: group });
        for (const cmd of matches) {
          count++;
          const label = cmd.name.replace(/^Advanced: /, "").replace(/^Notion Toggle: /, "");
          new Setting(results).setName(label).addButton((button) => button
            .setIcon(cmd.icon || "arrow-up-right")
            .setTooltip(label)
            .onClick(() => {
              this.close();
              if (!registry.executeCommandById(cmd.id)) new Notice("Open a note to use this action.");
            }));
        }
      }
      if (!count) results.createEl("p", { text: "No matching actions." });
    };
    search.addEventListener("input", () => { this.query = search.value.toLocaleLowerCase().trim(); render(); });
    render();
    search.focus();
  }
}
