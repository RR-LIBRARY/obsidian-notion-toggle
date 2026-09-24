/**
 * v1.7.0 — guardrails for the research folder.
 *
 * The research features were added as a self-contained folder so main.ts
 * stayed an orchestrator. This keeps the boundaries honest: pure modules
 * never import Obsidian, the shell modules never import main.ts, main.ts
 * touches the folder through `wire.ts` only, and the styles ship the panel
 * classes the panel actually uses.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

const read = (f: string) => readFileSync(f, "utf8");
const lines = (f: string) => read(f).split("\n").length;
const files = readdirSync("src/research").filter((f) => f.endsWith(".ts"));
/** Type-only imports are erased by esbuild, so they never create a runtime dependency. */
const runtimeImports = (src: string) => src.replace(/import\s+type\s[\s\S]*?from\s+["'][^"']+["'];?/g, "");

describe("research folder", () => {
  test("pure logic modules never import Obsidian", () => {
    for (const f of ["cache.ts", "client.ts", "format.ts", "runs.ts", "types.ts", "dom.ts"]) {
      expect(files).toContain(f);
      expect(read(`src/research/${f}`)).not.toMatch(/from ["']obsidian["']/);
    }
  });

  test("no research module reaches back into main.ts or the top-level src modules (types excepted)", () => {
    for (const f of files) {
      const src = read(`src/research/${f}`);
      expect(src).not.toMatch(/from ["']\.\.\/\.\.\/main["']/);
      expect(src).not.toMatch(/from ["']\.\.\/main["']/);
      expect(runtimeImports(src)).not.toMatch(/from ["']\.\.\/(?!research)[a-z-]+["']/);
    }
  });

  test("main.ts uses the folder through wire.ts (plus the shared types) only", () => {
    const main = runtimeImports(read("main.ts"));
    const imports = Array.from(main.matchAll(/from ["']\.\/src\/research\/([a-z-]+)["']/g)).map((m) => m[1]);
    expect(new Set(imports)).toEqual(new Set(["wire", "types"]));
    // v1.7.2 — see tests/architecture.test.ts: the sticky Open all / Close all
    // logic lives in src/, main.ts only registers the wiring.
    expect(lines("main.ts")).toBeLessThan(3500);
  });

  test("every research module stays reviewable", () => {
    for (const f of files) {
      expect(lines(`src/research/${f}`)).toBeGreaterThan(10);
      expect(lines(`src/research/${f}`)).toBeLessThan(700);
    }
  });

  test("styles ship every panel class the panel renders", () => {
    const css = read("styles.css");
    const panel = read("src/research/panel.ts");
    const used = new Set(Array.from(panel.matchAll(/ntt-rp-[a-z-]+/g)).map((m) => m[0]));
    expect(used.size).toBeGreaterThan(15);
    const missing = [...used].filter((c) => !css.includes(`.${c}`));
    expect(missing).toEqual([]);
    expect(css).toContain(".ntt-research-panel");
    expect(css).toContain(".ntt-research-notice-actions");
  });
});
