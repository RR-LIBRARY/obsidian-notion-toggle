/**
 * v1.2.3 — DOM helpers for toggles (callouts and <details>), extracted from
 * main.ts so the quiz / autoscroll open-close behaviour can be tested for real
 * instead of being re-implemented inside a test file.
 */

export const TOGGLE_SELECTOR = ".callout, details, [data-callout]";

/** Every rendered toggle in `root`, outermost only (nested ones belong to their parent). */
export function collectToggleEls(root: ParentNode): HTMLElement[] {
  const nodes = Array.from(root.querySelectorAll(TOGGLE_SELECTOR)) as HTMLElement[];
  return nodes.filter((el) => !nodes.some((other) => other !== el && other.contains(el)));
}

/** Callout type / class string used for the colour filter. */
export function toggleTypeOf(el: HTMLElement): string {
  return (
    el.getAttribute("data-callout") ??
    (el.className || (el.tagName.toLowerCase() === "details" ? "details" : ""))
  );
}

/** Is this toggle currently expanded? */
export function isToggleOpen(el: HTMLElement): boolean {
  if (el.tagName.toLowerCase() === "details") return (el as HTMLDetailsElement).open;
  return !el.classList.contains("is-collapsed");
}

/**
 * Expand / collapse a toggle.
 *
 * `<details>` flips the native attribute; a callout is folded by Obsidian's
 * own title click handler, so we only click when the state really differs.
 * As a safety net (tests, or a theme without the handler) the class is synced
 * when the click did not change anything.
 */
export function setToggleOpen(el: HTMLElement, open: boolean): void {
  if (el.tagName.toLowerCase() === "details") {
    (el as HTMLDetailsElement).open = open;
    return;
  }
  if (isToggleOpen(el) === open) return;
  const title = el.querySelector(".callout-title") as HTMLElement | null;
  title?.click();
  if (isToggleOpen(el) !== open) el.classList.toggle("is-collapsed", !open);
}

/** Visible title text of a toggle (used for the per-question "⏱30" marker). */
export function toggleTitleOf(el: HTMLElement): string {
  if (el.tagName.toLowerCase() === "details") {
    return el.querySelector("summary")?.textContent ?? "";
  }
  return (
    el.querySelector(".callout-title-inner")?.textContent ??
    el.querySelector(".callout-title")?.textContent ??
    ""
  );
}

/**
 * Quiz visibility rule: only `index` may be open, and only when its answer has
 * been revealed. When `closeOthers` is false the already-revealed toggles stay
 * open so the reader can look back.
 */
export function applyQuizVisibility(
  els: (HTMLElement | undefined)[],
  index: number,
  revealed: boolean,
  closeOthers: boolean
): void {
  els.forEach((el, i) => {
    if (!el) return;
    if (i === index) setToggleOpen(el, revealed);
    else if (closeOthers) setToggleOpen(el, false);
  });
}

/** Put every toggle back to the open/closed state it had before a run. */
export function restoreToggles(els: (HTMLElement | undefined)[], wasOpen: boolean[]): void {
  els.forEach((el, i) => {
    if (el) setToggleOpen(el, !!wasOpen[i]);
  });
}
