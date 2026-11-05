import { describe, expect, test } from "bun:test";
import { CursorAnchor } from "../src/voice/cursor";

describe("voice writes where the cursor is", () => {
  test("keeps writing after its own text while the cursor stays put", () => {
    const a = new CursorAnchor(10);
    expect(a.follow(10)).toBe(10);
    a.wrote(5);
    expect(a.follow(15)).toBe(15);
  });
  test("moves to the new spot when the user taps elsewhere mid-recording", () => {
    const a = new CursorAnchor(10);
    a.wrote(5);
    expect(a.follow(3)).toBe(3);
    a.wrote(4);
    expect(a.follow(7)).toBe(7);
  });
});
