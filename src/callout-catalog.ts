/**
 * v1.5.0 — one catalog for every filter kind.
 *
 * The picker, the stats breakdown, the playground note and the manual all used
 * to spell the same list out by hand, which is how `!important` and friends
 * ended up missing from one place and present in another. This module is the
 * single source: icon, human name, real callout word and Obsidian's aliases.
 *
 * Pure module — no Obsidian, no DOM.
 */

import { CALLOUT_KINDS, COLOR_ICON, GRADED_COLORS, KIND_WORD_ALIASES, type RecallColor } from "./autoscroll";

export interface KindMeta {
  kind: RecallColor;
  icon: string;
  /** Human name shown in the picker rows. */
  name: string;
  /** The callout word you type in the note, e.g. `!important`. */
  word: string;
  /** Extra words Obsidian accepts for the same kind. */
  aliases: string[];
  /** Deep-link `filter=` value. */
  param: string;
}

const NAMES: Partial<Record<RecallColor, string>> = {
  red: "Red — didn't know",
  yellow: "Yellow — half known",
  green: "Green — known",
  question: "Question",
  info: "Info",
  note: "Note",
  abstract: "Abstract / summary",
  tip: "Tip / hint",
  warning: "Warning",
  success: "Success",
  todo: "Todo",
  important: "Important",
  failure: "Failure",
  danger: "Danger / error",
  bug: "Bug",
  example: "Example",
  quote: "Quote",
  other: "Ungraded — anything else",
};

/** Alias words that resolve to `kind`, in a stable order. */
export function aliasesOf(kind: RecallColor): string[] {
  return Object.entries(KIND_WORD_ALIASES)
    .filter(([, target]) => target === kind)
    .map(([word]) => word)
    .sort();
}

export function metaOf(kind: RecallColor): KindMeta {
  const aliases = aliasesOf(kind);
  const graded = GRADED_COLORS.includes(kind);
  return {
    kind,
    icon: COLOR_ICON[kind],
    name: NAMES[kind] ?? kind,
    word: graded ? `!recall-${kind}` : kind === "other" ? "(no matching type)" : `!${kind}`,
    aliases,
    param: kind,
  };
}

/** Every callout kind (no traffic lights), in picker order. */
export const CALLOUT_META: KindMeta[] = CALLOUT_KINDS.map(metaOf);

/** Traffic-light kinds plus the ungraded wildcard. */
export const GRADED_META: KindMeta[] = [...GRADED_COLORS, "other" as RecallColor].map(metaOf);

/** "❗ Important — !important" */
export function kindLabel(kind: RecallColor): string {
  const m = metaOf(kind);
  return `${m.icon} ${m.name} — ${m.word}`;
}

/** "!failure / !fail / !missing" */
export function kindWords(kind: RecallColor): string {
  const m = metaOf(kind);
  return [m.word, ...m.aliases.map((a) => `!${a}`)].join(" / ");
}
