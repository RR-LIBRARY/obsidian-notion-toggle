/**
 * v1.5.0 — "Odd toggles (1, 3, 5 …)" must mean the note's own toggle numbers.
 *
 * Before this, a filtered run renumbered the survivors 1..N, so with a red
 * filter "odd" pointed at red #1, #3, #5 — positions the reader could not see
 * anywhere in the note. `scanToggleEls` pairs each surviving toggle with its
 * note-wide ordinal, which is what the pause-at plan now consumes.
 */
import { describe, expect, it } from "bun:test";
import { Window } from "happy-dom";
import { kindOf, matchesFilter, type RecallColor } from "../src/autoscroll";
import { noteToggleCount, scanToggleEls, toggleIdentity, toggleTypeOf } from "../src/toggle-dom";
import { buildModeStops, orderModeStops } from "../src/scrollmode";

const NOTE = `
  <div class="callout" data-callout="recall-red"><div class="callout-title">1</div></div>
  <div class="callout" data-callout="recall-green"><div class="callout-title">2</div></div>
  <div class="callout" data-callout="recall-red"><div class="callout-title">3</div></div>
  <div class="callout" data-callout="important"><div class="callout-title">4</div></div>
  <div class="callout" data-callout="recall-red"><div class="callout-title">5</div></div>
  <div class="callout" data-callout="recall-yellow"><div class="callout-title">6</div></div>
`;

const mount = (html: string): HTMLElement => {
  const win = new Window();
  const doc = win.document as unknown as Document;
  doc.body.innerHTML = `<div class="markdown-preview-view">${html}</div>`;
  return doc.querySelector(".markdown-preview-view") as unknown as HTMLElement;
};

const scanFiltered = (root: HTMLElement, filter: RecallColor[]) =>
  scanToggleEls(root, (el) =>
    filter.length === 0 ? true : matchesFilter(kindOf(toggleTypeOf(el)), filter)
  );

describe("note-wide toggle numbers (v1.5.0)", () => {
  it("unfiltered toggles are numbered 1..N in document order", () => {
    const root = mount(NOTE);
    expect(scanFiltered(root, []).map((s) => s.ordinal)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(noteToggleCount(root)).toBe(6);
  });

  it("a filtered run keeps the note's numbers instead of renumbering survivors", () => {
    const root = mount(NOTE);
    // reds sit at note positions 1, 3 and 5 — not 1, 2, 3.
    expect(scanFiltered(root, ["red"]).map((s) => s.ordinal)).toEqual([1, 3, 5]);
    expect(scanFiltered(root, ["important" as RecallColor]).map((s) => s.ordinal)).toEqual([4]);
  });

  it("'Odd toggles (1, 3, 5 …)' selects the note's odd toggles under a filter", () => {
    const root = mount(NOTE);
    const kept = scanFiltered(root, ["red"]);
    const items = kept.map((s, i) => ({ ordinal: s.ordinal, top: i * 100, height: 80 }));
    const stops = buildModeStops(items, { mode: "odd", picks: [], route: [], loop: false }, 600, false);
    // every red already sits on an odd note position, so all three stay.
    expect(stops.map((s) => s.ordinal)).toEqual([1, 3, 5]);
  });

  it("'Even toggles' under the same filter selects nothing rather than the wrong rows", () => {
    const root = mount(NOTE);
    const kept = scanFiltered(root, ["red"]);
    const items = kept.map((s, i) => ({ ordinal: s.ordinal, top: i * 100, height: 80 }));
    const stops = buildModeStops(items, { mode: "even", picks: [], route: [], loop: false }, 600, false);
    expect(stops).toEqual([]);
  });

  it("a custom list refers to note numbers, so '4' finds the !important toggle", () => {
    const root = mount(NOTE);
    const kept = scanFiltered(root, []);
    const items = kept.map((s, i) => ({ ordinal: s.ordinal, top: i * 100, height: 80 }));
    const cfg = { mode: "custom" as const, picks: [4], route: [], loop: false };
    const ordered = orderModeStops(buildModeStops(items, cfg, 600, false), cfg, false);
    expect(ordered.map((s) => s.ordinal)).toEqual([4]);
    const src = kept.find((s) => s.ordinal === 4)!;
    expect(kindOf(toggleTypeOf(src.el))).toBe("important");
  });

  it("keeps a question identity stable when its lazy DOM window changes", () => {
    const full = mount(NOTE);
    const original = scanFiltered(full, ["red"])[1]!;
    const partial = mount(NOTE.split("\n").slice(3).join("\n"));
    const replacement = scanFiltered(partial, ["red"])[0]!;
    expect(replacement.ordinal).not.toBe(original.ordinal);
    expect(toggleIdentity(replacement.el)).toBe(toggleIdentity(original.el));
    expect(replacement.identity).toBe(original.identity);
  });
});
