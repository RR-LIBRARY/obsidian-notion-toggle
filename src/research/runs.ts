/**
 * v1.7.0 — bookkeeping for background deep-research runs.
 *
 * Pure helpers over the `researchRuns` array stored in data.json: which runs
 * still need polling, how long to wait between polls, and how to keep the list
 * bounded so data.json never grows without limit. No Obsidian imports.
 */
import type { TaskRun, TrackedRun } from "./types";

/** Newest runs kept in settings (finished ones included, for "insert later"). */
export const MAX_TRACKED_RUNS = 20;
/** Result markdown kept per run — longer reports are re-fetched on insert. */
export const MAX_STORED_MARKDOWN = 60_000;

export const POLL_BASE_MS = 6_000;
export const POLL_MAX_MS = 30_000;

export function isActive(run: Pick<TrackedRun, "status">): boolean {
  return run.status === "queued" || run.status === "running";
}

export function activeRuns(runs: TrackedRun[]): TrackedRun[] {
  return runs.filter(isActive);
}

/** Finished runs the reader has not inserted or dismissed yet. */
export function unconsumedRuns(runs: TrackedRun[]): TrackedRun[] {
  return runs.filter((r) => r.status === "completed" && !r.consumed);
}

/**
 * Poll delay grows gently with the number of consecutive "still running"
 * answers: 6 s, 9 s, 13.5 s … capped at 30 s. Deep research takes minutes,
 * so hammering the bridge every few seconds only burns battery.
 */
export function nextPollDelayMs(attempt: number, base = POLL_BASE_MS, max = POLL_MAX_MS): number {
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(max, Math.round(base * Math.pow(1.5, n)));
}

export function trackedFromRun(run: TaskRun): TrackedRun {
  return {
    runId: run.runId,
    objective: run.objective,
    preset: run.preset,
    processor: run.processor,
    notePath: run.notePath,
    status: run.status,
    createdAt: run.createdAt,
    markdown: run.result ? clipMarkdown(run.result.markdown) : null,
    error: run.error,
    consumed: false,
  };
}

export function clipMarkdown(md: string, max = MAX_STORED_MARKDOWN): string {
  return md.length > max ? `${md.slice(0, max)}\n\n_(truncated — reopen from the research panel for the full report)_` : md;
}

/** Insert or update one run, keeping the newest MAX_TRACKED_RUNS entries. */
export function upsertRun(runs: TrackedRun[], next: TrackedRun, max = MAX_TRACKED_RUNS): TrackedRun[] {
  const idx = runs.findIndex((r) => r.runId === next.runId);
  const out = idx >= 0 ? runs.map((r, i) => (i === idx ? { ...r, ...next } : r)) : [...runs, next];
  return pruneRuns(out, max);
}

/** Apply a fresh poll result to the tracked entry; preserves `consumed`. */
export function applyPoll(runs: TrackedRun[], polled: TaskRun): TrackedRun[] {
  const existing = runs.find((r) => r.runId === polled.runId);
  const fresh = trackedFromRun(polled);
  return upsertRun(runs, { ...fresh, consumed: existing?.consumed ?? false });
}

export function markConsumed(runs: TrackedRun[], runId: string): TrackedRun[] {
  return runs.map((r) => (r.runId === runId ? { ...r, consumed: true } : r));
}

export function removeRun(runs: TrackedRun[], runId: string): TrackedRun[] {
  return runs.filter((r) => r.runId !== runId);
}

/**
 * Drop the oldest finished runs first, then the oldest of anything, until the
 * list fits. Active runs are only dropped when nothing else is left.
 */
export function pruneRuns(runs: TrackedRun[], max = MAX_TRACKED_RUNS): TrackedRun[] {
  if (runs.length <= max) return runs;
  const sorted = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const finished = sorted.filter((r) => !isActive(r));
  const active = sorted.filter(isActive);
  const keepFinished = finished.slice(Math.max(0, finished.length - Math.max(0, max - active.length)));
  const kept = [...active, ...keepFinished].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return kept.slice(Math.max(0, kept.length - max));
}

/** Sanitise whatever an old data.json stored under `researchRuns`. */
export function sanitizeRuns(raw: unknown): TrackedRun[] {
  if (!Array.isArray(raw)) return [];
  const out: TrackedRun[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Partial<TrackedRun>;
    if (typeof r.runId !== "string" || !r.runId) continue;
    out.push({
      runId: r.runId,
      objective: typeof r.objective === "string" ? r.objective : "",
      preset: isPreset(r.preset) ? r.preset : "report",
      processor: isProcessor(r.processor) ? r.processor : "core",
      notePath: typeof r.notePath === "string" ? r.notePath : null,
      status: isStatus(r.status) ? r.status : "running",
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(0).toISOString(),
      markdown: typeof r.markdown === "string" ? clipMarkdown(r.markdown) : null,
      error: typeof r.error === "string" ? r.error : null,
      consumed: !!r.consumed,
    });
  }
  return pruneRuns(out);
}

function isPreset(v: unknown): v is TrackedRun["preset"] {
  return v === "report" || v === "key_facts" || v === "compare" || v === "timeline" || v === "literature";
}
function isProcessor(v: unknown): v is TrackedRun["processor"] {
  return v === "lite" || v === "base" || v === "core" || v === "pro";
}
function isStatus(v: unknown): v is TrackedRun["status"] {
  return v === "queued" || v === "running" || v === "completed" || v === "failed" || v === "cancelled";
}

/** Short human label for a run row. */
export function runLabel(run: Pick<TrackedRun, "objective" | "preset">, max = 64): string {
  const text = run.objective.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text || run.preset;
}
