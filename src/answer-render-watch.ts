/**
 * v1.7.2 — watch Obsidian build the rest of a note.
 *
 * Reading View creates sections lazily, so answers below the fold appear long
 * after "Open all / Close all" was tapped. This thin DOM shell notices those
 * inserts and asks the plugin to re-apply the remembered state, coalescing a
 * burst of inserts into one apply per frame.
 *
 * DOM only — no Obsidian import, so the rules stay unit-testable.
 */

export interface AnswerWatchDeps {
  /** Is a sticky Open all / Close all command in force? */
  active: () => boolean;
  /** Are *we* currently flipping toggles (then the inserts are our own)? */
  busy: () => boolean;
  /** Re-apply the remembered state to the active note. */
  apply: () => void;
  /** Frame scheduler (injected so tests can run it synchronously). */
  schedule: (fn: () => void) => void;
}

/**
 * Observe `target` for inserted nodes and apply the remembered answer state to
 * each new batch. Returns a disposer.
 */
export function watchAnswerRenders(target: Node, deps: AnswerWatchDeps): () => void {
  let queued = false;
  const run = () => {
    queued = false;
    if (deps.active()) deps.apply();
  };
  const observer = new MutationObserver((records) => {
    if (queued || deps.busy() || !deps.active()) return;
    for (const record of records) {
      if (record.addedNodes.length === 0) continue;
      queued = true;
      deps.schedule(run);
      return;
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/** Did the reader tap a fold arrow / callout title themselves? */
export function isManualToggleClick(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest?.(".callout-title, summary");
}
