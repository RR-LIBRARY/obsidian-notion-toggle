/**
 * v1.8.0 — "Notion-like writing": the Obsidian-facing shell that wires the
 * clean-toggle editor layer into the plugin.
 *
 * Why this exists: a toggle is stored as `> [!question]- Title` + `> body`.
 * Reading view already shows it as arrow + title, but the moment the caret
 * enters the block Live Preview reveals the raw `>` and `[!question]-` markers,
 * which non-technical writers find uncomfortable. This module registers:
 *
 *   1. the CodeMirror extension that hides those markers behind a clickable
 *      arrow while typing (`src/clean-toggles-view.ts`),
 *   2. the `>` + space shortcut that starts a toggle like Notion does,
 *   3. paste handling: `<details>` blocks on the clipboard become toggles,
 *   4. a one-tap nudge when a note that still carries `<details>` is opened,
 *   5. the plain Notion look (a body class the stylesheet keys off),
 *   6. a command to flip a toggle between "closed by default" and "open by default",
 *   7. the "Notion-like writing" section of the settings tab.
 *
 * All decisions about *what* to hide or convert live in the pure module
 * `src/clean-toggles.ts`; this file only talks to Obsidian.
 */

import { MarkdownView, Notice, Setting, editorLivePreviewField, type TFile } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type NotionTogglePlugin from "../main";
import { cleanTogglesExtension, releaseCleanToggles, runBlockMove, type MoveHow } from "./clean-toggles-view";
import { convertNotionPaste, onOwnLine } from "./notion-paste";
import { cleanOwnsEnter, convertPastedText, detailsBlockCount, flipFoldMarker, type DocLike } from "./clean-toggles";
import { convertDetailsToCallouts, newTogglePlan, nextToggleNumber } from "./editor-blocks";
import { AT_TOP_LEVEL, NO_TOGGLE_ABOVE, installIndentBridge, type BridgeEditor, type CoreCommand } from "./indent-bridge";
import { INDENT_COMMAND_ID, OUTDENT_COMMAND_ID } from "./naming";

/* ---------- settings ---------- */

export interface NotionWritingSettings {
  /** v1.8.0: hide `>` / `[!type]-` while typing; show a clickable arrow instead. */
  cleanEditing: boolean;
  /** v1.8.0: plain Notion look for rendered toggles (arrow + title, no coloured box). */
  notionLook: boolean;
  /** v1.8.0: typing `>` then a space on an empty line starts a toggle. */
  notionShortcut: boolean;
  /** v1.8.0: pasted `<details>` blocks become toggles automatically. */
  convertDetailsOnPaste: boolean;
  /** v1.8.0: offer a one-tap conversion when a note with `<details>` opens. */
  detailsNudge: boolean;
  /** v1.8.2: show a small "…" chip after the title of a closed toggle while editing (off = Notion: arrow + title only). */
  cleanMoreChip: boolean;
  /** v1.8.9: Tab / Shift+Tab, Ctrl/Cmd+Shift+↑/↓ and press-and-drag rearrange blocks and shove them into toggles. */
  blockMoves: boolean;
  /** v1.8.14: paste copied from Notion (nested toggles, toggle headings, callouts) arrives as nested toggles. */
  convertNotionPaste: boolean;
}

export const DEFAULT_NOTION_WRITING: NotionWritingSettings = {
  cleanEditing: true,
  notionLook: true,
  notionShortcut: true,
  convertDetailsOnPaste: true,
  detailsNudge: true,
  cleanMoreChip: false,
  blockMoves: true,
  convertNotionPaste: true,
};

/** Body class the stylesheet keys off; themes and CSS snippets can build on it too. */
export const NOTION_LOOK_CLASS = "ntt-notion-look";

/* ---------- wiring ---------- */

/** Every feature here is about callout toggles; `<details>` format keeps the plain editor. */
function calloutMode(plugin: NotionTogglePlugin): boolean {
  return plugin.settings.format === "callout";
}

