/** 1.9.26 — Android: voice mode must never stay stuck ("mic button does nothing"). */
import { describe, expect, it } from "bun:test";
import { resumeWithin } from "../src/voice/wake";
import { DEFAULT_VOICE_SETTINGS, VoiceError, transcribe, transcribeWithRetry, withTimeout, type VoiceTransport } from "../src/voice/client";

describe("audio engine wake-up", () => {
  it("a resume() that never answers gives up after the wait instead of hanging", async () => {
    const ctx = { state: "suspended" as AudioContextState, resume: () => new Promise<void>(() => {}) };
    const t0 = Date.now();
    expect(await resumeWithin(ctx, 50)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("reports running when resume works", async () => {
    const ctx = { state: "suspended" as AudioContextState, resume: async () => { ctx.state = "running"; } };
    expect(await resumeWithin(ctx, 1000)).toBe(true);
  });
  it("a failing resume() does not throw", async () => {
    const ctx = { state: "suspended" as AudioContextState, resume: () => Promise.reject(new Error("no gesture")) };
    expect(await resumeWithin(ctx, 50)).toBe(false);
  });
});

describe("voice request timeout", () => {
  const s = { ...DEFAULT_VOICE_SETTINGS, voiceKey: "k" };
  const wav = new ArrayBuffer(4000);
  const hang: VoiceTransport = () => new Promise(() => {});

  it("a request that never answers fails as 'no connection' (status 0)", async () => {
    const err = await transcribe(withTimeout(hang, 30), s, wav).catch((e) => e);
    expect(err).toBeInstanceOf(VoiceError);
    expect((err as VoiceError).status).toBe(0);
    expect((err as VoiceError).retryable).toBe(true);
  });
  it("after 3 timed-out tries the piece fails (so its audio gets rescued) instead of waiting forever", async () => {
    let calls = 0;
    const t: VoiceTransport = withTimeout(() => { calls++; return new Promise(() => {}); }, 20);
    const err = await transcribeWithRetry(t, s, wav, "", async () => {}).catch((e) => e);
    expect(calls).toBe(3);
    expect((err as VoiceError).status).toBe(0);
  });
  it("a normal reply still comes through", async () => {
    const ok: VoiceTransport = async () => ({ status: 200, text: JSON.stringify({ text: "Namaste." }) });
    expect(await transcribe(withTimeout(ok, 1000), s, wav)).toBe("Namaste.");
  });
});
