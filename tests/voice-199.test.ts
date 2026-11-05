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

import { linkPhrases, shinglesOf, type PhraseHit } from "../src/voice/client";
describe("voice line linking", () => {
  const build = (notes: Record<string, string>) => {
    const idx = new Map<string, PhraseHit[]>();
    for (const [note, body] of Object.entries(notes)) for (const [k, heading] of shinglesOf(body)) (idx.get(k) ?? idx.set(k, []).get(k)!).push({ note, heading });
    return idx;
  };
  const idx = build({ "My work": "# Voice\nOffline me card bolte waqt live text nahi dikhega.\n" });
  it("links a spoken line written in another note, with its heading", () => {
    expect(linkPhrases("Yaad rakho, offline me live text nahi dikhega theek hai.", build({ "My work": "## Voice\noffline me live text nahi dikhega" })))
      .toBe("Yaad rakho, [[My work#Voice|offline me live text nahi dikhega]] theek hai.");
  });
  it("extends across the longest matching run", () => {
    expect(linkPhrases("Card bolte waqt live text nahi dikhega.", idx)).toBe("[[My work#Voice|Card bolte waqt live text nahi dikhega]].");
  });
  it("needs 4+ matching words, skips current note and lines in 3+ notes", () => {
    expect(linkPhrases("live text nahi", idx)).toBe("live text nahi");
    expect(linkPhrases("live text nahi dikhega", idx, "My work")).toBe("live text nahi dikhega");
    const common = build({ A: "aaj ka din accha hai", B: "aaj ka din accha hai", C: "aaj ka din accha hai" });
    expect(linkPhrases("aaj ka din accha hai", common)).toBe("aaj ka din accha hai");
  });
  it("leaves existing links alone", () => {
    expect(linkPhrases("[[X]] live text nahi dikhega", idx)).toBe("[[X]] [[My work#Voice|live text nahi dikhega]]");
  });
});

describe("voice line linking — Hinglish spellings", () => {
  it("matches mein/me and nahin/nahi as the same word", () => {
    const idx = new Map<string, PhraseHit[]>();
    for (const [k, heading] of shinglesOf("## Voice\nOffline me live text nahi dikhega.")) idx.set(k, [{ note: "My work", heading }]);
    expect(linkPhrases("offline mein live text nahin dikhega", idx)).toBe("[[My work#Voice|offline mein live text nahin dikhega]]");
  });
});

import { clampTermOpts } from "../src/voice/client";
describe("term link settings", () => {
  const idx = new Map<string, string[]>([["kidney", ["Bio"]], ["revision", ["A", "B", "C", "D"]], ["glaucoma", ["Eye"]]]);
  it("default 7 letters: 6-letter word not linked, 8-letter linked", () => {
    expect(linkTerms("kidney glaucoma", idx)).toBe("kidney [[Eye|glaucoma]]");
  });
  it("shortest word 6 links 'kidney'", () => {
    expect(linkTerms("kidney", idx, "", 3, 6, 3)).toBe("[[Bio|kidney]]");
  });
  it("max notes 4 allows a word written in 4 notes", () => {
    expect(linkTerms("revision", idx, "", 3, 7, 3)).toBe("revision");
    expect(linkTerms("revision", idx, "", 3, 7, 4)).toBe("[[A|revision]]");
  });
  it("settings are clamped to safe ranges", () => {
    expect(clampTermOpts(2, 50)).toEqual({ minLen: 4, maxNotes: 10 });
    expect(clampTermOpts("x", undefined)).toEqual({ minLen: 7, maxNotes: 3 });
    expect(clampTermOpts(7, 0)).toEqual({ minLen: 7, maxNotes: 0 });
  });
});

import { autoMaxNotes, TERM_PRESETS } from "../src/voice/client";
describe("term link auto + presets", () => {
  it("auto max notes follows vault size", () => {
    expect(autoMaxNotes(50)).toBe(2);
    expect(autoMaxNotes(500)).toBe(3);
    expect(autoMaxNotes(1000)).toBe(3);
    expect(autoMaxNotes(5000)).toBe(5);
  });
  it("medical preset uses 9 letters and auto", () => {
    expect(TERM_PRESETS.technical).toMatchObject({ minLen: 9, maxNotes: 0 });
  });
});
