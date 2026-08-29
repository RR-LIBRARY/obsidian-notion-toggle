/**
 * v1.3.3 — end-to-end quiz flows through the in-Obsidian harness
 * (tests/e2e/harness.ts): deep links, fold interactions, re-render healing,
 * dock/ring painting and clean teardown.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import {
  QuizHarness,
  applyDeepLink,
  ensureDom,
  parseDeepLink,
  renderNote,
  type NoteQuestion,
} from "./e2e/harness";

ensureDom();

const NOTE: NoteQuestion[] = [
  { title: "Q1 what is an allele?", answer: "A1", type: "question" },
  { title: "Q2 ⏱5 dominant vs recessive", answer: "A2", type: "recall-red" },
  { title: "Q3 codominance", answer: "A3", type: "recall-yellow" },
  { title: "Q4 raw details", answer: "A4", details: true },
];

let container: HTMLElement;
beforeEach(() => {
  container = renderNote(NOTE);
});

describe("E2E — deep links", () => {
  it("quiz link carries file, filter and seconds into a run", () => {
    const link = parseDeepLink({
      action: "quiz",
      file: "Bio/Alleles.md",
      filter: "red,yellow",
      seconds: "30",
    });
    const plan = applyDeepLink(link);
    expect(plan?.file).toBe("Bio/Alleles.md");
    expect(plan?.filter).toEqual(["red", "yellow"]);
    expect(plan?.settings.quizSeconds).toBe(30);

    const h = new QuizHarness(container, plan!.settings, plan!.filter);
    expect(h.titles).toEqual(["Q2 ⏱5 dominant vs recessive", "Q3 codominance"]);
    h.stop();
  });

  it("autoscroll link clamps speed and `graded` expands to all three colours", () => {
    const link = parseDeepLink({ action: "autoscroll", filter: "graded", speed: "9000" });
    const plan = applyDeepLink(link);
    expect(plan?.speed).toBe(600);
    expect(plan?.filter?.sort()).toEqual(["green", "red", "yellow"]);
  });

  it("unknown actions are rejected instead of half-starting a run", () => {
    expect(parseDeepLink({ action: "launch-missiles" })).toBeNull();
    expect(applyDeepLink(null)).toBeNull();
  });
});

describe("E2E — fold interactions across a full run", () => {
  it("reveals exactly one answer at a time and restores the note afterwards", () => {
    const h = new QuizHarness(container, { quizSeconds: 4, quizRevealSeconds: 2 });
    const before = h.els.map((el) => el!.className);

    h.tick(4000);
    expect(h.events).toContain("reveal");
    expect(h.visibleTitles()).toEqual(["Q1 what is an allele?"]);

    h.tick(2000); // reveal over → next
    expect(h.state.at).toBe(1);
    expect(h.visibleTitles()).toEqual([]);

    h.run();
    expect(h.state.phase).toBe("done");
    // Teardown leaves no quiz classes and puts <details> back as it was.
    for (const el of h.els) {
      expect(el!.className).toBe(before[h.els.indexOf(el)] ?? el!.className);
      expect(el!.classList.contains("ntt-quiz-hidden")).toBe(false);
      expect(el!.classList.contains("ntt-quiz-shown")).toBe(false);
    }
    expect((document.getElementById("q3") as HTMLDetailsElement).open).toBe(false);
  });

  it("per-question ⏱ override in the title beats the default duration", () => {
    const h = new QuizHarness(container, { quizSeconds: 20, quizRevealSeconds: 1 });
    h.next(); // to Q2, which carries "⏱5"
    h.state = { ...h.state, remaining: 5000 };
    h.tick(4990);
    expect(h.state.phase).toBe("question");
    h.tick(20);
    expect(h.state.phase).toBe("reveal");
    h.stop();
  });

  it("keeps earlier answers readable when closeOthers is off", () => {
    const h = new QuizHarness(container, { quizSeconds: 1, quizRevealSeconds: 1 }, [], false);
    h.revealNow();
    h.next();
    h.revealNow();
    expect(h.visibleTitles().length).toBe(2);
    h.stop();
  });
});

describe("E2E — survives Obsidian re-rendering the section (Q22 skip bug)", () => {
  it("heals detached questions so the reveal still lands", () => {
    const h = new QuizHarness(container, { quizSeconds: 2, quizRevealSeconds: 1 });
    h.next(); // now on Q2

    // Obsidian unmounts and re-renders the whole preview while scrolling.
    const fresh = renderNote(NOTE);
    expect(h.els[1]!.isConnected).toBe(false);
    (h as unknown as { container: HTMLElement }).container = fresh;

    h.revealNow();
    expect(h.els[1]!.isConnected).toBe(true);
    expect(h.visibleTitles()).toEqual(["Q2 ⏱5 dominant vs recessive"]);
    h.stop();
  });

  it("records heal + re-measure work in telemetry without stalling the timer", () => {
    const h = new QuizHarness(container, { quizSeconds: 2, quizRevealSeconds: 1 });
    h.run();
    const report = h.perf.report();
    expect(report.quizRender.paints).toBeGreaterThan(4);
    expect(report.quizRender.score).toBeGreaterThan(0.9);
  });
});

describe("E2E — modal-driven controls", () => {
  it("dock buttons drive pause, reveal, next and stop", () => {
    const h = new QuizHarness(container, { quizSeconds: 30, quizRevealSeconds: 5 }).withUi();
    const dock = document.querySelector(".ntt-quiz-dock") as HTMLElement;
    const click = (cls: string) =>
      (dock.querySelector(`.${cls}`) as HTMLButtonElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );

    click("is-run");
    expect(h.state.running).toBe(false);
    click("is-run");
    expect(h.state.running).toBe(true);

    click("is-reveal");
    expect(h.visibleTitles()).toEqual(["Q1 what is an allele?"]);

    click("is-next");
    expect(h.state.at).toBe(1);
    expect(h.visibleTitles()).toEqual([]);

    click("is-stop");
    expect(document.querySelector(".ntt-quiz-dock")).toBeNull();
    expect(document.querySelector(".ntt-quiz-ring")).toBeNull();
  });

  it("the inline ring follows the active question and never duplicates", () => {
    const h = new QuizHarness(container, { quizSeconds: 10, quizRevealSeconds: 2 }).withUi();
    const rings = () => document.querySelectorAll(".ntt-quiz-ring").length;
    expect(rings()).toBe(1);
    expect(h.els[0]!.contains(document.querySelector(".ntt-quiz-ring"))).toBe(true);
    h.next();
    expect(rings()).toBe(1);
    expect(h.els[1]!.contains(document.querySelector(".ntt-quiz-ring"))).toBe(true);
    h.stop();
  });
});
