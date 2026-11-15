import { describe, expect, it } from "bun:test";
import { checkServer, type VoiceTransport } from "../src/voice/client";

const s = { voiceEndpoint: "https://x.test/api/public/transcribe", voiceKey: "k" };
const reply = (status: number, body: unknown): VoiceTransport => async () => ({ status, text: JSON.stringify(body) });

// v1.9.28 — self-test must say plainly when the server's own AI key broke (e.g. after a workspace move).
describe("voice self-test server check", () => {
  it("AI ok", async () => expect(await checkServer(reply(200, { ok: true, ai: "ok" }), s)).toEqual({ ok: true, text: "Server AI ready" }));
  it("server AI key broken → tells user what to send to Lovable", async () => {
    const r = await checkServer(reply(503, { ok: false, ai: "failed", problem: "ai_key_broken" }), s);
    expect(r.ok).toBe(false);
    expect(r.text).toContain("Voice health check karke fix karo");
  });
  it("missing server secret → same fix message", async () =>
    expect((await checkServer(reply(503, { ok: false, problem: "missing_secret" }), s)).text).toContain("Voice health check karke fix karo"));
  it("wrong voice key", async () => expect((await checkServer(reply(200, { ok: true, ai: "not_checked (send x-voice-key)" }), s)).ok).toBe(false));
  it("credits used up", async () => expect((await checkServer(reply(503, { ok: false, problem: "no_credits" }), s)).text).toContain("credits"));
  it("no network", async () => expect((await checkServer(async () => { throw new Error("offline"); }, s)).ok).toBe(false));
  it("sends the voice key with a GET", async () => {
    let seen: { method?: string; headers?: Record<string, string> } = {};
    await checkServer(async (r) => { seen = r; return { status: 200, text: '{"ok":true,"ai":"ok"}' }; }, s);
    expect(seen.method).toBe("GET");
    expect(seen.headers?.["x-voice-key"]).toBe("k");
  });
});
