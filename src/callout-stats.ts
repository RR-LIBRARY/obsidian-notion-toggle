/**
 * v1.5.0 — per-kind counts and percentages for the active note.
 *
 * "Filter kaam nahi kar raha" was almost always "this note has none of that
 * kind". Counting every kind (including the zeroes) makes that visible in the
 * picker and in the stats panel instead of leaving it to guesswork.
 *
 * Pure module — no Obsidian, no DOM.
 */

import { CALLOUT_KINDS, GRADED_COLORS, type RecallColor } from "./autoscroll";
import { metaOf } from "./callout-catalog";

export interface KindCount {
  kind: RecallColor;
  icon: string;
  name: string;
  word: string;
  count: number;
  /** 0..100, rounded to one decimal. */
  percent: number;
}

/** All kinds in report order: traffic lights, then callouts, then ungraded. */
export const REPORT_ORDER: RecallColor[] = [
  ...GRADED_COLORS,
  ...CALLOUT_KINDS,
  "other" as RecallColor,
];

export function percentOf(count: number, total: number): number {
  if (!total || count <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

/** Count every kind found in `kinds`; zero rows are kept on purpose. */
export function countKinds(kinds: RecallColor[]): KindCount[] {
  const total = kinds.length;
  const tally = new Map<RecallColor, number>();
  for (const k of kinds) tally.set(k, (tally.get(k) ?? 0) + 1);
  return REPORT_ORDER.map((kind) => {
    const meta = metaOf(kind);
    const count = tally.get(kind) ?? 0;
    return {
      kind,
      icon: meta.icon,
      name: meta.name,
      word: meta.word,
      count,
      percent: percentOf(count, total),
    };
  });
}

/** Only the kinds this note actually has, biggest first. */
export function presentKinds(rows: KindCount[]): KindCount[] {
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
}

/** "4 · 5.5%" — the inline suffix used in picker rows. */
export function countBadge(row: KindCount | undefined): string {
  if (!row) return "";
  if (row.count === 0) return "0";
  return `${row.count} · ${row.percent}%`;
}

/** Markdown table for the "Copy callout breakdown" command. */
export function breakdownTable(rows: KindCount[], total: number): string {
  const present = presentKinds(rows);
  const head = ["| Type | Callout | Count | % of note |", "|---|---|---:|---:|"];
  const body = present.map(
    (r) => `| ${r.icon} ${r.name} | \`${r.word}\` | ${r.count} | ${r.percent}% |`
  );
  const foot = `| **Total** | | **${total}** | 100% |`;
  if (present.length === 0) return "No toggles found in this note.";
  return [...head, ...body, foot].join("\n");
}

/** One-line summary for notices and the debug overlay. */
export function breakdownSummary(rows: KindCount[], total: number): string {
  const present = presentKinds(rows);
  if (!present.length) return "no toggles";
  return `${total} toggles · ${present
    .map((r) => `${r.icon} ${r.count} (${r.percent}%)`)
    .join(" · ")}`;
}
