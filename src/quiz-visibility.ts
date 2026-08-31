/**
 * v1.3.0 — quiz open/close without touching Obsidian's fold state.
 *
 * The old path clicked `.callout-title`, which runs Obsidian's own fold
 * handler: it animates the fold and *persists* the fold state into the note's
 * view state. On mobile that produced the blinking seen in the screen
 * recording, and it silently rewrote the reader's collapsed/expanded note.
 *
 * Quiz mode now shows / hides the answer with plugin-owned classes only, so
 * Obsidian never sees a fold event and the note is byte-identical afterwards.
 */

/** Answer hidden by the quiz. */
export const QUIZ_HIDDEN_CLASS = "ntt-quiz-hidden";
/** Answer revealed by the quiz (overrides a natively collapsed callout). */
export const QUIZ_SHOWN_CLASS = "ntt-quiz-shown";
/** Set on `<body>` while a quiz runs: suppresses fold/transition animations. */
export const QUIZ_ACTIVE_CLASS = "ntt-quiz-active";

const isDetails = (el: HTMLElement) => el.tagName.toLowerCase() === "details";

/** Pre-quiz state of one toggle, so the note can be given back untouched. */
export interface ToggleSnapshot {
  /** `<details open>` before the quiz. */
  open: boolean;
}

export function snapshotToggle(el: HTMLElement): ToggleSnapshot {
  return { open: isDetails(el) ? (el as HTMLDetailsElement).open : false };
}

export function snapshotToggles(els: (HTMLElement | undefined)[]): ToggleSnapshot[] {
  return els.map((el) => (el ? snapshotToggle(el) : { open: false }));
}

/** Show / hide a toggle's body for the quiz — classes only, never a click. */
export function setQuizVisible(el: HTMLElement, visible: boolean): void {
  if (isDetails(el)) {
    // Native attribute: no Obsidian handler, no persisted fold state.
    (el as HTMLDetailsElement).open = visible;
    el.classList.toggle(QUIZ_SHOWN_CLASS, visible);
    el.classList.toggle(QUIZ_HIDDEN_CLASS, !visible);
    return;
  }
  el.classList.toggle(QUIZ_SHOWN_CLASS, visible);
  el.classList.toggle(QUIZ_HIDDEN_CLASS, !visible);
  const content = el.querySelector<HTMLElement>(".callout-content");
  if (!content) return;
  if (visible) {
    // The measured height lets CSS reveal the full answer without a fixed
    // max-height, which is important for long mobile answers.
    const height = Math.max(content.scrollHeight, content.getBoundingClientRect().height);
    content.style.setProperty("--ntt-reveal-height", `${height}px`);
  } else {
    content.style.removeProperty("--ntt-reveal-height");
  }
}

/** Is this toggle currently revealed by the quiz? */
export function isQuizVisible(el: HTMLElement): boolean {
  return el.classList.contains(QUIZ_SHOWN_CLASS);
}

/**
 * Quiz visibility rule: only `index` may be open, and only after the reveal.
 * With `closeOthers` off, already-answered questions stay readable.
 */
export function applyQuizVisibilityClasses(
  els: (HTMLElement | undefined)[],
  index: number,
  revealed: boolean,
  closeOthers: boolean
): void {
  els.forEach((el, i) => {
    if (!el) return;
    if (i === index) setQuizVisible(el, revealed);
    else if (closeOthers) setQuizVisible(el, false);
  });
}

/** Drop every quiz class and put `<details>` back to its pre-quiz state. */
export function clearQuizVisibility(
  els: (HTMLElement | undefined)[],
  snapshot: ToggleSnapshot[] = []
): void {
  els.forEach((el, i) => {
    if (!el) return;
    el.classList.remove(QUIZ_HIDDEN_CLASS, QUIZ_SHOWN_CLASS);
    el.querySelector<HTMLElement>(".callout-content")?.style.removeProperty("--ntt-reveal-height");
    if (isDetails(el)) (el as HTMLDetailsElement).open = !!snapshot[i]?.open;
  });
}
