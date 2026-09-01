/**
 * v1.6.2 — the park/dwell decisions the frame loop used to make inline.
 *
 * These are the exact rules behind the audit's two HIGH engine findings:
 * a refused park must never hold the run, and the active identity must never
 * be a synthetic ordinal string.
 */
import { describe, expect, test } from "bun:test";
import { dwellPlan, isRefusedPark, nextActiveIdentity, skipEventLabel } from "../src/run-step";
import { resolveParkTarget } from "../src/filter-guard";
import type { RecallColor } from "../src/autoscroll";

const el = (color: RecallColor, connected = true) =>
  ({ color, isConnected: connected }) as unknown as HTMLElement;
const colorOf = (e: HTMLElement) => (e as unknown as { color: RecallColor }).color;

describe("refused parks (v1.6.2)", () => {
  test("every no-element reason is a refusal, including missing", () => {
    expect(isRefusedPark("missing")).toBe(true);
    expect(isRefusedPark("detached")).toBe(true);
    expect(isRefusedPark("filtered-out")).toBe(true);
  });

  test("a resolved park is not a refusal", () => {
    expect(isRefusedPark("identity")).toBe(false);
    expect(isRefusedPark("ordinal")).toBe(false);
  });

  test("a vanished stop never holds the run (the frozen-run bug)", () => {
    const res = resolveParkTarget({
      identity: "gone",
      ordinal: 7,
      byIdentity: new Map(),
      byOrdinal: new Map(),
      filter: ["red"],
      colorOf,
    });
    expect(res.reason).toBe("missing");
    const plan = dwellPlan(1_000, 4_000, 5_000, !isRefusedPark(res.reason));
    expect(plan).toEqual({ dwellUntil: 0, thinkMs: 0 });
  });

  test("a real red stop under a red filter holds hold + think", () => {
    const target = el("red");
    const res = resolveParkTarget({
      identity: "red:q1",
      ordinal: 1,
      byIdentity: new Map([["red:q1", target]]),
      byOrdinal: new Map([[1, target]]),
      filter: ["red"],
      colorOf,
    });
    expect(res.el).toBe(target);
    expect(dwellPlan(1_000, 4_000, 5_000, true)).toEqual({ dwellUntil: 10_000, thinkMs: 5_000 });
  });

  test("a yellow toggle resolved by drifted ordinal under a red filter is refused", () => {
    const yellow = el("yellow");
    const res = resolveParkTarget({
      identity: "red:q1",
      ordinal: 8,
      byIdentity: new Map(),
      byOrdinal: new Map([[8, yellow]]),
      filter: ["red"],
      colorOf,
    });
    expect(res.reason).toBe("filtered-out");
    expect(dwellPlan(0, 4_000, 5_000, false).dwellUntil).toBe(0);
  });

  test("bad numbers never produce a NaN deadline", () => {
    expect(dwellPlan(100, Number.NaN, Number.POSITIVE_INFINITY, true)).toEqual({
      dwellUntil: 100,
      thinkMs: 0,
    });
  });
});

describe("active identity (v1.6.2)", () => {
  test("a refused park clears the active identity", () => {
    expect(nextActiveIdentity("red:q1", false)).toBeNull();
  });

  test("a park with no identity stores null, never an ordinal string", () => {
    expect(nextActiveIdentity(undefined, true)).toBeNull();
    expect(nextActiveIdentity("", true)).toBeNull();
  });

  test("a real identity is kept verbatim", () => {
    expect(nextActiveIdentity("recall-red|Q1 What?", true)).toBe("recall-red|Q1 What?");
  });
});

describe("skip labels", () => {
  test("the reason reaches the debug overlay", () => {
    expect(skipEventLabel("crossedTarget 7", "missing")).toBe("crossedTarget 7 · skipped (missing)");
  });
});
