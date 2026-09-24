/**
 * v1.7.5 — shared "Pause on each screen" control (sheet + settings tab):
 * header with live value, 1 s … 1 h log slider, scale labels and quick chips.
 */
import { formatPause, pauseToSlider, sliderToPause, PAUSE_CHIPS, PAUSE_STEPS } from "./pause-scale";
import { clampScreenDwellMs } from "./screen-stops";

export interface ScreenPauseHost {
  settings: { scrollScreenDwellMs: number; scrollChunkTall: boolean; scrollAdvanceBy?: string };
  saveSettings(): Promise<void>;
  refreshScrollPlan(): void;
}

export interface ScreenPauseControl {
  el: HTMLElement;
  setEnabled(on: boolean): void;
}

export function renderScreenPause(parent: HTMLElement, host: ScreenPauseHost): ScreenPauseControl {
  const doc = parent.ownerDocument;
  const mk = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) => {
    const e = doc.createElement(tag);
    e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const box = mk("div", "ntt-pause");
  const head = mk("div", "ntt-pause-head");
  head.append(mk("span", "ntt-pause-label", "Pause on each screen"));
  const value = mk("span", "ntt-pause-value");
  head.append(value);
  const slider = mk("input", "ntt-pause-slider") as HTMLInputElement;
  slider.type = "range";
  slider.min = "0";
  slider.max = String(PAUSE_STEPS);
  slider.step = "1";
  slider.setAttribute("aria-label", "Pause on each screen");
  const scale = mk("div", "ntt-pause-scale");
  for (const t of ["1s", "1m", "1h"]) scale.append(mk("span", "", t));
  const chips = mk("div", "ntt-pause-chips");
  const chipEls: HTMLButtonElement[] = [];

  const show = (ms: number) => {
    value.textContent = formatPause(ms);
    slider.value = String(pauseToSlider(ms));
    for (const c of chipEls) c.classList.toggle("is-active", Number(c.dataset.ms) === ms);
  };
  const commit = async (ms: number) => {
    host.settings.scrollScreenDwellMs = clampScreenDwellMs(ms);
    show(host.settings.scrollScreenDwellMs);
    await host.saveSettings();
    host.refreshScrollPlan();
  };
  for (const c of PAUSE_CHIPS) {
    const b = mk("button", "ntt-pause-chip", c.label) as HTMLButtonElement;
    b.type = "button";
    b.dataset.ms = String(c.ms);
    b.addEventListener("click", () => void commit(c.ms));
    chipEls.push(b);
    chips.append(b);
  }
  slider.addEventListener("input", () => {
    value.textContent = formatPause(sliderToPause(Number(slider.value)));
  });
  slider.addEventListener("change", () => void commit(sliderToPause(Number(slider.value))));

  box.append(head, slider, scale, chips);
  parent.append(box);
  show(clampScreenDwellMs(host.settings.scrollScreenDwellMs));
  const setEnabled = (on: boolean) => {
    box.classList.toggle("is-disabled", !on);
    slider.disabled = !on;
    for (const c of chipEls) c.disabled = !on;
  };
  // Screen stops ("Screens" / "Toggles + screens") use the same pause.
  setEnabled(host.settings.scrollChunkTall || (host.settings.scrollAdvanceBy ?? "toggles") !== "toggles");
  return { el: box, setEnabled };
}
