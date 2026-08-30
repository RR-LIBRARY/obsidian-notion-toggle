/**
 * v1.3.1 — architecture guardrails.
 *
 * The audit's only HIGH finding was main.ts as a 4.8k-line god object. It is
 * now an orchestrator (< 3.2k lines) with modals, editor transforms, the
 * palette and the settings tab in their own modules. This test keeps it that
 * way instead of trusting a one-off refactor.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

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

/* ---------- v1.3.3 — boundaries beyond main.ts ---------- */

const srcFiles = readdirSync("src")
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `src/${f}`);

/** Modules allowed to talk to Obsidian at all (UI shells and settings). */
const OBSIDIAN_SHELLS = new Set([
  "src/modals.ts",
  "src/sheet-modal.ts",

  "src/settings-tab.ts",
  "src/guide.ts",
  "src/stats-panel.ts",
]);

describe("module size budget (v1.3.3)", () => {
  test("no src module grows into a second god object", () => {
    const oversize = srcFiles.filter((f) => lines(f) > 900);
    expect(oversize).toEqual([]);
  });

  test("pure engine modules stay small and focused", () => {
    for (const f of [
      "src/quiz.ts",
      "src/quiz-heal.ts",
      "src/quiz-visibility.ts",
      "src/quiz-badge.ts",
      "src/quiz-ui.ts",
      "src/telemetry.ts",
      "src/deeplink.ts",
      "src/toggle-dom.ts",
    ]) {
      expect({ f, over: lines(f) > 320 }).toEqual({ f, over: false });
    }
  });
});

describe("dependency boundaries (v1.3.3)", () => {
  test("only declared UI shells may import Obsidian", () => {
    const leaks = srcFiles.filter(
      (f) => !OBSIDIAN_SHELLS.has(f) && /from "obsidian"/.test(readFileSync(f, "utf8"))
    );
    expect(leaks).toEqual([]);
  });

  test("no src module imports main.ts at runtime (type-only is fine)", () => {
    const bad = srcFiles.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /^import\s+(?!type)[^;]*from\s+"\.\.\/main"/m.test(src);
    });
    expect(bad).toEqual([]);
  });

  test("telemetry stays a leaf: no DOM, no Obsidian, no plugin imports", () => {
    const src = readFileSync("src/telemetry.ts", "utf8");
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain('from "obsidian"');
    expect(code).not.toContain("../main");
    expect(code).not.toMatch(/\b(document|window)\./);
  });

  test("the E2E harness drives real modules, never a re-implementation", () => {
    const src = readFileSync("tests/e2e/harness.ts", "utf8");
    for (const mod of [
      "../../src/quiz",
      "../../src/deeplink",
      "../../src/quiz-visibility",
      "../../src/quiz-heal",
      "../../src/toggle-dom",
      "../../src/quiz-badge",
      "../../src/quiz-ui",
    ]) {
      expect(src).toContain(mod);
    }
  });
});
