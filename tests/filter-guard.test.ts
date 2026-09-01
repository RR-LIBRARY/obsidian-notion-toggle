/**
 * v1.6.1 — the colour-filter hard guard.
 *
 * These are the cases behind "🔴 filter lagaya, 🟡 bhi khul gaya": an identity
 * that resolves onto a replaced (detached) node, an ordinal that now points at
 * a different physical toggle, and a toggle the reader had already opened by
 * hand before the run started.
 */
import { describe, expect, it } from "bun:test";
import {
  colorAllowed,
  parkSkipLabel,
  resolveParkTarget,
  strayOpenToggles,
} from "../src/filter-guard";
import type { RecallColor } from "../src/autoscroll";

interface Fake {
  id: string;
  color: RecallColor;
  connected: boolean;
  open: boolean;
}

const fake = (id: string, color: RecallColor, extra: Partial<Fake> = {}): Fake => ({
  id,
  color,
  connected: true,
  open: false,
  ...extra,
});

const asEl = (f: Fake) => f as unknown as HTMLElement;
const colorOf = (el: HTMLElement) => (el as unknown as Fake).color;
const isConnected = (el: HTMLElement) => (el as unknown as Fake).connected;

const lookupFor = (
  stops: Fake[],
  filter: RecallColor[],
  identity?: string,
  ordinal = 1
) => ({
  identity,
  ordinal,
  byIdentity: new Map(stops.map((s, i) => [`id${i + 1}`, asEl(s)])),
  byOrdinal: new Map(stops.map((s, i) => [i + 1, asEl(s)])),
  filter,
  colorOf,
  isConnected,
});

describe("colorAllowed", () => {
  it("empty filter allows every colour", () => {
    for (const c of ["red", "yellow", "green", "other"] as RecallColor[]) {
      expect(colorAllowed(c, [])).toBe(true);
    }
  });
  it("only the picked colours pass", () => {
    expect(colorAllowed("red", ["red"])).toBe(true);
    expect(colorAllowed("yellow", ["red"])).toBe(false);
    expect(colorAllowed("yellow", ["red", "yellow"])).toBe(true);
  });
});

describe("resolveParkTarget — identity path", () => {
  it("opens the identity match when its live colour still passes", () => {
    const red = fake("q3", "red");
    const res = resolveParkTarget(lookupFor([red], ["red"], "id1", 1));
    expect(res.reason).toBe("identity");
    expect(res.el).toBe(asEl(red));
    expect(res.color).toBe("red");
  });

  it("refuses when the element's live colour is not in the filter (the reported bug)", () => {
    const yellow = fake("q8", "yellow");
    const res = resolveParkTarget(lookupFor([yellow], ["red"], "id1", 1));
    expect(res.el).toBeNull();
    expect(res.reason).toBe("filtered-out");
    expect(parkSkipLabel(res, 8)).toContain("skipped toggle 8");
  });

  it("refuses a detached node left behind by a lazy section replacement", () => {
    const stale = fake("q5", "red", { connected: false });
    const res = resolveParkTarget(lookupFor([stale], ["red"], "id1", 1));
    expect(res.el).toBeNull();
    expect(res.reason).toBe("detached");
    expect(parkSkipLabel(res, 5)).toContain("re-rendered");
  });
});

describe("resolveParkTarget — ordinal fallback after a mid-run shift", () => {
  it("does not open a yellow toggle that inherited the red toggle's ordinal", () => {
    // Lazy render replaced the section: ordinal 2 is now a yellow toggle.
    const red = fake("q2", "red");
    const yellow = fake("q8", "yellow");
    const res = resolveParkTarget({
      identity: "gone",
      ordinal: 2,
      byIdentity: new Map([["kept", asEl(red)]]),
      byOrdinal: new Map([[2, asEl(yellow)]]),
      filter: ["red"],
      colorOf,
      isConnected,
    });
    expect(res.el).toBeNull();
    expect(res.reason).toBe("filtered-out");
  });

  it("still uses the ordinal when the colour is right", () => {
    const red = fake("q4", "red");
    const res = resolveParkTarget({
      identity: undefined,
      ordinal: 4,
      byIdentity: new Map(),
      byOrdinal: new Map([[4, asEl(red)]]),
      filter: ["red"],
      colorOf,
      isConnected,
    });
    expect(res.reason).toBe("ordinal");
    expect(res.el).toBe(asEl(red));
  });

  it("misses cleanly when nothing resolves", () => {
    const res = resolveParkTarget({
      identity: "nope",
      ordinal: 9,
      byIdentity: new Map(),
      byOrdinal: new Map(),
      filter: ["red"],
      colorOf,
      isConnected,
    });
    expect(res.el).toBeNull();
    expect(res.reason).toBe("missing");
    expect(parkSkipLabel(res, 9)).toContain("not in the filtered plan");
  });

  it("duplicate titles cannot smuggle a wrong colour through", () => {
    const yellowTwin = fake("dup", "yellow");
    const res = resolveParkTarget({
      identity: "dup",
      ordinal: 3,
      byIdentity: new Map([["dup", asEl(yellowTwin)]]),
      byOrdinal: new Map([[3, asEl(yellowTwin)]]),
      filter: ["green"],
      colorOf,
      isConnected,
    });
    expect(res.el).toBeNull();
  });

  it("every single-colour filter only ever admits its own colour", () => {
    const note = [fake("a", "red"), fake("b", "yellow"), fake("c", "green"), fake("d", "other")];
    for (const filter of [["red"], ["yellow"], ["green"]] as RecallColor[][]) {
      const opened = note
        .map((f, i) => resolveParkTarget(lookupFor(note, filter, `id${i + 1}`, i + 1)))
        .filter((r) => r.el)
        .map((r) => r.color);
      expect(opened).toEqual(filter);
    }
  });
});

describe("strayOpenToggles", () => {
  const scan = (f: Fake[]) => f.map((x) => ({ el: asEl(x), color: x.color, open: x.open }));

  it("closes a hand-opened yellow answer during a red run", () => {
    const yellow = fake("q8", "yellow", { open: true });
    const red = fake("q2", "red", { open: true });
    const strays = strayOpenToggles(scan([red, yellow]), ["red"], asEl(red));
    expect(strays).toEqual([asEl(yellow)]);
  });

  it("never closes the toggle the run is parked on", () => {
    const red = fake("q2", "red", { open: true });
    expect(strayOpenToggles(scan([red]), ["red"], asEl(red))).toEqual([]);
  });

  it("leaves closed toggles alone", () => {
    const yellow = fake("q8", "yellow", { open: false });
    expect(strayOpenToggles(scan([yellow]), ["red"], null)).toEqual([]);
  });

  it("does nothing when no filter is active", () => {
    const yellow = fake("q8", "yellow", { open: true });
    expect(strayOpenToggles(scan([yellow]), [], null)).toEqual([]);
  });

  it("multi-colour filter keeps both picked colours open", () => {
    const red = fake("r", "red", { open: true });
    const yellow = fake("y", "yellow", { open: true });
    const green = fake("g", "green", { open: true });
    expect(strayOpenToggles(scan([red, yellow, green]), ["red", "yellow"], null)).toEqual([
      asEl(green),
    ]);
  });
});
