import "./sheet-dom-prelude";
import { describe, expect, it } from "bun:test";
import { Component, MarkdownRenderer } from "obsidian";
import { PerfReportModal } from "../src/perf-report-modal";
import { Telemetry } from "../src/telemetry";

// Real Obsidian 1.13 logs an error when renderMarkdown gets something that is not a Component.
describe("quiz performance report window", () => {
  const host = {
    app: { workspace: { getActiveFile: () => null }, vault: { adapter: {} } } as never,
    perf: new Telemetry(),
    settings: { perfLog: false },
  };

  it("renders with a real Component, loaded while open and unloaded on close", () => {
    let owner: unknown = null;
    const orig = MarkdownRenderer.render;
    (MarkdownRenderer as { render: unknown }).render = async (_a: unknown, _md: string, _el: HTMLElement, _p: string, c: unknown) => { owner = c; };
    try {
      const m = new PerfReportModal(host as never);
      m.onOpen();
      expect(owner).toBeInstanceOf(Component);
      expect(owner).not.toBe(m);
      let unloaded = false;
      const child = new Component();
      child.unload = () => { unloaded = true; };
      (owner as Component).addChild(child);
      m.onClose();
      expect(unloaded).toBe(true);
    } finally {
      (MarkdownRenderer as { render: unknown }).render = orig;
    }
  });
});
