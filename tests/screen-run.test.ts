/**
 * v1.7.1 — screen stops as first-class run behaviour.
 *
 * Pins the rules behind the sheet's "Advance by", "Screen pause duration",
 * "Tall toggles screen-by-screen" and "Answers — open / close all" controls:
 *  - screens fill the gaps *between* toggle stops (no duplicate next to a toggle)
 *  - screen stops / continuation chunks use the screen dwell, never the toggle hold
 *  - a tall toggle stays open while its own chunks or inner screens are ahead
 *  - waitFor gives the forced full render time to catch up (and gives up honestly)
 *  - Open all / Close all copy says "N of M" whenever the note is partly rendered
 */
import { describe, expect, test } from "bun:test";
import {
  MAX_GAP_SCREEN_STOPS,
  SCREEN_KEY_PREFIX,
  answersNotice,
  answersNoticeIsImportant,
  gapScreenStops,
  isContinuationStop,
  keepOpenAtDwellEnd,
  screenPlanEntries,
  screenStopLabel,
  stopHoldMs,
  waitFor,
} from "../src/screen-run";
import { isScreenStop } from "../src/screen-stops";

const t = (top: number, key: string) => ({ top, key });

describe("gapScreenStops — Toggles + screens", () => {
  test("fills the lead-in, the gaps between toggles, and the tail", () => {
    // 700 px step, toggles at 1000 and 3000, note scrolls to 5000.
    const stops = gapScreenStops([t(1000, "a"), t(3000, "b")], 700, 5000, 60);
    const tops = stops.map((s) => s.top);
    // lead-in: 700 (1400 is within 60 px? no — 1400 > 1000, segment ends at 1000)
    expect(tops).toEqual([700, 1700, 2400, 3700, 4400, 5000]);
    // every page ordinal is negative → recognised as a screen stop everywhere
    expect(stops.every((s) => isScreenStop(s.page))).toBe(true);
    expect(stops.map((s) => s.page)).toEqual([-1, -2, -3, -4, -5, -6]);
  });

  test("never plants a screen stop on top of a toggle stop", () => {
    const stops = gapScreenStops([t(700, "a"), t(1400, "b")], 700, 2100, 60);
    // 700 and 1400 are toggle tops — no screen stop may sit within tolerance of them
    for (const s of stops) {
      expect(Math.abs(s.top - 700) > 60).toBe(true);
      expect(Math.abs(s.top - 1400) > 60).toBe(true);
    }
    expect(stops.map((s) => s.top)).toEqual([2100]);
  });

  test("keys are anchored to the previous toggle so a re-measure keeps the visited set", () => {
    const before = gapScreenStops([t(1000, "q1"), t(3000, "q2")], 700, 5000, 60);
    // everything shifts 12 px after an image loads
    const after = gapScreenStops([t(1012, "q1"), t(3012, "q2")], 700, 5012, 60);
    expect(after.map((s) => s.key)).toEqual(before.map((s) => s.key));
    expect(before[0].key).toBe(`${SCREEN_KEY_PREFIX}^:1`);
    expect(before[1].key).toBe(`${SCREEN_KEY_PREFIX}q1:1`);
    expect(before.at(-1)!.key).toBe(`${SCREEN_KEY_PREFIX}q2:end`);
  });

  test("a note shorter than one screen yields no screen stops", () => {
    expect(gapScreenStops([], 900, 0, 60)).toEqual([]);
    expect(gapScreenStops([t(100, "a")], 900, 400, 60)).toEqual([{
      page: -1, top: 400, height: 900, index: 0, key: `${SCREEN_KEY_PREFIX}a:end`, identity: `${SCREEN_KEY_PREFIX}a:end`,
    }]);
  });

  test("a broken step (≤ tolerance) or an unmeasured note plans nothing instead of thousands of stops", () => {
    expect(gapScreenStops([], 10, 100000, 60)).toEqual([]);
    expect(gapScreenStops([], 0, 5000, 0)).toEqual([]);
    expect(gapScreenStops([], 1, 10_000_000, 0).length).toBe(MAX_GAP_SCREEN_STOPS);
  });

  test("ignores toggle stops with a NaN top and de-duplicates stacked toggles", () => {
    const stops = gapScreenStops([t(NaN, "x"), t(1000, "a"), t(1010, "a2")], 700, 2000, 60);
    expect(stops.map((s) => s.top)).toEqual([700, 1700, 2000]);
  });

  test("screen height defaults to the step and can be given explicitly", () => {
    expect(gapScreenStops([], 700, 1400, 60)[0].height).toBe(700);
    expect(gapScreenStops([], 700, 1400, 60, 820)[0].height).toBe(820);
  });

  test("screenPlanEntries turns tops into negative-ordinal plan rows", () => {
    expect(screenPlanEntries([100, 900])).toEqual([
      { top: 100, ordinal: -1 },
      { top: 900, ordinal: -2 },
    ]);
  });
});

