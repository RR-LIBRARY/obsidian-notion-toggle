import { describe, it, expect } from "bun:test";
import { isTapOnToggle } from "../src/clean-toggles-view";
const d = { x: 100, y: 100, t: 1000 };
describe("isTapOnToggle", () => {
  it("clean tap flips", () => expect(isTapOnToggle(d, 104, 103, 1150, 0)).toBe(true));
  it("finger jitter up to 12px still a tap", () => expect(isTapOnToggle(d, 108, 108, 1200, 0)).toBe(true));
  it("swipe is not a tap", () => expect(isTapOnToggle(d, 130, 100, 1200, 0)).toBe(false));
  it("long hold is not a tap", () => expect(isTapOnToggle(d, 100, 100, 1700, 0)).toBe(false));
  it("right after a drag is not a tap", () => expect(isTapOnToggle(d, 100, 100, 1200, 1000)).toBe(false));
});
