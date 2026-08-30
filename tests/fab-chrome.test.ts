/**
 * v1.4.4 — the floating autoscroll button must be a *bare* mark.
 *
 * On mobile, Obsidian styles raw <button> through host selectors such as
 * `.is-mobile button`, which out-specifies a plain `.ntt-fab` rule and paints a
 * grey rounded square behind the layered icon. These guards fail the build if
 * the chip-killing overrides are ever weakened, and if the stepping animation
 * rules are ever touched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync("styles.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Returns the declaration block whose selector list contains `selector`. */
function blocksWith(selector: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const sel = (m[1] ?? "").trim();
    if (sel.split(",").some((s) => s.trim() === selector)) out.push(m[2] ?? "");
  }
  return out;
}

const STATES = [
  ".ntt-fab",
  ".ntt-fab:hover",
  ".ntt-fab:active",
  ".ntt-fab:focus",
  ".ntt-fab.is-running",
  ".ntt-fab.is-pressed",
  ".ntt-fab.is-reverse",
  "body.is-mobile .ntt-fab",
  "body.is-mobile .ntt-fab:hover",
  "body.is-mobile .ntt-fab:active",
  "body.is-mobile .ntt-fab.is-running",
  ".ntt-fab-wrap .ntt-fab",
  ".ntt-fab-wrap .ntt-fab:hover",
  ".ntt-fab-wrap .ntt-fab.is-running",
];

describe("floating button carries no chrome (v1.4.4)", () => {
  for (const selector of STATES) {
    test(`${selector} is cleared of background, border and shadow`, () => {
      const decls = blocksWith(selector).join(";");
      expect(decls).toContain("background: none !important");
      expect(decls).toContain("background-color: transparent !important");
      expect(decls).toContain("border: 0 !important");
      expect(decls).toContain("box-shadow: none !important");
      expect(decls).toContain("appearance: none !important");
    });
  }

  test("the wrapper never paints a surface either", () => {
    const decls = blocksWith(".ntt-fab-wrap").join(";");
    expect(decls).toContain("background: none !important");
    expect(decls).toContain("box-shadow: none !important");
  });

  test("no rule paints a visible background on the button", () => {
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
      const sel = (m[1] ?? "").trim();
      if (!/\.ntt-fab(\b|[.:])/.test(sel) && !/\.ntt-fab-wrap\b/.test(sel)) continue;
      if (/\.ntt-fab-icon|\.ntt-fab-sr|\.ntt-fab-layers|\.ntt-layer/.test(sel)) continue;
      for (const decl of (m[2] ?? "").split(";")) {
        const [prop, value] = decl.split(":").map((s) => (s ?? "").trim());
        if (!prop || !value) continue;
        if (prop === "background" || prop === "background-color" || prop === "background-image") {
          expect({ sel, prop, value }).toEqual({
            sel,
            prop,
            value: /^(none|transparent)/.test(value) ? value : "transparent",
          });
        }
      }
    }
  });

  test("keyboard focus stays visible as an outline, not a filled chip", () => {
    const decls = blocksWith(".ntt-fab:focus-visible").join(";");
    expect(decls).toMatch(/outline:\s*3px solid/);
  });
});

describe("the stepping animation is untouched (v1.4.4)", () => {
  test("layer animations and keyframes still exist", () => {
    expect(css).toContain("@keyframes ntt-layer-step");
    for (const n of [1, 2, 3]) {
      const decls = blocksWith(`.ntt-fab-layers.is-stepping .ntt-layer-${n}`).join(";");
      expect(decls).toContain("animation: ntt-layer-step 1.5s ease-in-out infinite");
    }
  });

  test("no !important override leaks into the layered icon", () => {
    for (const sel of [
      ".ntt-fab-layers .ntt-layer",
      ".ntt-fab-layers.is-reverse",
      ".ntt-fab-layers.is-stepping .ntt-layer-1",
      ".ntt-fab-layers.is-stepping .ntt-layer-2",
      ".ntt-fab-layers.is-stepping .ntt-layer-3",
    ]) {
      expect(blocksWith(sel).join(";")).not.toContain("!important");
    }
  });

  test("reduced motion still disables stepping", () => {
    expect(css).toContain(".ntt-fab-layers.is-stepping .ntt-layer {");
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });
});
