import { describe, expect, test } from "bun:test";
import { decorationsFor } from "../src/clean-toggles-view";

describe("v1.8.21 IME-safe 'Toggle' hint", () => {
  test("empty title hint is a line class at the header start, not an inline widget", () => {
    const out = decorationsFor([{ kind: "placeholder", pos: 15, key: 0 }]);
    expect(out.length).toBe(1);
    expect(out[0].from).toBe(0);
    expect((out[0].value.spec as { class?: string }).class).toBe("ntt-clean-empty-title");
    expect((out[0].value.spec as { widget?: unknown }).widget).toBeUndefined();
  });
});
