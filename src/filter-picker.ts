/**
 * v1.5.0 — the filter picker as data.
 *
 * 23 flat buttons did not fit a phone screen and gave no clue what
 * `!important` or `!quote` actually mean. The picker is now grouped and
 * collapsible, every row carries the real callout words, and the counts come
 * from the active note so an empty result is visibly "this note has none of
 * that kind" instead of "the filter is broken".
 *
 * Pure module — no Obsidian, no DOM.
 */

import { CALLOUT_KINDS, GRADED_COLORS, type RecallColor } from "./autoscroll";
import { CALLOUT_META, kindWords, metaOf } from "./callout-catalog";
import { countBadge, type KindCount } from "./callout-stats";

export interface FilterOption {
  label: string;
  /** Extra line under the label: the callout words that match. */
  hint?: string;
  filter: RecallColor[];
  /** Set for single-kind rows, so counts can be shown. */
  kind?: RecallColor;
}

export interface FilterGroup {
  id: string;
  label: string;
  /** Should the group start expanded? */
  open: boolean;
  options: FilterOption[];
}

const GRADED_OPTIONS: FilterOption[] = [
  { label: "⚪ All toggles (no filter)", filter: [] },
  { label: `🔴 ${metaOf("red").name}`, hint: "!recall-red", filter: ["red"], kind: "red" },
  { label: `🟡 ${metaOf("yellow").name}`, hint: "!recall-yellow", filter: ["yellow"], kind: "yellow" },
  { label: `🟢 ${metaOf("green").name}`, hint: "!recall-green", filter: ["green"], kind: "green" },
  { label: "🔴🟡 Red + Yellow (weak spots)", filter: ["red", "yellow"] },
  { label: "🔴🟡🟢 All graded toggles", filter: [...GRADED_COLORS] },
];

/** Groups in display order. */
export function filterGroups(): FilterGroup[] {
  return [
    { id: "graded", label: "🔴🟡🟢 Traffic light (recall grades)", open: true, options: GRADED_OPTIONS },
    {
      id: "callouts",
      label: `❓💡📝 Callout types (${CALLOUT_KINDS.length})`,
      open: false,
      options: [
        ...CALLOUT_META.map((m) => ({
          label: `${m.icon} ${m.name}`,
          hint: kindWords(m.kind),
          filter: [m.kind],
          kind: m.kind,
        })),
        { label: "❓💡📝 All built-in callouts", filter: [...CALLOUT_KINDS] },
      ],
    },
    {
      id: "everything",
      label: "🌐 Everything else",
      open: false,
      options: [
        {
          label: "⚪ Ungraded — anything without a grade",
          hint: "plain toggles and every non-graded callout",
          filter: ["other"],
          kind: "other",
        },
        {
          label: "🔴🟡🟢⚪ Everything, graded + ungraded",
          filter: [...GRADED_COLORS, "other" as RecallColor],
        },
      ],
    },
  ];
}

/** Flat list, for deep links, tests and anything that still wants one array. */
export function flatFilterOptions(): FilterOption[] {
  return filterGroups().flatMap((g) => g.options);
}

/** "❗ Important — 3 · 4.1%" style suffix for one row. */
export function optionCount(opt: FilterOption, rows: KindCount[]): string {
  if (!opt.kind) return "";
  return countBadge(rows.find((r) => r.kind === opt.kind));
}

/** Does this note have nothing of the row's kind? (row is dimmed, never hidden) */
export function isEmptyOption(opt: FilterOption, rows: KindCount[]): boolean {
  if (!opt.kind) return false;
  return (rows.find((r) => r.kind === opt.kind)?.count ?? 0) === 0;
}