describe("stopHoldMs — which dwell a stop gets", () => {
  test("a toggle's first stop holds for the toggle hold", () => {
    expect(stopHoldMs({ page: 3, index: 0 }, 4, 22_250)).toBe(4000);
  });
  test("a continuation chunk of a tall toggle holds for the screen dwell", () => {
    expect(stopHoldMs({ page: 3, index: 1 }, 4, 22_250)).toBe(22_250);
    expect(isContinuationStop({ page: 3, index: 1 })).toBe(true);
    expect(isContinuationStop({ page: 3, index: 0 })).toBe(false);
  });
  test("a screen stop holds for the screen dwell — never zero, never the toggle hold", () => {
    expect(stopHoldMs({ page: -1, index: 0 }, 4, 22_250)).toBe(22_250);
    expect(stopHoldMs({ page: -7, index: 0 }, 4, 1000)).toBe(1000);
    expect(isContinuationStop({ page: -7, index: 0 })).toBe(false);
  });
  test("negative or NaN inputs clamp to 0 rather than exploding", () => {
    expect(stopHoldMs({ page: 1, index: 0 }, -3, 500)).toBe(0);
    expect(stopHoldMs({ page: -1, index: 0 }, 4, -500)).toBe(0);
  });
  test("screenStopLabel is human-readable for the debug overlay", () => {
    expect(screenStopLabel({ key: `${SCREEN_KEY_PREFIX}q1:2`, top: 1700.4 }, 22_250)).toBe("screen stop q1:2 @ 1700 · 22.3s");
  });
});

describe("keepOpenAtDwellEnd — Close them when leaving", () => {
  const targets = [
    { page: 1, top: 1000, index: 0, key: "t1:0", identity: "q1" },
    { page: 1, top: 1700, index: 1, key: "t1:1", identity: "q1" },
    { page: 1, top: 2400, index: 2, key: "t1:2", identity: "q1" },
    { page: -1, top: 2000, index: 0, key: "screen:q1:1", identity: "screen:q1:1" },
    { page: 2, top: 3000, index: 0, key: "t2:0", identity: "q2" },
  ];
  const open = { identity: "q1", page: 1, top: 1000, height: 1800 };

  test("keeps a tall toggle open while its own chunks are ahead", () => {
    expect(keepOpenAtDwellEnd(targets, new Set(["t1:0"]), open, 1000, 1)).toBe(true);
  });
  test("keeps it open while a screen stop inside the answer is ahead", () => {
    const visited = new Set(["t1:0", "t1:1", "t1:2"]);
    expect(keepOpenAtDwellEnd(targets, visited, open, 1700, 1)).toBe(true);
  });
  test("lets it close once everything inside the answer was read", () => {
    const visited = new Set(["t1:0", "t1:1", "t1:2", "screen:q1:1"]);
    expect(keepOpenAtDwellEnd(targets, visited, open, 2400, 1)).toBe(false);
  });
  test("the next toggle's stop never keeps the previous one open", () => {
    const visited = new Set(["t1:0", "t1:1", "t1:2", "screen:q1:1"]);
    expect(keepOpenAtDwellEnd(targets, visited, open, 2400, 1)).toBe(false);
    // a screen stop *after* the answer does not count either
    const later = [...targets, { page: -2, top: 2900, index: 0, key: "screen:q1:2", identity: "screen:q1:2" }];
    expect(keepOpenAtDwellEnd(later, visited, open, 2400, 1)).toBe(false);
  });
  test("respects run direction when reading upwards", () => {
    // reverse direction: chunks at higher tops are *behind*, only lower ones count
    expect(keepOpenAtDwellEnd(targets, new Set(["t1:2"]), open, 2400, -1)).toBe(true); // t1:1 & t1:0 ahead
    expect(keepOpenAtDwellEnd(targets, new Set(["t1:2", "t1:1", "t1:0", "screen:q1:1"]), open, 1000, -1)).toBe(false);
  });
  test("falls back to the page ordinal when the box has no identity", () => {
    const noId = { page: 1, top: 1000, height: 1800 };
    expect(keepOpenAtDwellEnd(targets, new Set(["t1:0"]), noId, 1000, 1)).toBe(true);
    expect(keepOpenAtDwellEnd(targets, new Set(), null, 1000, 1)).toBe(false);
  });
});

