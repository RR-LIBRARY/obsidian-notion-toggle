import { describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (!globalThis.document) GlobalRegistrator.register();
import { sessionStops } from "../src/run-session";
import { questionNumbers } from "../src/toggle-dom";

const s = { scrollStartNumber: 5, scrollMode: "every", scrollReverse: false } as never;

describe("Think start number counts questions, not nested Answers", () => {
  it("nested Answer shares its question's number", () => {
    document.body.innerHTML = Array.from({ length: 8 }, (_, i) =>
      `<details id="q${i + 1}"><summary>Q${i + 1}</summary><details id="a${i + 1}"><summary>Answer</summary>x</details></details>`).join("");
    const all = Array.from(document.querySelectorAll("details")) as HTMLElement[];
    const m = questionNumbers(all);
    expect(m.get(document.getElementById("q5")!)).toBe(5);
    expect(m.get(document.getElementById("a5")!)).toBe(5);
  });
  it("typing 5 starts at Q5", () => {
    const stops = Array.from({ length: 8 }, (_, i) => ({ ordinal: i * 2 + 1, question: i + 1 }));
    expect(sessionStops(stops, s)[0].question).toBe(5);
  });
});
import { screensFromStart } from "../src/run-session";
describe("Advance by: screens honours the start number", () => {
  const base = { scrollMode: "every", scrollReverse: false } as const;
  it("start 5 skips screens before Q5 and lands on Q5", () => {
    const out = screensFromStart([0, 800, 1600, 2400, 3200], [2000, 2500, 3000], { ...base, scrollStartNumber: 5 } as never, 800);
    expect(out[0]).toBe(2000);
    expect(out).not.toContain(800);
  });
  it("start 1 keeps every screen", () => {
    expect(screensFromStart([0, 800], [0, 500], { ...base, scrollStartNumber: 1 } as never, 800)).toEqual([0, 800]);
  });
});
import { sourceQuestionNumbers } from "../src/source-toggles";
import { seekStartQuestion } from "../src/run-session";
describe("long notes: numbers come from the note text", () => {
  it("Q25 is 25 even when only part of the note is drawn", () => {
    const md = Array.from({ length: 30 }, (_, i) => `> [!question]- Q${i + 1} **bold** title\n> > [!answer]- Answer\n> > text\n`).join("\n");
    const m = sourceQuestionNumbers(md);
    expect(m.get("question\u0000q25 bold title")).toBe(25);
  });
  it("scrolls on when the start question is not drawn yet", () => {
    const c = { scrollTop: 0, scrollHeight: 10000, clientHeight: 800 } as unknown as HTMLElement;
    const keep = seekStartQuestion(c, [{ top: 100, question: 1 }, { top: 900, question: 4 }], { scrollStartNumber: 25, scrollMode: "all", scrollReverse: false } as never, 0);
    expect(keep).toBe(true);
    expect(c.scrollTop).toBe(900);
  });
  it("stops seeking once the start question is drawn", () => {
    const c = { scrollTop: 0, scrollHeight: 10000, clientHeight: 800 } as unknown as HTMLElement;
    expect(seekStartQuestion(c, [{ top: 100, question: 25 }], { scrollStartNumber: 25, scrollMode: "all", scrollReverse: false } as never, 0)).toBe(false);
  });
});
