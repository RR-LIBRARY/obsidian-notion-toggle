/**
 * v1.9.0 — voice mode bar, modelled on Lovable's voice input: a live
 * waveform with ✕ (discard) and ✓ (finish and write), plus timer, pause
 * and a status line for pieces still being written.
 */
import { setIcon } from "obsidian";

export interface VoiceBarLook {
  lift: number;
  style: "full" | "compact";
  wave: "muted" | "accent";
  /** Called once a long-press drag ends, with the new lift in px. */
  onMoved(lift: number): void;
}

export interface VoiceBarActions {
  cancel(): void;
  done(): void;
  togglePause(): void;
}

const BARS = 56;

export class VoiceBar {
  readonly el: HTMLElement;
  private wave: HTMLElement;
  private bars: HTMLElement[] = [];
  private levels: number[] = new Array(BARS).fill(0);
  private timeEl: HTMLElement;
  private statusEl: HTMLElement;
  private textEl: HTMLElement;
  private shown = "";
  private pauseBtn: HTMLButtonElement;
  private timer: number;
  private pausedMs = 0;
  private pausedAt = 0;

  constructor(private readonly actions: VoiceBarActions, private readonly startedAt: number, private readonly look?: VoiceBarLook) {
    this.el = document.body.createDiv({ cls: "ntt-voice-bar", attr: { role: "region", "aria-label": "Voice mode" } });
    const top = this.el.createDiv({ cls: "ntt-voice-top" });
    this.timeEl = top.createSpan({ cls: "ntt-voice-time", text: "0:00" });
    this.statusEl = top.createSpan({ cls: "ntt-voice-status", text: "Listening…" });
    this.textEl = this.el.createDiv({ cls: "ntt-voice-text", attr: { "aria-live": "polite" } });
    this.textEl.setText("Bolna shuru kijiye… text yahan dikhega");
    this.textEl.addClass("is-empty");
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
    if (look) {
      this.el.toggleClass("is-compact", look.style === "compact");
      this.el.toggleClass("is-accent", look.wave === "accent");
      this.setLift(look.lift);
      this.enableDrag();
    }
  }

  private lift = 0;
  private setLift(px: number): void {
    const max = Math.max(0, window.innerHeight - this.el.offsetHeight - 120);
    this.lift = Math.round(Math.min(max, Math.max(-60, px)));
    this.el.style.setProperty("--ntt-voice-lift", `${this.lift}px`);
  }

  /** v1.9.4 — long-press the card (not a button), then slide up or down. */
  private enableDrag(): void {
    let timer = 0;
    let startY = 0;
    let startLift = 0;
    let dragging = false;
    const end = () => {
      window.clearTimeout(timer);
      if (dragging) {
        dragging = false;
        this.el.removeClass("is-dragging");
        this.look?.onMoved(this.lift);
      }
    };
    this.el.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button")) return;
      startY = e.clientY;
      startLift = this.lift;
      timer = window.setTimeout(() => {
        dragging = true;
        this.el.addClass("is-dragging");
        try { this.el.setPointerCapture(e.pointerId); } catch { /* ok */ }
        (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(15);
      }, 400);
    });
    this.el.addEventListener("pointermove", (e) => {
      if (!dragging) {
        if (Math.abs(e.clientY - startY) > 10) window.clearTimeout(timer);
        return;
      }
      e.preventDefault();
      this.setLift(startLift + (startY - e.clientY));
    });
    this.el.addEventListener("pointerup", end);
    this.el.addEventListener("pointercancel", end);
  }

  private tick(): void {
    const now = this.pausedAt || Date.now();
    const s = Math.max(0, Math.floor((now - this.startedAt - this.pausedMs) / 1000));
    this.timeEl.setText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
  }

  /** v1.9.3 — Lovable-style wave: newest sound in the centre, spreading out
   *  to both sides, tall in the middle and tapering to dots at the edges. */
  level(l: number): void {
    const v = Math.min(1, Math.sqrt(l * 12));
    this.levels.unshift(v);
    this.levels.pop();
    const mid = (BARS - 1) / 2;
    for (let i = 0; i < BARS; i++) {
      const d = Math.abs(i - mid);
      const taper = Math.cos((d / (mid + 1)) * (Math.PI / 2));
      const h = this.levels[Math.floor(d)] * taper;
      this.bars[i].style.transform = `scaleY(${0.1 + h * 0.9})`;
    }
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

  /** Live transcript box: shows what has been written so far (last ~400 chars). */
  transcript(piece: string): void {
    this.shown = (this.shown + piece).slice(-400);
    this.textEl.removeClass("is-empty");
    this.textEl.setText(this.shown.trimStart());
    this.textEl.scrollTop = this.textEl.scrollHeight;
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
