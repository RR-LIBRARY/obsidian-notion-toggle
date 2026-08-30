import { describe, expect, it } from "bun:test";
import { planSummary } from "../src/scrollmode";
import { DEFAULT_AUTOSCROLL } from "../src/autoscroll";
import { DEFAULT_QUIZ } from "../src/quiz";

const cfg = (over: Record<string, unknown> = {}) => ({
  mode: "all" as const,
  picks: [] as number[],
  route: [] as number[],
  loopRoute: false,
  shuffleFrom: 0,
  shuffleTo: 0,
  ...over,
});

describe("v1.4.3 — plan toast", () => {
  it("names the mode", () => {
    expect(planSummary(cfg())).toBe("Plan: every toggle");
  });
  it("confirms loop for a route", () => {
    expect(planSummary(cfg({ mode: "route", route: [2, 5], loopRoute: true }))).toContain("loop ON");
    expect(planSummary(cfg({ mode: "route", route: [2, 5] }))).toContain("loop OFF");
  });
  it("confirms the shuffle range", () => {
    const s = planSummary(cfg({ mode: "shuffle", route: [1, 2], shuffleFrom: 2, shuffleTo: 6 }));
    expect(s).toContain("range 2–6");
    expect(planSummary(cfg({ mode: "shuffle", route: [1] }))).toContain("whole note");
  });
});

describe("v1.4.3 — saved plan defaults", () => {
  it("ships an empty user route that survives reloads", () => {
    expect(DEFAULT_AUTOSCROLL.scrollUserRoute).toEqual([]);
  });
  it("keeps answers closed unless auto-quiz open mode is chosen", () => {
    expect(DEFAULT_QUIZ.quizKeepAnswersOpen).toBe(false);
  });
});
