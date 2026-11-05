import { describe, it, expect } from "bun:test";
import { splitLong } from "../src/voice/audio";

describe("splitLong (audio file transcription)", () => {
  it("short file stays one piece", () => {
    expect(splitLong(new Float32Array(16000 * 5))).toEqual([[0, 80000]]);
  });
  it("covers a 60 s file with pieces of 10-20 s, no gaps", () => {
    const s = new Float32Array(16000 * 60).map((_, i) => Math.sin(i / 5) * 0.3);
    const r = splitLong(s);
    expect(r[0][0]).toBe(0);
    expect(r[r.length - 1][1]).toBe(s.length);
    for (let i = 1; i < r.length; i++) expect(r[i][0]).toBe(r[i - 1][1]);
    for (const [a, b] of r.slice(0, -1)) { expect(b - a).toBeGreaterThanOrEqual(16000 * 10); expect(b - a).toBeLessThanOrEqual(16000 * 20); }
  });
  it("cuts at the silent gap", () => {
    const s = new Float32Array(16000 * 30).fill(0.3);
    s.fill(0, 16000 * 14, 16000 * 14.5);
    const [[, cut]] = splitLong(s);
    expect(cut).toBeGreaterThanOrEqual(16000 * 14);
    expect(cut).toBeLessThanOrEqual(16000 * 14.5);
  });
});

import { joinPiece } from "../src/voice/audio";
describe("tables across pieces", () => {
  it("new row after a table goes on its own line", () => {
    expect(joinPiece("| A | B |\n| --- | --- |", "| 1 | 2 |")).toBe("\n| 1 | 2 |");
  });
  it("normal text after a table starts a new paragraph", () => {
    expect(joinPiece("| A | B |\n| --- | --- |\n| 1 | 2 |", "Aage padhai.")).toBe("\n\nAage padhai.");
  });
});

import { cleanPiece } from "../src/voice/client";
describe("cleanPiece (1.9.20)", () => {
  it("drops trailing and leading ellipses", () => {
    expect(cleanPiece("Toh mar jaate, aur papa...")).toBe("Toh mar jaate, aur papa");
    expect(cleanPiece("... 3 saal ka mehnat")).toBe("3 saal ka mehnat");
  });
  it("mid ellipsis becomes a space or a full stop", () => {
    expect(cleanPiece("Aur saara... mehnat.")).toBe("Aur saara mehnat.");
    expect(cleanPiece("Doctor… Taaki hum")).toBe("Doctor. Taaki hum");
  });
  it("keeps numbers and normal text", () => {
    expect(cleanPiece("NEET 2027 clear hui hai.")).toBe("NEET 2027 clear hui hai.");
  });
});
