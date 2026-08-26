import { describe, expect, test } from "bun:test";
import {
  ANSWER_LINE,
  EMPTY_ANSWER_LINE,
  EMPTY_MATCH_ROW,
  MATCH_SEPARATOR,
  nextMatchRow,
  toggleOptionCheckbox,
  MCQ_EMPTY_OPTION,
  MCQ_OPTION,
  TRAFFIC_CYCLE,
  buildMatchBlock,
  buildMcqBlock,
  calloutForColor,
  convertCalloutsToDetails,
  convertDetailsToCallouts,
  nextToggleNumber,
  planBackspace,
  planEnter,
  renumberToggles,
  type EnterOptions,
} from "../main";

const callout: EnterOptions = {
  calloutType: "question",
  collapsed: true,
  boldSummary: true,
  format: "callout",
};
const details: EnterOptions = { ...callout, format: "details" };

describe("v1.0.2 — Enter behaviour (callout)", () => {
  test("question header with text moves into the body", () => {
    const plan = planEnter("> [!question]- **What is stomata?**", callout);
    expect(plan).not.toBeNull();
    expect(plan!.insert).toContain("> ");
  });

  test("answer line with content adds another body line", () => {
    const plan = planEnter("> Guard cells open it.", callout);
    expect(plan!.insert).toBe("\n> ");
  });

  test("empty body line starts the next toggle", () => {
    const plan = planEnter("> ", callout);
    expect(plan!.insert).toContain("[!question]-");
  });

  test("empty header escapes to plain text", () => {
    const plan = planEnter("> [!question]- ****", callout);
    expect(plan!.insert).toBe("");
  });

  test("plain text is left to Obsidian", () => {
    expect(planEnter("Just a normal line", callout)).toBeNull();
  });
});

describe("v1.0.2 — Enter behaviour (<details>)", () => {
  test("summary with content moves into the body", () => {
    const plan = planEnter("<summary><b>Q1. Photosynthesis?</b></summary>", details);
    expect(plan!.insert).toBe("\n");
  });

  test("empty summary escapes", () => {
    const plan = planEnter("<summary><b></b></summary>", details);
    expect(plan!.insert).toBe("");
  });

  test("line after </details> starts the next skeleton", () => {
    const plan = planEnter("</details>", details);
    expect(plan!.insert).toContain("<details>");
  });
});

describe("v1.0.2 — Backspace behaviour", () => {
  test("empty body line unwraps to plain text", () => {
    const plan = planBackspace("> ", 2, callout);
    expect(plan).not.toBeNull();
    expect(plan!.insert).toBe("");
  });

  test("caret before question text unwraps the marker", () => {
    const text = "> [!question]- **Term?**";
    const plan = planBackspace(text, text.indexOf("**") + 2, callout);
    expect(plan).not.toBeNull();
    expect(plan!.insert).not.toContain("[!question]");
  });

  test("mid-word backspace is left to Obsidian", () => {
    expect(planBackspace("> Guard cells", 8, callout)).toBeNull();
  });

  test("empty <summary> skeleton line is removed", () => {
    const plan = planBackspace("<summary><b></b></summary>", 12, details);
    expect(plan!.insert).toBe("");
  });
});

describe("v1.0.3 — auto-numbering", () => {
  test("next number continues from the last numbered toggle", () => {
    const lines = [
      "> [!question]- **1. First**",
      "> body",
      "> [!question]- **2. Second**",
    ];
    expect(nextToggleNumber(lines)).toBe(3);
  });

  test("numbering starts at 1 when nothing is numbered", () => {
    expect(nextToggleNumber(["> [!question]- **Plain**"])).toBe(1);
  });

  test("<summary> numbering is detected too", () => {
    expect(nextToggleNumber(["<summary><b>7. Seventh</b></summary>"])).toBe(8);
  });

  test("Enter carries the next number into the new toggle", () => {
    const plan = planEnter("> ", { ...callout, numbered: true, nextNumber: 5 });
    expect(plan!.insert).toContain("5. ");
  });

  test("renumber fixes gaps and duplicates", () => {
    const doc = [
      "> [!question]- **3. A**",
      "> a",
      "> [!question]- **3. B**",
      "> b",
      "> [!question]- **9. C**",
    ].join("\n");
    const out = renumberToggles(doc);
    expect(out).toContain("**1. A**");
    expect(out).toContain("**2. B**");
    expect(out).toContain("**3. C**");
  });

  test("renumber leaves unnumbered notes untouched", () => {
    const doc = "> [!question]- **A**\n> body";
    expect(renumberToggles(doc)).toBe(doc);
  });
});

