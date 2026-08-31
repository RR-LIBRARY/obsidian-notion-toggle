/**
 * v1.4.10 — which element does autoscroll actually write `scrollTop` to?
 *
 * The old inline picker in `main.ts` had two problems that produced the
 * "autoscroll runs but the page never moves" report:
 *
 *  1. its candidate list only knew desktop selectors (`.markdown-preview-view`,
 *     `.cm-scroller`) — on mobile the real scroller is often
 *     `.markdown-reading-view` / `.markdown-source-view` / `.view-content`, or
 *     the document itself;
 *  2. its last fallback returned *any* candidate, scrollable or not, so the
 *     loop happily wrote `scrollTop` into a wrapper that ignores it.
 *
 * This module is pure DOM (no Obsidian import) so both rules are unit-testable:
 * candidates are built here, and `pickScrollContainer` returns `null` rather
 * than a dead wrapper.
 */

/** Selectors that can hold the scroller, most specific first. */
export const VIEW_SCROLLER_SELECTORS = [
  ".markdown-preview-view",
  ".cm-scroller",
  ".markdown-reading-view",
  ".markdown-source-view",
  ".view-content",
] as const;

/** Can this element actually be scrolled? */
export function canScroll(el: Element | null | undefined): el is HTMLElement {
  const h = el as HTMLElement | null | undefined;
  return !!h && typeof h.scrollHeight === "number" && h.scrollHeight - h.clientHeight > 2;
}

/** Is the element on screen (not a hidden background tab)? */
export function isVisible(el: Element | null | undefined): el is HTMLElement {
  const h = el as HTMLElement | null | undefined;
  if (!h) return false;
  // happy-dom / detached nodes report `offsetParent === undefined`; only an
  // explicit `null` means "not rendered".
  return h.offsetParent !== null;
}

/**
 * Candidates inside the active markdown view. `root` is the preview-mode
 * container when present, `contentEl` the view's own element.
 */
export function viewScrollCandidates(
  root: Element | null | undefined,
  contentEl: Element | null | undefined
): HTMLElement[] {
  const out: (Element | null | undefined)[] = [];
  for (const scope of [root, contentEl]) {
    if (!scope) continue;
    for (const sel of VIEW_SCROLLER_SELECTORS) out.push(scope.querySelector(sel));
  }
  out.push(root, contentEl);
  return dedupe(out);
}

/**
 * Document-wide candidates: the active leaf first, then every matching
 * scroller, then the document scrollers themselves (mobile Obsidian scrolls
 * `document.documentElement` in some themes).
 */
export function documentScrollCandidates(doc: Document): HTMLElement[] {
  const out: (Element | null | undefined)[] = [];
  const leaf = doc.querySelector(".workspace-leaf.mod-active");
  for (const scope of [leaf, doc] as (Element | Document | null)[]) {
    if (!scope) continue;
    for (const sel of VIEW_SCROLLER_SELECTORS) {
      out.push(...Array.from(scope.querySelectorAll(sel)));
    }
  }
  out.push(doc.scrollingElement, doc.documentElement, doc.body);
  return dedupe(out);
}

/**
 * The first candidate that can really scroll — visible ones win. Returns
 * `null` when nothing in the list scrolls, so the caller can tell the reader
 * instead of spinning a loop that moves nothing.
 */
export function pickScrollContainer(candidates: (Element | null | undefined)[]): HTMLElement | null {
  for (const el of candidates) if (canScroll(el) && isVisible(el)) return el;
  for (const el of candidates) if (canScroll(el)) return el;
  return null;
}

/** First visible candidate, scrollable or not — used only for DOM scans. */
export function pickAnyContainer(candidates: (Element | null | undefined)[]): HTMLElement | null {
  const scroller = pickScrollContainer(candidates);
  if (scroller) return scroller;
  for (const el of candidates) if (isVisible(el)) return el;
  return (candidates.find(Boolean) as HTMLElement | undefined) ?? null;
}

function dedupe(list: (Element | null | undefined)[]): HTMLElement[] {
  const seen = new Set<Element>();
  const out: HTMLElement[] = [];
  for (const el of list) {
    if (!el || seen.has(el)) continue;
    seen.add(el);
    out.push(el as HTMLElement);
  }
  return out;
}

/** How long a run may make no progress before we call it stuck (ms). */
export const SCROLL_STUCK_MS = 3000;

/** Shown when the note has no scrollable container (or it never moves). */
export const MSG_NO_SCROLLER =
  "Autoscroll stopped: this view has nothing to scroll. Open the note in reading view (or make the note longer than one screen) and try again.";

/** Has the run made no progress long enough to be considered stuck? */
export function isScrollStuck(stuckSince: number, now: number): boolean {
  return stuckSince > 0 && now - stuckSince >= SCROLL_STUCK_MS;
}
