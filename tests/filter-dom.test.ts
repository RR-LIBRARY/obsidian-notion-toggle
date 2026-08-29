/**
 * v1.2.5 — red / yellow / green filter, verified on real DOM.
 *
 * The existing autoscroll tests only feed strings into `colorOf`. This file
 * walks the path the plugin actually uses at runtime:
 *   markup → collectToggleEls(Filtered) → toggleTypeOf → colorOf → matchesFilter
 */
import { describe, expect, it, beforeEach } from "bun:test";
import { Window } from "happy-dom";
import {
  colorCounts,
  colorOf,
  filterLabel,
  matchesFilter,
  normalizeFilter,
  planStops,
  sameFilter,
  type RecallColor,
} from "../src/autoscroll";
import {
  collectToggleEls,
  collectToggleElsFiltered,
  toggleTypeOf,
} from "../src/toggle-dom";

let doc: Document;

const mount = (html: string): HTMLElement => {
  const win = new Window();
  doc = win.document as unknown as Document;
  doc.body.innerHTML = `<div class="markdown-preview-view">${html}</div>`;
  return doc.body.firstElementChild as HTMLElement;
};

const callout = (type: string, body = "x") =>
  `<div class="callout is-collapsible" data-callout="${type}"><div class="callout-title"><div class="callout-title-inner">${type}</div></div><div class="callout-content">${body}</div></div>`;

const keepFor = (filter: RecallColor[]) => (el: HTMLElement) =>
  matchesFilter(colorOf(toggleTypeOf(el)), filter);

const colorsIn = (root: HTMLElement, filter: RecallColor[] = []) =>
  (filter.length
    ? collectToggleElsFiltered(root, keepFor(filter))
    : collectToggleEls(root)
  ).map((el) => colorOf(toggleTypeOf(el)));

describe("colour read from real markup", () => {
  it("reads data-callout on rendered callouts", () => {
    const root = mount(
      callout("recall-red") + callout("recall-yellow") + callout("recall-green") + callout("note")
    );
    expect(colorsIn(root)).toEqual(["red", "yellow", "green", "other"]);
  });

  it("reads the class list of <details> toggles", () => {
    const root = mount(
      `<details class="recall-green"><summary>a</summary>x</details>` +
        `<details open><summary>b</summary>y</details>`
    );
    expect(colorsIn(root)).toEqual(["green", "other"]);
  });

  it("reads Live Preview markup, where the wrapper carries no colour", () => {
    const root = mount(`<div class="cm-callout">${callout("recall-red")}</div>`);
    expect(colorsIn(root)).toEqual(["red"]);
  });

  it("keeps the outermost toggle when nothing is filtered", () => {
    const root = mount(
      `<div class="callout" data-callout="note"><div class="callout-content">${callout(
        "recall-red"
      )}</div></div>`
    );
    expect(collectToggleEls(root)).toHaveLength(1);
    expect(colorsIn(root)).toEqual(["other"]);
  });
});

describe("BUG v1.2.4: a coloured toggle nested in a plain one was dropped", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = mount(
      callout("recall-yellow") +
        `<div class="callout" data-callout="note"><div class="callout-content">${callout(
          "recall-red"
        )}</div></div>`
    );
  });

  it("finds the nested red toggle when filtering red", () => {
    expect(colorsIn(root, ["red"])).toEqual(["red"]);
  });

  it("still collapses nested toggles of the same colour to the outer one", () => {
    const nestedRed = mount(
      `<div class="callout" data-callout="recall-red"><div class="callout-content">${callout(
        "recall-red"
      )}</div></div>`
    );
    expect(colorsIn(nestedRed, ["red"])).toEqual(["red"]);
  });

  it("red + yellow finds both, top-level and nested", () => {
    expect(colorsIn(root, ["red", "yellow"]).sort()).toEqual(["red", "yellow"]);
  });

  it("plans stops in travel order after the filter", () => {
    const els = collectToggleElsFiltered(root, keepFor(["red", "yellow"]));
    const stops = els.map((el, index) => ({
      index,
      top: index * 100,
      color: colorOf(toggleTypeOf(el)),
    }));
    expect(planStops(stops, ["red"], false).map((s) => s.color)).toEqual(["red"]);
    expect(planStops(stops, [], true).map((s) => s.color)).toEqual(["red", "yellow"]);
  });
});

describe("filter selection is order-independent", () => {
  it("normalizes to the canonical order", () => {
    expect(normalizeFilter(["yellow", "red"])).toEqual(["red", "yellow"]);
    expect(normalizeFilter(["green", "green"])).toEqual(["green"]);
    expect(normalizeFilter([])).toEqual([]);
    expect(normalizeFilter(undefined)).toEqual([]);
  });

  it("BUG v1.2.4: the picker highlighted the wrong row after a reordered save", () => {
    expect(sameFilter(["yellow", "red"], ["red", "yellow"])).toBe(true);
    expect(sameFilter(["red"], ["red", "yellow"])).toBe(false);
    expect(sameFilter([], [])).toBe(true);
    expect(filterLabel(["yellow", "red"])).toBe(filterLabel(["red", "yellow"]));
  });
});

describe("uncoloured toggles and empty selections", () => {
  const root = () =>
    mount(callout("question") + callout("note") + callout("recall-green"));

  it('"all graded" intentionally skips plain !note / !question toggles', () => {
    expect(colorsIn(root(), ["red", "yellow", "green"])).toEqual(["green"]);
  });

  it("an empty filter keeps everything, including plain toggles", () => {
    expect(colorsIn(root())).toHaveLength(3);
  });

  it("a filter that matches nothing yields an empty plan, never a silent full run", () => {
    expect(colorsIn(root(), ["red"])).toEqual([]);
    expect(planStops([], ["red"], false)).toEqual([]);
  });

  it("counts each colour for the debug read-out", () => {
    expect(colorCounts(colorsIn(root()))).toEqual({
      red: 0,
      yellow: 0,
      green: 1,
      other: 2,
    });
  });
});
