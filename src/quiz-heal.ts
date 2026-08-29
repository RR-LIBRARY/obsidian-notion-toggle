/**
 * v1.3.2 — self-healing question elements for quiz mode.
 *
 * Obsidian's reading view re-renders sections while you scroll: the element a
 * question was captured from can be detached by the time its answer should be
 * revealed. `setQuizVisible` on a detached node changes nothing, so the reader
 * sees the question skipped entirely (Q21 → Q23 in the bug report).
 *
 * These helpers re-map the captured questions onto the elements that are in
 * the document *right now*, preferring the title text so the mapping survives
 * a partial re-render.
 */

/** Any captured question whose element is gone / detached? */
export function needsHeal(els: (HTMLElement | undefined)[]): boolean {
  return els.some((el) => !el || !el.isConnected);
}

/**
 * Re-map captured questions onto freshly collected elements.
 *
 * Same count → positional (cheapest, matches a plain re-render). Otherwise
 * match on the question title, consuming each fresh element at most once so
 * repeated titles still line up in document order.
 */
export function healQuizEls(
  current: (HTMLElement | undefined)[],
  titles: string[],
  fresh: HTMLElement[],
  titleOf: (el: HTMLElement) => string
): (HTMLElement | undefined)[] {
  const used = new Set<HTMLElement>();
  const norm = (s: string) => s.replace(/\s+/g, " ").trim();
  for (const el of current) if (el && el.isConnected) used.add(el);
  const sameCount = fresh.length === current.length;
  return current.map((el, i) => {
    if (el && el.isConnected) return el;
    const want = norm(titles[i] ?? "");
    // Title first — it survives a partial re-render where positions shift.
    const hit = want
      ? fresh.find((f) => !used.has(f) && norm(titleOf(f)) === want)
      : undefined;
    // Untitled question in a straight one-for-one re-render: fall back to the
    // element at the same position, as long as nothing else claimed it.
    const chosen =
      hit ?? (sameCount && fresh[i] && !used.has(fresh[i]) ? fresh[i] : undefined);
    if (chosen) used.add(chosen);
    return chosen ?? el;
  });
}


/**
 * Did the reveal actually put the answer on screen? A themed callout that was
 * re-rendered comes back with Obsidian's own collapsed markup, which our class
 * alone may not beat — the caller then falls back to a real open.
 */
export function revealLanded(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  if (el.tagName.toLowerCase() === "details") return (el as HTMLDetailsElement).open;
  const content = el.querySelector(".callout-content") as HTMLElement | null;
  if (!content) return false;
  const view = el.ownerDocument?.defaultView;
  if (view && typeof view.getComputedStyle === "function") {
    if (view.getComputedStyle(content).display === "none") return false;
  }
  return true;
}