describe("waitFor — let the forced full render catch up", () => {
  function fakeClock() {
    let now = 0;
    const queue: { at: number; fn: () => void }[] = [];
    return {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        queue.push({ at: now + ms, fn });
        return 0;
      },
      async run(untilMs: number) {
        while (queue.length && queue[0].at <= untilMs) {
          const next = queue.shift()!;
          now = next.at;
          next.fn();
          await Promise.resolve();
        }
        now = untilMs;
      },
    };
  }

  test("resolves true immediately when the DOM is already complete", async () => {
    expect(await waitFor(() => true)).toBe(true);
  });
  test("polls until ready and resolves true", async () => {
    const clock = fakeClock();
    let count = 3;
    const p = waitFor(() => ++count >= 6, { everyMs: 50, timeoutMs: 1000, setTimeout: clock.setTimeout, now: clock.now })
      .then((ok) => ({ ok, at: clock.now() }));
    await clock.run(1000);
    const done = await p;
    expect(done.ok).toBe(true);
    expect(done.at).toBe(100); // ready on the 3rd check → two 50 ms polls, not the full second
    expect(count).toBe(6);
  });
  test("gives up honestly after the timeout", async () => {
    const clock = fakeClock();
    const p = waitFor(() => false, { everyMs: 50, timeoutMs: 300, setTimeout: clock.setTimeout, now: clock.now });
    await clock.run(400);
    expect(await p).toBe(false);
  });
  test("a throwing predicate counts as not-ready instead of rejecting", async () => {
    const clock = fakeClock();
    const p = waitFor(() => { throw new Error("detached"); }, { everyMs: 10, timeoutMs: 30, setTimeout: clock.setTimeout, now: clock.now });
    await clock.run(50);
    expect(await p).toBe(false);
  });
});

describe("answersNotice — honest Open all / Close all copy", () => {
  test("no toggles", () => {
    expect(answersNotice(true, { changed: 0, rendered: 0, total: 0 })).toBe("No answer toggles in this note.");
    expect(answersNoticeIsImportant({ changed: 0, rendered: 0, total: 0 })).toBe(true);
  });
  test("partial render says N of M and asks to scroll", () => {
    const r = { changed: 12, rendered: 12, total: 73 };
    expect(answersNotice(true, r)).toBe("Opened 12 of 73 answers — the rest will open as you scroll.");
    expect(answersNoticeIsImportant(r)).toBe(true);
  });
  test("complete render: plain counts, quiet-mode friendly", () => {
    expect(answersNotice(true, { changed: 73, rendered: 73, total: 73 })).toBe("Opened 73 of 73 answers.");
    expect(answersNotice(false, { changed: 1, rendered: 1, total: 1 })).toBe("Closed 1 answer.");
    expect(answersNotice(false, { changed: 70, rendered: 73, total: 73 })).toBe("Closed 73 of 73 answers.");
    expect(answersNotice(true, { changed: 0, rendered: 73, total: 73 })).toBe("All 73 answers already open.");
    expect(answersNoticeIsImportant({ changed: 0, rendered: 73, total: 73 })).toBe(false);
  });
  test("unknown source total (0) never claims something is missing", () => {
    expect(answersNotice(true, { changed: 5, rendered: 5, total: 0 })).toBe("Opened 5 of 5 answers.");
    expect(answersNoticeIsImportant({ changed: 5, rendered: 5, total: 0 })).toBe(false);
  });
});
