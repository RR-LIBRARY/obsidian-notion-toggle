/**
 * v1.4.14 — the reported "filter save nahi hota / galat toggles par rukta hai"
 * bug: the two pickers used to write different keys, so a choice made in one
 * had no effect on the other.
 */
import { describe, expect, it } from "vitest";
import {
  applyQuizFilter,
  applyScrollFilter,
  effectiveQuizFilter,
  type FilterSettings,
} from "../src/filter-sync";
import { matchesFilter, kindOf } from "../src/autoscroll";

const base = (): FilterSettings => ({
  scrollFilter: [],
  quizFilter: [],
  quizUseColorFilter: true,
});

describe("v1.4.14 — picker choices stay in sync", () => {
  it("autoscroll pick reaches the quiz", () => {
    const s = applyScrollFilter(base(), ["important"]);
    expect(s.scrollFilter).toEqual(["important"]);
    expect(effectiveQuizFilter(s)).toEqual(["important"]);
  });

  it("a stale quiz pick no longer overrides a newer autoscroll pick", () => {
    let s = applyQuizFilter(base(), ["red"]);
    s = applyScrollFilter(s, ["todo", "quote"]);
    expect(effectiveQuizFilter(s)).toEqual(["todo", "quote"]);
  });

  it("quiz pick reaches autoscroll and enables the filter", () => {
    const s = applyQuizFilter({ ...base(), quizUseColorFilter: false }, ["bug"]);
    expect(s.scrollFilter).toEqual(["bug"]);
    expect(s.quizUseColorFilter).toBe(true);
    expect(effectiveQuizFilter(s)).toEqual(["bug"]);
  });

  it("choices survive a settings round trip", () => {
    const s = applyScrollFilter(base(), ["failure", "danger"]);
    const reloaded: FilterSettings = JSON.parse(JSON.stringify(s));
    expect(effectiveQuizFilter(reloaded)).toEqual(["failure", "danger"]);
    expect(reloaded.scrollFilter).toEqual(["failure", "danger"]);
  });

  it("selection order does not change the stored filter", () => {
    const a = applyScrollFilter(base(), ["quote", "red"]);
    const b = applyScrollFilter(base(), ["red", "quote"]);
    expect(a.scrollFilter).toEqual(b.scrollFilter);
  });

  it("the mirrored filter still matches the right kinds", () => {
    const s = applyScrollFilter(base(), ["important"]);
    expect(matchesFilter(kindOf("important"), effectiveQuizFilter(s))).toBe(true);
    expect(matchesFilter(kindOf("recall-red"), effectiveQuizFilter(s))).toBe(false);
    expect(matchesFilter(kindOf("note"), effectiveQuizFilter(s))).toBe(false);
  });

  it("turning the quiz filter off asks about every toggle", () => {
    const s = applyScrollFilter({ ...base(), quizUseColorFilter: false }, ["red"]);
    expect(effectiveQuizFilter(s)).toEqual([]);
  });
});
