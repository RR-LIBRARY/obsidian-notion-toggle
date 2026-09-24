/**
 * v1.7.0 — prompts for the research commands.
 *
 * Two small dialogs: one for the quick operations (ask / fact-check / search
 * / recall) and one for background deep research. Both prefill from the
 * selection and hand the reader's choices back to the command; nothing here
 * talks to the network.
 */
import { App, Modal, Setting } from "obsidian";
import type { ResearchKind } from "./service";
import {
  EFFORT_LABELS,
  PRESET_DEFAULT_PROCESSOR,
  PRESET_LABELS,
  PROCESSOR_LABELS,
  RECALL_STYLE_LABELS,
  SEARCH_MODE_LABELS,
  type Effort,
  type Processor,
  type RecallStyle,
  type SearchMode,
  type TaskPreset,
} from "./types";

export type PromptKind = Exclude<ResearchKind, "deep" | "extract">;

export interface PromptDefaults {
  kind: PromptKind;
  text: string;
  effort: Effort;
  mode: SearchMode;
  recallCount: number;
  recallStyle: RecallStyle;
  /** Shown as the source for recall when the note (not a selection) is used. */
  usingNote?: boolean;
}

export interface PromptResult {
  kind: PromptKind;
  text: string;
  effort: Effort;
  mode: SearchMode;
  recallCount: number;
  recallStyle: RecallStyle;
}

const KIND_OPTIONS: Array<{ id: PromptKind; label: string; hint: string; placeholder: string; button: string }> = [
  {
    id: "answer",
    label: "Ask the web (cited answer)",
    hint: "A short answer with numbered sources, inserted as a toggle.",
    placeholder: "e.g. Why does the sky look red at sunset?",
    button: "Ask",
  },
  {
    id: "factcheck",
    label: "Fact-check a claim",
    hint: "Verdict, confidence, correction and the sources that decide it.",
    placeholder: "e.g. The Great Wall of China is visible from space.",
    button: "Check",
  },
  {
    id: "search",
    label: "Web search (excerpts → toggles)",
    hint: "One toggle per source with the relevant excerpt inside.",
    placeholder: "e.g. CRISPR base editing 2026 review",
    button: "Search",
  },
  {
    id: "quick",
    label: "Quick search (links list)",
    hint: "Fast ranked links with one-line snippets.",
    placeholder: "e.g. NEET 2026 syllabus changes",
    button: "Search",
  },
  {
    id: "recall",
    label: "Recall toggles (from text or topic)",
    hint: "Question toggles ready for quiz and spaced repetition.",
    placeholder: "Paste text, or type a topic like “Krebs cycle”",
    button: "Generate",
  },
];

