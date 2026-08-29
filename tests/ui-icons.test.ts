/**
 * v1.3.1 — UI chrome contract tests.
 *
 * These lock the two design/security regressions the audit called out:
 *  1. no icon is ever built from an HTML string (`innerHTML`);
 *  2. every control ships an accessible name and a real <svg> node.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildPauseIcon, buildPlayIcon } from "../src/scroll-fab";
import { buildQuizIcon, QuizBar } from "../src/quiz-ui";

describe("icon rendering", () => {
  test("FAB icons are real SVG element nodes", () => {
    for (const svg of [buildPlayIcon(), buildPauseIcon()]) {
      expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.childNodes.length).toBeGreaterThan(0);
    }
  });

  test("quiz icons share one size and one stroke width", () => {
    for (const kind of ["pause", "play", "reveal", "next", "stop"] as const) {
      const svg = buildQuizIcon(kind);
      expect(svg.getAttribute("width")).toBe("20");
      expect(svg.getAttribute("stroke-width")).toBe("2");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  test("no plugin source builds UI from an HTML string", () => {
    for (const f of ["src/scroll-fab.ts", "src/quiz-ui.ts", "src/quiz-badge.ts"]) {
      expect(readFileSync(f, "utf8")).not.toContain(".innerHTML =");
    }
  });
});

describe("quiz dock accessibility", () => {
  test("every control has an aria-label and the run button reports state", () => {
    const bar = new QuizBar({
      onTogglePause: () => {},
      onRevealNow: () => {},
      onNext: () => {},
      onStop: () => {},
    });
    const dock = document.querySelector(".ntt-quiz-dock") as HTMLElement;
    expect(dock.getAttribute("role")).toBe("group");
    const btns = Array.from(dock.querySelectorAll("button"));
    expect(btns.length).toBe(4);
    for (const b of btns) {
      expect(b.getAttribute("aria-label")).toBeTruthy();
      expect(b.querySelector("svg")).not.toBeNull();
    }
    bar.render({ progress: "Q 2/5", running: false, revealing: false });
    const run = dock.querySelector(".ntt-quiz-dock-btn.is-run") as HTMLElement;
    expect(run.getAttribute("aria-pressed")).toBe("true");
    expect(run.getAttribute("aria-label")).toBe("Resume quiz");
    expect(dock.classList.contains("is-paused")).toBe(true);
    bar.destroy();
    expect(document.querySelector(".ntt-quiz-dock")).toBeNull();
  });
});
