/**
 * v1.4.7 — the user-visible deep-quiz performance report.
 *
 * Everything the run measured (timer accuracy, freezes, filter/render timings,
 * recovered autoscroll stops) in one readable panel, with Copy and Save-to-note
 * so a slow phone can be reported without opening a console.
 */
import { App, MarkdownRenderer, Modal, Notice, Component } from "obsidian";
import { formatQuizReport, type QuizPerfReport } from "./quiz-perf";

export interface PerfHost {
  app: App;
  perf: { report(): QuizPerfReport };
  settings: { perfLog: boolean };
}

const stampNow = (): string => new Date().toISOString().replace("T", " ").slice(0, 19);

/** Full markdown document for the current telemetry, note name included. */
export function quizReportMarkdown(host: PerfHost): string {
  const note = host.app.workspace.getActiveFile()?.basename ?? "no note";
  return `# Performance report — ${note} · ${stampNow()} UTC\n\n${formatQuizReport(host.perf.report())}\n`;
}

/** Append a report to perf-log.md (created on first use). */
export async function appendPerfLog(host: PerfHost, body: string): Promise<void> {
  const path = "perf-log.md";
  const entry = `\n## ${host.app.workspace.getActiveFile()?.basename ?? "no note"} — ${stampNow()} UTC\n\n${body}\n`;
  try {
    if (await host.app.vault.adapter.exists(path)) await host.app.vault.adapter.append(path, entry);
    else await host.app.vault.adapter.write(path, `# Autoscroll performance log\n${entry}`);
  } catch {
    /* logging is best-effort */
  }
}

/** v1.4.0 command path: copy the report, optionally log it. */
export async function exportPerfReport(host: PerfHost): Promise<void> {
  const report = quizReportMarkdown(host);
  try {
    await navigator.clipboard.writeText(report);
    new Notice("Performance report copied to clipboard.", 5000);
  } catch {
    new Notice(report.slice(0, 1200), 12000);
  }
  if (host.settings.perfLog) await appendPerfLog(host, report);
}

export class PerfReportModal extends Modal {
  private readonly body: string;

  constructor(private readonly host: PerfHost) {
    super(host.app);
    this.body = quizReportMarkdown(host);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("notion-toggle-perf-modal");
    contentEl.createEl("h2", { text: "Quiz performance report" });
    const md = contentEl.createDiv({ cls: "ntt-perf-body" });
    try {
      void MarkdownRenderer.render(this.host.app, this.body, md, "", this as unknown as Component);
    } catch {
      md.createEl("pre", { text: this.body });
    }
    const row = contentEl.createDiv({ cls: "ntt-perf-actions" });
    const copy = row.createEl("button", { text: "Copy report", cls: "mod-cta" });
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(this.body);
        new Notice("Report copied.");
      } catch {
        new Notice("Clipboard unavailable on this device.");
      }
    };
    const save = row.createEl("button", { text: "Save to note" });
    save.onclick = async () => {
      await appendPerfLog(this.host, this.body);
      new Notice("Saved to perf-log.md");
    };
    row.createEl("button", { text: "Close" }).onclick = () => this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/** Open the report panel. */
export function openPerfReport(host: PerfHost): void {
  new PerfReportModal(host).open();
}
