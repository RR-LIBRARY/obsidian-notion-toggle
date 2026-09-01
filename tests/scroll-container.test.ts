/**
 * v1.4.10 — regression cover for "autoscroll runs but nothing moves".
 *
 * The picker used to return any candidate as a last resort, so the loop wrote
 * `scrollTop` into a wrapper that ignores it. These tests pin both rules:
 * only a really-scrollable element wins, and mobile wrappers / the document
 * scroller are candidates too.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { beforeEach, describe, expect, it } from "bun:test";
import {
  MSG_NO_SCROLLER,
  SCROLL_STUCK_MS,
  canScroll,
  documentScrollCandidates,
  isScrollStuck,
  pickAnyContainer,
  pickScrollContainer,
  shouldWaitForScrollable,
  viewScrollCandidates,
} from "../src/scroll-container";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

/** happy-dom has no layout, so fake the two metrics the picker reads. */
function sizeOf(el: Element, scrollHeight: number, clientHeight: number): HTMLElement {
  Object.defineProperty(el, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  return el as HTMLElement;
}

const q = (sel: string) => document.querySelector(sel) as HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("canScroll", () => {
  it("is false for a wrapper whose content fits", () => {
    document.body.innerHTML = `<div id="w"></div>`;
    expect(canScroll(sizeOf(q("#w"), 500, 500))).toBe(false);
  });

  it("is true once content overflows by more than 2px", () => {
    document.body.innerHTML = `<div id="w"></div>`;
    expect(canScroll(sizeOf(q("#w"), 900, 500))).toBe(true);
  });

  it("is false for null", () => {
    expect(canScroll(null)).toBe(false);
  });
});

describe("viewScrollCandidates", () => {
  it("finds the reading-view scroller inside the preview container", () => {
    document.body.innerHTML = `<div id="root"><div class="markdown-preview-view" id="s"></div></div>`;
    const cands = viewScrollCandidates(q("#root"), q("#root"));
    expect(cands[0].id).toBe("s");
  });

  it("includes the live-preview scroller and the view element itself", () => {
    document.body.innerHTML = `<div id="content"><div class="cm-scroller" id="cm"></div></div>`;
    const ids = viewScrollCandidates(null, q("#content")).map((el) => el.id);
    expect(ids).toContain("cm");
    expect(ids).toContain("content");
  });

  it("includes the mobile wrappers Obsidian scrolls on phones", () => {
    document.body.innerHTML = `<div id="content">
      <div class="markdown-reading-view" id="mrv"></div>
      <div class="markdown-source-view" id="msv"></div>
      <div class="view-content" id="vc"></div>
    </div>`;
    const ids = viewScrollCandidates(null, q("#content")).map((el) => el.id);
    expect(ids).toContain("mrv");
    expect(ids).toContain("msv");
    expect(ids).toContain("vc");
  });

  it("never lists the same element twice", () => {
    document.body.innerHTML = `<div id="root" class="view-content"></div>`;
    const cands = viewScrollCandidates(q("#root"), q("#root"));
    expect(new Set(cands).size).toBe(cands.length);
  });
});

describe("documentScrollCandidates", () => {
  it("prefers the active leaf's scroller and still offers document scrollers", () => {
    document.body.innerHTML = `
      <div class="workspace-leaf"><div class="markdown-preview-view" id="bg"></div></div>
      <div class="workspace-leaf mod-active"><div class="markdown-preview-view" id="fg"></div></div>`;
    const cands = documentScrollCandidates(document);
    expect(cands[0].id).toBe("fg");
    expect(cands).toContain(document.documentElement as unknown as HTMLElement);
    expect(cands).toContain(document.body as unknown as HTMLElement);
    // background leaves are still reachable as later fallbacks
    expect(cands.map((el) => el.id)).toContain("bg");
  });
});

describe("pickScrollContainer", () => {
  it("skips a non-scrolling wrapper and returns the real scroller", () => {
    document.body.innerHTML = `<div id="wrap"><div id="inner"></div></div>`;
    const wrap = sizeOf(q("#wrap"), 500, 500);
    const inner = sizeOf(q("#inner"), 4000, 500);
    expect(pickScrollContainer([wrap, inner])).toBe(inner);
  });

  it("returns null when nothing can scroll (the old silent-run bug)", () => {
    document.body.innerHTML = `<div id="a"></div><div id="b"></div>`;
    expect(pickScrollContainer([sizeOf(q("#a"), 300, 300), sizeOf(q("#b"), 10, 10)])).toBeNull();
  });

  it("falls back to the document scroller when only it overflows", () => {
    document.body.innerHTML = `<div id="wrap"></div>`;
    const wrap = sizeOf(q("#wrap"), 400, 400);
    const doc = sizeOf(document.documentElement, 5000, 800);
    expect(pickScrollContainer([wrap, doc])).toBe(doc);
  });

  it("prefers a visible scroller over a hidden background one", () => {
    document.body.innerHTML = `<div id="bg"></div><div id="fg"></div>`;
    const bg = sizeOf(q("#bg"), 4000, 500);
    Object.defineProperty(bg, "offsetParent", { value: null, configurable: true });
    const fg = sizeOf(q("#fg"), 4000, 500);
    Object.defineProperty(fg, "offsetParent", { value: document.body, configurable: true });
    expect(pickScrollContainer([bg, fg])).toBe(fg);
  });
});

describe("pickAnyContainer", () => {
  it("still returns a wrapper for DOM scans when nothing scrolls", () => {
    document.body.innerHTML = `<div id="wrap"></div>`;
    const wrap = sizeOf(q("#wrap"), 300, 300);
    expect(pickAnyContainer([wrap])).toBe(wrap);
    expect(pickScrollContainer([wrap])).toBeNull();
  });

  it("prefers the scroller when one exists", () => {
    document.body.innerHTML = `<div id="wrap"></div><div id="s"></div>`;
    const wrap = sizeOf(q("#wrap"), 300, 300);
    const s = sizeOf(q("#s"), 3000, 300);
    expect(pickAnyContainer([wrap, s])).toBe(s);
  });
});

describe("stuck detection", () => {
  it("needs the full grace period before declaring a stall", () => {
    expect(isScrollStuck(1000, 1000 + SCROLL_STUCK_MS - 1)).toBe(false);
    expect(isScrollStuck(1000, 1000 + SCROLL_STUCK_MS)).toBe(true);
  });

  it("treats 0 as 'making progress'", () => {
    expect(isScrollStuck(0, 999999)).toBe(false);
  });

  it("has a message that tells the reader what to do", () => {
    expect(MSG_NO_SCROLLER).toContain("reading view");
    expect(MSG_NO_SCROLLER.length).toBeGreaterThan(30);
  });
});

describe("delayed mobile scrollability", () => {
  it("waits while a note with source toggles is still becoming scrollable", () => {
    expect(shouldWaitForScrollable(true, true, 0)).toBe(true);
    expect(shouldWaitForScrollable(true, true, 7)).toBe(true);
  });

  it("eventually reports a real non-scrollable view", () => {
    expect(shouldWaitForScrollable(true, true, 8)).toBe(false);
    expect(shouldWaitForScrollable(true, false, 0)).toBe(false);
    expect(shouldWaitForScrollable(false, true, 0)).toBe(false);
  });
});
