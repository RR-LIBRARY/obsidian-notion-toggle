/**
 * v1.5.4 — force Obsidian's Reading View to render the *whole* note.
 *
 * Root cause this module fixes: Obsidian's markdown preview is lazy. Sections
 * far from the viewport are emptied and kept only as height placeholders, so
 * `querySelectorAll(".callout")` at the top of a long note returns just the
 * first screenful. Every stop list was therefore built from a partial DOM:
 *
 *   - "No toggles match this selection (🔴 · every toggle)" on a note whose
 *     first red toggle is below the fold,
 *   - green (or any) toggles silently skipped,
 *   - the run opening the first few toggles and then only scrolling.
 *
 * Obsidian's preview renderer exposes a `showAll` flag that disables the lazy
 * window. It is an internal, so everything here is duck-typed and defensive:
 * on a build without it we simply report `forced: false` and the caller falls
 * back to progressive re-measuring.
 *
 * No Obsidian imports — the shape is structural, so this is unit-testable.
 */

export interface PreviewRenderer {
  showAll?: boolean;
  rerender?: (full?: boolean) => void;
}

export interface PreviewMode {
  renderer?: PreviewRenderer;
}

export interface FullRenderView {
  previewMode?: PreviewMode | null;
  getMode?: () => string;
}

export interface FullRenderHandle {
  renderer: PreviewRenderer | null;
  /** The flag value before we touched it, so reading stays lazy afterwards. */
  previous: boolean;
  /** Did we actually flip lazy rendering off? */
  forced: boolean;
}

export const NO_FULL_RENDER: FullRenderHandle = { renderer: null, previous: false, forced: false };

function rendererOf(view: FullRenderView | null | undefined): PreviewRenderer | null {
  const renderer = view?.previewMode?.renderer;
  return renderer && typeof renderer === "object" ? renderer : null;
}

/**
 * Render every section of the note now.
 *
 * Returns a handle for `restoreFullRender`. Safe to call repeatedly: when the
 * flag is already on, `forced` is false and the restore is a no-op, so nested
 * callers (autoscroll + quiz) never fight over the flag.
 */
export function ensureFullRender(view: FullRenderView | null | undefined): FullRenderHandle {
  const renderer = rendererOf(view);
  if (!renderer || typeof renderer.showAll !== "boolean") return NO_FULL_RENDER;
  const previous = renderer.showAll;
  if (previous) return { renderer, previous, forced: false };
  try {
    renderer.showAll = true;
    renderer.rerender?.(true);
  } catch {
    // An internal changed shape — keep going with lazy rendering.
    return NO_FULL_RENDER;
  }
  return { renderer, previous, forced: true };
}

/** Put lazy rendering back, so long notes stay light outside a run. */
export function restoreFullRender(handle: FullRenderHandle | null | undefined): boolean {
  if (!handle?.forced || !handle.renderer) return false;
  try {
    handle.renderer.showAll = handle.previous;
    handle.renderer.rerender?.(true);
  } catch {
    return false;
  }
  return true;
}