/** Apply / remove the plain Notion look. Called on load and whenever the setting flips. */
export function applyNotionLook(plugin: NotionTogglePlugin): void {
  document.body.classList.toggle(NOTION_LOOK_CLASS, plugin.settings.notionLook);
}

/**
 * `>` + space on an empty line: swap the lone `>` for a fresh toggle skeleton and
 * park the caret where the title goes. Returns false when the line is not a lone `>`.
 */
export function insertToggleFromShortcut(plugin: NotionTogglePlugin, view: EditorView): boolean {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.head);
  if (line.text !== ">") return false;
  const above: string[] = [];
  for (let n = 1; n < line.number; n++) above.push(view.state.doc.line(n).text);
  const plan = newTogglePlan({
    header: plugin.toggleHeader(""),
    format: "callout",
    lineHasText: false,
    collapsed: plugin.settings.defaultCollapsed,
    boldSummary: plugin.settings.boldSummary,
    numbered: plugin.settings.numberedByDefault,
    nextNumber: nextToggleNumber(above),
  });
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: plan.block },
    selection: { anchor: line.from + plan.ch },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
}

/** Notes already nudged this session — one gentle offer per note, never a loop. */
const nudged = new WeakMap<NotionTogglePlugin, Set<string>>();

/**
 * A note that still uses `<details>` gets a one-tap offer to become toggles.
 * Nothing changes until the writer presses the button.
 */
export async function offerDetailsConversion(plugin: NotionTogglePlugin, file: TFile | null): Promise<void> {
  if (!file || !plugin.settings.detailsNudge || !calloutMode(plugin)) return;
  if (file.extension !== "md") return;
  let seen = nudged.get(plugin);
  if (!seen) nudged.set(plugin, (seen = new Set()));
  if (seen.has(file.path)) return;
  const text = await plugin.app.vault.cachedRead(file);
  const count = detailsBlockCount(text);
  if (count === 0) return;
  seen.add(file.path);

  const frag = document.createDocumentFragment();
  const box = frag.createDiv({ cls: "ntt-details-nudge" });
  box.createDiv({
    text: count === 1 ? "This note has 1 <details> block." : `This note has ${count} <details> blocks.`,
  });
  box.createDiv({ cls: "ntt-details-nudge-hint", text: "Turn them into toggles you can open with an arrow?" });
  const row = box.createDiv({ cls: "ntt-details-nudge-actions" });
  const notice = new Notice(frag, 15000);
  row.createEl("button", { text: "Convert to toggles", cls: "mod-cta" }).addEventListener("click", () => {
    const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    const editor = view?.file?.path === file.path ? view.editor : null;
    if (!editor) {
      new Notice('Open the note in editing mode, then run "Convert <details> blocks to callouts".');
      notice.hide();
      return;
    }
    const doc = editor.getValue();
    const converted = convertDetailsToCallouts(
      doc,
      plugin.activeCallout(),
      plugin.settings.defaultCollapsed,
      plugin.settings.boldSummary
    );
    if (converted !== doc) editor.setValue(converted);
    new Notice("Done — every <details> block is now a toggle.");
    notice.hide();
  });
  row.createEl("button", { text: "Not now" }).addEventListener("click", () => notice.hide());
}

/**
 * v1.8.13 — asked by main.ts's older Enter handler (which runs first and only
 * knows flat `> ` lines) before it acts: with clean editing on in Live Preview,
 * the end of a toggle title and anything inside a nested toggle belong to the
 * clean layer, so that handler steps aside and lets the clean layer's Enter
 * (or, failing that, Obsidian's own `>` continuation) run.
 */
export function cleanLayerOwnsEnter(
  plugin: NotionTogglePlugin,
  state: { doc: DocLike; field?: (f: unknown, required?: false) => unknown },
  lineNumber: number,
  head: number
): boolean {
  if (!plugin.settings.cleanEditing || !calloutMode(plugin)) return false;
  const live = typeof state.field === "function" ? state.field(editorLivePreviewField, false) : undefined;
  if (live === false) return false; // Source mode: the clean layer is off there too
  return cleanOwnsEnter(state.doc, lineNumber, head);
}

