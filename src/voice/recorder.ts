/**
 * v1.9.0 — voice mode: microphone capture with automatic pieces.
 *
 * Noise suppression / echo cancellation / auto-gain are asked from the
 * device, every chunk feeds a live level (for the waveform) and the
 * Segmenter, and finished pieces are handed out as 16 kHz WAV while you keep
 * talking.
 */
import { Segmenter, TARGET_RATE, concat, downsample, encodeWav, hasSpeech, normalize, rms } from "./audio";

export interface RecorderEvents {
  onLevel(level: number): void;
  /** A finished piece (WAV) — `final` is true for the last one. */
  onPiece(wav: ArrayBuffer | null, final: boolean): void;
}

type AnyAudioContext = typeof AudioContext;

export class VoiceRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private pieceSamples = 0;
  private seg = new Segmenter();
  private paused = false;
  startedAt = 0;

  constructor(private readonly ev: RecorderEvents) {}

  async start(): Promise<void> {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) throw new Error("This device does not allow microphone access here.");
    this.stream = await md.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    const Ctx: AnyAudioContext = (window.AudioContext || (window as unknown as { webkitAudioContext: AnyAudioContext }).webkitAudioContext);
    this.ctx = new Ctx();
    await this.ctx.resume();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    const rate = this.ctx.sampleRate;
    this.node.onaudioprocess = (e) => {
      if (this.paused) return;
      const raw = new Float32Array(e.inputBuffer.getChannelData(0));
      const level = rms(raw);
      this.ev.onLevel(level);
      const small = downsample(raw, rate);
      this.chunks.push(small);
      this.pieceSamples += small.length;
      const chunkMs = (raw.length / rate) * 1000;
      if (this.seg.push(level, chunkMs, this.pieceSamples / TARGET_RATE)) this.flush(false);
    };
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination);
    this.startedAt = Date.now();
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }
  get isPaused(): boolean {
    return this.paused;
  }

  private flush(final: boolean): void {
    const samples = concat(this.chunks);
    this.chunks = [];
    this.pieceSamples = 0;
    this.seg.reset();
    const useful = samples.length > TARGET_RATE * 0.4 && hasSpeech(samples);
    this.ev.onPiece(useful ? encodeWav(normalize(samples), TARGET_RATE) : null, final);
  }

  /** Stop and hand out the last piece (send=false discards it). */
  async stop(send: boolean): Promise<void> {
    if (this.node) this.node.onaudioprocess = null;
    if (send) this.flush(true);
    else this.chunks = [];
    this.stream?.getTracks().forEach((t) => t.stop());
    try {
      this.node?.disconnect();
      this.source?.disconnect();
      await this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.stream = null;
    this.ctx = null;
    this.node = null;
  }
}
