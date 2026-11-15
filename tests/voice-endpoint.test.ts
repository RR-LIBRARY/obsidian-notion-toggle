/** 1.9.27 — the old voice server was retired; saved settings must move to the new one. */
import { describe, expect, it } from "bun:test";
import { DEFAULT_VOICE_ENDPOINT, upgradeVoiceEndpoint } from "../src/voice/client";

describe("voice server address", () => {
  it("new installs use the new voice server", () => {
    expect(DEFAULT_VOICE_ENDPOINT).toBe("https://project--c35eb88f-50bf-4da0-b80f-c79f43c5b539.lovable.app/api/public/transcribe");
  });
  it("a saved old address moves to the new server", () => {
    expect(upgradeVoiceEndpoint("https://notion-toggle-voice.lovable.app/api/public/transcribe")).toBe(DEFAULT_VOICE_ENDPOINT);
    expect(upgradeVoiceEndpoint("https://notion-toggle-voice.lovable.app/api/public/transcribe/")).toBe(DEFAULT_VOICE_ENDPOINT);
  });
  it("an empty address falls back to the new server", () => {
    expect(upgradeVoiceEndpoint("")).toBe(DEFAULT_VOICE_ENDPOINT);
    expect(upgradeVoiceEndpoint(undefined)).toBe(DEFAULT_VOICE_ENDPOINT);
  });
  it("a custom address the user typed is kept", () => {
    expect(upgradeVoiceEndpoint("https://my-own.example.com/api/public/transcribe")).toBe("https://my-own.example.com/api/public/transcribe");
  });
});
