/** v1.9.30 — think reveal timing, answer read time, smooth glide, friendly names. */
import { describe, expect, test } from "bun:test";
import { answerReadMs, openAtArrival, wordCount } from "../src/think-reveal";
import { effectiveSmoothness, normaliseSmoothness, rampFactor, scrollWriteValue, smoothnessStats } from "../src/smooth-scroll";
import { commandName } from "../src/naming";

describe("think reveal", () => {
  test("with a countdown the arrow stays closed on arrival", () => expect(openAtArrival(true, 5000)).toBe(false));
  test("no countdown → opens on arrival", () => expect(openAtArrival(true, 0)).toBe(true));
  test("auto-open off never opens", () => expect(openAtArrival(false, 0)).toBe(false));
});

describe("answer read time", () => {
  test("60 words at 3 w/s with a 4 s hold adds 16 s", () => expect(answerReadMs(Array(60).fill("w").join(" "), 3, 4000, 30)).toBe(16000));
  test("short answer inside the hold adds nothing", () => expect(answerReadMs("Tobacco.", 3, 4000, 30)).toBe(0));
  test("capped at the max seconds", () => expect(answerReadMs(Array(600).fill("w").join(" "), 3, 4000, 30)).toBe(26000));
  test("0 words/s = off", () => expect(answerReadMs("a b c d e f", 0, 0, 30)).toBe(0));
  test("Hinglish / Devanagari words count", () => expect(wordCount("नमस्ते, आज मुझे बाजार जाना है")).toBe(6));
});

describe("smooth glide", () => {
  test("standard writes whole pixels, smooth writes sub-pixel", () => {
    expect(scrollWriteValue(10.56, "standard")).toBe(10);
    expect(scrollWriteValue(10.56, "smooth")).toBe(10.56);
  });
  test("soft start ramps from 0.15 to full speed", () => {
    expect(rampFactor(0, "smooth")).toBeCloseTo(0.15);
    expect(rampFactor(350, "smooth")).toBe(1);
    expect(rampFactor(0, "standard")).toBe(1);
  });
  test("slow frames fall back to standard", () => expect(effectiveSmoothness("ultra", 40)).toBe("standard"));
  test("unknown setting value → smooth", () => expect(normaliseSmoothness("x")).toBe("smooth"));
  test("stats count stalls and jumps", () => {
    const s = smoothnessStats([0, 1, 1, 2, 50], [0, 16, 32, 48, 64]);
    expect(s.stalledFrames).toBe(1);
    expect(s.jumps).toBe(1);
  });
});

describe("friendly command names", () => {
  test("grading command no longer reads 'Advanced: Review: …'", () =>
    expect(commandName("review-color-filter", "Review: grade and filter red / yellow / green", true)).toBe("Grade: mark & filter red / yellow / green"));
  test("full names mode keeps the legacy name", () =>
    expect(commandName("review-color-filter", "Review: grade", false)).toBe("Review: grade"));
});
