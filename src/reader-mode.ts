/**
 * v1.5.1 — autoscroll switches the note into Obsidian's Reading View.
 *
 * Why: Live Preview rebuilds sections while CodeMirror virtualises them, so a
 * long run could scroll over half-rendered blocks. Reading View gives one
 * stable DOM surface on desktop and mobile alike, which is exactly what the
 * stop planner and the container detection expect.
 *
 * This module stays free of Obsidian imports (architecture guardrail): the
 * leaf and view are duck-typed, so the whole transition is unit-testable.
 */

export type ReaderMode = "source" | "preview";

export interface ModeSnapshot {
  /** The mode the note was in before autoscroll took over. */
  mode: ReaderMode;
  /** Should stopping the run put that mode back? */
  shouldRestore: boolean;
}

/** Minimal shape of a MarkdownView for mode purposes. */
export interface ModeView {
  getMode(): string;
  getState(): object;
}

/** Minimal shape of a WorkspaceLeaf for mode purposes. */
export interface ModeLeaf {
  getViewState(): object;
  setViewState(state: object, eState?: unknown): unknown;
}

export function snapshotMode(mode: string | undefined, restore: boolean): ModeSnapshot {
  const normalized: ReaderMode = mode === "preview" ? "preview" : "source";
  return { mode: normalized, shouldRestore: restore && normalized !== "preview" };
}

/** Is a switch needed at all? Reading View already satisfies the run. */
export function needsReadingMode(mode: string | undefined, forceReading: boolean): boolean {
  return forceReading && mode !== "preview";
}

function withMode(leafState: object, viewState: object, mode: ReaderMode): object {
  return { ...leafState, state: { ...viewState, mode } };
}

/**
 * Switch the leaf into Reading View, remembering the old mode once per run.
 * Returns the snapshot to keep (null when nothing changed).
 */
export function enterReadingMode(
  leaf: ModeLeaf,
  view: ModeView,
  opts: { forceReading: boolean; restoreMode: boolean; existing: ModeSnapshot | null }
): ModeSnapshot | null {
  if (!needsReadingMode(view.getMode(), opts.forceReading)) return opts.existing;
  const snapshot = opts.existing ?? snapshotMode(view.getMode(), opts.restoreMode);
  leaf.setViewState(withMode(leaf.getViewState(), view.getState(), "preview"), { history: false });
  return snapshot;
}

/** Put the remembered mode back. No snapshot / preview-origin run = no-op. */
export function exitReadingMode(
  leaf: ModeLeaf | null,
  view: ModeView | null,
  snapshot: ModeSnapshot | null
): boolean {
  if (!snapshot?.shouldRestore || !leaf || !view) return false;
  leaf.setViewState(withMode(leaf.getViewState(), view.getState(), snapshot.mode), { history: false });
  return true;
}
