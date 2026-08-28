import { describe, expect, test } from "bun:test";
import {
  pruneCards,
  removeCardKey,
  renameCardKey,
  scheduleStoreSummary,
} from "../src/maintenance";

const store = () => ({ "A.md": 1, "folder/B.md": 2 });

describe("renameCardKey", () => {
  test("moves the card to the new path", () => {
    const { store: next, moved } = renameCardKey(store(), "A.md", "New/A.md");
    expect(moved).toBe(true);
    expect(next["New/A.md"]).toBe(1);
    expect("A.md" in next).toBe(false);
    expect(next["folder/B.md"]).toBe(2);
  });

  test("no-op for unknown or identical paths", () => {
    expect(renameCardKey(store(), "X.md", "Y.md").moved).toBe(false);
    expect(renameCardKey(store(), "A.md", "A.md").moved).toBe(false);
  });

  test("moved note wins over an existing destination card", () => {
    const { store: next } = renameCardKey(store(), "A.md", "folder/B.md");
    expect(next["folder/B.md"]).toBe(1);
    expect(Object.keys(next)).toEqual(["folder/B.md"]);
  });
});

describe("removeCardKey", () => {
  test("removes an existing card", () => {
    const { store: next, removed } = removeCardKey(store(), "A.md");
    expect(removed).toBe(true);
    expect(Object.keys(next)).toEqual(["folder/B.md"]);
  });

  test("no-op when absent", () => {
    const { store: next, removed } = removeCardKey(store(), "Z.md");
    expect(removed).toBe(false);
    expect(Object.keys(next).sort()).toEqual(["A.md", "folder/B.md"]);
  });
});

describe("pruneCards", () => {
  test("keeps only cards with an existing note", () => {
    const { store: next, removed } = pruneCards(store(), ["folder/B.md", "C.md"]);
    expect(Object.keys(next)).toEqual(["folder/B.md"]);
    expect(removed).toEqual(["A.md"]);
  });

  test("empty vault removes everything, sorted", () => {
    const { removed } = pruneCards(store(), []);
    expect(removed).toEqual(["A.md", "folder/B.md"]);
  });

  test("nothing removed when all notes exist", () => {
    const { removed } = pruneCards(store(), ["A.md", "folder/B.md"]);
    expect(removed).toEqual([]);
  });
});

describe("scheduleStoreSummary", () => {
  test("plural forms", () => {
    expect(scheduleStoreSummary(0)).toBe("No notes scheduled yet.");
    expect(scheduleStoreSummary(1)).toBe("1 note scheduled.");
    expect(scheduleStoreSummary(7)).toBe("7 notes scheduled.");
  });
});
