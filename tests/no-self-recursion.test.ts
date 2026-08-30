import { describe, expect, it } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * v1.4.8 regression guard.
 * `resetDwell()` once shipped as `private resetDwell() { this.resetDwell(); }`,
 * which blew the stack the moment autoscroll started. Any method whose whole
 * body is a call to itself is that same bug, so fail the build on the shape.
 */
const SELF_CALL = /(?:private\s+|public\s+|protected\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::[^{;]+)?\{\s*(?:return\s+)?this\.\1\s*\([^)]*\)\s*;?\s*\}/g;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...files(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("no method is a call to itself", () => {
  for (const file of ["main.ts", ...files("src")]) {
    it(`${file} has no self-recursive stub`, () => {
      const hits = [...readFileSync(file, "utf8").matchAll(SELF_CALL)].map((m) => m[1]);
      expect(hits).toEqual([]);
    });
  }
});
