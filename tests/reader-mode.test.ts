/**
 * v1.5.1 — autoscroll must run in Obsidian's Reading View.
 *
 * The reader's complaint: starting autoscroll from Source / Live Preview
 * scrolled over half-rendered blocks. Now the run switches the note into
 * Reading View and puts the old mode back when it stops. These tests pin both
 * halves, including "don't touch a note that is already in Reading View".
 */
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_AUTOSCROLL,
} from "../src/autoscroll";
import {
  enterReadingMode,
  exitReadingMode,
  needsReadingMode,
  snapshotMode,
  type ModeLeaf,
  type ModeSnapshot,
  type ModeView,
} from "../src/reader-mode";

function fakeLeaf(mode: string) {
  const calls: Record<string, unknown>[] = [];
  const view: ModeView = {
    getMode: () => mode,
    getState: () => ({ mode, file: "note.md", source: mode === "source" }),
  };
  const leaf: ModeLeaf = {
    getViewState: () => ({ type: "markdown", active: true }),
    setViewState: (state) => {
      calls.push(state);
      return Promise.resolve();
    },
  };
  return { leaf, view, calls };
}

describe("reading mode defaults (v1.5.1)", () => {
  test("autoscroll forces Reading View and restores afterwards out of the box", () => {
    expect(DEFAULT_AUTOSCROLL.scrollForceReading).toBe(true);
    expect(DEFAULT_AUTOSCROLL.scrollRestoreMode).toBe(true);
  });

  test("a switch is only needed when the note is not already in Reading View", () => {
    expect(needsReadingMode("source", true)).toBe(true);
    expect(needsReadingMode("preview", true)).toBe(false);
    expect(needsReadingMode("source", false)).toBe(false);
  });

  test("the snapshot only promises a restore for a note that came from Source", () => {
    expect(snapshotMode("source", true)).toEqual({ mode: "source", shouldRestore: true });
    expect(snapshotMode("preview", true)).toEqual({ mode: "preview", shouldRestore: false });
    expect(snapshotMode("source", false)).toEqual({ mode: "source", shouldRestore: false });
  });
});

describe("entering Reading View (v1.5.1)", () => {
  test("a Source note is switched to preview, keeping the rest of the view state", () => {
    const { leaf, view, calls } = fakeLeaf("source");
    const snap = enterReadingMode(leaf, view, {
      forceReading: true,
      restoreMode: true,
      existing: null,
    });
    expect(snap).toEqual({ mode: "source", shouldRestore: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ type: "markdown", active: true });
    expect((calls[0].state as Record<string, unknown>).mode).toBe("preview");
    // the file the leaf was showing is never dropped by the switch
    expect((calls[0].state as Record<string, unknown>).file).toBe("note.md");
  });

  test("a note already in Reading View is left completely alone", () => {
    const { leaf, view, calls } = fakeLeaf("preview");
    expect(enterReadingMode(leaf, view, { forceReading: true, restoreMode: true, existing: null })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("with the setting off, the reader's own mode wins", () => {
    const { leaf, view, calls } = fakeLeaf("source");
    expect(enterReadingMode(leaf, view, { forceReading: false, restoreMode: true, existing: null })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  test("a re-entry during the same run keeps the first snapshot", () => {
    const { leaf, view } = fakeLeaf("source");
    const existing: ModeSnapshot = { mode: "source", shouldRestore: true };
    const snap = enterReadingMode(leaf, view, { forceReading: true, restoreMode: true, existing });
    expect(snap).toBe(existing);
  });
});

describe("leaving Reading View (v1.5.1)", () => {
  test("stopping restores the mode the note started in", () => {
    const { leaf, view, calls } = fakeLeaf("preview");
    const restored = exitReadingMode(leaf, view, { mode: "source", shouldRestore: true });
    expect(restored).toBe(true);
    expect((calls[0].state as Record<string, unknown>).mode).toBe("source");
  });

  test("a run started in Reading View leaves the note in Reading View", () => {
    const { leaf, view, calls } = fakeLeaf("preview");
    expect(exitReadingMode(leaf, view, { mode: "preview", shouldRestore: false })).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("restore off, or a closed leaf, never throws or touches another note", () => {
    const { leaf, view, calls } = fakeLeaf("preview");
    expect(exitReadingMode(leaf, view, { mode: "source", shouldRestore: false })).toBe(false);
    expect(exitReadingMode(null, view, { mode: "source", shouldRestore: true })).toBe(false);
    expect(exitReadingMode(leaf, null, { mode: "source", shouldRestore: true })).toBe(false);
    expect(exitReadingMode(leaf, view, null)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test("full round trip: source → autoscroll → stop → source", () => {
    const { leaf, view, calls } = fakeLeaf("source");
    const snap = enterReadingMode(leaf, view, { forceReading: true, restoreMode: true, existing: null });
    exitReadingMode(leaf, { getMode: () => "preview", getState: () => ({ mode: "preview" }) }, snap);
    expect(calls.map((c) => (c.state as Record<string, unknown>).mode)).toEqual(["preview", "source"]);
  });
});
