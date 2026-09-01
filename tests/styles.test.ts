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