describe("v1.0.3 — colours", () => {
  test("colour ids map to recall callouts", () => {
    expect(calloutForColor("red", "question")).toBe("recall-red");
    expect(calloutForColor("plain", "question")).toBe("recall-plain");
  });

  test("default colour falls back to the callout type", () => {
    expect(calloutForColor("default", "info")).toBe("info");
  });

  test("traffic-light cycle is red -> yellow -> green", () => {
    expect(TRAFFIC_CYCLE).toEqual(["recall-red", "recall-yellow", "recall-green"]);
  });
});

describe("v1.0.4 — MCQ toggle", () => {
  const base = { ...callout, count: 4, addAnswerLine: true };

  test("skeleton has the requested checkbox options and an Answer line", () => {
    const { text } = buildMcqBlock(base);
    expect(text.match(/- \[ \]/g)?.length).toBe(4);
    expect(text).toContain("**Answer:** ");
    expect(text).toContain("> [!question]-");
  });

  test("option count is clamped to 2..6", () => {
    expect(buildMcqBlock({ ...base, count: 99 }).text.match(/- \[ \]/g)?.length).toBe(6);
    expect(buildMcqBlock({ ...base, count: 1 }).text.match(/- \[ \]/g)?.length).toBe(2);
  });

  test("Answer line can be turned off", () => {
    expect(buildMcqBlock({ ...base, addAnswerLine: false }).text).not.toContain("Answer:");
  });

  test("cursor lands in the question title", () => {
    const { text, cursorOffset } = buildMcqBlock(base);
    expect(text.slice(0, cursorOffset)).toBe("> [!question]- **");
  });

  test("numbering is applied to the question title", () => {
    const { text } = buildMcqBlock({ ...base, numbered: true, number: 4 });
    expect(text).toContain("**4. ");
  });

  test("<details> format produces an HTML skeleton", () => {
    const { text } = buildMcqBlock({ ...details, count: 3, addAnswerLine: true });
    expect(text).toContain("<details>");
    expect(text).toContain("<summary><b>");
    expect(text).toContain("</details>");
    expect(text.match(/- \[ \]/g)?.length).toBe(3);
  });

  test("regexes recognise filled / empty options and the answer line", () => {
    expect(MCQ_OPTION.test("> - [ ] Chlorophyll")).toBe(true);
    expect(MCQ_OPTION.test("> - [ ] ")).toBe(false);
    expect(MCQ_EMPTY_OPTION.test("> - [ ] ")).toBe(true);
    expect(ANSWER_LINE.test("> **Answer:** B")).toBe(true);
  });

  test("Enter on a filled option adds the next checkbox", () => {
    const plan = planEnter("> - [ ] Chlorophyll", { ...callout, addAnswerLine: true });
    expect(plan!.insert).toBe("\n> - [ ] ");
  });

  test("Enter on an empty option jumps to the Answer line", () => {
    const plan = planEnter("> - [ ] ", { ...callout, addAnswerLine: true });
    expect(plan!.insert).toContain("**Answer:** ");
  });

  test("Enter on an empty option gives a plain body line when Answer lines are off", () => {
    const plan = planEnter("> - [ ] ", { ...callout, addAnswerLine: false });
    expect(plan!.insert).not.toContain("Answer");
  });

  test("Enter after the Answer line still continues the body", () => {
    const plan = planEnter("> **Answer:** B", callout);
    expect(plan!.insert).toBe("\n> ");
  });

  test("a checked option is still treated as an option", () => {
    expect(MCQ_OPTION.test("> - [x] Chlorophyll")).toBe(true);
    expect(planEnter("> - [x] Chlorophyll", callout)!.insert).toBe("\n> - [ ] ");
  });

  test("Backspace on an empty option line falls back to plain text or default", () => {
    const plan = planBackspace("> - [ ] ", 8, callout);
    // Either unwrapped or handed to Obsidian — never a crash, never a header.
    if (plan) expect(plan.insert).not.toContain("[!question]");
  });
});

