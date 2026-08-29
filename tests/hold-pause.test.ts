import { describe, expect, test } from "bun:test";
import {
  HOLD_MOVE_TOLERANCE_PX,
  HOLD_PAUSE_MS,
  isIgnoredHoldTarget,
  movedTooFar,
} from "../src/hold-pause";
import { FAB_AUTO_HIDE_MS } from "../src/scroll-fab";

describe("hold-to-pause helpers", () => {
  test("default timings match the plan", () => {
    expect(HOLD_PAUSE_MS).toBe(250);
    expect(HOLD_MOVE_TOLERANCE_PX).toBe(12);
    expect(FAB_AUTO_HIDE_MS).toBe(3000);
  });

  test("small jitter still counts as a hold, real scrolling does not", () => {
    expect(movedTooFar(3, -4)).toBe(false);
    expect(movedTooFar(0, 40)).toBe(true);
    expect(movedTooFar(20, 0)).toBe(true);
  });

  test("presses on controls are ignored", () => {
    // No DOM in this runner — emulate Element.closest().
    const fake = (matchSel: string | null) =>
      ({ closest: (sel: string) => (matchSel && sel.includes(matchSel.split(",")[0]) ? {} : null) }) as unknown as EventTarget;
    expect(isIgnoredHoldTarget(fake(".ntt-fab-wrap"))).toBe(true);
    expect(isIgnoredHoldTarget(fake(null))).toBe(false);
    expect(isIgnoredHoldTarget(null)).toBe(false);
    expect(isIgnoredHoldTarget({} as EventTarget)).toBe(false);
  });
});
