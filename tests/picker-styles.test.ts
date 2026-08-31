/**
 * v1.4.14 — the filter picker has 20+ rows, so the list must scroll inside the
 * modal. Without max-height + overflow the bottom options are unreachable on a
 * phone (the reported "list kat jaati hai").
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { QUIZ_FILTER_OPTIONS } from "../src/modals";

const css = readFileSync(join(__dirname, "..", "styles.css"), "utf8");
const block = css.slice(css.indexOf(".notion-toggle-color-list {"));
const listRules = block.slice(0, block.indexOf("}"));
const btnBlock = css.slice(css.indexOf(".notion-toggle-color-btn {"));
const btnRules = btnBlock.slice(0, btnBlock.indexOf("}"));

describe("filter picker styling", () => {
  it("caps the list height so it scrolls inside the modal", () => {
    expect(listRules).toContain("max-height");
    expect(listRules).toContain("overflow-y: auto");
  });

  it("keeps scrolling contained and smooth on touch devices", () => {
    expect(listRules).toContain("overscroll-behavior: contain");
    expect(listRules).toContain("-webkit-overflow-scrolling: touch");
  });

  it("lets long option labels wrap instead of clipping", () => {
    expect(btnRules).toContain("white-space: normal");
    expect(btnRules).toContain("height: auto");
  });

  it("still has more options than fit unscrolled, which is why this matters", () => {
    expect(QUIZ_FILTER_OPTIONS.length).toBeGreaterThan(15);
  });
});
