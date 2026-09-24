/**
 * v1.7.0 — deep-research run bookkeeping (pure).
 */
import { describe, expect, test } from "bun:test";
import {
  MAX_TRACKED_RUNS,
  applyPoll,
  clipMarkdown,
  isActive,
  markConsumed,
  nextPollDelayMs,
  pruneRuns,
  removeRun,
  runLabel,
  sanitizeRuns,
  trackedFromRun,
  unconsumedRuns,
  upsertRun,
} from "../src/research/runs";
import { taskRun } from "./research-fixtures";

describe("poll cadence", () => {
  test("backs off from 6 s by 1.5× and caps at 30 s", () => {
    expect(nextPollDelayMs(0)).toBe(6000);
    expect(nextPollDelayMs(1)).toBe(9000);
    expect(nextPollDelayMs(2)).toBe(13500);
    expect(nextPollDelayMs(10)).toBe(30000);
    expect(nextPollDelayMs(-3)).toBe(6000);
  });
});

describe("tracking", () => {
  test("a fresh run is tracked without a report and unconsumed", () => {
    const t = trackedFromRun(taskRun());
    expect(t).toMatchObject({ runId: "trun_1", status: "queued", markdown: null, consumed: false, notePath: "notes/silk.md" });
    expect(isActive(t)).toBe(true);
  });

  test("a poll that completes the run stores the (clipped) markdown and keeps `consumed`", () => {
    const runs = markConsumed([trackedFromRun(taskRun())], "trun_1");
    const done = taskRun({ status: "completed", result: { markdown: "# Report", content: {}, basis: [], sources: [] } });
    const next = applyPoll(runs, done);
    expect(next[0]).toMatchObject({ status: "completed", markdown: "# Report", consumed: true });
    expect(unconsumedRuns(next)).toHaveLength(0);
    expect(unconsumedRuns(applyPoll([trackedFromRun(taskRun())], done))).toHaveLength(1);
  });

  test("very long reports are clipped with a pointer back to the panel", () => {
    const md = clipMarkdown("x".repeat(70_000));
    expect(md.length).toBeLessThan(70_000);
    expect(md).toContain("truncated");
  });

  test("upsert replaces by id and removeRun drops by id", () => {
    const a = trackedFromRun(taskRun({ runId: "a" }));
    const b = trackedFromRun(taskRun({ runId: "b" }));
    const runs = upsertRun(upsertRun([], a), b);
    expect(runs.map((r) => r.runId)).toEqual(["a", "b"]);
    expect(upsertRun(runs, { ...a, status: "failed" })[0].status).toBe("failed");
    expect(removeRun(runs, "a").map((r) => r.runId)).toEqual(["b"]);
  });

  test("pruning drops old finished runs before any active one", () => {
    const runs = Array.from({ length: MAX_TRACKED_RUNS + 3 }, (_, i) =>
      trackedFromRun(
        taskRun({
          runId: `r${i}`,
          status: i < 3 ? "running" : "completed",
          createdAt: new Date(2026, 0, 1, 0, i).toISOString(),
        })
      )
    );
    const kept = pruneRuns(runs);
    expect(kept).toHaveLength(MAX_TRACKED_RUNS);
    expect(kept.filter(isActive)).toHaveLength(3);
    expect(kept.map((r) => r.runId)).not.toContain("r3");
  });
});

describe("sanitizeRuns", () => {
  test("rejects junk and repairs partial entries", () => {
    const out = sanitizeRuns([null, 4, { runId: "" }, { runId: "ok", status: "weird", preset: "nope", processor: "x", markdown: 5 }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ runId: "ok", status: "running", preset: "report", processor: "core", markdown: null, consumed: false });
    expect(sanitizeRuns("nope")).toEqual([]);
  });
});

describe("labels", () => {
  test("runLabel collapses whitespace, clips, and falls back to the preset", () => {
    expect(runLabel({ objective: "  a   b ", preset: "report" })).toBe("a b");
    expect(runLabel({ objective: "x".repeat(80), preset: "report" }, 10)).toBe("xxxxxxxxx…");
    expect(runLabel({ objective: "", preset: "timeline" })).toBe("timeline");
  });
});