/** v1.8.11 — called from `onunload`: drop the module-level drag host so a disabled plugin keeps nothing alive. */
export function uninstallNotionWriting(): void {
  releaseCleanToggles();
}

/** Register everything. Called once from `onload`; cleanup rides on the plugin lifecycle. */
export function installNotionWriting(plugin: NotionTogglePlugin): void {
  plugin.registerEditorExtension(
    cleanTogglesExtension({
      livePreviewField: editorLivePreviewField,
      enabled: () => plugin.settings.cleanEditing && calloutMode(plugin),
      shortcutEnabled: () => plugin.settings.notionShortcut && calloutMode(plugin),
      insertToggleFromShortcut: (view) => insertToggleFromShortcut(plugin, view),
      moreChip: () => plugin.settings.cleanMoreChip,
      autoContinue: () => plugin.settings.autoContinue,
      blockMoves: () => plugin.settings.blockMoves !== false,
      newToggleFold: () => (plugin.settings.defaultCollapsed ? "-" : "+"),
    })
  );

  // v1.8.23 — Indent / Outdent are Notion's nesting controls and get their own
  // toolbar buttons (primary names in src/naming.ts). IDs unchanged since 1.8.9.
  const moves: [MoveHow, string, string, string][] = [
    ["up", "move-block-up", "Move block up", "arrow-up"],
    ["down", "move-block-down", "Move block down", "arrow-down"],
    ["in", INDENT_COMMAND_ID, "Indent (nest under the toggle above)", "indent"],
    ["out", OUTDENT_COMMAND_ID, "Outdent (move out one level)", "outdent"],
  ];
  for (const [how, id, name, icon] of moves) {
    plugin.addCommand({
      id,
      name,
      icon,
      editorCallback: (editor) => {
        const cm = (editor as unknown as { cm?: EditorView }).cm;
        if (!cm || !runBlockMove(cm, how)) {
          new Notice(how === "in" ? NO_TOGGLE_ABOVE : how === "out" ? AT_TOP_LEVEL : "Nothing to move here.");
        }
      },
    });
  }

  // Obsidian's own Indent / Unindent toolbar buttons behave like the two
  // commands above while the caret is on a toggle (src/indent-bridge.ts).
  installIndentBridge({
    registry: (plugin.app as unknown as { commands?: { commands?: Record<string, CoreCommand> } }).commands?.commands,
    activeEditor: () => (plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor as unknown as BridgeEditor | undefined) ?? null,
    enabled: () => plugin.settings.blockMoves !== false && calloutMode(plugin),
    notify: (message) => void new Notice(message),
    register: (cleanup) => plugin.register(cleanup),
  });

  plugin.registerEvent(
    plugin.app.workspace.on("editor-paste", (evt, editor) => {
      if (evt.defaultPrevented || !calloutMode(plugin)) return;
      const text = evt.clipboardData?.getData("text/plain") ?? "";
      const opts = {
        calloutType: plugin.activeCallout(),
        collapsed: plugin.settings.defaultCollapsed,
        boldSummary: plugin.settings.boldSummary,
      };
      const fromNotion = plugin.settings.convertNotionPaste !== false ? convertNotionPaste(text, opts) : null;
      const converted = fromNotion ?? (plugin.settings.convertDetailsOnPaste ? convertPastedText(text, opts) : null);
      if (!converted) return;
      evt.preventDefault();
      const cur = editor.getCursor("from");
      editor.replaceSelection(onOwnLine(converted, editor.getLine(cur.line).slice(0, cur.ch)));
      new Notice(fromNotion ? "Pasted from Notion — toggles, headings and callouts kept." : "Pasted <details> blocks were turned into toggles.");
    })
  );

  plugin.registerEvent(plugin.app.workspace.on("file-open", (file) => void offerDetailsConversion(plugin, file)));

  plugin.addCommand({
    id: "toggle-default-state",
    icon: "chevrons-up-down",
    name: "Toggle: open by default ↔ closed by default (this toggle)",
    editorCallback: (editor) => {
      const found = plugin.findHeaderLine(editor);
      if (!found) {
        new Notice("Put the cursor inside a toggle first.");
        return;
      }
      const flipped = flipFoldMarker(found.text);
      if (flipped === found.text) {
        new Notice("This works with callout toggles only.");
        return;
      }
      editor.setLine(found.line, flipped);
      new Notice(/\]\+/.test(flipped) ? "This toggle now opens by default." : "This toggle now starts closed.");
    },
  });

  applyNotionLook(plugin);
  plugin.register(() => document.body.classList.remove(NOTION_LOOK_CLASS));
}

