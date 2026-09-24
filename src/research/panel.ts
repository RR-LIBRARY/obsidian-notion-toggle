/**
 * v1.7.0 — the research side panel.
 *
 * One place to ask, search, fact-check and generate recall toggles, watch
 * background deep-research runs, and insert any result into the note with a
 * tap. The panel never talks to the network itself: every action goes through
 * the ResearchService, and it re-renders whenever the service changes.
 *
 * DOM is built with the plain helpers in ./dom so the whole view renders in
 * happy-dom tests; Obsidian is used for the view shell, icons and markdown.
 */
import { ItemView, MarkdownRenderer, MarkdownView, Notice, type WorkspaceLeaf, setIcon } from "obsidian";
import { describeError, extractUrls } from "./client";
import { ago, button, clear, el, latencyLabel } from "./dom";
import { DeepResearchModal, ResearchPromptModal } from "./modals";
import { isActive, runLabel } from "./runs";
import { KIND_LABELS, type ResearchKind, type ResearchResult, type ResearchService, recallInput } from "./service";
import { PRESET_LABELS, PROCESSOR_LABELS, type ResearchSettings, type TrackedRun } from "./types";

export const RESEARCH_VIEW_TYPE = "notion-toggle-research";
export const RESEARCH_VIEW_ICON = "globe";

/** What the panel needs from the plugin — narrow so tests can fake it. */
export interface ResearchPanelHost {
  settings: ResearchSettings;
  research: ResearchService;
  /** Open the plugin's settings tab (research section is at the bottom). */
  openSettings(): void;
}

export type ComposerKind = Exclude<ResearchKind, "deep">;

export const COMPOSER_KINDS: Array<{ id: ComposerKind; label: string; placeholder: string; button: string }> = [
  { id: "answer", label: "Ask the web", placeholder: "A question — you get a short cited answer", button: "Ask" },
  { id: "factcheck", label: "Fact-check", placeholder: "A claim to verify", button: "Check" },
  { id: "search", label: "Web search", placeholder: "Keywords — one toggle per source", button: "Search" },
  { id: "quick", label: "Quick search", placeholder: "Keywords — a fast list of links", button: "Search" },
  { id: "extract", label: "Read link", placeholder: "Paste one or more links", button: "Read" },
  { id: "recall", label: "Recall toggles", placeholder: "A topic, a link, or pasted text (empty = whole note)", button: "Generate" },
];