describe("v1.0.4 — Match the following", () => {
  const base = { ...callout, count: 4, addAnswerLine: true };

  test("table skeleton has header, separator and numbered rows", () => {
    const { text } = buildMatchBlock(base);
    expect(text).toContain("| # | Column A | Column B |");
    expect(text).toContain("|---|---|---|");
    expect(text.match(/^> \| \d /gm)?.length).toBe(4);
  });

  test("default title is 'Match the following'", () => {
    expect(buildMatchBlock(base).text).toContain("Match the following");
  });

  test("row count is clamped to 2..8", () => {
    expect(buildMatchBlock({ ...base, count: 20 }).text.match(/^> \| \d /gm)?.length).toBe(8);
    expect(buildMatchBlock({ ...base, count: 0 }).text.match(/^> \| \d /gm)?.length).toBe(4);
  });

  test("answer key lists every row", () => {
    expect(buildMatchBlock({ ...base, count: 3 }).text).toContain("**Answer:** 1-, 2-, 3-");
  });

  test("<details> format wraps the table in HTML", () => {
    const { text } = buildMatchBlock({ ...details, count: 2, addAnswerLine: false });
    expect(text).toContain("<details>");
    expect(text).toContain("| # | Column A | Column B |");
    expect(text).not.toContain("Answer:");
  });
});

describe("conversions — Botany round trip", () => {
  const doc = [
    "# Notes",
    "",
    "> [!question]- **1. What is a stoma?**",
    "> A pore for gas exchange.",
    "",
    "> [!question]- **2. Where is chlorophyll?**",
    "> In chloroplast thylakoids.",
    "",
  ].join("\n");

  test("callouts -> details -> callouts is stable", () => {
    const asDetails = convertCalloutsToDetails(doc);
    expect(asDetails.match(/<details/g)?.length).toBe(2);
    const back = convertDetailsToCallouts(asDetails, "question", true, true);
    expect(back.match(/\[!question\]-/g)?.length).toBe(2);
    expect(back).toContain("What is a stoma?");
    expect(back).toContain("In chloroplast thylakoids.");
  });
});

/* ---------- v1.0.5: MCQ / Match edge cases ---------- */

describe("v1.0.5 — option checkbox toggle", () => {
  test("empty box becomes ticked and back", () => {
    const ticked = toggleOptionCheckbox("> - [ ] Chlorophyll");
    expect(ticked).toBe("> - [x] Chlorophyll");
    expect(toggleOptionCheckbox(ticked)).toBe("> - [ ] Chlorophyll");
  });

  test("uppercase [X] is treated as ticked", () => {
    expect(toggleOptionCheckbox("> - [X] RuBisCO")).toBe("> - [ ] RuBisCO");
  });

  test("plain list line (details body) works too", () => {
    expect(toggleOptionCheckbox("- [ ] Stroma")).toBe("- [x] Stroma");
    expect(toggleOptionCheckbox("  - [ ] Stroma")).toBe("  - [x] Stroma");
  });

  test("non-option lines are returned unchanged", () => {
    for (const line of ["> [!question]- **1. Q**", "> **Answer:** B", "plain text", "> | 1 |  | 1. |"]) {
      expect(toggleOptionCheckbox(line)).toBe(line);
    }
  });

  test("empty option keeps its trailing space when ticked", () => {
    expect(toggleOptionCheckbox("> - [ ] ")).toBe("> - [x] ");
  });
});

describe("v1.0.5 — MCQ Enter edge cases", () => {
  test("checked option still chains to the next empty option", () => {
    const plan = planEnter("> - [x] Chlorophyll", callout)!;
    expect(plan.insert).toBe("\n> - [ ] ");
    expect(plan.cursorOffset).toBe(plan.insert.length);
  });

  test("empty Answer line escapes the toggle", () => {
    const plan = planEnter("> **Answer:** ", callout)!;
    expect(plan.from).toBe("lineStart");
    expect(plan.insert).toBe("");
    expect(plan.cursorOffset).toBe(0);
  });

  test("filled Answer line continues as a normal body line", () => {
    const plan = planEnter("> **Answer:** B", callout)!;
    expect(plan.insert).toBe("\n> ");
  });

  test("<details> body: filled option chains, empty option jumps to Answer", () => {
    expect(planEnter("- [ ] Chlorophyll", details)!.insert).toBe("\n- [ ] ");
    const answer = planEnter("- [ ] ", details)!;
    expect(answer.insert).toBe("**Answer:** ");
    expect(answer.cursorOffset).toBe(answer.insert.length);
  });

  test("<details> body: Answer line is off when the setting is off", () => {
    const plan = planEnter("- [ ] ", { ...details, addAnswerLine: false })!;
    expect(plan.insert).toBe("");
  });
});

