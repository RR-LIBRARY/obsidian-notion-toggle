/**
 * v1.6.1 — the filter guard on *real* DOM, walking the exact runtime path:
 *
 *   markup → scanToggleEls(filter) → identity/ordinal maps → lazy re-render
 *          → resolveParkTarget → open (or refuse)
 *
 * The re-render step is the one that produced "🔴 filter par 🟡 khul gaya":
 * Obsidian replaces a lazily rendered section, so a measured identity points at
 * a detached node and the ordinal that used to be red now belongs to a yellow
 * toggle.
 */
import { beforeEach, describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { colorOf, matchesFilter, type RecallColor } from "../src/autoscroll";
import { isToggleOpen, scanToggleEls, setToggleOpen, toggleTypeOf } from "../src/toggle-dom";
import { resolveParkTarget, strayOpenToggles } from "../src/filter-guard";

let doc: Document;

const NOTE = `
  <div class="markdown-preview-view">
    <div class="section" id="s1">
      <div class="callout is-collapsed" data-callout="recall-red"><div class="callout-title"><div class="callout-title-inner">Q1 hard</div></div><div class="callout-content">A1</div></div>
      <div class="callout is-collapsed" data-callout="recall-yellow"><div class="callout-title"><div class="callout-title-inner">Q2 medium</div></div><div class="callout-content">A2</div></div>
    </div>
    <div class="section" id="s2">
      <div class="callout is-collapsed" data-callout="recall-red"><div class="callout-title"><div class="callout-title-inner">Q3 hard</div></div><div class="callout-content">A3</div></div>
      <div class="callout is-collapsed" data-callout="recall-green"><div class="callout-title"><div class="callout-title-inner">Q4 easy</div></div><div class="callout-content">A4</div></div>
    </div>
  </div>`;

const mount = (html: string): HTMLElement => {
  const win = new Window();
  doc = win.document as unknown as Document;
  doc.body.innerHTML = html;
  return doc.body.firstElementChild as HTMLElement;
};

const colorOfEl = (el: HTMLElement): RecallColor => colorOf(toggleTypeOf(el));

const measure = (root: HTMLElement, filter: RecallColor[]) => {
  const scan = scanToggleEls(root, (el) =>
    filter.length === 0 ? true : matchesFilter(colorOfEl(el), filter)
  );
  const byIdentity = new Map(scan.map((s) => [s.identity, s.el]));
  const byOrdinal = new Map(scan.map((s) => [s.ordinal, s.el]));
  return { scan, byIdentity, byOrdinal };
};

const park = (
  plan: { identity: string; ordinal: number },
  maps: { byIdentity: Map<string, HTMLElement>; byOrdinal: Map<number, HTMLElement> },
  filter: RecallColor[]
) =>
  resolveParkTarget({
    ...plan,
    byIdentity: maps.byIdentity,
    byOrdinal: maps.byOrdinal,
    filter,
    colorOf: colorOfEl,
  });

describe("v1.6.1 — red filter opens only red toggles", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = mount(NOTE);
  });

  it("a whole red run never opens a yellow or green answer", () => {
    const filter: RecallColor[] = ["red"];
    const maps = measure(root, filter);
    for (const stop of maps.scan) {
      const res = park(stop, maps, filter);
      if (res.el) setToggleOpen(res.el, true);
    }
    const opened = Array.from(root.querySelectorAll<HTMLElement>(".callout"))
      .filter((el) => isToggleOpen(el))
      .map(colorOfEl);
    expect(opened).toEqual(["red", "red"]);
  });

  it("refuses the stop after a lazy re-render shifted the ordinals", () => {
    const filter: RecallColor[] = ["red"];
    const maps = measure(root, filter);
    const plan = maps.scan.map((s) => ({ identity: s.identity, ordinal: s.ordinal }));

    // Obsidian replaces section 2: the old red element is detached and its
    // ordinal now belongs to a *yellow* toggle.
    const s2 = root.querySelector("#s2") as HTMLElement;
    s2.innerHTML =
      '<div class="callout is-collapsed" data-callout="recall-yellow"><div class="callout-title"><div class="callout-title-inner">Q9 medium</div></div><div class="callout-content">A9</div></div>';

    for (const stop of plan) {
      const res = park(stop, maps, filter);
      if (res.el) setToggleOpen(res.el, true);
    }
    const opened = Array.from(root.querySelectorAll<HTMLElement>(".callout")).filter((el) =>
      isToggleOpen(el)
    );
    expect(opened.map(colorOfEl)).toEqual(["red"]);
    expect(colorOfEl(root.querySelector<HTMLElement>('[data-callout="recall-yellow"]')!)).toBe(
      "yellow"
    );
  });

  it("closes a yellow answer the reader had already opened by hand", () => {
    const filter: RecallColor[] = ["red"];
    const yellow = root.querySelector<HTMLElement>('[data-callout="recall-yellow"]')!;
    setToggleOpen(yellow, true);
    expect(isToggleOpen(yellow)).toBe(true);

    const scan = scanToggleEls(root, () => true).map((s) => ({
      el: s.el,
      color: colorOfEl(s.el),
      open: isToggleOpen(s.el),
    }));
    const strays = strayOpenToggles(scan, filter, null);
    for (const el of strays) setToggleOpen(el, false);
    expect(isToggleOpen(yellow)).toBe(false);
  });

  it("every colour filter admits exactly its own colour, on real markup", () => {
    for (const filter of [["red"], ["yellow"], ["green"]] as RecallColor[][]) {
      const fresh = mount(NOTE);
      const maps = measure(fresh, filter);
      for (const stop of maps.scan) {
        const res = park(stop, maps, filter);
        if (res.el) setToggleOpen(res.el, true);
      }
      const opened = Array.from(fresh.querySelectorAll<HTMLElement>(".callout"))
        .filter((el) => isToggleOpen(el))
        .map(colorOfEl);
      expect(new Set(opened)).toEqual(new Set(filter));
      expect(opened.length).toBeGreaterThan(0);
    }
  });

  it("no filter = every toggle is fair game", () => {
    const maps = measure(root, []);
    for (const stop of maps.scan) {
      const res = park(stop, maps, []);
      if (res.el) setToggleOpen(res.el, true);
    }
    const opened = Array.from(root.querySelectorAll<HTMLElement>(".callout")).filter((el) =>
      isToggleOpen(el)
    );
    expect(opened.length).toBe(4);
  });
});
