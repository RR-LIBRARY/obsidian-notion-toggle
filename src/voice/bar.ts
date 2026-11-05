/**
 * v1.9.0 — voice mode bar, modelled on Lovable's voice input: a live
 * waveform with ✕ (discard) and ✓ (finish and write), plus timer, pause
 * and a status line for pieces still being written.
 */
import { setIcon } from "obsidian";

export interface VoiceBarActions {
  cancel(): void;
  done(): void;
  togglePause(): void;
}

const BARS = 48;

export class VoiceBar {
  readonly el: HTMLElement;
  private wave: HTMLElement;
  private bars: HTMLElement[] = [];
  private levels: number[] = new Array(BARS).fill(0);
  private timeEl: HTMLElement;
  private statusEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private timer: number;
  private pausedMs = 0;
  private pausedAt = 0;

  constructor(private readonly actions: VoiceBarActions, private readonly startedAt: number) {
    this.el = document.body.createDiv({ cls: "ntt-voice-bar", attr: { role: "region", "aria-label": "Voice mode" } });
    const top = this.el.createDiv({ cls: "ntt-voice-top" });
    this.timeEl = top.createSpan({ cls: "ntt-voice-time", text: "0:00" });
    this.statusEl = top.createSpan({ cls: "ntt-voice-status", text: "Listening…" });
    this.wave = this.el.createDiv({ cls: "ntt-voice-wave" });
    for (let i = 0; i < BARS; i++) this.bars.push(this.wave.createDiv({ cls: "ntt-voice-b" }));
    const row = this.el.createDiv({ cls: "ntt-voice-row" });
    const cancel = row.createEl("button", { cls: "ntt-voice-btn ntt-voice-cancel", attr: { "aria-label": "Discard recording" } });
    setIcon(cancel, "x");
    this.pauseBtn = row.createEl("button", { cls: "ntt-voice-btn ntt-voice-pause", attr: { "aria-label": "Pause" } });
    setIcon(this.pauseBtn, "pause");
    const done = row.createEl("button", { cls: "ntt-voice-btn ntt-voice-done", attr: { "aria-label": "Finish and write" } });
    setIcon(done, "check");
    cancel.onclick = () => this.actions.cancel();
    done.onclick = () => this.actions.done();
    this.pauseBtn.onclick = () => this.actions.togglePause();
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  private tick(): void {
    const now = this.pausedAt || Date.now();
    const s = Math.max(0, Math.floor((now - this.startedAt - this.pausedMs) / 1000));
    this.timeEl.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
  }

  level(l: number): void {
    this.levels.push(Math.min(1, l * 9));
    this.levels.shift();
    for (let i = 0; i < BARS; i++) this.bars[i].style.transform = `scaleY(${0.08 + this.levels[i] * 0.92})`;
  }

  setPaused(p: boolean): void {
    if (p) this.pausedAt = Date.now();
    else if (this.pausedAt) {
      this.pausedMs += Date.now() - this.pausedAt;
      this.pausedAt = 0;
    }
    this.el.toggleClass("is-paused", p);
    setIcon(this.pauseBtn, p ? "mic" : "pause");
    this.pauseBtn.setAttr("aria-label", p ? "Resume" : "Pause");
    this.status(p ? "Paused" : "Listening…");
  }

  status(text: string): void {
    this.statusEl.setText(text);
  }

  finishing(): void {
    this.el.addClass("is-finishing");
    this.status("Writing…");
  }

  destroy(): void {
    window.clearInterval(this.timer);
    this.el.remove();
  }
}
