/**
 * v1.3.3 — quiz dock + inline ring UI coverage across every state, plus the
 * colour-filter picker permutations and their accessible names.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { beforeEach, describe, expect, it } from "bun:test";

import { QuizBar, buildQuizIcon, type QuizIcon } from "../src/quiz-ui";
import { QuizRing, formatRingTime, ringOffset, RING_CIRCUMFERENCE } from "../src/quiz-badge";
import { QUIZ_FILTER_OPTIONS } from "../src/modals";
import { normalizeFilter, sameFilter, filterLabel, type RecallColor } from "../src/autoscroll";
import { parseFilterParam } from "../src/deeplink";

if (typeof (globalThis as { document?: unknown }).document === "undefined") {
  GlobalRegistrator.register();
}

function mountBar() {
  const calls: string[] = [];
  const bar = new QuizBar({
    onTogglePause: () => calls.push("pause"),
    onRevealNow: () => calls.push("reveal"),
    onNext: () => calls.push("next"),
    onStop: () => calls.push("stop"),
  });
  const dock = document.querySelector(".ntt-quiz-dock") as HTMLElement;
  return { bar, dock, calls };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("quiz dock — structure and accessibility", () => {
  it("is a labelled group of real buttons, each with an aria-label and title", () => {
    const { bar, dock } = mountBar();
    expect(dock.getAttribute("role")).toBe("group");
    expect(dock.getAttribute("aria-label")).toBe("Quiz controls");
    const buttons = [...dock.querySelectorAll("button")] as HTMLButtonElement[];
    expect(buttons.length).toBe(4);
    for (const b of buttons) {
      expect(b.type).toBe("button");
      expect(b.getAttribute("aria-label")).toBeTruthy();
      expect(b.title).toBe(b.getAttribute("aria-label"));
      // Icons are decorative: the name comes from the label, not the SVG.
      expect(b.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    }
    bar.destroy();
  });

  it("fires exactly one callback per button", () => {
    const { bar, dock, calls } = mountBar();
    for (const cls of ["is-run", "is-reveal", "is-next", "is-stop"]) {
      (dock.querySelector(`.${cls}`) as HTMLButtonElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    }
    expect(calls).toEqual(["pause", "reveal", "next", "stop"]);
    bar.destroy();
  });
});

describe("quiz dock — every render mode", () => {
  const modes = [
    { name: "running question", d: { progress: "Q 3/12", running: true, revealing: false } },
    { name: "paused question", d: { progress: "Q 3/12", running: false, revealing: false } },
    { name: "revealing answer", d: { progress: "Q 3/12", running: true, revealing: true } },
    { name: "paused reveal", d: { progress: "Q 12/12", running: false, revealing: true } },
  ];

  for (const mode of modes) {
    it(`paints the ${mode.name} state`, () => {
      const { bar, dock } = mountBar();
      bar.render(mode.d);
      const run = dock.querySelector(".is-run") as HTMLButtonElement;
      expect(dock.querySelector(".ntt-quiz-dock-progress")?.textContent).toBe(mode.d.progress);
      expect(dock.classList.contains("is-paused")).toBe(!mode.d.running);
      expect(dock.classList.contains("is-reveal")).toBe(mode.d.revealing);
      expect(run.getAttribute("aria-pressed")).toBe(String(!mode.d.running));
      expect(run.getAttribute("aria-label")).toBe(mode.d.running ? "Pause quiz" : "Resume quiz");
      expect(run.querySelectorAll("svg").length).toBe(1); // no icon pile-up
      bar.destroy();
    });
  }

  it("destroy removes the dock from the document", () => {
    const { bar } = mountBar();
    bar.destroy();
    expect(document.querySelector(".ntt-quiz-dock")).toBeNull();
  });
});

describe("quiz icons", () => {
  const icons: QuizIcon[] = ["pause", "play", "reveal", "next", "stop"];
  for (const kind of icons) {
    it(`${kind} is a 20px currentColor SVG with content`, () => {
      const svg = buildQuizIcon(kind);
      expect(svg.getAttribute("width")).toBe("20");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.childNodes.length).toBeGreaterThan(0);
    });
  }
});

describe("inline quiz ring", () => {
  it("announces question, phase and time left", () => {
    const ring = new QuizRing(document);
    const host = document.createElement("div");
    host.innerHTML = `<div class="callout-title"><div class="callout-title-inner">Q3</div></div>`;
    document.body.appendChild(host);
    ring.mount(host);
    ring.render({ remaining: 7000, ratio: 0.35, phase: "question", running: true, index: 3, total: 12 });

    expect(ring.root.getAttribute("role")).toBe("timer");
    expect(ring.root.getAttribute("aria-live")).toBe("polite");
    expect(ring.root.getAttribute("aria-label")).toBe(
      "Question 3 of 12, question, 0:07 left"
    );
    expect(ring.root.textContent).toContain("0:07");
    expect(ring.root.classList.contains("is-reveal")).toBe(false);

    ring.render({ remaining: 1200, ratio: 0, phase: "reveal", running: false, index: 3, total: 12 });
    expect(ring.root.classList.contains("is-reveal")).toBe(true);
    expect(ring.root.classList.contains("is-paused")).toBe(true);
    expect(ring.root.getAttribute("aria-label")).toContain("answer");
    ring.destroy();
    expect(document.querySelector(".ntt-quiz-ring")).toBeNull();
  });

  it("ring geometry maps ratio → dashoffset", () => {
    expect(ringOffset(1)).toBeCloseTo(0, 5);
    expect(ringOffset(0)).toBeCloseTo(RING_CIRCUMFERENCE, 5);
    expect(ringOffset(Number.NaN)).toBeCloseTo(RING_CIRCUMFERENCE, 5);
    expect(formatRingTime(-5)).toBe("0:00");
    expect(formatRingTime(65_000)).toBe("1:05");
  });
});

describe("colour filter picker — every permutation", () => {
  it("offers each option exactly once, with a canonical filter", () => {
    const labels = QUIZ_FILTER_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const opt of QUIZ_FILTER_OPTIONS) {
      expect(opt.label.trim().length).toBeGreaterThan(3);
      expect(sameFilter(normalizeFilter(opt.filter), opt.filter)).toBe(true);
    }
  });

  it("each option is distinct and round-trips through a deep link", () => {
    const asParam = (f: RecallColor[]) => (f.length ? f.join(",") : "all");
    for (const opt of QUIZ_FILTER_OPTIONS) {
      const parsed = parseFilterParam(asParam(opt.filter));
      expect(sameFilter(parsed ?? [], opt.filter)).toBe(true);
    }
    for (let i = 0; i < QUIZ_FILTER_OPTIONS.length; i++) {
      for (let j = i + 1; j < QUIZ_FILTER_OPTIONS.length; j++) {
        expect(
          sameFilter(QUIZ_FILTER_OPTIONS[i]!.filter, QUIZ_FILTER_OPTIONS[j]!.filter)
        ).toBe(false);
      }
    }
  });

  it("every option has a human label for the settings sheet", () => {
    for (const opt of QUIZ_FILTER_OPTIONS) {
      expect(filterLabel(opt.filter).length).toBeGreaterThan(0);
    }
  });
});
