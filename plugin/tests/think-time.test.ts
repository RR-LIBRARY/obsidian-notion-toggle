/**
 * v1.5.9 — think time gate + screenshot-2 (pause-at panel) logic checks.
 *
 * Flow under test: question title → think window (answer hidden) → answer
 * released → hold. Plus the loop-wrap glitch and the pause-at panel numbers.
 */
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_THINK,
  THINK_BADGE_CLASS,
  THINK_HIDDEN_CLASS,
  THINK_SECONDS_MAX,
  THINK_SHOWN_CLASS,
  ThinkGate,
  clampThinkSeconds,
  parseThinkSeconds,
  isIconImage,
  thinkCountdownLabel,
  thinkMsFor,
  thinkSplit,
} from "../src/think-gate";
import {
  buildModeStops,
  inShuffleRange,
  matchesMode,
  orderModeStops,
  type ModeConfig,
} from "../src/scrollmode";

describe("think time — settings and per-toggle overrides", () => {
  it("clamps to 0s … 1h", () => {
    expect(clampThinkSeconds(-5)).toBe(0);
    expect(clampThinkSeconds(99999)).toBe(THINK_SECONDS_MAX);
    expect(clampThinkSeconds(Number.NaN)).toBe(DEFAULT_THINK.scrollThinkSeconds);
  });

  it("reads 🤔20 / ?30s / [think 2m] from the question title", () => {
    expect(parseThinkSeconds("Q1. Mendel 🤔20", 5)).toBe(20);
    expect(parseThinkSeconds("Q2. ratio ?30s", 5)).toBe(30);
    expect(parseThinkSeconds("Q3. alleles [think 2m]", 5)).toBe(120);
    expect(parseThinkSeconds("Q4. plain question", 7)).toBe(7);
  });

  it("is off entirely when the setting is off", () => {
    expect(thinkMsFor("Q 🤔20", { scrollThinkEnabled: false, scrollThinkSeconds: 5 })).toBe(0);
    expect(thinkMsFor("Q", { scrollThinkEnabled: true, scrollThinkSeconds: 5 })).toBe(5000);
  });

  it("adds the think window on top of the hold, never inside it", () => {
    expect(thinkSplit(4000, 5000)).toEqual({ thinkMs: 5000, holdMs: 4000, totalMs: 9000 });
    expect(thinkSplit(4000, 0)).toEqual({ thinkMs: 0, holdMs: 4000, totalMs: 4000 });
  });

  it("counts down in a readable chip", () => {
    expect(thinkCountdownLabel(4200)).toBe("🤔 5");
    expect(thinkCountdownLabel(0)).toBe("🤔 0");
    expect(thinkCountdownLabel(125000)).toBe("🤔 2m 5");
  });
});

/* ---------------------------------------------------------------- DOM gate */

interface FakeClassList {
  set: Set<string>;
  toggle(name: string, on: boolean): void;
  remove(...names: string[]): void;
  contains(name: string): boolean;
}

function classList(): FakeClassList {
  const set = new Set<string>();
  return {
    set,
    toggle: (name, on) => (on ? set.add(name) : set.delete(name)),
    remove: (...names) => names.forEach((n) => set.delete(n)),
    contains: (name) => set.has(name),
  };
}

/** Minimal callout: `.callout-title` row plus a class list. */
function fakeToggle(title: string) {
  const badges: { className: string; textContent: string; isConnected: boolean }[] = [];
  const row = {
    textContent: title,
    listeners: [] as ((ev: unknown) => void)[],
    appendChild(node: { className: string; textContent: string; isConnected: boolean }) {
      node.isConnected = true;
      badges.push(node);
    },
    addEventListener(_type: string, fn: (ev: unknown) => void) {
      row.listeners.push(fn);
    },
    removeEventListener(_type: string, fn: (ev: unknown) => void) {
      row.listeners = row.listeners.filter((l) => l !== fn);
    },
  };
  const el = {
    tagName: "DIV",
    classList: classList(),
    ownerDocument: {
      createElement: () => ({ className: "", textContent: "", isConnected: false, remove() {
        this.isConnected = false;
      } }),
    },
    querySelector: (sel: string) => (sel === ".callout-title" ? row : null),
    querySelectorAll: () => badges.filter((b) => b.isConnected),
    row,
    badges,
  };
  return el as unknown as HTMLElement & { row: typeof row; badges: typeof badges };
}

