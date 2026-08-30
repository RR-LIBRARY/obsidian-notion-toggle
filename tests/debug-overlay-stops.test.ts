/**
 * v1.4.9 — the debug overlay's stop / anchor / skip read-out.
 *
 * These are the lines a reader looks at on the phone when a toggle "gets
 * skipped": which stop index the loop is on, where that stop is anchored, the
 * orientation the anchor maths ran against, and how many stops were recovered.
 */
import { describe, expect, test } from "bun:test";
import {
  anchorFrame,
  debugLines,
  orientationFrame,
  skipFrame,
  type DebugFrame,
} from "../src/debug-overlay";
import { anchorScrollTop } from "../src/scroll-anchor";
import { STOP_ANCHORS, type StopAnchor } from "../src/autoscroll";

const base = (extra: Partial<DebugFrame> = {}): DebugFrame => ({
  pos: 1200,
  scrollTop: 1200,
  max: 5000,
  speed: 60,
  dir: 1,
  mode: "all",
  routeMode: false,
  target: null,
  routeIdx: 0,
  routeLen: 0,
  routeStop: 0,
  routeStops: 1,
  stops: 23,
  at: 6,
  dwellKey: "7:0",
  dwellLeft: 0,
  lastEvent: "",
  lastGrade: "",
  progress: "",
  ...extra,
});

const text = (f: DebugFrame) => debugLines(f).join("\n");

describe("stop index line", () => {
  test("reports nth/total, key and visited count", () => {
    const out = text(
      base(skipFrame({ stopKey: "7:0", visited: 6, pending: 17, skipped: 0, lastSkips: [] }))
    );
    expect(out).toContain("stop 7/23");
    expect(out).toContain("key 7:0");
    expect(out).toContain("visited 6");
    expect(out).toContain("pending 17");
  });

  test("omits the stop/anchor/skip block entirely when no data is supplied", () => {
    const out = text(base());
    expect(out).not.toContain("stop 7/23");
    expect(out).not.toContain("anchor");
    expect(out).not.toContain("orientation");
    expect(out).not.toContain("skips");
    expect(out).not.toContain("undefined");
  });
});

describe("anchor line", () => {
  const container = { clientHeight: 2000, scrollHeight: 20000 };

  for (const anchor of Object.keys(STOP_ANCHORS) as StopAnchor[]) {
    test(`reports the same offset the loop uses for anchor "${anchor}"`, () => {
      const stopTop = 5000;
      const anchorTop = anchorScrollTop(container, stopTop, 300, anchor);
      const out = text(base(anchorFrame({ anchor, anchorTop, stopTop })));
      expect(out).toContain(`anchor ${anchor} → top ${anchorTop}`);
      expect(out).toContain(`offset ${stopTop - anchorTop} from toggle top`);
    });
  }

  test("shows a dash when there is no current stop", () => {
    const out = text(base(anchorFrame({ anchor: "middle", anchorTop: null, stopTop: null })));
    expect(out).toContain("anchor middle → top —");
    expect(out).not.toContain("offset");
  });
});

describe("orientation line", () => {
  test("portrait when the container is taller than wide", () => {
    const out = text(base(orientationFrame({ width: 1080, height: 2160, layoutSig: "a1" })));
    expect(out).toContain("orientation portrait · 1080x2160");
    expect(out).toContain("layout a1");
  });

  test("landscape when the container is wider than tall", () => {
    const out = text(base(orientationFrame({ width: 2160, height: 1080 })));
    expect(out).toContain("orientation landscape · 2160x1080");
  });

  test("same anchor maths on both orientations — only the offset differs", () => {
    const portrait = anchorScrollTop({ clientHeight: 2160, scrollHeight: 20000 }, 5000, 300, "middle");
    const landscape = anchorScrollTop({ clientHeight: 1080, scrollHeight: 20000 }, 5000, 300, "middle");
    expect(portrait).toBeLessThan(landscape);
    for (const [w, h, label] of [
      [1080, 2160, "portrait"],
      [2160, 1080, "landscape"],
    ] as const) {
      expect(text(base(orientationFrame({ width: w, height: h })))).toContain(
        `orientation ${label}`
      );
    }
  });
});

describe("skip line", () => {
  test("counts recovered stops and names the last few", () => {
    const out = text(
      base(
        skipFrame({
          stopKey: "9:0",
          visited: 8,
          pending: 0,
          skipped: 2,
          lastSkips: ["5:0", "6:0", "7:0", "8:0"],
        })
      )
    );
    expect(out).toContain("skips 2 recovered");
    expect(out).toContain("6:0, 7:0, 8:0");
    expect(out).not.toContain("5:0");
  });

  test("warns while stops are still unvisited after a recovery", () => {
    const out = text(
      base(skipFrame({ stopKey: "3:0", visited: 3, pending: 4, skipped: 1, lastSkips: ["3:0"] }))
    );
    expect(out).toContain("⚠ 4 stop(s) still unvisited on this leg");
  });

  test("no warning when nothing was skipped", () => {
    const out = text(
      base(skipFrame({ stopKey: "3:0", visited: 3, pending: 4, skipped: 0, lastSkips: [] }))
    );
    expect(out).not.toContain("still unvisited");
  });
});

describe("reverse mode", () => {
  test("adds the reverse line with the wrap fallback", () => {
    const out = text(
      base({
        dir: -1,
        ...skipFrame({
          stopKey: "4:0",
          visited: 2,
          pending: 5,
          skipped: 0,
          lastSkips: [],
          reverseWrap: 22,
        }),
      })
    );
    expect(out).toContain("dir up ↑");
    expect(out).toContain("reverse ↑ · dwell guard scoped to up-leg");
    expect(out).toContain("wraps to stop 22");
  });

  test("forward runs never print the reverse line", () => {
    const out = text(base(skipFrame({ stopKey: "1:0", visited: 1, pending: 1, skipped: 0, lastSkips: [] })));
    expect(out).not.toContain("reverse ↑");
  });
});