describe("v1.0.5 — Match table Enter edge cases", () => {
  test("separator row creates the first data row", () => {
    const plan = planEnter("> |---|---|---|", callout)!;
    expect(plan.insert).toBe("\n> | 1 |  | 1.  |");
  });

  test("filled row creates the next numbered row with the caret in Column A", () => {
    const plan = planEnter("> | 2 | RuBisCO | 2. Stroma |", callout)!;
    expect(plan.insert).toBe("\n> | 3 |  | 3.  |");
    const caret = plan.insert.slice(plan.cursorOffset);
    expect(caret.startsWith(" |") || caret.startsWith("|")).toBe(true);
  });

  test("blank row leaves the table and lands on the answer key", () => {
    const plan = planEnter("> | 4 |  | 4.  |", callout)!;
    expect(plan.from).toBe("lineStart");
    expect(plan.insert).toBe("> **Answer:** ");
    expect(plan.cursorOffset).toBe(plan.insert.length);
  });

  test("blank row gives a plain body line when Answer lines are off", () => {
    const plan = planEnter("> | 2 |  | 2.  |", { ...callout, addAnswerLine: false })!;
    expect(plan.insert).toBe("> ");
  });
});

describe("v1.0.5 — MCQ / Match Backspace edge cases", () => {
  test("empty option collapses to a plain body line inside the toggle", () => {
    const text = "> - [ ] ";
    const plan = planBackspace(text, text.length, callout)!;
    expect(plan.insert).toBe("> ");
    expect(plan.cursorOffset).toBe(2);
  });

  test("empty Answer line collapses to a plain body line", () => {
    const text = "> **Answer:** ";
    const plan = planBackspace(text, text.length, callout)!;
    expect(plan.insert).toBe("> ");
  });

  test("blank match row collapses to a plain body line", () => {
    const text = "> | 3 |  | 3.  |";
    const plan = planBackspace(text, text.length, callout)!;
    expect(plan.insert).toBe("> ");
  });

  test("caret before option text drops the checkbox but keeps the text", () => {
    const text = "> - [ ] Chlorophyll";
    const plan = planBackspace(text, text.indexOf("Chlorophyll"), callout)!;
    expect(plan.insert).toBe("> Chlorophyll");
    expect(plan.cursorOffset).toBe(2);
  });

  test("mid-word backspace inside an option is left to Obsidian", () => {
    expect(planBackspace("> - [ ] Chlorophyll", 12, callout)).toBeNull();
  });

  test("filled Answer line is not swallowed", () => {
    const text = "> **Answer:** B";
    const plan = planBackspace(text, text.length, callout);
    expect(plan).toBeNull();
  });
});

describe("v1.0.5 — answer line + cursor placement", () => {
  const opts = { ...callout, count: 4 };

  test("MCQ caret starts in the question title, before the options", () => {
    const { text, cursorOffset } = buildMcqBlock(opts);
    expect(text.slice(cursorOffset, cursorOffset + 2)).toBe("**");
    expect(text.indexOf("- [ ] ")).toBeGreaterThan(cursorOffset);
  });

  test("MCQ Answer line is the last body line and ends with a space", () => {
    const { text } = buildMcqBlock(opts);
    const lines = text.split("\n").filter((l) => l.length > 0);
    expect(lines[lines.length - 1]).toBe("> **Answer:** ");
  });

  test("Match answer key lists every row and ends the block", () => {
    const { text } = buildMatchBlock({ ...opts, count: 3 });
    const lines = text.trimEnd().split("\n");
    expect(lines[lines.length - 1]).toBe("> **Answer:** 1-, 2-, 3-");
  });

  test("Match caret sits in the title (default 'Match the following')", () => {
    const { text, cursorOffset } = buildMatchBlock(opts);
    expect(text.slice(0, cursorOffset)).toContain("[!question]-");
    // caret sits at the END of the title text, ready to edit it
    expect(text.slice(0, cursorOffset).endsWith("Match the following")).toBe(true);
  });

  test("nextMatchRow numbers and blanks both columns", () => {
    expect(nextMatchRow(0)).toBe("| 1 |  | 1.  |");
    expect(nextMatchRow(7)).toBe("| 8 |  | 8.  |");
  });

  test("answer-line regexes stay strict", () => {
    expect(EMPTY_ANSWER_LINE.test("> **Answer:** ")).toBe(true);
    expect(EMPTY_ANSWER_LINE.test("> **Answer:** B")).toBe(false);
    expect(ANSWER_LINE.test("> **Answer:** B")).toBe(true);
    expect(EMPTY_MATCH_ROW.test("> | 2 |  | 2.  |")).toBe(true);
    expect(EMPTY_MATCH_ROW.test("> | 2 | RuBisCO | 2. Stroma |")).toBe(false);
    expect(MATCH_SEPARATOR.test("> |---|---|---|")).toBe(true);
  });
});
