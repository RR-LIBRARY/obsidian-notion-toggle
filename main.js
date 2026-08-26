"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  convertCalloutsToDetails: () => convertCalloutsToDetails,
  convertDetailsToCallouts: () => convertDetailsToCallouts,
  default: () => NotionTogglePlugin,
  planEnter: () => planEnter
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");
var DEFAULT_SETTINGS = {
  calloutType: "question",
  defaultCollapsed: true,
  boldSummary: true,
  autoContinue: true,
  format: "callout"
};
var CALLOUT_TYPES = ["question", "info", "note", "abstract", "tip", "warning", "success"];
var NotionTogglePlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "insert-toggle",
      icon: "chevrons-down-up",
      name: "Insert toggle (empty)",
      editorCallback: (editor) => {
        const fold = this.settings.defaultCollapsed ? "-" : "+";
        const type = this.settings.calloutType;
        const cursor = editor.getCursor();
        editor.replaceRange(`> [!${type}]${fold} 
> 
`, cursor);
        editor.setCursor({ line: cursor.line, ch: cursor.ch + `> [!${type}]${fold} `.length });
      }
    });
    this.addCommand({
      id: "wrap-selection-toggle",
      icon: "text-quote",
      name: "Wrap selection as toggle",
      editorCallback: (editor) => {
        const selection = editor.getSelection();
        const type = this.settings.calloutType;
        const fold = this.settings.defaultCollapsed ? "-" : "+";
        if (selection.trim().length === 0) {
          const line = editor.getLine(editor.getCursor().line);
          if (line.trim().length === 0) {
            new import_obsidian.Notice("Nothing to wrap \u2014 select the question and answer first.");
            return;
          }
          const title2 = this.maybeBold(line.trim());
          editor.replaceRange(`> [!${type}]${fold} ${title2}
> 
`, {
            line: editor.getCursor().line,
            ch: 0
          }, {
            line: editor.getCursor().line,
            ch: line.length
          });
          return;
        }
        const lines = selection.split("\n");
        let titleLine = "";
        let bodyStart = 0;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].trim().length > 0) {
            titleLine = lines[i].trim();
            bodyStart = i + 1;
            break;
          }
        }
        if (titleLine.length === 0) {
          new import_obsidian.Notice("Selection is empty.");
          return;
        }
        const title = this.maybeBold(titleLine);
        const bodyLines = lines.slice(bodyStart);
        while (bodyLines.length > 0 && bodyLines[0].trim().length === 0) {
          bodyLines.shift();
        }
        const body = bodyLines.length > 0 ? "\n" + bodyLines.map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n") : "";
        const block = `> [!${type}]${fold} ${title}${body}
`;
        editor.replaceSelection(block);
      }
    });
    this.addCommand({
      id: "convert-details-to-callouts",
      icon: "list-tree",
      name: "Convert <details> blocks to callouts",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertDetailsToCallouts(doc, this.settings.calloutType, this.settings.defaultCollapsed, this.settings.boldSummary);
        if (converted === doc) {
          new import_obsidian.Notice("No <details> blocks found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian.Notice("Converted all <details> blocks to callout toggles.");
      }
    });
    this.addCommand({
      id: "convert-callouts-to-details",
      icon: "code",
      name: "Convert callouts to <details> blocks",
      editorCallback: (editor) => {
        const doc = editor.getValue();
        const converted = convertCalloutsToDetails(doc);
        if (converted === doc) {
          new import_obsidian.Notice("No foldable callout toggles found in this file.");
          return;
        }
        editor.setValue(converted);
        new import_obsidian.Notice("Converted callout toggles to <details> blocks.");
      }
    });
    this.addCommand({
      id: "quick-qa-toggle",
      icon: "help-circle",
      name: "Quick Q&A toggle (prompt)",
      editorCallback: (editor) => {
        new QuickQAModal(this.app, this, (result) => {
          const type = this.settings.calloutType;
          const fold = this.settings.defaultCollapsed ? "-" : "+";
          const q = result.question.trim();
          const a = result.answer.trim();
          if (q.length === 0) {
            new import_obsidian.Notice("Question is empty \u2014 nothing inserted.");
            return;
          }
          const title = this.maybeBold(q);
          const body = a.length > 0 ? "\n" + a.split("\n").map((l) => `> ${l}`.replace(/>\s+$/, ">")).join("\n") : "";
          editor.replaceRange(`> [!${type}]${fold} ${title}${body}
`, editor.getCursor());
        }).open();
      }
    });
    this.addCommand({
      id: "new-toggle-below",
      icon: "plus-circle",
      name: "New toggle below",
      editorCallback: (editor) => this.insertNewToggleBelow(editor)
    });
    this.addCommand({
      id: "toggle-auto-continue",
      icon: "corner-down-left",
      name: "Toggle auto-continue on Enter",
      callback: async () => {
        this.settings.autoContinue = !this.settings.autoContinue;
        await this.saveSettings();
        new import_obsidian.Notice(`Auto-continue on Enter: ${this.settings.autoContinue ? "ON" : "OFF"}`);
      }
    });
    this.registerEditorExtension(
      import_state.Prec.highest(
        import_view.keymap.of([
          {
            key: "Enter",
            run: (view) => {
              if (!this.settings.autoContinue)
                return false;
              return this.handleEnter(view);
            }
          }
        ])
      )
    );
    this.addSettingTab(new NotionToggleSettingTab(this.app, this));
  }
  /** Build a fresh toggle header string (no trailing newline). */
  toggleHeader(title = "") {
    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const inner = this.settings.boldSummary ? `<b>${title}</b>` : title;
      return `<details${openAttr}>
<summary>${inner}</summary>

`;
    }
    const fold = this.settings.defaultCollapsed ? "-" : "+";
    return `> [!${this.settings.calloutType}]${fold} ${title}`;
  }
  /** Insert an empty toggle on the line below the cursor and place the caret in its summary. */
  insertNewToggleBelow(editor) {
    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const prefix = currentLine.trim().length === 0 ? "" : "\n";
    if (this.settings.format === "details") {
      const openAttr = this.settings.defaultCollapsed ? "" : " open";
      const openTag = `<details${openAttr}>`;
      const summaryOpen = this.settings.boldSummary ? "<summary><b>" : "<summary>";
      const summaryClose = this.settings.boldSummary ? "</b></summary>" : "</summary>";
      const block2 = `${prefix}${openTag}
${summaryOpen}${summaryClose}


</details>
`;
      editor.replaceRange(block2, { line: cursor.line, ch: currentLine.length });
      const summaryLine = cursor.line + (prefix ? 2 : 1);
      editor.setCursor({ line: summaryLine, ch: summaryOpen.length });
      return;
    }
    const header = this.toggleHeader("");
    const bold = this.settings.boldSummary ? "****" : "";
    const block = `${prefix}${header}${bold}
> 
`;
    editor.replaceRange(block, { line: cursor.line, ch: currentLine.length });
    const headerLine = cursor.line + (prefix ? 1 : 0);
    editor.setCursor({
      line: headerLine,
      ch: header.length + (this.settings.boldSummary ? 2 : 0)
    });
  }
  /**
   * Enter inside a toggle:
   *  - callout body line with content  -> new "> " body line
   *  - empty "> " body line            -> start the NEXT toggle
   *  - line after </details>           -> start the next <details> skeleton
   * Returns true when handled (default Enter suppressed).
   */
  handleEnter(view) {
    const state = view.state;
    const sel = state.selection.main;
    if (!sel.empty)
      return false;
    const line = state.doc.lineAt(sel.head);
    const text = line.text;
    const atLineEnd = sel.head === line.to;
    if (!atLineEnd)
      return false;
    const plan = planEnter(text, {
      calloutType: this.settings.calloutType,
      collapsed: this.settings.defaultCollapsed,
      boldSummary: this.settings.boldSummary,
      format: this.settings.format
    });
    if (!plan)
      return false;
    view.dispatch({
      changes: { from: plan.from === "lineStart" ? line.from : sel.head, to: line.to, insert: plan.insert },
      selection: { anchor: (plan.from === "lineStart" ? line.from : sel.head) + plan.cursorOffset },
      scrollIntoView: true,
      userEvent: "input"
    });
    return true;
  }
  maybeBold(text) {
    if (!this.settings.boldSummary)
      return text;
    if (text.startsWith("**") && text.endsWith("**"))
      return text;
    return `**${text}**`;
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var QuickQAModal = class extends import_obsidian.Modal {
  constructor(app, plugin, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Quick Q&A Toggle" });
    contentEl.createEl("label", { text: "Question" });
    this.questionEl = contentEl.createEl("textarea");
    this.questionEl.rows = 2;
    this.questionEl.style.width = "100%";
    this.questionEl.style.marginBottom = "12px";
    this.questionEl.placeholder = "Type the question...";
    contentEl.createEl("label", { text: "Answer" });
    this.answerEl = contentEl.createEl("textarea");
    this.answerEl.rows = 4;
    this.answerEl.style.width = "100%";
    this.answerEl.style.marginBottom = "12px";
    this.answerEl.placeholder = "Type the answer...";
    const buttonContainer = contentEl.createDiv();
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.onclick = () => this.close();
    const submitBtn = buttonContainer.createEl("button", { text: "Insert toggle", cls: "mod-cta" });
    submitBtn.onclick = () => {
      this.onSubmit({
        question: this.questionEl.value,
        answer: this.answerEl.value
      });
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var NotionToggleSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Default callout type").setDesc("Type used when inserting/wrapping toggles.").addDropdown((dropdown) => {
      for (const t of CALLOUT_TYPES) {
        dropdown.addOption(t, t);
      }
      dropdown.setValue(this.plugin.settings.calloutType);
      dropdown.onChange(async (value) => {
        this.plugin.settings.calloutType = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Default collapsed").setDesc("On: toggles start collapsed (answer hidden). Off: expanded.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.defaultCollapsed);
      toggle.onChange(async (value) => {
        this.plugin.settings.defaultCollapsed = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Auto-continue on Enter").setDesc("Inside a toggle, Enter keeps writing the answer; Enter on an empty toggle line starts the NEXT toggle.").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.autoContinue);
      toggle.onChange(async (value) => {
        this.plugin.settings.autoContinue = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Toggle format").setDesc("Native callout (recommended, folds in Obsidian) or HTML <details>.").addDropdown((dropdown) => {
      dropdown.addOption("callout", "Native callout (> [!question]-)");
      dropdown.addOption("details", "HTML <details>");
      dropdown.setValue(this.plugin.settings.format);
      dropdown.onChange(async (value) => {
        this.plugin.settings.format = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Bold the question/summary").setDesc("Auto-wrap the title in **bold** (skips already-bold text).").addToggle((toggle) => {
      toggle.setValue(this.plugin.settings.boldSummary);
      toggle.onChange(async (value) => {
        this.plugin.settings.boldSummary = value;
        await this.plugin.saveSettings();
      });
    });
  }
};
function convertDetailsToCallouts(doc, calloutType, collapsed, boldSummary) {
  const fold = collapsed ? "-" : "+";
  const detailsRegex = /<details(\s[^>]*)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;
  return doc.replace(detailsRegex, (_match, _attrs, summaryRaw, bodyRaw) => {
    const summary = cleanInlineHtml(summaryRaw).trim();
    const title = boldSummary && !summary.startsWith("**") ? `**${summary}**` : summary;
    const bodyText = bodyRaw.trim();
    if (bodyText.length === 0) {
      return `> [!${calloutType}]${fold} ${title}`;
    }
    const bodyLines = bodyText.split("\n").map((line) => {
      const cleaned = cleanInlineHtml(line);
      return cleaned.trim().length === 0 ? ">" : `> ${cleaned}`;
    });
    return `> [!${calloutType}]${fold} ${title}
${bodyLines.join("\n")}`;
  });
}
function convertCalloutsToDetails(doc) {
  const lines = doc.split("\n");
  const out = [];
  let i = 0;
  let changed = false;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^>\s*\[!([^\]]+)\]([+-])\s?(.*)$/);
    if (m) {
      const _type = m[1];
      const marker = m[2];
      const title = m[3].trim();
      const body = [];
      i++;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        if (/^>\s*\[![^\]]+\][+-]/.test(lines[i]))
          break;
        const bodyLine = lines[i].replace(/^>\s?/, "");
        body.push(bodyLine);
        i++;
      }
      const openAttr = marker === "+" ? " open" : "";
      const summary = title.length > 0 ? `<summary>${title}</summary>` : "<summary></summary>";
      const bodyHtml = body.length > 0 ? "\n\n" + body.join("\n") : "";
      out.push(`<details${openAttr}>`);
      out.push(summary);
      out.push(bodyHtml);
      out.push("</details>");
      changed = true;
      continue;
    }
    out.push(line);
    i++;
  }
  return changed ? out.join("\n") : doc;
}
function cleanInlineHtml(text) {
  return text.replace(/<b>/g, "**").replace(/<\/b>/g, "**").replace(/<strong>/g, "**").replace(/<\/strong>/g, "**").replace(/<i>/g, "*").replace(/<\/i>/g, "*").replace(/<em>/g, "*").replace(/<\/em>/g, "*").replace(/<br\s*\/?>/g, "").trim();
}
function planEnter(text, opts) {
  const bold = opts.boldSummary ? "**" : "";
  const fold = opts.collapsed ? "-" : "+";
  const calloutHeader = `> [!${opts.calloutType}]${fold} `;
  if (opts.format === "details") {
    if (text.trim() === "</details>") {
      const openAttr = opts.collapsed ? "" : " open";
      const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
      const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";
      const insert = `

<details${openAttr}>
${sOpen}${sClose}


</details>
`;
      const cursorOffset = `

<details${openAttr}>
${sOpen}`.length;
      return { from: "cursor", insert, cursorOffset };
    }
    return null;
  }
  const isCalloutHeader = /^>\s*\[![^\]]+\][+-]/.test(text);
  const isCalloutLine = /^>/.test(text);
  if (!isCalloutLine)
    return null;
  if (!isCalloutHeader && /^>\s*$/.test(text)) {
    const insert = `
${calloutHeader}${bold}${bold}`;
    return {
      from: "lineStart",
      insert,
      cursorOffset: 1 + calloutHeader.length + bold.length
    };
  }
  return { from: "cursor", insert: "\n> ", cursorOffset: 3 };
}