describe("ThinkGate — question first, answer later", () => {
  const s = { scrollThinkEnabled: true, scrollThinkSeconds: 5 };

  it("hides the answer for the think window and releases it after", () => {
    const gate = new ThinkGate();
    const el = fakeToggle("Q1. Law of Dominance?");
    const ms = gate.begin(el, s, 1000);
    expect(ms).toBe(5000);
    expect(el.classList.contains(THINK_HIDDEN_CLASS)).toBe(true);
    expect(gate.thinking).toBe(true);

    expect(gate.tick(3000)).toBe(false);
    expect(el.classList.contains(THINK_HIDDEN_CLASS)).toBe(true);

    expect(gate.tick(6000)).toBe(true);
    expect(el.classList.contains(THINK_HIDDEN_CLASS)).toBe(false);
    expect(el.classList.contains(THINK_SHOWN_CLASS)).toBe(true);
    expect(gate.thinking).toBe(false);
    // Released only once — the hold takes over from here.
    expect(gate.tick(7000)).toBe(false);
  });

  it("paints a countdown chip on the question title and removes it on reveal", () => {
    const gate = new ThinkGate();
    const el = fakeToggle("Q2. 🤔10 phenotypic ratio?");
    expect(gate.begin(el, s, 0)).toBe(10000);
    expect(el.badges.some((b) => b.className === THINK_BADGE_CLASS && b.isConnected)).toBe(true);
    gate.tick(10001);
    expect(el.badges.every((b) => !b.isConnected)).toBe(true);
  });

  it("a tap on the question reveals the answer immediately", () => {
    const gate = new ThinkGate();
    const el = fakeToggle("Q3. Incomplete dominance?");
    gate.begin(el, s, 0);
    el.row.listeners.forEach((fn) => fn({}));
    expect(gate.thinking).toBe(false);
    expect(el.classList.contains(THINK_SHOWN_CLASS)).toBe(true);
  });

  it("think time off = answer visible from the first frame", () => {
    const gate = new ThinkGate();
    const el = fakeToggle("Q4. plain");
    expect(gate.begin(el, { scrollThinkEnabled: false, scrollThinkSeconds: 5 }, 0)).toBe(0);
    expect(gate.thinking).toBe(false);
    expect(el.classList.contains(THINK_HIDDEN_CLASS)).toBe(false);
  });

  it("moving to the next toggle never leaves the old answer hidden", () => {
    const gate = new ThinkGate();
    const a = fakeToggle("Q5. first");
    const b = fakeToggle("Q6. second");
    gate.begin(a, s, 0);
    gate.begin(b, s, 100);
    expect(a.classList.contains(THINK_HIDDEN_CLASS)).toBe(false);
    expect(b.classList.contains(THINK_HIDDEN_CLASS)).toBe(true);
    gate.clear();
    expect(b.classList.contains(THINK_HIDDEN_CLASS)).toBe(false);
    expect(b.classList.contains(THINK_SHOWN_CLASS)).toBe(false);
  });

  it("reports the phase for the debug readout", () => {
    const gate = new ThinkGate();
    const el = fakeToggle("Q7. phase");
    gate.begin(el, s, 0);
    expect(gate.phaseLabel(2000)).toBe("think 3s");
    gate.revealNow();
    expect(gate.phaseLabel(2000)).toBe("answer");
  });
});

/* ------------------------------------------- main.ts wiring + loop glitch */

describe("run loop wiring (v1.5.9)", () => {
  const main = readFileSync("main.ts", "utf8");

  it("extends every stop's dwell by the think window", () => {
    // v1.6.2 — hold + think are now computed by the pure `dwellPlan` helper, so
    // a refused park can return a 0 deadline instead of holding an empty stop.
    const plans = main.match(/dwellPlan\(ts, [^)]+, this\.scrollThinkMs, parked\)/g) ?? [];
    expect(plans.length).toBe(2); // route waypoints + normal stops
  });


  it("ticks the gate while parked, and clears it when the stop ends", () => {
    // v1.6.1 — the same tick, now also stamping the timing log.
    expect(main).toMatch(/if \(this\.thinkGate\.tick\(ts\)\) \{[\s\S]{0,120}scrollBoxesAt = 0;/);
    expect(main).toMatch(/scrollDwellUntil = 0;[\s\S]{0,120}this\.thinkGate\.clear\(\)/);
  });

  it("adds the think + focus body classes on start and drops them on stop", () => {
    expect(main).toContain("document.body.classList.add(THINK_RUN_CLASS)");
    expect(main).toContain("classList.toggle(FOCUS_RUN_CLASS, this.settings.scrollFocusChrome)");
    expect(main).toContain("classList.remove(THINK_RUN_CLASS, FOCUS_RUN_CLASS, REDUCED_MOTION_CLASS)");
  });

  it("a loop wrap starts a clean lap (this was the loop-toggle glitch)", () => {
    const wrap = main.slice(main.indexOf("if (this.settings.scrollLoop) {"));
    const lap = wrap.slice(0, wrap.indexOf("} else {"));
    expect(lap).toContain("this.thinkGate.clear()");
    expect(lap).toContain("this.scrollDwellUntil = 0");
    expect(lap).toContain("this.resetDwell()");
    expect(lap).toContain("this.scrollBoxesAt = 0");
    expect(lap).toContain("this.scrollMovedPx = 0");
  });
});

