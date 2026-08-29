/**
 * v1.3.2 — regression cover for the "question skipped" bug.
 *
 * Obsidian's reading view re-renders sections while the quiz scrolls, so the
 * element captured at quiz start can be detached when its answer is due.
 * Revealing on the detached node did nothing and the reader saw Q21 → Q23.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { beforeEach, describe, expect, it } from "bun:test";
import { healQuizEls, needsHeal, revealLanded } from "../src/quiz-heal";
import { collectToggleEls, toggleTitleOf } from "../src/toggle-dom";
import { setQuizVisible } from "../src/quiz-visibility";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

const callout = (id: string, title: string, collapsed = true) => `
  <div class="callout${collapsed ? " is-collapsed" : ""}" data-callout="question" id="${id}">
    <div class="callout-title"><div class="callout-title-inner">${title}</div></div>
    <div class="callout-content">Answer ${title}</div>
  </div>`;

function render(titles: string[], prefix = "a"): HTMLElement {
  document.body.innerHTML = `<div class="markdown-preview-view" id="note">
    ${titles.map((t, i) => callout(`${prefix}${i}`, t)).join("")}
  </div>`;
  return document.getElementById("note") as HTMLElement;
}

const TITLES = ["Q20. First", "Q21. Second", "Q22. Third", "Q23. Fourth"];

describe("needsHeal", () => {
  beforeEach(() => render(TITLES));

  it("is false while every captured element is still in the document", () => {
    expect(needsHeal(collectToggleEls(document.body))).toBe(false);
  });

  it("is true when an element was detached by a re-render", () => {
    const els = collectToggleEls(document.body);
    els[2].remove();
    expect(needsHeal(els)).toBe(true);
  });

  it("is true when a question never resolved to an element", () => {
    expect(needsHeal([document.getElementById("a0") as HTMLElement, undefined])).toBe(true);
  });
});

describe("healQuizEls", () => {
  it("re-maps positionally when the note re-rendered with the same count", () => {
    const root = render(TITLES);
    const captured = collectToggleEls(root);
    // Whole section replaced by Obsidian: same markup, brand new nodes.
    const fresh = collectToggleEls(render(TITLES, "b"));
    const healed = healQuizEls(captured, TITLES, fresh, toggleTitleOf);
    expect(healed.map((el) => el?.id)).toEqual(["b0", "b1", "b2", "b3"]);
    expect(needsHeal(healed)).toBe(false);
  });

  it("keeps live elements and only replaces the detached one", () => {
    const root = render(TITLES);
    const captured = collectToggleEls(root);
    const gone = captured[2];
    gone.remove();
    root.insertAdjacentHTML("beforeend", callout("fixed", "Q22. Third"));
    const fresh = collectToggleEls(root);
    const healed = healQuizEls(captured, TITLES, fresh, toggleTitleOf);
    expect(healed[0]).toBe(captured[0]);
    expect(healed[1]).toBe(captured[1]);
    expect(healed[2]?.id).toBe("fixed");
    expect(healed[3]).toBe(captured[3]);
  });

  it("matches on title when the fresh count differs (partial render)", () => {
    const root = render(TITLES);
    const captured = collectToggleEls(root);
    captured[2].remove();
    // Only two questions are mounted right now, Q22 among them.
    document.body.innerHTML = "";
    const partial = render(["Q22. Third", "Q23. Fourth"], "p");
    const fresh = collectToggleEls(partial);
    const healed = healQuizEls(captured, TITLES, fresh, toggleTitleOf);
    expect(healed[2]?.id).toBe("p0");
    expect(healed[3]?.id).toBe("p1");
  });

  it("never maps two questions onto the same fresh element", () => {
    const root = render(TITLES);
    const captured = collectToggleEls(root);
    captured[1].remove();
    captured[2].remove();
    const partial = render(["Q21. Second"], "s");
    const fresh = collectToggleEls(partial);
    const healed = healQuizEls(captured, TITLES, fresh, toggleTitleOf);
    expect(healed[1]?.id).toBe("s0");
    expect(healed[2]).toBe(captured[2]); // unresolved, not a duplicate of s0
  });
});

describe("revealLanded", () => {
  beforeEach(() => render(TITLES));

  it("reports false for a detached element (the skip signature)", () => {
    const el = document.getElementById("a1") as HTMLElement;
    el.remove();
    setQuizVisible(el, true);
    expect(revealLanded(el)).toBe(false);
  });

  it("reports true once the answer is shown on a live element", () => {
    const el = document.getElementById("a1") as HTMLElement;
    setQuizVisible(el, true);
    expect(revealLanded(el)).toBe(true);
  });

  it("reports false when the re-rendered callout has no content node yet", () => {
    const el = document.getElementById("a1") as HTMLElement;
    el.querySelector(".callout-content")?.remove();
    setQuizVisible(el, true);
    expect(revealLanded(el)).toBe(false);
  });

  it("<details> reports its native open state", () => {
    document.body.innerHTML = `<details id="d"><summary>Q</summary><p>A</p></details>`;
    const el = document.getElementById("d") as HTMLElement;
    expect(revealLanded(el)).toBe(false);
    setQuizVisible(el, true);
    expect(revealLanded(el)).toBe(true);
  });
});

describe("end-to-end: re-rendered question is no longer skipped", () => {
  it("Q22 reveals after its section was replaced mid-run", () => {
    const root = render(TITLES);
    let stops = collectToggleEls(root) as (HTMLElement | undefined)[];
    // Run reaches Q21, then Obsidian re-renders the whole section.
    const fresh = collectToggleEls(render(TITLES, "r"));
    // Old path: reveal on the captured (now detached) node.
    setQuizVisible(stops[2] as HTMLElement, true);
    expect(revealLanded(stops[2] as HTMLElement)).toBe(false);
    // New path: heal, then reveal.
    stops = healQuizEls(stops, TITLES, fresh, toggleTitleOf);
    setQuizVisible(stops[2] as HTMLElement, true);
    expect(revealLanded(stops[2] as HTMLElement)).toBe(true);
    expect((stops[2] as HTMLElement).id).toBe("r2");
  });
});
