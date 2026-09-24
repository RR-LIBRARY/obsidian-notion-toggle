/**
 * v1.7.0 — command registration for web research.
 *
 * Every command reads the selection (or the current line / whole note),
 * asks the service to do the work, and inserts the result at the cursor in
 * the reader's toggle format. Errors become a Notice with the fix spelled
 * out; nothing is inserted on failure.
 */
import { type Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { describeError } from "./client";
import { DeepResearchModal, ResearchPromptModal, type PromptKind, type PromptResult } from "./modals";
import { RESEARCH_VIEW_TYPE } from "./panel";
import { insertIntoEditor, recallInput, type ResearchService } from "./service";
import type { ResearchSettings } from "./types";

export interface ResearchCommandHost extends Plugin {
  settings: ResearchSettings;
  research: ResearchService;
  /** Wrapped addCommand (applies the plugin's naming rules). */
  addCommand(cmd: Parameters<Plugin["addCommand"]>[0]): ReturnType<Plugin["addCommand"]>;
}

export const RESEARCH_COMMAND_IDS = [
  "research-open-panel",
  "research-ask",
  "research-factcheck",
  "research-search",
  "research-quick-search",
  "research-extract",
  "research-recall",
  "research-deep",
  "research-insert-latest",
] as const;

export function registerResearchCommands(plugin: ResearchCommandHost): void {
  const svc = plugin.research;

  const notify = (err: unknown) => new Notice(describeError(err), 8000);

  /** Run an operation, insert the result, and keep the panel in sync. */
  const runAndInsert = async (editor: Editor | null, work: () => Promise<{ markdown: string }>): Promise<void> => {
    const notice = new Notice("Researching…", 0);
    try {
      const result = await work();
      notice.hide();
      if (editor) {
        insertIntoEditor(editor, result.markdown, plugin.settings.researchInsertTarget);
      } else {
        await svc.insertMarkdown(result.markdown);
      }
    } catch (err) {
      notice.hide();
      notify(err);
    }
  };

  const openPrompt = (kind: PromptKind, editor: Editor | null) => {
    const ctx = svc.contextText(editor);
    const usingNote = kind === "recall" && !ctx.fromSelection;
    new ResearchPromptModal(
      plugin.app,
      {
        kind,
        text: ctx.fromSelection ? ctx.text : kind === "recall" ? "" : ctx.text,
        effort: plugin.settings.researchEffort,
        mode: plugin.settings.researchSearchMode,
        recallCount: plugin.settings.researchRecallCount,
        recallStyle: plugin.settings.researchRecallStyle,
        usingNote,
      },
      (r) => void handlePrompt(r, editor, usingNote)
    ).open();
  };

  const handlePrompt = async (r: PromptResult, editor: Editor | null, usingNote: boolean): Promise<void> => {
    switch (r.kind) {
      case "answer":
        return runAndInsert(editor, () => svc.ask(r.text, { effort: r.effort }));
      case "factcheck":
        return runAndInsert(editor, () => svc.factCheck(r.text, editor ? nearbyContext(editor) : undefined));
      case "search":
        return runAndInsert(editor, () => svc.search(r.text, { mode: r.mode }));
      case "quick":
        return runAndInsert(editor, () => svc.quickSearch(r.text));
      case "recall": {
        const input = recallInput(r.text, usingNote ? svc.noteText(editor) : "");
        if (!input) {
          new Notice("Type a topic or select some text first.");
          return;
        }
        return runAndInsert(editor, () =>
          svc.recall(input, { count: r.recallCount, style: r.recallStyle, startNumber: svc.nextNumber(editor) })
        );
      }
    }
  };

  plugin.addCommand({
    id: "research-open-panel",
    icon: "globe",
    name: "Research: open panel",
    callback: () => void openPanel(plugin),
  });

  plugin.addCommand({
    id: "research-ask",
    icon: "message-circle-question",
    name: "Research: ask the web (cited answer)",
    editorCallback: (editor) => openPrompt("answer", editor),
  });

  plugin.addCommand({
    id: "research-factcheck",
    icon: "badge-check",
    name: "Research: fact-check selection",
    editorCallback: (editor) => openPrompt("factcheck", editor),
  });

  plugin.addCommand({
    id: "research-search",
    icon: "search",
    name: "Research: web search → source toggles",
    editorCallback: (editor) => openPrompt("search", editor),
  });

  plugin.addCommand({
    id: "research-quick-search",
    icon: "zap",
    name: "Research: quick search (links)",
    editorCallback: (editor) => openPrompt("quick", editor),
  });

  plugin.addCommand({
    id: "research-extract",
    icon: "link",
    name: "Research: read link(s) into toggles",
    editorCallback: (editor) => {
      const ctx = svc.contextText(editor);
      const source = ctx.fromSelection ? ctx.text : editor.getLine(editor.getCursor().line);
      void runAndInsert(editor, () => svc.extract(source));
    },
  });

  plugin.addCommand({
    id: "research-recall",
    icon: "brain",
    name: "Research: recall toggles from selection / note",
    editorCallback: (editor) => openPrompt("recall", editor),
  });

  plugin.addCommand({
    id: "research-deep",
    icon: "telescope",
    name: "Research: deep research (background)",
    callback: () => {
      const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const ctx = svc.contextText(view?.editor);
      new DeepResearchModal(
        plugin.app,
        { objective: ctx.fromSelection ? ctx.text : "", preset: plugin.settings.researchDefaultPreset },
        (r) => {
          svc
            .startDeepResearch(r.objective, { preset: r.preset, processor: r.processor })
            .then((run) => new Notice(`Deep research started (${run.preset}). A notice will offer to insert it when ready.`, 6000))
            .catch(notify);
        }
      ).open();
    },
  });

  plugin.addCommand({
    id: "research-insert-latest",
    icon: "file-down",
    name: "Research: insert latest finished deep research",
    callback: () => {
      const ready = [...svc.runs].reverse().find((r) => r.status === "completed" && !r.consumed) ?? [...svc.runs].reverse().find((r) => r.status === "completed");
      if (!ready) {
        new Notice(svc.runs.some((r) => r.status === "running" || r.status === "queued") ? "Still running — check the research panel." : "No finished deep research yet.");
        return;
      }
      svc.insertRun(ready.runId).catch(notify);
    },
  });

  // Right-click menu on selected text: the two most common actions.
  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu, editor) => {
      if (!editor.getSelection().trim()) return;
      menu.addItem((item) =>
        item
          .setTitle("Research: ask the web")
          .setIcon("globe")
          .onClick(() => openPrompt("answer", editor))
      );
      menu.addItem((item) =>
        item
          .setTitle("Research: fact-check")
          .setIcon("badge-check")
          .onClick(() => openPrompt("factcheck", editor))
      );
      menu.addItem((item) =>
        item
          .setTitle("Research: recall toggles")
          .setIcon("brain")
          .onClick(() => openPrompt("recall", editor))
      );
    })
  );
}

/** Lines around the cursor give the fact-checker the surrounding context. */
export function nearbyContext(editor: Editor, radius = 6): string {
  const line = editor.getCursor().line;
  const from = Math.max(0, line - radius);
  const to = Math.min(editor.lastLine(), line + radius);
  const lines: string[] = [];
  for (let l = from; l <= to; l++) lines.push(editor.getLine(l));
  return lines.join("\n").slice(0, 4000);
}

export async function openPanel(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  const existing = workspace.getLeavesOfType(RESEARCH_VIEW_TYPE)[0];
  if (existing) {
    workspace.revealLeaf(existing);
    return;
  }
  const leaf = workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
  await leaf.setViewState({ type: RESEARCH_VIEW_TYPE, active: true });
  workspace.revealLeaf(leaf);
}
