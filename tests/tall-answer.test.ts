import { describe, expect, it } from "bun:test";
import { anchorOffset } from "../src/autoscroll";
import { anchorScrollTop } from "../src/scroll-anchor";
import { buildModeStops } from "../src/scrollmode";

describe("tall answer reading", () => {
  const modes = ["toggles", "screens", "both"] as const;

  it("keeps a tall answer's question at the visible top on phone-sized screens", () => {
    for (const mode of modes) {
      const top = anchorScrollTop(
        { clientHeight: 640, scrollHeight: 5000 },
        1200,
        2400,
        "middle"
      );
      expect(top).toBe(1200);
      expect(mode).toMatch(/toggles|screens|both/);
    }
  });

  it("never centres a tall answer below the viewport", () => {
    expect(anchorOffset(900, 1800, 640, "middle", 4360)).toBe(900);
    expect(anchorOffset(900, 400, 640, "middle", 4360)).toBe(780);
  });

  it("creates every screen slice for a selected tall toggle", () => {
    const items = [{ ordinal: 1, top: 0, height: 2200 }];
    for (const mode of modes) {
      const stops = buildModeStops(items, {
        mode: "all",
        picks: [],
        route: [],
        loopRoute: false,
      }, 640, true);
      expect(stops.length).toBeGreaterThan(1);
      expect(stops.at(-1)?.top).toBeGreaterThan(0);
      expect(mode).toMatch(/toggles|screens|both/);
    }
  });
});
