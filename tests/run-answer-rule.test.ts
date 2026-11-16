/** v1.9.29 — the reader's Open all / Close all wins over an autoscroll run's own open/close switches. */
import { describe, expect, test } from "bun:test";
import { runAnswerRule } from "../src/answer-state";

describe("runAnswerRule", () => {
  test("Open all: the run never closes an answer and skips the think countdown", () => {
    expect(runAnswerRule("open", true, true)).toEqual({ open: true, close: false, think: false });
  });
  test("Close all: the run never opens an answer", () => {
    expect(runAnswerRule("closed", true, true)).toEqual({ open: false, close: true, think: false });
  });
  test("no command: the run's own switches apply unchanged", () => {
    expect(runAnswerRule(null, true, true)).toEqual({ open: true, close: true, think: true });
    expect(runAnswerRule(null, false, false)).toEqual({ open: false, close: false, think: false });
  });
  test("Open all never forces the run to open when 'open on arrive' is off", () => {
    expect(runAnswerRule("open", false, true).open).toBe(false);
  });
});
