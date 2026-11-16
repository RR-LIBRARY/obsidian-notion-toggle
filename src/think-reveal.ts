/**
 * v1.9.30 — Think mode reveal + answer read time (pure, no Obsidian).
 *
 * Reported: during the 🤔 countdown the arrow was already ▼ (the callout was
 * opened and only its body hidden), so it looked as if the answer "opened"
 * before the timer ended. Now the run keeps the arrow closed while thinking and
 * opens it for real when the countdown hits 0 (`openAtArrival`).
 *
 * Answer read time: after the reveal the stop is held long enough to read the
 * answer — words ÷ words-per-second, clamped — on top of the normal hold.
 */

/** Open the toggle the moment the run arrives? Only when no countdown runs first. */
export function openAtArrival(mayOpen: boolean, thinkMs: number): boolean {
  return mayOpen && !(thinkMs > 0);
}

/** Words in an answer (Latin + Devanagari etc.; any non-space run counts). */
export function wordCount(text: string | null | undefined): number {
  const t = (text ?? "").trim();
  return t ? t.split(/\s+/).length : 0;
}

/**
 * Extra hold for reading the answer, in ms. `wps <= 0` turns it off.
 * The base hold already covers a short answer, so only the time beyond it is added.
 */
export function answerReadMs(text: string | null | undefined, wps: number, baseHoldMs: number, maxSec: number): number {
  if (!(wps > 0)) return 0;
  const need = (wordCount(text) / wps) * 1000;
  const cap = Math.max(0, maxSec) * 1000;
  return Math.round(Math.max(0, Math.min(cap, need) - Math.max(0, baseHoldMs)));
}

/** The answer text of a callout / details toggle (title excluded). */
export function answerTextOf(el: HTMLElement | null | undefined): string {
  if (!el) return "";
  const body = el.querySelector(":scope > .callout-content") ?? el.querySelector(":scope > :not(summary)");
  return body?.textContent ?? "";
}