/* ------------------------------------ screenshot 2: "pause at" panel logic */

const items = Array.from({ length: 14 }, (_v, i) => ({
  ordinal: i + 1,
  top: i * 400,
  height: 300,
}));

const cfg = (over: Partial<ModeConfig> = {}): ModeConfig => ({
  mode: "custom",
  picks: [],
  route: [],
  ...over,
});

describe("pause-at panel — verified against the note's 14 toggles", () => {
  it("custom list 2, 5, 8, 9, 22 stops at the four that exist", () => {
    const c = cfg({ mode: "custom", picks: [2, 5, 8, 9, 22] });
    const stops = buildModeStops(items, c, 800);
    expect([...new Set(stops.map((s) => s.ordinal))]).toEqual([2, 5, 8, 9]);
    expect(matchesMode(c, 22)).toBe(true); // in the list …
    expect(items.some((i) => i.ordinal === 22)).toBe(false); // … but not in the note
  });

  it("an empty custom list falls back to every toggle instead of a dead run", () => {
    const stops = buildModeStops(items, cfg({ mode: "custom", picks: [] }), 800);
    expect(new Set(stops.map((s) => s.ordinal)).size).toBe(14);
  });

  it("route order is the user's own visit order, and looping replays it", () => {
    const c = cfg({ mode: "route", route: [7, 2, 9, 2], loopRoute: true });
    const stops = orderModeStops(buildModeStops(items, c, 800), c, false);
    expect(stops.map((s) => s.ordinal)).toEqual([7, 2, 9, 2]);
    expect(c.route[(3 + 1) % c.route.length]).toBe(7); // wraps back to the start
  });

  it("shuffle range 0/0 means the whole note; a reversed range still works", () => {
    expect(inShuffleRange(cfg({ mode: "shuffle", shuffleFrom: 0, shuffleTo: 0 }), 13)).toBe(true);
    const range = cfg({ mode: "shuffle", shuffleFrom: 9, shuffleTo: 4 });
    expect(inShuffleRange(range, 6)).toBe(true);
    expect(inShuffleRange(range, 12)).toBe(false);
  });

  it("tall toggles are still read screen-by-screen (chunks per toggle)", () => {
    const tall = [{ ordinal: 1, top: 0, height: 2400 }];
    const stops = buildModeStops(tall, cfg({ mode: "all" }), 800);
    expect(stops.length).toBeGreaterThan(1);
    expect(stops.every((s) => s.ordinal === 1)).toBe(true);
  });
});

describe("v1.6.0 — customisable countdown face", () => {
  it("uses the reader's emoji or text in the chip", () => {
    expect(thinkCountdownLabel(3200, "💭")).toBe("💭 4");
    expect(thinkCountdownLabel(3200, "Think")).toBe("Think 4");
    expect(thinkCountdownLabel(3200, "")).toBe("🤔 4");
  });

  it("drops the text face when an image is used, keeping the seconds", () => {
    expect(thinkCountdownLabel(3200, "assets/brain.gif")).toBe("4");
  });

  it("recognises image faces only for image paths", () => {
    expect(isIconImage("assets/brain.gif")).toBe(true);
    expect(isIconImage("https://x.dev/a.png?v=2")).toBe(true);
    expect(isIconImage("/icons/think.svg")).toBe(true);
    expect(isIconImage("🤔")).toBe(false);
    expect(isIconImage("Think")).toBe(false);
  });
});
