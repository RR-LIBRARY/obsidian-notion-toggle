/**
 * v1.7.0 — the research service: one object the commands, the panel and the
 * settings tab all talk to.
 *
 * Owns the bridge client, the on-device cache, the result history shown in
 * the panel, background polling of deep-research runs, and "insert into the
 * note" in all its forms. Obsidian shell — the logic it calls is in the pure
 * modules next to it (client, format, runs, cache).
 */
import { type App, type Editor, MarkdownView, Notice, TFile } from "obsidian";
import { ResearchCache } from "./cache";
import { ResearchClient, ResearchError, bridgeConfigured, clipForRecall, describeError, extractUrls } from "./client";
import {
  type FormatOptions,
  type ToggleStyle,
  formatAnswer,
  formatExtract,
  formatFactCheck,
  formatPerplexity,
  formatRecall,
  formatRun,
  formatSearch,
  summarize,
} from "./format";
import {
  activeRuns,
  applyPoll,
  markConsumed,
  nextPollDelayMs,
  removeRun,
  runLabel,
  sanitizeRuns,
  trackedFromRun,
  upsertRun,
} from "./runs";
import { obsidianTransport } from "./transport";
import type {
  AnswerResponse,
  Effort,
  ExtractResponse,
  FactCheckResponse,
  PerplexityResponse,
  Processor,
  RecallResponse,
  RecallStyle,
  ResearchSettings,
  SearchMode,
  SearchResponse,
  TaskPreset,
  TaskRun,
  TrackedRun,
} from "./types";
import { PRESET_DEFAULT_PROCESSOR } from "./types";

/** What the service needs from the plugin — kept narrow so tests can fake it. */
export interface ResearchHost {
  app: App;
  settings: ResearchSettings & {
    calloutType: string;
    defaultCollapsed: boolean;
    boldSummary: boolean;
    format: "callout" | "details";
    numberedByDefault: boolean;
  };
  saveSettings(): Promise<void>;
  registerInterval(id: number): number;
  activeCallout(): string;
  nextNumberAt(editor: Editor, line: number): number;
  clientVersion: string;
}

export type ResearchKind = "answer" | "factcheck" | "search" | "quick" | "extract" | "recall" | "deep";

export interface ResearchResult {
  id: string;
  kind: ResearchKind;
  title: string;
  /** Markdown in the reader's insert style (toggle or plain). */
  markdown: string;
  /** Plain markdown for the panel preview (never wrapped in a toggle). */
  preview: string;
  createdAt: number;
  cached: boolean;
  latencyMs: number;
  /** Parallel response id — lets "Follow-up" continue the conversation. */
  responseId?: string;
  sourcePath: string | null;
}

export const KIND_LABELS: Record<ResearchKind, string> = {
  answer: "Ask the web",
  factcheck: "Fact-check",
  search: "Web search",
  quick: "Quick search",
  extract: "Read link",
  recall: "Recall toggles",
  deep: "Deep research",
};

type Listener = () => void;

/** Results kept in the panel history (newest first). */
export const MAX_RESULTS = 30;

export class ResearchService {
  readonly results: ResearchResult[] = [];
  /** Kinds currently in flight (for spinners in the panel). */
  readonly busy = new Set<ResearchKind>();
  private cache = new ResearchCache();
  private listeners = new Set<Listener>();
  private pollTimer: number | null = null;
  private pollAttempts = new Map<string, number>();
  private nextPollAt = new Map<string, number>();
  private polling = false;
  private seq = 0;

  constructor(private readonly host: ResearchHost) {
    host.settings.researchRuns = sanitizeRuns(host.settings.researchRuns);
  }

  /* ---------- wiring ---------- */

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  get configured(): boolean {
    return bridgeConfigured(this.host.settings);
  }

