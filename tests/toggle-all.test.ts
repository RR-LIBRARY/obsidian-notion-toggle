/**
 * v1.8.15 — Notion parity for Ctrl/Cmd+Alt+T ("open / close all toggles").
 *
 * Ground truth (verified against a real Notion page through the Notion API and
 * Notion's own shortcut list): one shortcut flips the whole page — anything
 * still folded means "open everything", otherwise "close everything".
 */
import { describe, expect, test } from "bun:test";
import { planToggleAll } from "../src/clean-toggles";

const note = ["> [!note]- One", "> body", "> > [!tip]- Nested", "> > deeper", "", "> [!note]+ Two", "plain text"].join("\n");

describe("planToggleAll", () => {
  test("opens everything when anything is still closed", () => {
    const plan = planToggleAll(note);
    expect(plan.opened).toBe(true);
    expect(plan.total).toBe(3);
    expect(plan.changed).toBe(2);
    expect(plan.doc.split("\n")[0]).toBe("> [!note]+ One");
    expect(plan.doc).toContain("> > [!tip]+ Nested");
    expect(plan.doc).toContain("> [!note]+ Two");
    expect(plan.doc).toContain("plain text");
  });

  test("closes everything once the whole note is open", () => {
    const opened = planToggleAll(note).doc;
    const plan = planToggleAll(opened);
    expect(plan.opened).toBe(false);
    expect(plan.changed).toBe(3);
    expect(plan.doc).toContain("> [!note]- One");
    expect(plan.doc).toContain("> > [!tip]- Nested");
  });

  test("nested toggles at any depth are included", () => {
    const deep = Array.from({ length: 12 }, (_, i) => `${"> ".repeat(i + 1)}[!note]- depth ${i + 1}`).join("\n");
    const plan = planToggleAll(deep);
    expect(plan.total).toBe(12);
    expect(plan.changed).toBe(12);
    expect(plan.doc.split("\n").every((l) => l.includes("]+"))).toBe(true);
  });

  test("<details> blocks flip too", () => {
    const html = "<details>\n<summary>a</summary>\n</details>\n<details open>\n<summary>b</summary>\n</details>";
    const open = planToggleAll(html);
    expect(open.opened).toBe(true);
    expect(open.doc).toContain("<details open>\n<summary>a</summary>");
    const close = planToggleAll(open.doc);
    expect(close.opened).toBe(false);
    expect(close.doc.includes("<details open>")).toBe(false);
  });

  test("force overrides the automatic direction", () => {
    expect(planToggleAll(note, "close").opened).toBe(false);
    expect(planToggleAll(note, "open").opened).toBe(true);
  });

  test("a note without toggles comes back untouched", () => {
    const plain = "just words\nand more";
    const plan = planToggleAll(plain);
    expect(plan.doc).toBe(plain);
    expect(plan.total).toBe(0);
    expect(plan.changed).toBe(0);
  });
});
