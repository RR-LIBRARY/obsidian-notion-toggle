/**
 * v1.6.1 — per-note think-time override + timing log.
 */
import { describe, expect, it } from "bun:test";
import {
  effectiveThinkSettings,
  frontmatterBlock,
  noteThinkScope,
  parseThinkValue,
} from "../src/think-scope";
import { thinkMsFor } from "../src/think-gate";
import { ThinkTimeline, thinkTimingLines, thinkWindowMs } from "../src/think-timeline";

const GLOBAL = { scrollThinkEnabled: true, scrollThinkSeconds: 5, scrollThinkIcon: "🤔" };

describe("frontmatter parsing", () => {
  it("finds the block only when the note starts with ---", () => {
    expect(frontmatterBlock("---\nthink: 20s\n---\n# note")).toContain("think: 20s");
    expect(frontmatterBlock("# note\n---\nthink: 20s\n---")).toBe("");
    expect(frontmatterBlock("")).toBe("");
  });

  it("reads seconds, minutes and hours", () => {
    expect(parseThinkValue("20")).toBe(20);
    expect(parseThinkValue("20s")).toBe(20);
    expect(parseThinkValue("2m")).toBe(120);
    expect(parseThinkValue("1h")).toBe(3600);
    expect(parseThinkValue('"30s"')).toBe(30);
  });

  it("understands off switches and ignores junk", () => {
    expect(parseThinkValue("off")).toBe(0);
    expect(parseThinkValue("false")).toBe(0);
    expect(parseThinkValue("0")).toBe(0);
    expect(parseThinkValue("soon")).toBeNull();
    expect(parseThinkValue(undefined)).toBeNull();
  });

  it("clamps beyond one hour", () => {
    expect(parseThinkValue("9h")).toBe(3600);
  });
});

describe("noteThinkScope", () => {
  it("reads think + icon", () => {
    const s = noteThinkScope("---\ntitle: Bio\nthink: 20s\nthink-icon: 💭\n---\nbody");
    expect(s).toEqual({ seconds: 20, enabled: true, icon: "💭" });
  });

  it("aliases think-time / think_icon", () => {
    const s = noteThinkScope("---\nthink_time: 2m\nthink_icon: icons/brain.png\n---");
    expect(s.seconds).toBe(120);
    expect(s.icon).toBe("icons/brain.png");
  });

  it("no frontmatter = no opinion", () => {
    expect(noteThinkScope("# just a note")).toEqual({ seconds: null, enabled: null, icon: null });
  });

  it("think: off disables think time for this note only", () => {
    const s = noteThinkScope("---\nthink: off\n---");
    expect(s.enabled).toBe(false);
    expect(effectiveThinkSettings(GLOBAL, s).scrollThinkEnabled).toBe(false);
    expect(effectiveThinkSettings(GLOBAL, noteThinkScope("# other")).scrollThinkEnabled).toBe(true);
  });
});

describe("precedence: title marker > note frontmatter > global", () => {
  it("note frontmatter beats the global setting", () => {
    const eff = effectiveThinkSettings(GLOBAL, noteThinkScope("---\nthink: 30s\n---"));
    expect(eff.scrollThinkSeconds).toBe(30);
    expect(thinkMsFor("Q1 — mitosis", eff)).toBe(30_000);
  });

  it("a per-toggle marker still wins over the note", () => {
    const eff = effectiveThinkSettings(GLOBAL, noteThinkScope("---\nthink: 30s\n---"));
    expect(thinkMsFor("Q1 🤔5s", eff)).toBe(5_000);
  });

  it("global applies when the note says nothing", () => {
    const eff = effectiveThinkSettings(GLOBAL, noteThinkScope("plain"));
    expect(thinkMsFor("Q1", eff)).toBe(5_000);
  });

  it("note icon overrides the global face", () => {
    const eff = effectiveThinkSettings(GLOBAL, noteThinkScope("---\nthink-icon: 🧠\n---"));
    expect(eff.scrollThinkIcon).toBe("🧠");
  });

  it("think: 0 in a note means reveal immediately", () => {
    const eff = effectiveThinkSettings(GLOBAL, noteThinkScope("---\nthink: 0\n---"));
    expect(thinkMsFor("Q1", eff)).toBe(0);
  });
});

describe("timing log", () => {
  it("stamps open → countdown → reveal with deltas", () => {
    const t = new ThinkTimeline();
    t.enabled = true;
    t.mark("open", 8, 1000);
    t.mark("countdown", 8, 1012, "5s");
    t.mark("reveal", 8, 6031);
    const lines = t.lines();
    expect(lines[0]).toContain("#8 toggle open t+0ms");
    expect(lines[1]).toContain("countdown start t+12ms (+12ms)");
    expect(lines[2]).toContain("answer release t+5031ms (+5019ms)");
    expect(thinkWindowMs(t.all(), 8)).toBe(5019);
  });

  it("records nothing while disabled", () => {
    const t = new ThinkTimeline();
    t.mark("open", 1, 0);
    expect(t.all()).toEqual([]);
    expect(t.lines()).toEqual(["timing —"]);
  });

  it("throttles ticks to one per second per toggle", () => {
    const t = new ThinkTimeline();
    t.enabled = true;
    for (let i = 0; i < 20; i++) t.mark("tick", 3, i * 100);
    expect(t.all().length).toBe(2);
  });

  it("keeps only the tail of a long run", () => {
    const t = new ThinkTimeline(8);
    t.enabled = true;
    for (let i = 1; i <= 30; i++) t.mark("open", i, i * 10);
    expect(t.all().length).toBe(8);
    expect(t.lines(3).length).toBe(3);
  });

  it("formats an empty log without crashing", () => {
    expect(thinkTimingLines([])).toEqual(["timing —"]);
  });
});