export class ResearchPromptModal extends Modal {
  private kind: PromptKind;
  private text: string;
  private effort: Effort;
  private mode: SearchMode;
  private recallCount: number;
  private recallStyle: RecallStyle;
  private textarea: HTMLTextAreaElement | null = null;
  private optionsEl: HTMLElement | null = null;
  private hintEl: HTMLElement | null = null;
  private submitBtn: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly defaults: PromptDefaults,
    private readonly onSubmit: (result: PromptResult) => void
  ) {
    super(app);
    this.kind = defaults.kind;
    this.text = defaults.text;
    this.effort = defaults.effort;
    this.mode = defaults.mode;
    this.recallCount = defaults.recallCount;
    this.recallStyle = defaults.recallStyle;
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("ntt-research-modal");
    this.setTitle("Web research");

    new Setting(contentEl).setName("What do you want?").addDropdown((dd) => {
      for (const k of KIND_OPTIONS) dd.addOption(k.id, k.label);
      dd.setValue(this.kind).onChange((v) => {
        this.kind = v as PromptKind;
        this.renderKind();
      });
    });

    this.hintEl = contentEl.createDiv({ cls: "ntt-research-hint setting-item-description" });

    this.textarea = contentEl.createEl("textarea", { cls: "ntt-modal-input ntt-research-textarea" });
    this.textarea.rows = 4;
    this.textarea.value = this.text;
    this.textarea.addEventListener("input", () => {
      this.text = this.textarea?.value ?? "";
      this.syncButton();
    });
    this.textarea.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        this.submit();
      }
    });

    this.optionsEl = contentEl.createDiv({ cls: "ntt-research-options" });

    const actions = contentEl.createDiv({ cls: "ntt-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    this.submitBtn = actions.createEl("button", { cls: "mod-cta" });
    this.submitBtn.onclick = () => this.submit();

    this.renderKind();
    window.setTimeout(() => this.textarea?.focus(), 30);
  }

  private renderKind(): void {
    const meta = KIND_OPTIONS.find((k) => k.id === this.kind) ?? KIND_OPTIONS[0];
    if (this.hintEl) this.hintEl.setText(meta.hint);
    if (this.textarea) this.textarea.placeholder = meta.placeholder;
    if (this.submitBtn) this.submitBtn.setText(meta.button);
    const el = this.optionsEl;
    if (!el) return;
    el.empty();

    if (this.kind === "answer" || this.kind === "factcheck") {
      new Setting(el)
        .setName("Effort")
        .setDesc("Low answers in seconds; high digs deeper and takes up to a minute.")
        .addDropdown((dd) => {
          for (const [id, label] of Object.entries(EFFORT_LABELS)) dd.addOption(id, label);
          dd.setValue(this.effort).onChange((v) => (this.effort = v as Effort));
        });
    }
    if (this.kind === "search") {
      new Setting(el).setName("Search mode").addDropdown((dd) => {
        for (const [id, label] of Object.entries(SEARCH_MODE_LABELS)) dd.addOption(id, label);
        dd.setValue(this.mode).onChange((v) => (this.mode = v as SearchMode));
      });
    }
    if (this.kind === "recall") {
      if (this.defaults.usingNote) {
        el.createDiv({
          cls: "setting-item-description ntt-research-hint",
          text: "Nothing is selected, so the whole note is the source. Edit the box above to use a topic instead.",
        });
      }
      new Setting(el).setName("How many").addSlider((sl) => {
        sl.setLimits(3, 20, 1)
          .setDynamicTooltip()
          .setValue(this.recallCount)
          .onChange((v) => (this.recallCount = v));
      });
      new Setting(el).setName("Style").addDropdown((dd) => {
        for (const [id, label] of Object.entries(RECALL_STYLE_LABELS)) dd.addOption(id, label);
        dd.setValue(this.recallStyle).onChange((v) => (this.recallStyle = v as RecallStyle));
      });
    }
    this.syncButton();
  }

  private syncButton(): void {
    if (!this.submitBtn) return;
    const ok = this.text.trim().length > 0 || (this.kind === "recall" && !!this.defaults.usingNote);
    this.submitBtn.disabled = !ok;
  }

  private submit(): void {
    if (this.submitBtn?.disabled) return;
    this.onSubmit({
      kind: this.kind,
      text: this.text.trim(),
      effort: this.effort,
      mode: this.mode,
      recallCount: this.recallCount,
      recallStyle: this.recallStyle,
    });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/* ---------- deep research ---------- */

export interface DeepDefaults {
  objective: string;
  preset: TaskPreset;
}

export interface DeepResult {
  objective: string;
  preset: TaskPreset;
  processor: Processor;
}

export class DeepResearchModal extends Modal {
  private objective: string;
  private preset: TaskPreset;
  private processor: Processor;
  private processorDropdown: { setValue(v: string): unknown } | null = null;
  private submitBtn: HTMLButtonElement | null = null;

  constructor(
    app: App,
    defaults: DeepDefaults,
    private readonly onSubmit: (result: DeepResult) => void
  ) {
    super(app);
    this.objective = defaults.objective;
    this.preset = defaults.preset;
    this.processor = PRESET_DEFAULT_PROCESSOR[defaults.preset];
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("ntt-research-modal");
    this.setTitle("Deep research (runs in the background)");
    contentEl.createDiv({
      cls: "setting-item-description ntt-research-hint",
      text: "Describe what you want researched. You can close Obsidian — the result waits for you and a notice offers to insert it.",
    });

    const ta = contentEl.createEl("textarea", { cls: "ntt-modal-input ntt-research-textarea" });
    ta.rows = 4;
    ta.value = this.objective;
    ta.placeholder = "e.g. Compare mRNA and viral-vector vaccine platforms for a first-year biology student";
    ta.addEventListener("input", () => {
      this.objective = ta.value;
      this.sync();
    });

    new Setting(contentEl)
      .setName("Shape of the result")
      .setDesc("Report, key facts, comparison, timeline or literature summary.")
      .addDropdown((dd) => {
        for (const [id, label] of Object.entries(PRESET_LABELS)) dd.addOption(id, label);
        dd.setValue(this.preset).onChange((v) => {
          this.preset = v as TaskPreset;
          this.processor = PRESET_DEFAULT_PROCESSOR[this.preset];
          this.processorDropdown?.setValue(this.processor);
        });
      });

    new Setting(contentEl)
      .setName("Depth")
      .setDesc("Deeper takes longer and costs more. The default suits the chosen shape.")
      .addDropdown((dd) => {
        for (const [id, label] of Object.entries(PROCESSOR_LABELS)) dd.addOption(id, label);
        dd.setValue(this.processor).onChange((v) => (this.processor = v as Processor));
        this.processorDropdown = dd;
      });

    const actions = contentEl.createDiv({ cls: "ntt-modal-actions" });
    const cancel = actions.createEl("button", { text: "Cancel" });
    cancel.onclick = () => this.close();
    this.submitBtn = actions.createEl("button", { text: "Start research", cls: "mod-cta" });
    this.submitBtn.onclick = () => {
      if (this.objective.trim().length < 3) return;
      this.onSubmit({ objective: this.objective.trim(), preset: this.preset, processor: this.processor });
      this.close();
    };
    this.sync();
    window.setTimeout(() => ta.focus(), 30);
  }

  private sync(): void {
    if (this.submitBtn) this.submitBtn.disabled = this.objective.trim().length < 3;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
