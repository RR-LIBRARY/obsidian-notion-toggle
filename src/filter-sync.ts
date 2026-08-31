/**
 * v1.4.14 — one source of truth for "which toggles am I filtering?".
 *
 * Before this module the two pickers wrote to two different settings keys:
 * the autoscroll picker only touched `scrollFilter`, while the quiz read
 * `quizFilter` whenever `quizUseColorFilter` was on. Picking a filter in the
 * autoscroll picker therefore looked like it "did not save" — the quiz kept
 * asking about whatever kinds were chosen in the quiz picker earlier, which is
 * exactly the "galat toggles par rukta hai" report.
 *
 * The rule now: choosing a filter in either picker sets both keys, so the two
 * pickers always agree and the choice survives a reload.
 */
import { normalizeFilter, type RecallColor } from "./autoscroll";

export interface FilterSettings {
  scrollFilter: RecallColor[];
  quizFilter: RecallColor[];
  quizUseColorFilter: boolean;
}

/** Filter the quiz actually runs with. */
export function effectiveQuizFilter(s: FilterSettings): RecallColor[] {
  if (!s.quizUseColorFilter) return [];
  return normalizeFilter(s.quizFilter.length ? s.quizFilter : s.scrollFilter);
}

/** Autoscroll picker choice — mirrored into the quiz so both pickers agree. */
export function applyScrollFilter<T extends FilterSettings>(s: T, filter: RecallColor[]): T {
  const next = normalizeFilter(filter);
  s.scrollFilter = next;
  s.quizFilter = next;
  return s;
}

/** Quiz picker choice — mirrored into autoscroll, and turns the filter on. */
export function applyQuizFilter<T extends FilterSettings>(s: T, filter: RecallColor[]): T {
  const next = normalizeFilter(filter);
  s.quizFilter = next;
  s.scrollFilter = next;
  s.quizUseColorFilter = true;
  return s;
}
