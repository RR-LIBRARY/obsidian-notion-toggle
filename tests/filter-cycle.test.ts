/**
 * v1.2.5 — red → yellow → green cycle, round-tripped over real markdown lines.
 */
import { describe, expect, it } from "bun:test";
import {
  TRAFFIC_CYCLE,
  calloutTypeOfLine,
  nextTrafficColor,
  recolorHeaderLine,
} from "../src/recolor";

describe("callout type of a header line", () => {
  it("reads the type with and without a fold marker", () => {
    expect(calloutTypeOfLine("> [!recall-red]- **Q1**")).toBe("recall-red");
    expect(calloutTypeOfLine("> [!recall-green]+ Q2")).toBe("recall-green");
    expect(calloutTypeOfLine(">[!note] plain")).toBe("note");
    expect(calloutTypeOfLine("just text")).toBe("");
  });
});

describe("cycle order", () => {
  it("walks red → yellow → green → red", () => {
    expect(nextTrafficColor("recall-red")).toBe("recall-yellow");
    expect(nextTrafficColor("recall-yellow")).toBe("recall-green");
    expect(nextTrafficColor("recall-green")).toBe("recall-red");
  });

  it("grades an ungraded toggle as red on the first tap", () => {
    expect(nextTrafficColor("note")).toBe("recall-red");
    expect(nextTrafficColor("question")).toBe("recall-red");
    expect(nextTrafficColor("")).toBe("recall-red");
  });

  it("returns to the start after a full lap", () => {
    let type = "note";
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      type = nextTrafficColor(type);
      seen.push(type);
    }
    expect(seen).toEqual([...TRAFFIC_CYCLE, TRAFFIC_CYCLE[0]]);
  });
});

describe("recolouring keeps the line intact", () => {
  it("keeps the fold marker and the title", () => {
    expect(recolorHeaderLine("> [!recall-red]- **Q1 — why?**", "recall-yellow")).toBe(
      "> [!recall-yellow]- **Q1 — why?**"
    );
    expect(recolorHeaderLine("> [!note]+ Answer ⏱30", "recall-green")).toBe(
      "> [!recall-green]+ Answer ⏱30"
    );
    expect(recolorHeaderLine("> [!note] no fold", "recall-red")).toBe("> [!recall-red] no fold");
  });

  it("leaves non-toggle lines untouched", () => {
    expect(recolorHeaderLine("plain paragraph", "recall-red")).toBe("plain paragraph");
  });

  it("survives three recolours without corrupting the header", () => {
    let line = "> [!note]- Title";
    for (let i = 0; i < 3; i++) line = recolorHeaderLine(line, nextTrafficColor(calloutTypeOfLine(line)));
    expect(line).toBe("> [!recall-green]- Title");
  });
});