  client(): ResearchClient {
    const s = this.host.settings;
    return new ResearchClient({
      bridgeUrl: s.researchBridgeUrl,
      pluginKey: s.researchPluginKey,
      transport: obsidianTransport(),
      cache: s.researchCache ? this.cache : null,
      clientVersion: this.host.clientVersion,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  formatOptions(): FormatOptions {
    const s = this.host.settings;
    const style: ToggleStyle = {
      calloutType: this.host.activeCallout(),
      collapsed: s.defaultCollapsed,
      boldSummary: s.boldSummary,
      format: s.format,
    };
    return { style, insertStyle: s.researchInsertStyle, includeSources: s.researchIncludeSources };
  }

  private plainOptions(): FormatOptions {
    return { ...this.formatOptions(), insertStyle: "markdown" };
  }

  private push(partial: Omit<ResearchResult, "id" | "createdAt" | "sourcePath">): ResearchResult {
    const result: ResearchResult = {
      ...partial,
      id: `r${++this.seq}`,
      createdAt: Date.now(),
      sourcePath: this.host.app.workspace.getActiveFile()?.path ?? null,
    };
    this.results.unshift(result);
    if (this.results.length > MAX_RESULTS) this.results.length = MAX_RESULTS;
    this.emit();
    return result;
  }

  /** Drop one result from the panel history. */
  forget(id: string): void {
    const idx = this.results.findIndex((r) => r.id === id);
    if (idx < 0) return;
    this.results.splice(idx, 1);
    this.emit();
  }

  clearResults(): void {
    if (!this.results.length) return;
    this.results.length = 0;
    this.emit();
  }

  private async guard<T>(kind: ResearchKind, work: () => Promise<T>): Promise<T> {
    if (!this.configured) throw new ResearchError("not_configured", "Research bridge is not configured");
    this.busy.add(kind);
    this.emit();
    try {
      return await work();
    } finally {
      this.busy.delete(kind);
      this.emit();
    }
  }

  /* ---------- operations ---------- */

  async ask(question: string, opts: { effort?: Effort; previousResponseId?: string } = {}): Promise<ResearchResult> {
    return this.guard("answer", async () => {
      const s = this.host.settings;
      const res: AnswerResponse = await this.client().answer({
        question,
        effort: opts.effort ?? s.researchEffort,
        previousResponseId: opts.previousResponseId,
        instructions: s.researchLanguage ? `Answer in ${s.researchLanguage}. Be concise and cite sources.` : undefined,
      });
      return this.push({
        kind: "answer",
        title: summarize(res.question),
        markdown: formatAnswer(res, this.formatOptions()),
        preview: formatAnswer(res, this.plainOptions()),
        cached: false,
        latencyMs: res.latencyMs,
        responseId: res.responseId,
      });
    });
  }

  async factCheck(claim: string, context?: string): Promise<ResearchResult> {
    return this.guard("factcheck", async () => {
      const res: FactCheckResponse = await this.client().factCheck({
        claim,
        context: context?.trim() ? context.trim().slice(0, 4000) : undefined,
        effort: this.host.settings.researchEffort,
      });
      return this.push({
        kind: "factcheck",
        title: summarize(res.claim, 60),
        markdown: formatFactCheck(res, this.formatOptions()),
        preview: formatFactCheck(res, this.plainOptions()),
        cached: false,
        latencyMs: res.latencyMs,
        responseId: res.responseId,
      });
    });
  }

  async search(query: string, opts: { mode?: SearchMode; maxResults?: number } = {}): Promise<ResearchResult> {
    return this.guard("search", async () => {
      const res: SearchResponse = await this.client().search({
        query,
        mode: opts.mode ?? this.host.settings.researchSearchMode,
        maxResults: opts.maxResults ?? 6,
      });
      return this.push({
        kind: "search",
        title: summarize(res.query),
        markdown: formatSearch(res, this.formatOptions()),
        preview: formatSearch(res, this.plainOptions()),
        cached: res.cached,
        latencyMs: res.latencyMs,
      });
    });
  }

  async quickSearch(query: string, opts: { recency?: "day" | "week" | "month" | "year" } = {}): Promise<ResearchResult> {
    return this.guard("quick", async () => {
      const res: PerplexityResponse = await this.client().perplexity({ query, maxResults: 8, recency: opts.recency });
      return this.push({
        kind: "quick",
        title: summarize(res.query),
        markdown: formatPerplexity(res, this.formatOptions()),
        preview: formatPerplexity(res, this.plainOptions()),
        cached: res.cached,
        latencyMs: res.latencyMs,
      });
    });
  }

  async extract(text: string, opts: { objective?: string; fullContent?: boolean } = {}): Promise<ResearchResult> {
    const urls = extractUrls(text);
    if (!urls.length) throw new ResearchError("invalid_request", "No http(s) link found in the selection or on this line.");
    return this.guard("extract", async () => {
      const res: ExtractResponse = await this.client().extract({
        urls,
        objective: opts.objective,
        fullContent: !!opts.fullContent,
        maxChars: opts.fullContent ? 12000 : 4000,
      });
      return this.push({
        kind: "extract",
        title: urls.length === 1 ? summarize(res.results[0]?.title ?? urls[0]) : `${urls.length} links`,
        markdown: formatExtract(res, this.formatOptions()),
        preview: formatExtract(res, this.plainOptions()),
        cached: false,
        latencyMs: res.latencyMs,
      });
    });
  }

  async recall(
    input: { text?: string; url?: string; topic?: string },
    opts: { count?: number; style?: RecallStyle; startNumber?: number } = {}
  ): Promise<ResearchResult> {
    return this.guard("recall", async () => {
      const s = this.host.settings;
      const res: RecallResponse = await this.client().recall({
        text: input.text ? clipForRecall(input.text) : undefined,
        url: input.url,
        topic: input.topic,
        count: opts.count ?? s.researchRecallCount,
        style: opts.style ?? s.researchRecallStyle,
        language: s.researchLanguage || undefined,
      });
      const fmt = { ...this.formatOptions(), insertStyle: "toggle" as const, numbered: s.numberedByDefault, startNumber: opts.startNumber };
      const md = formatRecall(res, fmt);
      return this.push({
        kind: "recall",
        title: `${res.cards.length} ${res.style.toUpperCase()} cards · ${summarize(res.title, 50)}`,
        markdown: md,
        preview: md,
        cached: false,
        latencyMs: res.latencyMs,
      });
    });
  }

  /* ---------- deep research (background) ---------- */

  get runs(): TrackedRun[] {
    return this.host.settings.researchRuns;
  }

  async startDeepResearch(
    objective: string,
    opts: { preset?: TaskPreset; processor?: Processor; notePath?: string | null } = {}
  ): Promise<TrackedRun> {
    return this.guard("deep", async () => {
      const preset = opts.preset ?? this.host.settings.researchDefaultPreset;
      const run: TaskRun = await this.client().createTask({
        objective,
        preset,
        processor: opts.processor ?? PRESET_DEFAULT_PROCESSOR[preset],
        notePath: opts.notePath ?? this.host.app.workspace.getActiveFile()?.path ?? undefined,
      });
      const tracked = trackedFromRun(run);
      this.host.settings.researchRuns = upsertRun(this.runs, tracked);
      await this.host.saveSettings();
      this.nextPollAt.set(run.runId, Date.now() + nextPollDelayMs(0));
      this.ensurePolling();
      this.emit();
      return tracked;
    });
  }

  /** Poll one run now (panel refresh button / insert of a run without stored markdown). */
  async refreshRun(runId: string): Promise<TrackedRun | null> {
    const polled = await this.client().pollTask(runId);
    return this.absorb(polled);
  }

  private async absorb(polled: TaskRun): Promise<TrackedRun | null> {
    const before = this.runs.find((r) => r.runId === polled.runId);
    this.host.settings.researchRuns = applyPoll(this.runs, polled);
    await this.host.saveSettings();
    const after = this.runs.find((r) => r.runId === polled.runId) ?? null;
    const wasActive = !!before && (before.status === "queued" || before.status === "running");
    if (after && wasActive && after.status === "completed") {
      this.announceFinished(after);
    } else if (after && wasActive && after.status === "failed") {
      new Notice(`Deep research failed: ${after.error ?? "unknown error"}`, 8000);
    }
    this.emit();
    return after;
  }

  private announceFinished(run: TrackedRun): void {
    const notice = new Notice(`Deep research ready: ${runLabel(run, 48)}`, 0);
    const actions = notice.noticeEl.createDiv({ cls: "ntt-research-notice-actions" });
    const insert = actions.createEl("button", { text: "Insert", cls: "mod-cta" });
    insert.onclick = (ev) => {
      ev.stopPropagation();
      void this.insertRun(run.runId);
      notice.hide();
    };
    const later = actions.createEl("button", { text: "Later" });
    later.onclick = (ev) => {
      ev.stopPropagation();
      notice.hide();
    };
  }

  async dismissRun(runId: string): Promise<void> {
    this.host.settings.researchRuns = removeRun(this.runs, runId);
    this.nextPollAt.delete(runId);
    this.pollAttempts.delete(runId);
    await this.host.saveSettings();
    this.emit();
  }

  ensurePolling(): void {
    if (this.pollTimer != null) return;
    if (!activeRuns(this.runs).length) return;
    const now = Date.now();
    for (const r of activeRuns(this.runs)) if (!this.nextPollAt.has(r.runId)) this.nextPollAt.set(r.runId, now + 1500);
    this.pollTimer = window.setInterval(() => void this.pollTick(), 2000);
    this.host.registerInterval(this.pollTimer);
  }

  private stopPolling(): void {
    if (this.pollTimer != null) window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private async pollTick(): Promise<void> {
    if (this.polling) return;
    const active = activeRuns(this.runs);
    if (!active.length) {
      this.stopPolling();
      return;
    }
    if (!this.configured) return;
    const now = Date.now();
    const due = active.filter((r) => (this.nextPollAt.get(r.runId) ?? 0) <= now);
    if (!due.length) return;
    this.polling = true;
    try {
      for (const r of due) {
        const attempt = this.pollAttempts.get(r.runId) ?? 0;
        try {
          const polled = await this.client().pollTask(r.runId);
          const after = await this.absorb(polled);
          if (after && (after.status === "queued" || after.status === "running")) {
            this.pollAttempts.set(r.runId, attempt + 1);
            this.nextPollAt.set(r.runId, Date.now() + nextPollDelayMs(attempt + 1));
          } else {
            this.pollAttempts.delete(r.runId);
            this.nextPollAt.delete(r.runId);
          }
        } catch (err) {
          if (err instanceof ResearchError && err.code === "not_found") {
            this.host.settings.researchRuns = upsertRun(this.runs, { ...r, status: "failed", error: "Run not found on the bridge" });
            await this.host.saveSettings();
            this.emit();
            continue;
          }
          // Transient: back off harder, keep the run.
          const wait = err instanceof ResearchError && err.retryAfterSec ? err.retryAfterSec * 1000 : nextPollDelayMs(attempt + 2);
          this.pollAttempts.set(r.runId, attempt + 1);
          this.nextPollAt.set(r.runId, Date.now() + wait);
        }
      }
    } finally {
      this.polling = false;
    }
  }

  dispose(): void {
    this.stopPolling();
    this.listeners.clear();
  }

  /* ---------- inserting ---------- */

  /**
   * The editor a result should land in. The focused note wins; when the panel
   * itself has focus, the note the result came from (or the most recently used
   * note) is used instead, so "Insert" from the side panel just works.
   */
  targetEditor(preferPath: string | null = null): Editor | null {
    const ws = this.host.app.workspace;
    const active = ws.getActiveViewOfType(MarkdownView);
    if (active?.editor && (!preferPath || active.file?.path === preferPath)) return active.editor;
    const markdownLeaves = ws.getLeavesOfType("markdown");
    const views = markdownLeaves.map((l) => l.view).filter((v): v is MarkdownView => v instanceof MarkdownView);
    const byPath = preferPath ? views.find((v) => v.file?.path === preferPath) : undefined;
    if (byPath?.editor) return byPath.editor;
    const recent = ws.getMostRecentLeaf?.()?.view;
    if (recent instanceof MarkdownView && recent.editor) return recent.editor;
    return active?.editor ?? views[0]?.editor ?? null;
  }

  /** Insert markdown into the best editor, or append to `fallbackPath`. */
  async insertMarkdown(markdown: string, fallbackPath: string | null = null): Promise<boolean> {
    const editor = this.targetEditor(fallbackPath);
    if (editor) {
      insertIntoEditor(editor, markdown, this.host.settings.researchInsertTarget);
      return true;
    }
    const path = fallbackPath ?? this.host.app.workspace.getActiveFile()?.path ?? null;
    if (path) {
      const file = this.host.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.host.app.vault.process(file, (data) => `${data.replace(/\s+$/, "")}\n\n${markdown.trimEnd()}\n`);
        new Notice(`Added to ${file.basename}`);
        return true;
      }
    }
    new Notice("Open a note first, then press Insert again.");
    return false;
  }

  async insertResult(result: ResearchResult): Promise<boolean> {
    return this.insertMarkdown(result.markdown, result.sourcePath);
  }

  async insertRun(runId: string): Promise<boolean> {
    let run = this.runs.find((r) => r.runId === runId) ?? null;
    if (!run) return false;
    if (run.status !== "completed" || !run.markdown) {
      try {
        run = await this.refreshRun(runId);
      } catch (err) {
        new Notice(describeError(err), 8000);
        return false;
      }
      if (!run || run.status !== "completed" || !run.markdown) {
        new Notice(
          run?.status === "failed" ? `That run failed: ${run.error ?? "unknown error"}` : "Still running — try again in a minute."
        );
        return false;
      }
    }
    const ok = await this.insertMarkdown(formatRun(run, this.formatOptions()), run.notePath);
    if (ok) {
      this.host.settings.researchRuns = markConsumed(this.runs, runId);
      await this.host.saveSettings();
      this.emit();
    }
    return ok;
  }

  /** Copy a result to the clipboard (panel "Copy" button). */
  async copy(markdown: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(markdown);
      new Notice("Copied as markdown");
    } catch {
      new Notice("Clipboard is not available here");
    }
  }

  /** Text the reader most likely means: selection, else the current line. */
  contextText(editor: Editor | null | undefined): { text: string; fromSelection: boolean } {
    if (!editor) return { text: "", fromSelection: false };
    const sel = editor.getSelection();
    if (sel.trim()) return { text: sel.trim(), fromSelection: true };
    const line = editor.getLine(editor.getCursor().line);
    return { text: cleanLine(line), fromSelection: false };
  }

  /** Whole note body (for "recall toggles from this note"). */
  noteText(editor: Editor | null | undefined): string {
    return editor ? editor.getValue() : "";
  }

  nextNumber(editor: Editor | null | undefined): number | undefined {
    if (!editor || !this.host.settings.numberedByDefault) return undefined;
    return this.host.nextNumberAt(editor, editor.getCursor().line);
  }
}

/* ---------- editor helpers (exported for tests) ---------- */

/** Strip toggle / list / heading markup from a line so it reads as a claim. */
export function cleanLine(line: string): string {
  return line
    .replace(/^>\s*\[![^\]]+\][+-]?\s*/, "")
    .replace(/^>\s?/, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")
    .replace(/^#+\s+/, "")
    .replace(/<\/?(?:summary|b|details)[^>]*>/g, "")
    .replace(/\*\*/g, "")
    .trim();
}

export type RecallInput = { text?: string; url?: string; topic?: string };

/**
 * Decide what a recall request is about from what the reader typed:
 * a lone URL → read that page; a long or multi-line text → use it as the
 * source; a short phrase → a topic; nothing typed → the whole note (if any).
 * Returns null when there is nothing to work from.
 */
export function recallInput(typed: string, noteText: string): RecallInput | null {
  const t = typed.trim();
  if (t) {
    if (/^https?:\/\/\S+$/.test(t)) return { url: t };
    if (t.length > 400 || /\n/.test(t)) return { text: t };
    return { topic: t };
  }
  const note = noteText.trim();
  return note ? { text: note } : null;
}

export function insertIntoEditor(editor: Editor, markdown: string, target: "cursor" | "end"): void {
  const text = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  if (target === "end") {
    const last = editor.lastLine();
    const tail = editor.getLine(last);
    const prefix = tail.trim().length ? "\n\n" : "\n";
    editor.replaceRange(`${prefix}${text}`, { line: last, ch: tail.length });
    editor.setCursor({ line: editor.lastLine(), ch: 0 });
    return;
  }
  const cursor = editor.getCursor();
  const current = editor.getLine(cursor.line);
  const hasText = current.trim().length > 0;
  const block = hasText ? `\n${text}` : text;
  editor.replaceRange(block, { line: cursor.line, ch: current.length });
  const added = block.split("\n").length - 1;
  editor.setCursor({ line: cursor.line + added, ch: 0 });
}
