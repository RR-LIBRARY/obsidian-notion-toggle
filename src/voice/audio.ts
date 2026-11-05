/**
 * v1.9.0 — voice mode: pure audio helpers (no Obsidian, no DOM).
 *
 * Recording is kept as raw mono Float32 chunks, downsampled to 16 kHz and
 * packed into a 16-bit WAV — about 32 KB per second, so a one-minute piece
 * is ~2 MB and uploads fast on a weak mobile connection.
 */
export const TARGET_RATE = 16000;

export function downsample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate <= toRate) return input;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  let pos = 0;
  for (let i = 0; i < outLen; i++) {
    const next = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(pos); j < next; j++) {
      sum += input[j];
      n++;
    }
    out[i] = n ? sum / n : 0;
    pos = next;
  }
  return out;
}

export function concat(chunks: readonly Float32Array[]): Float32Array {
  const len = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(len);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Root-mean-square loudness of a chunk, 0..1. */
export function rms(chunk: Float32Array): number {
  if (!chunk.length) return 0;
  let s = 0;
  for (let i = 0; i < chunk.length; i++) s += chunk[i] * chunk[i];
  return Math.sqrt(s / chunk.length);
}

/**
 * Bring quiet speech (phone in a pocket, far from the mic) up to a usable
 * level without clipping loud speech. Peak-normalise to ~0.9, gain capped at 8x.
 */
export function normalize(samples: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  if (peak < 1e-4) return samples;
  const gain = Math.min(8, 0.9 / peak);
  if (gain <= 1.05) return samples;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * gain;
  return out;
}

export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const tag = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, samples.length * 2, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true);
    o += 2;
  }
  return buf;
}

/** True when a piece holds speech worth sending (not just room noise). */
export function hasSpeech(samples: Float32Array, rate = TARGET_RATE, threshold = 0.012): boolean {
  const win = Math.floor(rate * 0.05);
  let voiced = 0;
  for (let i = 0; i + win <= samples.length; i += win) {
    if (rms(samples.subarray(i, i + win)) > threshold) voiced++;
  }
  return voiced * 0.05 >= 0.3; // at least ~0.3 s of voiced audio
}

/**
 * Decides when to cut the running recording into a piece so long dictation
 * is transcribed while you keep talking: after `softSec` cut at the next
 * pause, and never let a piece exceed `hardSec`.
 */
export class Segmenter {
  private quietMs = 0;
  constructor(
    private readonly softSec = 25,
    private readonly hardSec = 60,
    private readonly pauseMs = 700,
    private readonly threshold = 0.012
  ) {}
  reset(): void {
    this.quietMs = 0;
  }
  /** Feed one chunk; returns true when the piece should be cut now. */
  push(level: number, chunkMs: number, pieceSec: number): boolean {
    this.quietMs = level < this.threshold ? this.quietMs + chunkMs : 0;
    if (pieceSec >= this.hardSec) return true;
    return pieceSec >= this.softSec && this.quietMs >= this.pauseMs;
  }
}

/** Join a new transcript piece onto what is already in the note. */
export function joinPiece(before: string, piece: string): string {
  const t = piece.trim();
  if (!t) return "";
  if (!before || /[\s\n]$/.test(before)) return t;
  return " " + t;
}
