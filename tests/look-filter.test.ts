import { beforeEach, describe, expect, test } from "bun:test";
import type { App } from "obsidian";
import { CalloutFormatModal } from "../src/look-filter-modal";
import {
  CALLOUT_LOOK_OPTIONS,
  NATIVE_CALLOUT_CLASS,
  calloutLookSummary,
  normalizeCalloutTypes,
  paintCalloutLooks,
  usesNotionLook,
} from "../src/look-filter";
import { clickButton, flush, installObsidianDom } from "./research-dom";

installObsidianDom();

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("callout appearance filter", () => {
  test("Notion is the default and the global Callout choice wins over the filter", () => {
    expect(usesNotionLook("question", { notionLook: true, calloutLookTypes: [] })).toBe(true);
    expect(usesNotionLook("question", { notionLook: false, calloutLookTypes: [] })).toBe(false);
    expect(usesNotionLook("question", { notionLook: false, calloutLookTypes: ["note"] })).toBe(false);
  });

  test("only selected types stay native; matching ignores case and duplicate entries", () => {
    const settings = { notionLook: true, calloutLookTypes: ["Note", "RECALL-RED", "note", " "] };
    expect(normalizeCalloutTypes(settings.calloutLookTypes)).toEqual(["note", "recall-red"]);
    expect(usesNotionLook("question", settings)).toBe(true);
    expect(usesNotionLook("NOTE", settings)).toBe(false);
    expect(usesNotionLook("recall-red", settings)).toBe(false);
    expect(calloutLookSummary(settings)).toBe("2 types: native callout; others: Notion toggle");
  });

  test("one note can mix Notion Question, native Note and native Red; changes remove stale classes", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div class="callout is-collapsible" data-callout="question"></div>
      <div class="callout is-collapsible" data-callout="note"></div>
      <div class="callout is-collapsible" data-callout="recall-red"></div>
      <div class="callout" data-callout="note"></div>`;
    const settings = { notionLook: true, calloutLookTypes: ["note", "recall-red"] };
    expect(paintCalloutLooks(root, settings)).toBe(3);
    const items = Array.from(root.querySelectorAll<HTMLElement>(".callout"));
    expect(items[0].classList.contains(NATIVE_CALLOUT_CLASS)).toBe(false);
    expect(items[1].classList.contains(NATIVE_CALLOUT_CLASS)).toBe(true);
    expect(items[2].classList.contains(NATIVE_CALLOUT_CLASS)).toBe(true);
    expect(items[3].classList.contains(NATIVE_CALLOUT_CLASS)).toBe(false);

    settings.calloutLookTypes = [];
    paintCalloutLooks(root, settings);
    expect(root.querySelectorAll(`.${NATIVE_CALLOUT_CLASS}`).length).toBe(0);
    settings.notionLook = false;
    paintCalloutLooks(root, settings);
    expect(root.querySelectorAll(`.${NATIVE_CALLOUT_CLASS}`).length).toBe(3);
  });

  test("the mobile filter checks individual types and offers All Notion / All callouts", async () => {
    const changes: string[][] = [];
    const modal = new CalloutFormatModal({} as App, [], (types) => { changes.push([...types]); });
    modal.open();
    const noteRow = Array.from(modal.contentEl.querySelectorAll(".setting-item"))
      .find((el) => el.querySelector(".setting-item-name")?.textContent === "Note" || Array.from(el.children).some((child) => child.textContent === "Note"));
    const noteToggle = noteRow?.querySelector<HTMLElement>(".checkbox-container");
    expect(noteToggle).toBeTruthy();
    noteToggle!.click();
    await flush();
    expect(changes[0]).toEqual(["note"]);

    clickButton(modal.contentEl, "All Notion");
    await flush();
    expect(changes.at(-1)).toEqual([]);
    expect(modal.contentEl.querySelectorAll(".checkbox-container.is-enabled").length).toBe(0);

    clickButton(modal.contentEl, "All callouts");
    await flush();
    expect(changes.at(-1)).toEqual(CALLOUT_LOOK_OPTIONS.map((option) => option.type));
    expect(modal.contentEl.querySelectorAll(".checkbox-container.is-enabled").length).toBe(CALLOUT_LOOK_OPTIONS.length);
    modal.close();
  });
});
