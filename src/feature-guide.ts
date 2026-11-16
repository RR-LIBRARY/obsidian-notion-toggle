/**
 * v1.9.30 — "Feature guide": every feature family in plain words, so the reader
 * knows what the plugin can do without reading 86 command names.
 */
import { App, Modal } from "obsidian";

export interface FeatureFamily { name: string; what: string; how: string; }

export const FEATURE_FAMILIES: FeatureFamily[] = [
  { name: "✍️ Writing toggles", what: "Notion jaise toggles: > + space se naya toggle, Enter se agla, Indent/Outdent, MCQ / match / numbered toggle, <details> paste auto-convert.", how: "Note me likho; Tools button ya command 'Toggle (smart add)'." },
  { name: "🔴🟡🟢 Grading", what: "Har toggle ko red (weak) / yellow / green (strong) mark karo; filter se sirf ek colour dekho.", how: "'Colour (red → yellow → green)' ya 'Grade: mark & filter red / yellow / green'." },
  { name: "📜 Autoscroll", what: "Note khud scroll hota hai, har question par rukta hai, answer kholta / band karta hai. Speed, direction, pause, colour filter, route/shuffle, Smoothness.", how: "Floating button tap = start/pause; long-press = quick controls sheet." },
  { name: "🤔 Think mode", what: "Question par countdown; timer khatam → arrow khulta hai aur answer dikhta hai; phir answer read time.", how: "Sheet / Settings → Think time (sec), ya title me ⏱30." },
  { name: "📂 Answers open / close all", what: "Poore note ke answers ek tap me kholo ya band; autoscroll bhi isko maanta hai.", how: "Sheet → 'Answers — open / close all'." },
  { name: "⏱ Quiz & Recall", what: "Timed quiz (question → reveal → next), recall session timer, spaced-repetition review, weak-toggle stats.", how: "'Quiz (timed question run)', 'Recall', 'Review'." },
  { name: "🎙 Voice", what: "Bol kar likho (Hindi / English / Hinglish), offline me audio save, baad me auto-likhna, self-test.", how: "Mic button; 'Voice mode: self-test'." },
  { name: "🎨 Look", what: "Notion look ya native callouts, toggle numbers, colours.", how: "'Look: …' commands." },
  { name: "🔎 Research", what: "Web research se notes (alag research server chahiye).", how: "'Research: …' commands." },
];

export class FeatureGuideModal extends Modal {
  constructor(app: App) { super(app); }
  onOpen() {
    this.titleEl.setText("Notion Toggle — feature guide");
    for (const f of FEATURE_FAMILIES) {
      const box = this.contentEl.createDiv({ cls: "ntt-guide-item" });
      box.createEl("h4", { text: f.name });
      box.createEl("p", { text: f.what });
      box.createEl("p", { text: `Kaise: ${f.how}`, cls: "setting-item-description" });
    }
  }
  onClose() { this.contentEl.empty(); }
}
