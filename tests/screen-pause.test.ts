import { describe, expect, it } from "bun:test";
import { formatPause, pauseToSlider, sliderToPause, roundPause, PAUSE_CHIPS } from "../src/pause-scale";
import { renderScreenPause } from "../src/screen-pause-ui";
import { clampScreenDwellMs } from "../src/screen-stops";
import { stopHoldMs } from "../src/screen-run";
import { fabShouldShow } from "../src/guide";

describe("v1.7.5 — pause scale", () => {
  it("ends map to 1s and 1h", () => {
    expect(sliderToPause(0)).toBe(1000);
    expect(sliderToPause(100)).toBe(3_600_000);
    expect(pauseToSlider(1000)).toBe(0);
    expect(pauseToSlider(3_600_000)).toBe(100);
  });
  it("1m sits near the middle, round trip is stable", () => {
    const p = pauseToSlider(60_000);
    expect(p).toBeGreaterThan(40); expect(p).toBeLessThan(60);
    for (let i = 0; i <= 100; i++) expect(sliderToPause(pauseToSlider(sliderToPause(i)))).toBe(sliderToPause(i));
  });
  it("short end has 1s steps (5s, 7s reachable)", () => {
    const vals = new Set(Array.from({ length: 101 }, (_, i) => sliderToPause(i)));
    expect(vals.has(5000)).toBe(true); expect(vals.has(7000)).toBe(true);
  });
  it("formats", () => {
    expect(formatPause(7000)).toBe("7s"); expect(formatPause(90_000)).toBe("1m 30s");
    expect(formatPause(2_700_000)).toBe("45m"); expect(formatPause(3_600_000)).toBe("1h");
    expect(roundPause(754_000)).toBe(780_000);
  });
  it("chips are the reference set", () => expect(PAUSE_CHIPS.map((c) => c.label)).toEqual(["10s", "20s", "30s", "60s", "1h"]));
  it("clamp allows up to 1h and carries old values", () => {
    expect(clampScreenDwellMs(3_600_000)).toBe(3_600_000);
    expect(clampScreenDwellMs(9_999_999)).toBe(3_600_000);
    expect(clampScreenDwellMs(250)).toBe(1000);
    expect(clampScreenDwellMs(22_250)).toBe(22_250);
  });
});

describe("v1.7.5 — tall toggle first screen", () => {
  it("chunked first stop waits the longer of hold / screen pause", () => {
    expect(stopHoldMs({ page: 2, index: 0 }, 4, 20_000, true)).toBe(20_000);
    expect(stopHoldMs({ page: 2, index: 0 }, 30, 20_000, true)).toBe(30_000);
    expect(stopHoldMs({ page: 2, index: 0 }, 4, 20_000)).toBe(4000);
    expect(stopHoldMs({ page: 2, index: 1 }, 4, 20_000, true)).toBe(20_000);
  });
});

describe("v1.7.5 — floating button hidden under the sheet", () => {
  it("sheet open counts as an overlay", () => {
    expect(fabShouldShow(true, true, false, true, true)).toBe(false);
    expect(fabShouldShow(true, true, false, true, false)).toBe(true);
  });
});

describe("v1.7.5 — pause control DOM", () => {
  const host = () => {
    const h = { saved: 0, refreshed: 0, settings: { scrollScreenDwellMs: 4000, scrollChunkTall: true, scrollAdvanceBy: "toggles" },
      async saveSettings() { h.saved++; }, refreshScrollPlan() { h.refreshed++; } };
    return h;
  };
  it("shows value, chips set pause, slider commits", async () => {
    const h = host(); const root = document.createElement("div");
    renderScreenPause(root, h);
    expect(root.querySelector(".ntt-pause-value")!.textContent).toBe("4s");
    expect(root.querySelector(".ntt-pause-scale")!.textContent).toBe("1s1m1h");
    const chip = [...root.querySelectorAll<HTMLButtonElement>(".ntt-pause-chip")].find((b) => b.textContent === "20s")!;
    chip.click(); await Promise.resolve();
    expect(h.settings.scrollScreenDwellMs).toBe(20_000);
    expect(chip.classList.contains("is-active")).toBe(true);
    expect(root.querySelector(".ntt-pause-value")!.textContent).toBe("20s");
    const sl = root.querySelector<HTMLInputElement>(".ntt-pause-slider")!;
    sl.value = "100"; sl.dispatchEvent(new Event("change")); await Promise.resolve();
    expect(h.settings.scrollScreenDwellMs).toBe(3_600_000);
    expect(h.saved).toBe(2); expect(h.refreshed).toBe(2);
  });
  it("greys out when tall-chunking off and advancing by toggles only", () => {
    const h = host(); h.settings.scrollChunkTall = false; const root = document.createElement("div");
    const c = renderScreenPause(root, h);
    expect(c.el.classList.contains("is-disabled")).toBe(true);
    expect(root.querySelector<HTMLInputElement>(".ntt-pause-slider")!.disabled).toBe(true);
    c.setEnabled(true);
    expect(c.el.classList.contains("is-disabled")).toBe(false);
  });
});
