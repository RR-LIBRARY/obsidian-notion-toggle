/** v1.8.9 — rearrange + shove into toggle (src/block-move.ts) and nested toggle parsing. */
import { describe, expect, test } from "bun:test";
import { dropUnit, indentUnit, moveUnit, outdentUnit, parseUnits, unitAt } from "../src/block-move";
import { findBlockAt, markerDepth, parentOf, planClean, textDoc } from "../src/clean-toggles";

const L = ["> [!q]- Toggle List", "", "> [!q]- Oka", "> body", "", "Phir enter", "ok"];

describe("units", () => {
  test("a toggle with its body is one unit", () => {
    expect(unitAt(L, 2)).toMatchObject({ start: 2, end: 3, toggle: true, cd: 0 });
    expect(unitAt(L, 3)).toMatchObject({ start: 3, end: 3, toggle: false, cd: 1 });
    expect(parseUnits(L, 0, L.length - 1, 0).length).toBe(6);
  });
});

describe("moves keep toggles apart", () => {
  test("move a line up past a toggle", () => {
    const r = moveUnit(L, 5, -1)!;
    expect(r.lines).toEqual(["> [!q]- Toggle List", "", "Phir enter", "", "> [!q]- Oka", "> body", "", "ok"]);
    expect(r.lines[r.at]).toBe("Phir enter");
  });
  test("swap two toggles", () => {
    expect(moveUnit(L, 2, -1)!.lines.slice(0, 4)).toEqual(["> [!q]- Oka", "> body", "", "> [!q]- Toggle List"]);
  });
  test("first unit cannot move up", () => expect(moveUnit(L, 0, -1)).toBeNull());
});

describe("shove into / out of toggles", () => {
  test("Tab puts a line inside the toggle above", () => {
    const r = indentUnit(L, 5)!;
    expect(r.lines).toEqual(["> [!q]- Toggle List", "", "> [!q]- Oka", "> body", "> Phir enter", "", "ok"]);
    expect(r.openHeader).toBe(2);
  });
  test("Tab on a toggle nests it", () => {
    expect(indentUnit(L, 2)!.lines.slice(0, 3)).toEqual(["> [!q]- Toggle List", "> > [!q]- Oka", "> > body"]);
  });
  test("Tab without a toggle above does nothing", () => expect(indentUnit(L, 6)).toBeNull());
  test("Shift+Tab takes it back out", () => {
    const i = indentUnit(L, 5)!;
    expect(outdentUnit(i.lines, i.at)!.lines).toEqual(L);
  });
  test("drop into a toggle", () => {
    expect(dropUnit(L, 6, 0, "into")!.lines.slice(0, 2)).toEqual(["> [!q]- Toggle List", "> ok"]);
  });
  test("drop onto itself is refused", () => expect(dropUnit(L, 2, 3, "after")).toBeNull());
});

describe("nested toggles parse", () => {
  const N = ["> [!q]- Outer", "> > [!q]- Inner", "> > inner body", "> outer body"];
  const doc = textDoc(N.join("\n"));
  test("innermost block wins, parent is found", () => {
    const inner = findBlockAt(doc, 3)!;
    expect(inner.depth).toBe(2);
    expect(inner.lastLine).toBe(3);
    expect(parentOf(doc, inner)!.headerLine).toBe(1);
    expect(findBlockAt(doc, 4)!.headerLine).toBe(1);
    expect(markerDepth("> > x")).toBe(2);
  });
  test("plans never overlap", () => {
    const res = planClean(doc, [{ from: N[0]!.length + 3, to: N[0]!.length + 3 }], new Map([[0, true], [N[0]!.length + 1, true]]));
    const hides = res.plans.filter((p) => p.kind === "hide" || p.kind === "arrow") as { from: number; to: number }[];
    const sorted = [...hides].sort((a, b) => a.from - b.from);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.from).toBeGreaterThanOrEqual(sorted[i - 1]!.to);
  });
});
