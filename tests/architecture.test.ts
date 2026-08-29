/**
 * v1.3.1 — architecture guardrails.
 *
 * The audit's only HIGH finding was main.ts as a 4.8k-line god object. It is
 * now an orchestrator (< 3.2k lines) with modals, editor transforms, the
 * palette and the settings tab in their own modules. This test keeps it that
 * way instead of trusting a one-off refactor.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const lines = (f: string) => readFileSync(f, "utf8").split("\n").length;

describe("module boundaries", () => {
  test("main.ts stays an orchestrator, not a god object", () => {
    expect(lines("main.ts")).toBeLessThan(3200);
  });

  test("extracted modules exist and stay reviewable", () => {
    for (const f of [
      "src/modals.ts",
      "src/editor-blocks.ts",
      "src/settings-tab.ts",
      "src/toggle-colors.ts",
    ]) {
      expect(lines(f)).toBeGreaterThan(10);
      expect(lines(f)).toBeLessThan(900);
    }
  });

  test("pure logic modules never import Obsidian", () => {
    for (const f of [
      "src/editor-blocks.ts",
      "src/toggle-colors.ts",
      "src/quiz-ui.ts",
      "src/quiz-badge.ts",
      "src/toggle-dom.ts",
      "src/autoscroll.ts",
    ]) {
      expect(readFileSync(f, "utf8")).not.toContain('from "obsidian"');
    }
  });

  test("the settings tab only imports the plugin as a type", () => {
    const src = readFileSync("src/settings-tab.ts", "utf8");
    expect(src).toContain('import type NotionTogglePlugin from "../main"');
  });
});
