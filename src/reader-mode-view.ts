/**
 * v1.5.1 — the thin Obsidian shell around `reader-mode.ts`.
 *
 * Declared as a UI shell (see tests/architecture.test.ts) because this is the
 * only place that needs `MarkdownView` to reach the active leaf; all of the
 * decision logic lives in the pure module next to it.
 */

import { MarkdownView, type App, type WorkspaceLeaf } from "obsidian";
import { enterReadingMode, exitReadingMode, needsReadingMode, type ModeSnapshot } from "./reader-mode";

export interface ReaderModeHandle {
  snapshot: ModeSnapshot | null;
  leaf: WorkspaceLeaf | null;
  /** True when the view mode actually changed and the DOM needs a repaint. */
  switched: boolean;
}

/** Move the active Markdown note into Reading View for an autoscroll run. */
export function ensureReadingView(
  app: App,
  opts: { forceReading: boolean; restoreMode: boolean; snapshot: ModeSnapshot | null; leaf: WorkspaceLeaf | null }
): ReaderModeHandle {
  const view = app.workspace.getActiveViewOfType(MarkdownView);
  const leaf = view?.leaf ?? null;
  if (!view || !leaf || !needsReadingMode(view.getMode(), opts.forceReading)) {
    return { snapshot: opts.snapshot, leaf: opts.leaf, switched: false };
  }
  const snapshot = enterReadingMode(leaf, view, {
    forceReading: true,
    restoreMode: opts.restoreMode,
    existing: opts.snapshot,
  });
  return { snapshot, leaf, switched: true };
}

/** Put back the mode of the exact leaf the run changed — never another note. */
export function restoreReadingView(leaf: WorkspaceLeaf | null, snapshot: ModeSnapshot | null): void {
  const view = leaf?.view instanceof MarkdownView ? leaf.view : null;
  exitReadingMode(leaf, view, snapshot);
}
