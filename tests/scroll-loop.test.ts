import { describe, expect, test } from "bun:test";
import {
  FAB_PROGRAMMATIC_WINDOW_MS,
  isProgrammaticScroll,
  markProgrammaticScroll,
} from "../src/scroll-fab";
import { advancePosition, frameFactor } from "../src/scrollmode";
import { clampSpeed } from "../src/autoscroll";

/**
 * v1.2.1 — the bug: we latched onto a wrapper element that cannot scroll, so
 * writing scrollTop did nothing and the page never moved. These tests pin both
 * halves of the fix: "pick a scrollable element" and "frames really advance".
 */

interface FakeEl {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

const scrollable = (el: FakeEl) => el.scrollHeight - el.clientHeight > 2;

function pickContainer(candidates: FakeEl[]): FakeEl | null {
  return candidates.find(scrollable) ?? candidates[0] ?? null;
}

describe("scroll container pick", () => {
  test("skips a wrapper that cannot scroll", () => {
    const wrapper: FakeEl = { scrollTop: 0, scrollHeight: 800, clientHeight: 800 };
    const scroller: FakeEl = { scrollTop: 0, scrollHeight: 5000, clientHeight: 800 };
    expect(pickContainer([wrapper, scroller])).toBe(scroller);
  });

  test("falls back to the first candidate when nothing scrolls yet", () => {
    const wrapper: FakeEl = { scrollTop: 0, scrollHeight: 800, clientHeight: 800 };
    expect(pickContainer([wrapper])).toBe(wrapper);
  });
});

describe("scroll loop advances", () => {
  test("60 px/s moves ~60px over one second of frames", () => {
    const el: FakeEl = { scrollTop: 0, scrollHeight: 10000, clientHeight: 800 };
    const max = el.scrollHeight - el.clientHeight;
    const perFrame = clampSpeed(60) / 60;
    let pos = 0;
    let last = 0;
    for (let i = 1; i <= 60; i++) {
      const ts = i * (1000 / 60);
      const dt = frameFactor(ts - last);
      last = ts;
      pos = advancePosition(pos, perFrame, dt, 1, max);
      el.scrollTop = Math.floor(pos);
    }
    expect(el.scrollTop).toBeGreaterThan(50);
    expect(el.scrollTop).toBeLessThan(70);
  });

  test("reverse walks back towards the top and clamps at 0", () => {
    const max = 4000;
    let pos = 30;
    for (let i = 0; i < 120; i++) pos = advancePosition(pos, 1, 1, -1, max);
    expect(pos).toBe(0);
  });
});

describe("programmatic scroll marker", () => {
  test("our own scroll writes do not count as user activity", () => {
    const now = 10_000;
    markProgrammaticScroll(now);
    expect(isProgrammaticScroll(now + 10)).toBe(true);
    expect(isProgrammaticScroll(now + FAB_PROGRAMMATIC_WINDOW_MS + 1)).toBe(false);
  });
});
