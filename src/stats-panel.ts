/**
 * v1.1.3 — "why is this toggle weak?" stats.
 *
 * The shuffle order comes out of the FSRS scheduler, which is opaque: you see
 * toggle 7 first and have to trust it. These helpers turn the same card numbers
 * the scheduler uses (difficulty, stability, retrievability, lapses) into rows
 * with a one-line reason, so the order is explainable.
 *
 * Pure module — no Obsidian, no DOM.
 */

import {
  elapsedDays,
  isDue,
  isNewCard,
  retrievability,
  type PageCard,
} from "./reader/fsrsScheduler";

export interface WeakRow {
  /** Toggle number in the note (1-based, same numbering the commands use). */
  ordinal: number;
  /** Recall probability right now, 0..1. */
  recall: number;
  /** 1..10, higher = harder for this reader. */
  difficulty: number;
  /** Memory stability in days. */
  stability: number;
  reps: number;
  lapses: number;
  daysSince: number;
  due: boolean;
  fresh: boolean;
  /** Plain-language reason this row sits where it does. */
  why: string;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function reason(row: Omit<WeakRow, "why">): string {
  if (row.fresh) return "never revised — new toggles get mixed in first";
  if (row.lapses >= 2) return `forgotten ${row.lapses}× — kept close`;
  if (row.due) return `recall ${pct(row.recall)} — due now`;
  if (row.difficulty >= 7) return `hard for you (D ${row.difficulty.toFixed(1)}) — comes back sooner`;
  if (row.stability >= 21) return `solid (${Math.round(row.stability)}d memory) — pushed far away`;
  return `recall ${pct(row.recall)} — not due yet`;
}

/**
 * Every toggle in range, weakest first — the same ordering signal the shuffle
 * route is built from (lowest retrievability wins, new cards count as 0).
 */
export function weakRows(
  cards: PageCard[],
  total: number,
  now = Date.now(),
  opts: { from?: number; to?: number; retention?: number; limit?: number } = {}
): WeakRow[] {
  const from = Math.max(1, opts.from && opts.from > 0 ? opts.from : 1);
  const to = Math.min(total, opts.to && opts.to > 0 ? opts.to : total);
  const byPage = new Map(cards.map((c) => [c.page, c]));
  const rows: WeakRow[] = [];
  for (let page = from; page <= to; page++) {
    const card = byPage.get(page);
    if (!card) continue;
    const base = {
      ordinal: page,
      recall: retrievability(card, now),
      difficulty: card.difficulty,
      stability: card.stability,
      reps: card.reps,
      lapses: card.lapses,
      daysSince: elapsedDays(card, now),
      due: isDue(card, now, opts.retention),
      fresh: isNewCard(card),
    };
    rows.push({ ...base, why: reason(base) });
  }
  rows.sort((a, b) => a.recall - b.recall || b.difficulty - a.difficulty || a.ordinal - b.ordinal);
  return typeof opts.limit === "number" ? rows.slice(0, opts.limit) : rows;
}

/** Compact label for one row, e.g. "#7 · 42% recall · D 7.4 · 2 lapses". */
export function rowLabel(row: WeakRow): string {
  const bits = [`#${row.ordinal}`];
  bits.push(row.fresh ? "new" : `${pct(row.recall)} recall`);
  if (!row.fresh) bits.push(`D ${row.difficulty.toFixed(1)}`);
  if (!row.fresh) bits.push(`S ${row.stability.toFixed(1)}d`);
  if (row.lapses > 0) bits.push(`${row.lapses} lapse${row.lapses === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

/** One sentence explaining the whole ordering, shown above the rows. */
export function orderExplainer(rows: WeakRow[]): string {
  if (rows.length === 0) return "No revision history for this note yet — run a shuffle to build it.";
  const due = rows.filter((r) => r.due && !r.fresh).length;
  const fresh = rows.filter((r) => r.fresh).length;
  const first = rows[0];
  return `Shuffle visits the lowest recall first: #${first.ordinal} (${
    first.fresh ? "new" : pct(first.recall)
  }) leads, ${due} due and ${fresh} new toggle${fresh === 1 ? "" : "s"} queued.`;
}
