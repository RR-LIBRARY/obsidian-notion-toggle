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
    // v1.5.9 — the think-time state machine lives in src/think-gate.ts; main.ts
    // only wires it into the run loop, so the budget moves by a few lines only.
    // v1.6.1 — the filter hard guard + per-note think scope wiring; the logic
    // itself lives in src/filter-guard.ts, src/think-scope.ts, src/think-timeline.ts.
    // v1.6.2 — park/dwell decisions moved to src/run-step.ts and settings
    // upgrades to src/settings-migrate.ts; main.ts gained only the vault-event
    // and migration wiring those modules are called from.
    expect(lines("main.ts")).toBeLessThan(3400);
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
  // v1.5.0 — command registration shell for the callout playground / breakdown.
  "src/callout-commands.ts",
  // v1.5.1 — view-mode shell around the pure reader-mode module.
  "src/reader-mode-view.ts",
  "src/settings-tab.ts",
  "src/perf-report-modal.ts",
  "src/guide.ts",
  "src/stats-panel.ts",
  // v1.5.9 — shared think-time rows for both the settings tab and the sheet.
  "src/think-settings.ts",
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

/* ---------- v1.6.2 — focus mode must stay themeable ---------- */

describe("focus-mode CSS tokens (v1.6.2)", () => {
  const css = readFileSync("styles.css", "utf8");

  test("chrome hiding goes through a variable, not a hardcoded none", () => {
    expect(css).toContain("--ntt-focus-chrome-display: none;");
    expect(css).toContain("display: var(--ntt-focus-chrome-display) !important;");
  });

  test("safe-area gaps go through variables", () => {
    expect(css).toContain("--ntt-focus-top-gap:");
    expect(css).toContain("padding-top: var(--ntt-focus-top-gap) !important;");
    expect(css).toContain("padding-bottom: var(--ntt-focus-bottom-gap) !important;");
  });
});
