import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { TOOL_GROUPS, toolGroup } from "../src/tools-menu";

const commandSources = ["main.ts", "src/research/commands.ts", "src/notion-writing.ts", "src/callout-commands.ts", "src/padding-diagnose-view.ts"];

describe("compact Tools menu", () => {
  test("every existing command belongs to a visible group", () => {
    for (const path of commandSources) {
      const content = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
      for (const [, id] of content.matchAll(/id: "([^"]+)"/g)) {
        expect(TOOL_GROUPS).toContain(toolGroup(id));
      }
    }
  });
  test("research, quiz, writing, autoscroll and diagnostics are easy to find", () => {
    expect(toolGroup("research-deep")).toBe("Research");
    expect(toolGroup("quiz-pause")).toBe("Recall & quiz");
    expect(toolGroup("insert-mcq-toggle")).toBe("Writing & MCQ");
    expect(toolGroup("autoscroll-sheet")).toBe("Autoscroll");
    expect(toolGroup("autoscroll-toolbar-guide")).toBe("Settings");
    expect(toolGroup("toggle-all-toggles")).toBe("Toggle & layout");
  });
});
