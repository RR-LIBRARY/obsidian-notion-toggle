import { describe, expect, it } from "bun:test";
import { debugLines, type DebugFrame } from "../src/debug-overlay";
import { orderExplainer, rowLabel, weakRows } from "../src/stats-panel";
import { newCard, reviewCard, type PageCard } from "../src/reader/fsrsScheduler";

const frame = (over: Partial<DebugFrame> = {}): DebugFrame => ({
  pos: 120.4,
  scrollTop: 120,
  max: 2000,
  speed: 1.2,
  dir: 1,
  mode: "all",
  routeMode: false,
  target: null,
  routeIdx: 0,
  routeLen: 0,
  routeStop: 0,
  routeStops: 1,
  stops: 12,
  at: 3,
  dwellKey: null,
  dwellLeft: 0,
  lastEvent: "",
  lastGrade: "",
  progress: "progress 4/12",
  ...over,
});

describe("debug overlay", () => {
  it("prints float position, sub-pixel remainder and direction", () => {
    const lines = debugLines(frame());
    expect(lines[0]).toBe("pos 120.40 → top 120 / 2000");
    expect(lines[1]).toContain("down ↓");
    expect(lines[1]).toContain("frac 0.40");
  });

  it("reports the route leg and its waypoint in route mode", () => {
    const lines = debugLines(
      frame({ routeMode: true, mode: "route", routeIdx: 1, routeLen: 3, target: 880, routeStops: 2, routeStop: 1 })
    );
    expect(lines.some((l) => l === "leg 2/3 → target 880 · screen 2/2")).toBe(true);
  });

  it("shows the dwell guard key and the pause countdown", () => {
    const lines = debugLines(frame({ dwellKey: "3:1", dwellLeft: 2500 }));
    expect(lines.some((l) => l === "dwellKey 3:1 · paused 2.5s")).toBe(true);
    expect(debugLines(frame()).some((l) => l.includes("running"))).toBe(true);
  });

  it("surfaces the last loop event and grade", () => {
    const lines = debugLines(frame({ lastEvent: "crossedTarget 3:1 @ 880", lastGrade: "toggle 3 · 6.2s → Good (3)" }));
    expect(lines).toContain("event crossedTarget 3:1 @ 880");
    expect(lines).toContain("grade toggle 3 · 6.2s → Good (3)");
  });
});

describe("weak toggle stats", () => {
  const now = Date.UTC(2026, 7, 29);
  const seen = (page: number, grade: 1 | 2 | 3 | 4, daysAgo: number): PageCard => {
    let card = reviewCard(newCard(page), grade, now - daysAgo * 86_400_000);
    if (grade === 1) card = reviewCard(card, 1, now - daysAgo * 86_400_000 + 1000);
    return card;
  };

  it("orders weakest recall first and keeps new toggles in the queue", () => {
    const cards = [seen(1, 4, 0), seen(2, 1, 3), newCard(3)];
    const rows = weakRows(cards, 3, now);
    expect(rows[0].ordinal === 2 || rows[0].ordinal === 3).toBe(true);
    expect(rows[rows.length - 1].ordinal).toBe(1);
    expect(rows.find((r) => r.ordinal === 3)?.fresh).toBe(true);
  });

  it("explains why each toggle sits where it does", () => {
    const rows = weakRows([newCard(1), seen(2, 1, 5)], 2, now);
    expect(rows.find((r) => r.ordinal === 1)?.why).toContain("never revised");
    expect(rows.find((r) => r.ordinal === 2)?.why.length).toBeGreaterThan(0);
  });

  it("honours the shuffle range and the row limit", () => {
    const cards = [1, 2, 3, 4, 5].map((p) => seen(p, 3, p));
    expect(weakRows(cards, 5, now, { from: 2, to: 4 }).map((r) => r.ordinal).sort()).toEqual([2, 3, 4]);
    expect(weakRows(cards, 5, now, { limit: 2 })).toHaveLength(2);
  });

  it("labels a row compactly and summarises the order", () => {
    const rows = weakRows([seen(7, 1, 9)], 7, now);
    expect(rowLabel(rows[0])).toContain("#7");
    expect(orderExplainer(rows)).toContain("#7");
    expect(orderExplainer([])).toContain("No revision history");
  });
});
