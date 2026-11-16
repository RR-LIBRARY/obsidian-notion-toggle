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
