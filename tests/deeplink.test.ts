/**
 * v1.3.0 — obsidian://notion-toggle deep links.
 */
import { describe, expect, it } from "bun:test";
import { parseDeepLink, parseFilterParam } from "../src/deeplink";
import { QUIZ_SECONDS_MAX, QUIZ_SECONDS_MIN } from "../src/quiz";

describe("filter param", () => {
  it("accepts lists in any order and normalizes them", () => {
    expect(parseFilterParam("yellow,red")).toEqual(["red", "yellow"]);
    expect(parseFilterParam("red+green")).toEqual(["red", "green"]);
    expect(parseFilterParam("RED")).toEqual(["red"]);
  });

  it("understands the shorthands", () => {
    expect(parseFilterParam("all")).toEqual([]);
    expect(parseFilterParam("graded")).toEqual(["red", "yellow", "green"]);
  });

  it("ignores junk instead of guessing", () => {
    expect(parseFilterParam("purple")).toBeUndefined();
    expect(parseFilterParam(undefined)).toBeUndefined();
  });
});

describe("link parsing", () => {
  it("reads a full quiz link", () => {
    expect(
      parseDeepLink({ action: "quiz", file: "Bio/Alleles.md", filter: "red", seconds: "30" })
    ).toEqual({ action: "quiz", file: "Bio/Alleles.md", filter: ["red"], seconds: 30 });
  });

  it("clamps seconds and speed", () => {
    expect(parseDeepLink({ action: "quiz", seconds: "1" })?.seconds).toBe(QUIZ_SECONDS_MIN);
    expect(parseDeepLink({ action: "quiz", seconds: "99999" })?.seconds).toBe(QUIZ_SECONDS_MAX);
    expect(parseDeepLink({ action: "autoscroll", speed: "9999" })?.speed).toBe(600);
    expect(parseDeepLink({ action: "autoscroll", speed: "-4" })?.speed).toBeUndefined();
  });

  it("supports a bare stop link and rejects unknown actions", () => {
    expect(parseDeepLink({ action: "stop" })).toEqual({ action: "stop" });
    expect(parseDeepLink({ action: "explode" })).toBeNull();
    expect(parseDeepLink({})).toBeNull();
  });
});
