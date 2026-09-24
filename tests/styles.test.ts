/**
 * v1.5.5 — stylesheet guard for the toggle reveal / revert animation.
 *
 * The reveal was animated but the revert snapped shut, which read as a blink on
 * mobile. These assertions fail if the collapse animation is ever dropped.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("v1.5.5 collapse animation", () => {
  const css = readFileSync("styles.css", "utf8");

  it("defines a collapse keyframe that starts from the measured height", () => {
    expect(css).toContain("@keyframes ntt-collapse");
    expect(css).toContain("max-height: var(--ntt-reveal-height, 0px)");
  });

  it("applies it to hidden quiz answers", () => {
    expect(css).toMatch(/ntt-quiz-hidden[^{]*\{[^}]*animation: ntt-collapse 140ms/s);
  });

  it("respects reduced motion on the collapse path", () => {
    const block = css.slice(css.indexOf("@keyframes ntt-collapse"));
    expect(block).toMatch(/prefers-reduced-motion[\s\S]*animation: none/);
  });
});

describe("v1.5.6 bottom strip", () => {
  const css = readFileSync("styles.css", "utf8");

  it("only reserves quiz-dock space while the dock is active", () => {
    const reserved = [...css.matchAll(/([^{}]*)\{[^}]*padding-bottom:\s*calc\(88px[^}]*\}/g)];
    expect(reserved.length).toBeGreaterThan(0);
    for (const [, selectors] of reserved) {
      for (const selector of selectors.split(",")) {
        if (!selector.trim()) continue;
        expect(selector).toContain("ntt-quiz-active");
      }
    }
  });

  it("keeps only the safe-area inset under a plain mobile reading view", () => {
    expect(css).toMatch(
      /\.is-mobile \.markdown-preview-view,[\s\S]*?\{\s*padding-bottom: env\(safe-area-inset-bottom, 0px\);\s*\}/,
    );
  });

  it("has no fixed mobile bottom reservation outside quiz-active selectors", () => {
    const declarations = [...css.matchAll(/([^{}]*)\{([^}]*(?:padding-bottom|margin-bottom|min-height)[^}]*)\}/g)];
    for (const [, selectors, body] of declarations) {
      if (!/88px|calc\(88px/.test(body)) continue;
      for (const selector of selectors.split(",")) {
        if (/markdown-preview-view|markdown-reading-view|view-content/.test(selector)) {
          expect(selector).toContain("ntt-quiz-active");
        }
      }
    }
  });
});

describe("v1.5.9 think gate + distraction-free run", () => {
  const css = readFileSync("styles.css", "utf8");

  it("hides the answer body while the reader is thinking", () => {
    expect(css).toMatch(/ntt-think-hidden[^{]*\{[^}]*display:\s*none/s);
  });

  it("animates the release instead of snapping it open", () => {
    expect(css).toMatch(/ntt-think-shown[^{]*\{[^}]*animation: ntt-think-in 140ms/s);
    const block = css.slice(css.indexOf("@keyframes ntt-think-in"));
    expect(block).toMatch(/prefers-reduced-motion[\s\S]*animation: none/);
  });

  it("hides Obsidian chrome only while a focus run is active", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // v1.6.2 — the value moved into --ntt-focus-chrome-display (default none),
    // so match either the literal or the token; the scoping rule is unchanged.
    const hidden = [
      ...bare.matchAll(
        /([^{}]*)\{[^}]*display:\s*(?:none|var\(--ntt-focus-chrome-display\))\s*!important[^}]*\}/g
      ),
    ];
    const chrome = hidden.filter(([, sel]) => /status-bar|view-header|mobile-navbar|mobile-toolbar/.test(sel));
    expect(chrome.length).toBeGreaterThan(0);
    for (const [, sel] of chrome) {
      for (const one of sel.split(",")) {
        if (one.trim()) expect(one).toContain("ntt-focus-run");
      }
    }
  });

  it("keeps the safe-area inset so text never sits under the gesture bar", () => {
    const focus = css.slice(css.indexOf("body.ntt-focus-run.is-mobile"));
    expect(focus).toContain("var(--ntt-focus-bottom-gap)");
    // v1.6.2 — the token itself must still resolve to the real inset.
    // v1.7.1 — Obsidian's own inset first (Android reports env() as 0).
    expect(css).toContain("--ntt-focus-bottom-gap: var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px));");
  });
});

describe("v1.6.0 — focus run keeps the system status bar off the question", () => {
  const css = readFileSync("styles.css", "utf8");

  it("adds a top safe-area gap when Obsidian's header is hidden", () => {
    const block = css.slice(css.indexOf("body.ntt-focus-run.is-mobile .view-content"));
    expect(block).toContain("padding-top: var(--ntt-focus-top-gap)");
    // v1.7.1 — Obsidian's own inset, no floor.
    expect(css).toContain("--ntt-focus-top-gap: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));");
  });

  // v1.7.1 — the "white strip at the top": a 24px floor on a gap that Android
  // always reported as 0 became a permanent blank band above the note, and it
  // was applied to two nested elements so the first question sat 48px down.
  it("has no fixed floor on the top gap and applies it to one element only", () => {
    const token = css.match(/--ntt-focus-top-gap:\s*([^;]+);/)?.[1] ?? "";
    expect(token).not.toMatch(/max\(|[1-9]\d*px/); // no `max(..., 24px)` floor — only a 0px fallback
    expect(token).toContain("var(--safe-area-inset-top");
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const topRules = [...bare.matchAll(/([^{}]+)\{[^}]*padding-top:\s*var\(--ntt-focus-top-gap\)[^}]*\}/g)];
    expect(topRules.length).toBe(1);
    const selectors = topRules[0][1].split(",").map((s) => s.trim()).filter(Boolean);
    expect(selectors).toEqual(["body.ntt-focus-run.is-mobile .view-content"]);
    for (const sel of selectors) expect(sel).not.toMatch(/markdown-preview-view|markdown-reading-view/);
  });

  it("puts the bottom gap on the scroller only, so the last line can scroll clear", () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...bare.matchAll(/([^{}]+)\{[^}]*padding-bottom:\s*var\(--ntt-focus-bottom-gap\)[^}]*\}/g)];
    expect(rules.length).toBe(1);
    expect(rules[0][1].trim()).toBe("body.ntt-focus-run.is-mobile .markdown-preview-view");
  });

  it("hides the tab header / titlebar too, so nothing blinks mid-run", () => {
    expect(css).toContain("body.ntt-focus-run .workspace-tab-header-container");
    expect(css).toContain("body.ntt-focus-run .titlebar");
  });

  it("styles the image countdown face", () => {
    expect(css).toContain(".ntt-think-badge-img");
  });
});

describe("v1.6.1 — reduced motion + countdown preview", () => {
  const css = readFileSync("styles.css", "utf8");

  it("the reduced-motion switch kills the reveal animation and badge transitions", () => {
    const block = css.slice(css.indexOf("body.ntt-reduced-motion"));
    expect(block).toContain("animation: none !important");
    expect(block).toContain("transition: none !important");
    expect(block).toContain(".ntt-think-badge");
  });

  it("still honours the OS-level reduced-motion preference", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("styles the settings countdown preview chip (text and image faces)", () => {
    expect(css).toContain(".ntt-think-preview");
    expect(css).toContain(".ntt-think-preview-img");
  });
});