export class ResearchView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private kind: ComposerKind = "answer";
  private text = "";
  private readonly expanded = new Set<string>();
  private textarea: HTMLTextAreaElement | null = null;
  private statusEl: HTMLElement | null = null;
  private goBtn: HTMLButtonElement | null = null;
  private setupEl: HTMLElement | null = null;
  private busyEl: HTMLElement | null = null;
  private runsEl: HTMLElement | null = null;
  private resultsEl: HTMLElement | null = null;
  private submitting = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly host: ResearchPanelHost
  ) {
    super(leaf);
  }

  getViewType(): string {
    return RESEARCH_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Research";
  }

  getIcon(): string {
    return RESEARCH_VIEW_ICON;
  }

  async onOpen(): Promise<void> {
    const root = this.contentEl;
    clear(root);
    root.classList.add("ntt-research-panel");
    this.buildHeader(root);
    this.buildComposer(root);
    this.setupEl = el(root, "div", { cls: "ntt-rp-setup" });
    this.busyEl = el(root, "div", { cls: "ntt-rp-busy", attrs: { role: "status", "aria-live": "polite" } });
    this.runsEl = el(root, "section", { cls: "ntt-rp-section ntt-rp-runs" });
    this.resultsEl = el(root, "section", { cls: "ntt-rp-section ntt-rp-results" });
    this.unsubscribe = this.host.research.onChange(() => this.refresh());
    this.refresh();
    this.host.research.ensurePolling();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
    clear(this.contentEl);
  }

  /* ---------- static chrome ---------- */

  private buildHeader(root: HTMLElement): void {
    const header = el(root, "div", { cls: "ntt-rp-header" });
    const title = el(header, "div", { cls: "ntt-rp-title" });
    const icon = el(title, "span", { cls: "ntt-rp-title-icon", attrs: { "aria-hidden": "true" } });
    this.safeIcon(icon, RESEARCH_VIEW_ICON);
    el(title, "span", { text: "Research" });
    this.statusEl = el(header, "span", { cls: "ntt-rp-status" });
    this.iconButton(header, "refresh-cw", "Refresh runs", () => void this.refreshRuns());
    this.iconButton(header, "settings", "Research settings", () => this.host.openSettings());
  }

  private buildComposer(root: HTMLElement): void {
    const box = el(root, "div", { cls: "ntt-rp-composer" });
    const select = el(box, "select", { cls: "dropdown ntt-rp-kind", attrs: { "aria-label": "What to do" } });
    for (const k of COMPOSER_KINDS) {
      const opt = el(select, "option", { text: k.label });
      opt.value = k.id;
    }
    select.value = this.kind;
    select.addEventListener("change", () => {
      this.kind = select.value as ComposerKind;
      this.syncComposer();
    });

    this.textarea = el(box, "textarea", { cls: "ntt-rp-input", attrs: { rows: "3", "aria-label": "Research input" } });
    this.textarea.addEventListener("input", () => {
      this.text = this.textarea?.value ?? "";
      this.syncComposer();
    });
    this.textarea.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        void this.submit();
      }
    });

    const actions = el(box, "div", { cls: "ntt-rp-actions" });
    button(actions, "Use selection", () => this.useSelection(), { cls: "ntt-rp-grow", title: "Copy the selected text (or current line) from the note" });
    button(actions, "Deep…", () => this.openDeep(), { label: "Start deep research", title: "Long-form research that runs in the background" });
    this.goBtn = button(actions, "Ask", () => void this.submit(), { cta: true, label: "Run research" });
    this.syncComposer();
  }

  private syncComposer(): void {
    const meta = COMPOSER_KINDS.find((k) => k.id === this.kind) ?? COMPOSER_KINDS[0];
    if (this.textarea) this.textarea.placeholder = meta.placeholder;
    if (this.goBtn) {
      this.goBtn.textContent = meta.button;
      const noteOk = this.kind === "recall" && !!this.noteEditor();
      this.goBtn.disabled = this.submitting || !(this.text.trim().length > 0 || noteOk);
    }
  }

  /* ---------- dynamic sections ---------- */

  refresh(): void {
    this.renderStatus();
    this.renderSetup();
    this.renderBusy();
    this.renderRuns();
    this.renderResults();
    this.syncComposer();
  }

  private renderStatus(): void {
    const s = this.statusEl;
    if (!s) return;
    const ok = this.host.research.configured;
    s.textContent = ok ? "Connected" : "Not set up";
    s.classList.toggle("is-ok", ok);
    s.classList.toggle("is-off", !ok);
  }

  private renderSetup(): void {
    const box = this.setupEl;
    if (!box) return;
    clear(box);
    if (this.host.research.configured) {
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    el(box, "div", { cls: "ntt-rp-setup-title", text: "Connect your research bridge" });
    el(box, "div", {
      cls: "ntt-rp-setup-text",
      text: "Paste the bridge URL and a plugin key in settings. Then ask the web, fact-check, search and turn any text into recall toggles — right from this panel.",
    });
    const row = el(box, "div", { cls: "ntt-rp-actions" });
    button(row, "Open settings", () => this.host.openSettings(), { cta: true });
  }

  private renderBusy(): void {
    const box = this.busyEl;
    if (!box) return;
    clear(box);
    const busy = [...this.host.research.busy];
    if (!busy.length) {
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    el(box, "span", { cls: "ntt-rp-dot is-running", attrs: { "aria-hidden": "true" } });
    el(box, "span", { text: `Researching… ${busy.map((k) => KIND_LABELS[k]).join(", ")}` });
  }

  private renderRuns(): void {
    const box = this.runsEl;
    if (!box) return;
    clear(box);
    const runs = [...this.host.research.runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!runs.length) {
      box.style.display = "none";
      return;
    }
    box.style.display = "";
    const head = el(box, "div", { cls: "ntt-rp-section-title" });
    el(head, "span", { text: "Deep research" });
    const active = runs.filter(isActive).length;
    if (active) el(head, "span", { cls: "ntt-rp-chip", text: `${active} running` });
    for (const run of runs) this.renderRun(box, run);
  }

  private renderRun(parent: HTMLElement, run: TrackedRun): void {
    const row = el(parent, "div", { cls: `ntt-rp-run is-${run.status}` });
    row.dataset["runId"] = run.runId;
    const head = el(row, "div", { cls: "ntt-rp-run-head" });
    el(head, "span", { cls: `ntt-rp-dot is-${run.status}`, attrs: { "aria-hidden": "true" } });
    el(head, "span", { cls: "ntt-rp-run-label", text: runLabel(run, 90) });
    const meta = el(row, "div", { cls: "ntt-rp-meta" });
    const parts = [PRESET_LABELS[run.preset], PROCESSOR_LABELS[run.processor].split(" — ")[0], statusLabel(run), `${ago(run.createdAt)} ago`];
    meta.textContent = parts.filter(Boolean).join(" · ");
    if (run.status === "failed" && run.error) el(row, "div", { cls: "ntt-rp-error", text: run.error });
    if (run.status === "completed" && run.consumed) el(row, "div", { cls: "ntt-rp-meta", text: "Inserted" });

    const actions = el(row, "div", { cls: "ntt-rp-actions" });
    if (run.status === "completed") {
      button(actions, run.consumed ? "Insert again" : "Insert", () => void this.host.research.insertRun(run.runId).catch(this.notify), {
        cta: !run.consumed,
      });
      button(actions, "Copy", () => void this.copyRun(run));
    } else if (isActive(run)) {
      button(actions, "Check now", () => void this.host.research.refreshRun(run.runId).catch(this.notify));
    }
    button(actions, "Dismiss", () => void this.host.research.dismissRun(run.runId), { label: "Dismiss this run" });
  }

  private renderResults(): void {
    const box = this.resultsEl;
    if (!box) return;
    clear(box);
    const results = this.host.research.results;
    const head = el(box, "div", { cls: "ntt-rp-section-title" });
    el(head, "span", { text: "Results" });
    if (results.length) {
      el(head, "span", { cls: "ntt-rp-chip", text: String(results.length) });
      const spacer = el(head, "span", { cls: "ntt-rp-grow" });
      spacer.setAttribute("aria-hidden", "true");
      button(head, "Clear", () => this.host.research.clearResults(), { cls: "ntt-rp-link", label: "Clear all results" });
    }
    if (!results.length) {
      el(box, "div", {
        cls: "ntt-rp-empty",
        text: this.host.research.configured
          ? "Nothing yet. Type above, or select text in a note and use “Use selection”."
          : "Results will appear here once the bridge is connected.",
      });
      return;
    }
    for (const r of results) this.renderResult(box, r);
  }

  private renderResult(parent: HTMLElement, r: ResearchResult): void {
    const card = el(parent, "article", { cls: `ntt-rp-card is-${r.kind}` });
    card.dataset["resultId"] = r.id;
    const head = el(card, "div", { cls: "ntt-rp-card-head" });
    el(head, "span", { cls: "ntt-rp-chip", text: KIND_LABELS[r.kind] });
    const meta = [latencyLabel(r.latencyMs), r.cached ? "cached" : "", `${ago(r.createdAt)} ago`].filter(Boolean).join(" · ");
    el(head, "span", { cls: "ntt-rp-meta", text: meta });
    el(card, "div", { cls: "ntt-rp-card-title", text: r.title });

    const open = this.expanded.has(r.id);
    const actions = el(card, "div", { cls: "ntt-rp-actions" });
    button(actions, "Insert", () => void this.host.research.insertResult(r).catch(this.notify), { cta: true, label: `Insert “${r.title}” into the note` });
    button(actions, "Copy", () => void this.host.research.copy(r.markdown), { label: "Copy as markdown" });
    if (r.kind === "answer" && r.responseId) button(actions, "Follow-up", () => this.followUp(r), { title: "Ask another question in the same thread" });
    button(actions, open ? "Hide" : "Show", () => this.toggleExpanded(r.id), { label: open ? "Hide preview" : "Show preview" });
    button(actions, "×", () => this.host.research.forget(r.id), { cls: "ntt-rp-close", label: "Remove this result" });

    if (open) {
      const body = el(card, "div", { cls: "ntt-rp-card-body markdown-rendered" });
      void this.renderMarkdown(body, r.preview, r.sourcePath ?? "");
    }
  }

  private toggleExpanded(id: string): void {
    if (this.expanded.has(id)) this.expanded.delete(id);
    else this.expanded.add(id);
    this.renderResults();
  }

  private async renderMarkdown(target: HTMLElement, markdown: string, sourcePath: string): Promise<void> {
    try {
      await MarkdownRenderer.render(this.app, markdown, target, sourcePath, this);
    } catch {
      target.textContent = markdown;
    }
    if (!target.childNodes.length) target.textContent = markdown;
  }

  /* ---------- actions ---------- */

  /** The note editor a panel action should read from (never the panel itself). */
  noteEditor() {
    return this.host.research.targetEditor(null);
  }

  private useSelection(): void {
    const editor = this.noteEditor();
    const ctx = this.host.research.contextText(editor);
    if (!ctx.text) {
      new Notice("Select some text in a note first.");
      return;
    }
    this.text = ctx.text;
    if (this.textarea) this.textarea.value = ctx.text;
    this.syncComposer();
    this.textarea?.focus();
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    const svc = this.host.research;
    const text = this.text.trim();
    const editor = this.noteEditor();
    if (!svc.configured) {
      new Notice(describeError(new Error("Research bridge is not configured")));
      this.host.openSettings();
      return;
    }
    this.submitting = true;
    this.syncComposer();
    try {
      switch (this.kind) {
        case "answer":
          if (!text) return;
          await svc.ask(text);
          break;
        case "factcheck":
          if (!text) return;
          await svc.factCheck(text);
          break;
        case "search":
          if (!text) return;
          await svc.search(text);
          break;
        case "quick":
          if (!text) return;
          await svc.quickSearch(text);
          break;
        case "extract": {
          const source = text || (editor ? editor.getLine(editor.getCursor().line) : "");
          if (!extractUrls(source).length) {
            new Notice("Paste a link first.");
            return;
          }
          await svc.extract(source);
          break;
        }
        case "recall": {
          const input = recallInput(text, svc.noteText(editor));
          if (!input) {
            new Notice("Type a topic or open a note first.");
            return;
          }
          await svc.recall(input, { startNumber: svc.nextNumber(editor) });
          break;
        }
      }
      this.text = "";
      if (this.textarea) this.textarea.value = "";
      this.expanded.add(svc.results[0]?.id ?? "");
    } catch (err) {
      this.notify(err);
    } finally {
      this.submitting = false;
      this.refresh();
    }
  }

  private followUp(prev: ResearchResult): void {
    new ResearchPromptModal(
      this.app,
      {
        kind: "answer",
        text: "",
        effort: this.host.settings.researchEffort,
        mode: this.host.settings.researchSearchMode,
        recallCount: this.host.settings.researchRecallCount,
        recallStyle: this.host.settings.researchRecallStyle,
      },
      (r) => {
        if (r.kind !== "answer") return;
        this.host.research
          .ask(r.text, { effort: r.effort, previousResponseId: prev.responseId })
          .then((res) => this.expanded.add(res.id))
          .catch(this.notify);
      }
    ).open();
  }

  private openDeep(): void {
    const editor = this.noteEditor();
    const ctx = this.host.research.contextText(editor);
    new DeepResearchModal(
      this.app,
      { objective: this.text.trim() || (ctx.fromSelection ? ctx.text : ""), preset: this.host.settings.researchDefaultPreset },
      (r) => {
        this.host.research
          .startDeepResearch(r.objective, { preset: r.preset, processor: r.processor })
          .then(() => new Notice("Deep research started — this panel shows its progress.", 5000))
          .catch(this.notify);
      }
    ).open();
  }

  private async refreshRuns(): Promise<void> {
    const active = this.host.research.runs.filter(isActive);
    if (!active.length) {
      new Notice("No deep research is running.");
      return;
    }
    for (const run of active) {
      try {
        await this.host.research.refreshRun(run.runId);
      } catch (err) {
        this.notify(err);
        break;
      }
    }
  }

  private async copyRun(run: TrackedRun): Promise<void> {
    if (!run.markdown) {
      new Notice("The report is not stored on this device — press Insert to fetch it.");
      return;
    }
    await this.host.research.copy(run.markdown);
  }

  private readonly notify = (err: unknown): void => {
    new Notice(describeError(err), 8000);
  };

  /* ---------- small helpers ---------- */

  private iconButton(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = button(parent, "", onClick, { cls: "clickable-icon ntt-rp-iconbtn", label, title: label });
    this.safeIcon(b, icon);
    if (!b.childNodes.length) b.textContent = label[0] ?? "•";
    return b;
  }

  private safeIcon(target: HTMLElement, icon: string): void {
    try {
      if (typeof setIcon === "function") setIcon(target, icon);
    } catch {
      /* icons are decoration; the accessible name is on the button */
    }
  }
}

export function statusLabel(run: Pick<TrackedRun, "status">): string {
  switch (run.status) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
  }
}

/** True when the leaf shows a markdown note (used by the wiring to pick a target). */
export function isMarkdownLeaf(leaf: WorkspaceLeaf | null | undefined): boolean {
  return !!leaf && leaf.view instanceof MarkdownView;
}
