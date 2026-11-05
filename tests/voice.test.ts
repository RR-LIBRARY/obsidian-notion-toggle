import { describe, expect, test } from "bun:test";
import { Segmenter, downsample, encodeWav, hasSpeech, joinPiece, normalize } from "../src/voice/audio";
import { VoiceError, buildMultipart, buildPrompt, transcribe, transcribeWithRetry, DEFAULT_VOICE_SETTINGS } from "../src/voice/client";
import { DictationSession } from "../src/voice/session";

const tone = (sec: number, amp: number) => Float32Array.from({ length: 16000 * sec }, (_, i) => amp * Math.sin(i / 5));
const s = { ...DEFAULT_VOICE_SETTINGS, voiceKey: "k", voiceEndpoint: "https://x/api/public/transcribe" };

describe("voice audio", () => {
  test("48 kHz is downsampled to 16 kHz", () => expect(downsample(new Float32Array(48000), 48000).length).toBe(16000));
  test("wav header + 2 bytes per sample", () => {
    const w = encodeWav(new Float32Array(100), 16000);
    expect(w.byteLength).toBe(244);
    expect(new TextDecoder().decode(new Uint8Array(w, 0, 4))).toBe("RIFF");
  });
  test("silence is not speech, a voice is", () => {
    expect(hasSpeech(new Float32Array(16000))).toBe(false);
    expect(hasSpeech(tone(1, 0.2))).toBe(true);
  });
  test("quiet speech is boosted, capped at 8x", () => {
    const out = normalize(tone(1, 0.01));
    expect(Math.max(...out)).toBeCloseTo(0.08, 2);
  });
  test("piece cut: at a pause after 3 s, always at 12 s, never early", () => {
    const seg = new Segmenter();
    expect(seg.push(0, 800, 2)).toBe(false);
    expect(seg.push(0, 800, 4)).toBe(true);
    expect(new Segmenter().push(0.5, 90, 12)).toBe(true);
  });
  test("pauses are found in a noisy room", () => {
    const seg = new Segmenter();
    for (let i = 0; i < 800; i++) seg.push(0.05, 90, 1);
    expect(seg.push(0.3, 90, 4)).toBe(false);
    expect(seg.push(0.05, 800, 4)).toBe(true);
    expect(new Segmenter().push(0.5, 90, 60)).toBe(true);
  });
  test("a spoken list or table starts on a new line", () => {
    expect(joinPiece("Aaj ke topics", "- Maths\n- Physics")).toBe("\n- Maths\n- Physics");
    expect(joinPiece("Marks", "| Subject | Marks |")).toBe("\n| Subject | Marks |");
    expect(joinPiece("Topics\n", "- Maths")).toBe("- Maths");
  });
  test("pieces join with one space", () => {
    expect(joinPiece("hello", " world ")).toBe(" world");
    expect(joinPiece("hello\n", "world")).toBe("world");
    expect(joinPiece("x", "  ")).toBe("");
  });
});

describe("voice client", () => {
  test("Hinglish prompt by default", () => expect(buildPrompt(s)).toContain("Roman"));
  test("multipart carries the wav and fields", () => {
    const { body, contentType } = buildMultipart({ languages: "hi,en" }, new ArrayBuffer(8));
    const txt = new TextDecoder().decode(body);
    expect(contentType).toContain("boundary=");
    expect(txt).toContain('name="languages"');
    expect(txt).toContain('filename="speech.wav"');
  });
  test("sends key header and returns text", async () => {
    let hdr = "";
    const t = await transcribe(async (r) => ((hdr = r.headers["x-voice-key"]), { status: 200, text: '{"text":" namaste "}' }), s, new ArrayBuffer(8));
    expect(hdr).toBe("k");
    expect(t).toBe("namaste");
  });
  test("no key → clear error, no request", async () => {
    await expect(transcribe(async () => ({ status: 200, text: "{}" }), { ...s, voiceKey: "" }, new ArrayBuffer(8))).rejects.toThrow("voice key");
  });
  test("retries 5xx then succeeds; 401 stops at once", async () => {
    let n = 0;
    const ok = await transcribeWithRetry(async () => (++n < 3 ? { status: 503, text: "{}" } : { status: 200, text: '{"text":"ok"}' }), s, new ArrayBuffer(8), async () => {});
    expect([ok, n]).toEqual(["ok", 3]);
    let m = 0;
    await expect(transcribeWithRetry(async () => (m++, { status: 401, text: '{"error":"Wrong voice key"}' }), s, new ArrayBuffer(8), async () => {})).rejects.toBeInstanceOf(VoiceError);
    expect(m).toBe(1);
  });
});

describe("dictation session", () => {
  test("pieces are written in spoken order even if they finish out of order; failures are rescued", async () => {
    let note = "Notes:";
    const delays = [30, 5, 10];
    let i = 0;
    const sess = new DictationSession({
      transcribe: (w) => { const k = i++; return new Promise((r, j) => setTimeout(() => (k === 2 ? j(new Error("net")) : r(["one", "two"][k])), delays[k])); },
      write: (t) => { note += t; },
      before: () => note,
      rescue: async () => "Voice recordings/a.wav",
      onPending: () => {},
      onError: () => {},
    });
    sess.add(new ArrayBuffer(4)); sess.add(null); sess.add(new ArrayBuffer(4)); sess.add(new ArrayBuffer(4));
    await sess.end();
    expect(note).toBe("Notes: one two [voice not written — audio saved: Voice recordings/a.wav]");
  });
});
