import { describe, expect, it } from "bun:test";
import { buildContext, buildPrompt, friendlyError, isUndoCommand, wavSeconds } from "../src/voice/client";
import { DictationSession } from "../src/voice/session";

describe("voice 1.9.9", () => {
  it("recognises the spoken undo command only on its own", () => {
    expect(isUndoCommand("Pichhla mitao.")).toBe(true);
    expect(isUndoCommand("pichla wala hatao")).toBe(true);
    expect(isUndoCommand("undo last")).toBe(false);
    expect(isUndoCommand("maine pichhla mitao bola")).toBe(false);
  });
  it("credit and offline errors become plain messages", () => {
    expect(friendlyError(402, "x")).toContain("credits");
    expect(friendlyError(0, "x")).toContain("Internet");
    expect(friendlyError(500, "boom")).toBe("boom");
  });
  it("counts 16 kHz WAV seconds", () => {
    expect(wavSeconds(new ArrayBuffer(44 + 32000 * 3))).toBe(3);
  });
  it("adds note context to the prompt, max 200 chars of text", () => {
    const c = buildContext("Physics", "x".repeat(500));
    expect(c).toContain("Note title: Physics.");
    expect(c.match(/x{2,}/)![0].length).toBe(200);
    expect(buildPrompt({ voiceScript: "roman", voiceKeywords: "" }, c)).toContain("Physics");
  });
  it("session undo removes instead of writing", async () => {
    let out = "";
    let undone = 0;
    const s = new DictationSession({
      transcribe: async (w) => (w.byteLength === 1 ? "Hello." : "pichhla mitao"),
      write: (t) => (out += t), before: () => out, rescue: async () => null,
      onPending: () => {}, onError: () => {}, undo: () => undone++,
    });
    s.add(new ArrayBuffer(1)); s.add(new ArrayBuffer(2));
    await s.end();
    expect(out).toBe("Hello.");
    expect(undone).toBe(1);
  });
});

import { autoLink } from "../src/voice/client";
describe("voice auto-link", () => {
  const notes = ["Newton's Laws", "Physics", "AI", "Mock Test"];
  it("links existing note names, keeps spoken case as alias", () => {
    expect(autoLink("Aaj physics padhi aur mock test diya.", notes)).toBe("Aaj [[Physics|physics]] padhi aur [[Mock Test|mock test]] diya.");
  });
  it("whole words only, short names skipped, first match only", () => {
    expect(autoLink("Physicsy AI Physics Physics", notes)).toBe("Physicsy AI [[Physics]] Physics");
  });
  it("never links inside existing links or the current note", () => {
    expect(autoLink("[[Physics]] notes", notes)).toBe("[[Physics]] notes");
    expect(autoLink("Physics revision", notes, "Physics")).toBe("Physics revision");
  });
  it("longest name wins", () => {
    expect(autoLink("Newton's Laws samjho", [...notes, "Newton"])).toBe("[[Newton's Laws]] samjho");
  });
});

import { linkTerms, termsOf } from "../src/voice/client";
describe("voice term linking (thinking mode)", () => {
  const idx = new Map<string, string[]>([
    ["ophthalmologist", ["My work"]],
    ["offline", ["My work"]],
    ["revision", ["A", "B", "C", "D"]],
  ]);
  it("links a specific term to the note where it is written", () => {
    expect(linkTerms("Kal ophthalmologist ke paas jaana hai.", idx)).toBe("Kal [[My work|ophthalmologist]] ke paas jaana hai.");
  });
  it("skips terms used in more than 3 notes, short words, and the current note", () => {
    expect(linkTerms("revision card", idx)).toBe("revision card");
    expect(linkTerms("Ophthalmologist", idx, "My work")).toBe("Ophthalmologist");
  });
  it("links each term once, max 3 per piece, never inside links", () => {
    expect(linkTerms("ophthalmologist ophthalmologist [[ophthalmologist]]", idx)).toBe("[[My work|ophthalmologist]] ophthalmologist [[ophthalmologist]]");
  });
  it("indexes 7+ letter words, not common words or code", () => {
    const t = termsOf("Ophthalmologist visit because `glaucoma`");
    expect(t.has("ophthalmologist")).toBe(true);
    expect(t.has("because")).toBe(false);
    expect(t.has("glaucoma")).toBe(false);
  });
});
