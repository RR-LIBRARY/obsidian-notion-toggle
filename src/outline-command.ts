/**
 * v1.8.23 — Obsidian shell for "Outline selection with AI".
 *
 * Registers one command: take the selection (or the whole note), ask the
 * reader's outline service for same-level toggles, and write them into the
 * note. All logic lives in the pure `outline-service` module.
 */
import { type Editor, Notice, Plugin, requestUrl } from "obsidian";
import {
  describeOutlineError,
  outlineInput,
  requestOutline,
  type OutlineFormatOptions,
  type OutlineSettings,
  type OutlineTransport,
} from "./outline-service";

export const OUTLINE_COMMAND_ID = "outline-with-ai";

export interface OutlineCommandHost extends Plugin {
  settings: OutlineSettings & { format: "callout" | "details"; calloutType: string; defaultCollapsed: boolean; boldSummary: boolean };
  addCommand(cmd: Parameters<Plugin["addCommand"]>[0]): ReturnType<Plugin["addCommand"]>;
}

/** Obsidian's requestUrl as the injected transport (no CORS, works on mobile). */
export const obsidianTransport: OutlineTransport = async (req) => {
  const res = await requestUrl({ url: req.url, method: req.method, headers: req.headers, body: req.body, throw: false });
  return { status: res.status, text: res.text };
};

export function outlineOptions(s: OutlineCommandHost["settings"]): OutlineFormatOptions {
  return {
    format: s.format === "details" ? "details" : "callout",
    calloutType: s.calloutType || "note",
    collapsed: s.defaultCollapsed !== false,
    boldTitle: s.boldSummary !== false,
    maxToggles: s.outlineMaxToggles || 12,
  };
}

/** Put the outline below the current line, one blank line apart. */
export function writeOutline(editor: Editor, markdown: string): void {
  const cursor = editor.getCursor("to");
  const line = editor.getLine(cursor.line);
  const block = line.trim().length ? `\n\n${markdown}\n` : `${markdown}\n`;
  editor.replaceRange(block, { line: cursor.line, ch: line.length });
  editor.setCursor({ line: cursor.line + block.split("\n").length - 1, ch: 0 });
}

export function registerOutlineCommand(plugin: OutlineCommandHost, transport: OutlineTransport = obsidianTransport): void {
  plugin.addCommand({
    id: OUTLINE_COMMAND_ID,
    icon: "sparkles",
    name: "Outline selection with AI",
    editorCallback: async (editor: Editor) => {
      const { text, fromSelection } = outlineInput(editor.getSelection(), editor.getValue());
      if (!text) {
        new Notice("Select some text first, then run Outline with AI.");
        return;
      }
      const notice = new Notice(fromSelection ? "Outlining the selection…" : "Outlining this note…", 0);
      try {
        const out = await requestOutline(transport, plugin.settings, text, outlineOptions(plugin.settings));
        notice.hide();
        writeOutline(editor, out.markdown);
        new Notice(`Added ${out.toggles.length} toggle${out.toggles.length === 1 ? "" : "s"}.`);
      } catch (err) {
        notice.hide();
        new Notice(describeOutlineError(err), 8000);
      }
    },
  });
}