/* ---------- settings section ---------- */

/** "Notion-like writing" section of the settings tab (kept here so settings-tab.ts stays lean). */
export function renderNotionWritingSettings(containerEl: HTMLElement, plugin: NotionTogglePlugin): void {
  new Setting(containerEl).setName("Notion-like writing").setHeading();

  const note = containerEl.createDiv({ cls: "setting-item-description ntt-notion-writing-note" });
  note.setText(
    "Toggles stay ordinary Obsidian callouts underneath, so nothing breaks in other apps. " +
      "These options only change what you see and type."
  );

  const save = async () => {
    await plugin.saveSettings();
  };

  new Setting(containerEl)
    .setName("Clean editing")
    .setDesc(
      "While typing, show a small arrow instead of the “> [!question]-” code (a bold title's ** are hidden too). Click the arrow to open or close the toggle."
    )
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.cleanEditing);
      toggle.onChange(async (value) => {
        plugin.settings.cleanEditing = value;
        plugin.app.workspace.updateOptions(); // re-run the editor extension in every open editor
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Plain Notion look")
    .setDesc("Rendered toggles show just an arrow and the title — no coloured box or icon. Colour toggles keep a coloured arrow.")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.notionLook);
      toggle.onChange(async (value) => {
        plugin.settings.notionLook = value;
        applyNotionLook(plugin);
        await save();
      });
    });

  new Setting(containerEl)
    .setName("“>” + space starts a toggle")
    .setDesc("On an empty line, type > and a space to start a new toggle — the same habit as Notion.")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.notionShortcut);
      toggle.onChange(async (value) => {
        plugin.settings.notionShortcut = value;
        plugin.app.workspace.updateOptions();
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Convert pasted <details> automatically")
    .setDesc("When you paste text that contains <details>…</details> blocks, they arrive as toggles.")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.convertDetailsOnPaste);
      toggle.onChange(async (value) => {
        plugin.settings.convertDetailsOnPaste = value;
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Convert Notion paste to toggles")
    .setDesc("Text copied from Notion keeps its nested toggles, toggle headings, bullets and callouts.")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.convertNotionPaste !== false);
      toggle.onChange(async (value) => {
        plugin.settings.convertNotionPaste = value;
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Offer to convert old notes")
    .setDesc("When a note that still uses <details> is opened, show a one-tap “Convert to toggles” offer (once per note).")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.detailsNudge);
      toggle.onChange(async (value) => {
        plugin.settings.detailsNudge = value;
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Rearrange and shove into toggles")
    .setDesc(
      "Like Notion: press and hold a line (or drag a toggle's arrow) to move it — let go on a toggle to put it inside. Tab puts a line inside the toggle above, Shift+Tab takes it out, Ctrl/Cmd+Shift+↑/↓ moves it."
    )
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.blockMoves !== false);
      toggle.onChange(async (value) => {
        plugin.settings.blockMoves = value;
        await save();
      });
    });

  new Setting(containerEl)
    .setName("Show “…” after a closed title")
    .setDesc("Add a small … chip after the title of a closed toggle while editing. Off = just the arrow and the title, like Notion.")
    .addToggle((toggle) => {
      toggle.setValue(plugin.settings.cleanMoreChip);
      toggle.onChange(async (value) => {
        plugin.settings.cleanMoreChip = value;
        plugin.app.workspace.updateOptions();
        await save();
      });
    });
}
