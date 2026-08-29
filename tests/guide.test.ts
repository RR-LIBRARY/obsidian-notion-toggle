import { describe, expect, test } from "bun:test";
import {
  TOOLBAR_COMMANDS,
  TOOLBAR_STEPS,
  fabShouldShow,
  guideProgress,
  toggleGuideDone,
} from "../src/guide";

describe("mobile toolbar guide", () => {
  test("command ids are unique and prioritised", () => {
    const ids = TOOLBAR_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const priorities = TOOLBAR_COMMANDS.map((c) => c.priority);
    expect([...priorities].sort((a, b) => a - b)).toEqual(priorities);
  });

  test("start/pause is the first recommendation", () => {
    expect(TOOLBAR_COMMANDS[0].id).toBe("smart-autoscroll");
  });

  test("every entry has a name and a reason", () => {
    for (const c of TOOLBAR_COMMANDS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.why.length).toBeGreaterThan(0);
    }
  });

  test("steps mention the Manage toolbar screen", () => {
    expect(TOOLBAR_STEPS.join(" ")).toContain("Manage toolbar");
  });

  test("toggleGuideDone adds and removes in priority order", () => {
    let done: string[] = [];
    done = toggleGuideDone(done, "autoscroll-stop");
    done = toggleGuideDone(done, "smart-autoscroll");
    expect(done).toEqual(["smart-autoscroll", "autoscroll-stop"]);
    done = toggleGuideDone(done, "smart-autoscroll");
    expect(done).toEqual(["autoscroll-stop"]);
  });

  test("toggleGuideDone ignores unknown ids", () => {
    expect(toggleGuideDone([], "nope")).toEqual([]);
  });

  test("guideProgress counts only known ids", () => {
    expect(guideProgress([])).toBe(`0/${TOOLBAR_COMMANDS.length}`);
    expect(guideProgress(["smart-autoscroll", "stale-id"])).toBe(`1/${TOOLBAR_COMMANDS.length}`);
  });
});

describe("fabShouldShow", () => {
  test("shown when enabled and a note is open (v1.1.6: bar no longer hides it)", () => {
    expect(fabShouldShow(true, true, false)).toBe(true);
    expect(fabShouldShow(false, true, false)).toBe(false);
    expect(fabShouldShow(true, false, false)).toBe(false);
    expect(fabShouldShow(true, true, true)).toBe(true);
  });

});

/* ---------- v1.1.6 ---------- */
import { HOTKEYS, MSG_NOT_RUNNING, MSG_NO_TOGGLES, hotkeyLabel } from "../src/guide";

describe("v1.1.6 hotkeys + messages", () => {
  test("three default hotkeys, all unique", () => {
    expect(HOTKEYS).toHaveLength(3);
    expect(new Set(HOTKEYS.map((h) => h.label)).size).toBe(3);
  });

  test("hotkeyLabel resolves known ids and is empty otherwise", () => {
    expect(hotkeyLabel("smart-autoscroll")).toBe("Ctrl/Cmd+Shift+S");
    expect(hotkeyLabel("autoscroll-reverse")).toBe("Ctrl/Cmd+Shift+R");
    expect(hotkeyLabel("autoscroll-sheet")).toBe("Ctrl/Cmd+Shift+A");
    expect(hotkeyLabel("nope")).toBe("");
  });

  test("hotkey ids are real toolbar commands", () => {
    const ids = new Set(TOOLBAR_COMMANDS.map((c) => c.id));
    for (const h of HOTKEYS) expect(ids.has(h.id)).toBe(true);
  });

  test("messages name the start command and the toggle syntax", () => {
    expect(MSG_NOT_RUNNING).toContain("Autoscroll (start / pause revision)");
    expect(MSG_NOT_RUNNING).toContain("Ctrl/Cmd+Shift+S");
    expect(MSG_NO_TOGGLES).toContain("details");
  });

  test("fab stays visible during a running session", () => {
    expect(fabShouldShow(true, true, true)).toBe(true);
    expect(fabShouldShow(true, false, false)).toBe(false);
    expect(fabShouldShow(false, true, false)).toBe(false);
  });
});
