/**
 * v1.7.0 — research results → note markdown.
 *
 * Every formatter is string in / string out and honours the reader's toggle
 * settings (callout type, collapsed, bold summary, `<details>` format), so a
 * research answer looks exactly like a hand-written toggle and takes part in
 * autoscroll, quiz and spaced repetition like any other. No Obsidian imports.
 */
import type { ToggleFormat } from "../editor-blocks";
import type {
  AnswerResponse,
  Citation,
  ExtractResponse,
  FactCheckResponse,
  PerplexityResponse,
  RecallCard,
  RecallResponse,
  SearchResponse,
  Source,
  TrackedRun,
} from "./types";
import { VERDICT_CALLOUT, VERDICT_LABELS } from "./types";

export interface ToggleStyle {
  calloutType: string;
  collapsed: boolean;
  boldSummary: boolean;
  format: ToggleFormat;
}

export interface FormatOptions {
  style: ToggleStyle;
  /** "toggle" wraps the result in a toggle; "markdown" inserts plain markdown. */
  insertStyle: "toggle" | "markdown";
  includeSources: boolean;
}

/* ---------- toggle skeleton ---------- */

/** One toggle: title + body lines, in the reader's chosen format. */
export function toggleBlock(title: string, bodyLines: string[], style: ToggleStyle, calloutType = style.calloutType): string {
  const cleanTitle = oneLine(title) || "Untitled";
  if (style.format === "details") {
    const openAttr = style.collapsed ? "" : " open";
    const inner = style.boldSummary ? `<b>${cleanTitle}</b>` : cleanTitle;
    const body = bodyLines.join("\n").trim();
    return `<details${openAttr}>\n<summary>${inner}</summary>\n\n${body}\n\n</details>\n`;
  }
  const fold = style.collapsed ? "-" : "+";
  const t = style.boldSummary && !cleanTitle.startsWith("**") ? `**${cleanTitle}**` : cleanTitle;
  const body = bodyLines.map((l) => (l.trim().length ? `> ${l}` : ">")).join("\n");
  return `> [!${calloutType}]${fold} ${t}\n${body}\n`;
}

export function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Split markdown into lines with blank lines preserved (for callout bodies). */
export function bodyLines(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").trim().split("\n");
}

/* ---------- sources & citations ---------- */

export function sourceLine(s: { url: string; title?: string | null }, index?: number): string {
  const title = oneLine(s.title ?? "") || hostnameOf(s.url);
  const n = index != null ? `${index}. ` : "- ";
  return `${n}[${escapeBrackets(title)}](${s.url})`;
}

export function sourcesSection(sources: Array<{ url: string; title?: string | null }>, heading = "Sources"): string[] {
  const unique = dedupeByUrl(sources);
  if (!unique.length) return [];
  return ["", `**${heading}**`, ...unique.map((s, i) => sourceLine(s, i + 1))];
}

export function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function escapeBrackets(text: string): string {
  return text.replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

/**
 * Turn character-range citations into numbered markers: "…fact[1]…" plus a
 * numbered source list in the same order. Ranges are applied back-to-front so
 * earlier offsets stay valid. Citations without offsets only join the list.
 */
export function applyCitations(answer: string, citations: Citation[]): { text: string; sources: Source[] } {
  const order: Source[] = [];
  const indexFor = (c: Citation): number => {
    let i = order.findIndex((s) => s.url === c.url);
    if (i < 0) {
      order.push({ url: c.url, title: c.title });
      i = order.length - 1;
    }
    return i + 1;
  };
  const positioned = citations
    .filter((c) => c.endIndex != null && c.endIndex >= 0 && c.endIndex <= answer.length)
    .map((c) => ({ c, at: c.endIndex as number }));
  // Assign numbers in reading order first so [1] appears before [2].
  const byStart = [...positioned].sort((a, b) => a.at - b.at);
  const numbers = new Map<Citation, number>();
  for (const p of byStart) numbers.set(p.c, indexFor(p.c));
  for (const c of citations) if (!numbers.has(c)) indexFor(c);

  let text = answer;
  const byEndDesc = [...positioned].sort((a, b) => b.at - a.at);
  const seenAt = new Map<number, Set<number>>();
  for (const p of byEndDesc) {
    const n = numbers.get(p.c) as number;
    const set = seenAt.get(p.at) ?? new Set<number>();
    if (set.has(n)) continue;
    set.add(n);
    seenAt.set(p.at, set);
    text = `${text.slice(0, p.at)}[${n}]${text.slice(p.at)}`;
  }
  return { text, sources: order };
}

/* ---------- formatters ---------- */

export function formatAnswer(res: AnswerResponse, opts: FormatOptions): string {
  const { text, sources } = applyCitations(res.answer, res.citations);
  const allSources = dedupeByUrl([...sources, ...res.sources]);
  const body = [...bodyLines(text), ...(opts.includeSources ? sourcesSection(allSources) : [])];
  if (opts.insertStyle === "markdown") return `${body.join("\n")}\n`;
  return toggleBlock(res.question, body, opts.style);
}

export function formatFactCheck(res: FactCheckResponse, opts: FormatOptions): string {
  const verdict = VERDICT_LABELS[res.verdict];
  const lines = [`**Verdict:** ${verdict} (${res.confidence} confidence)`, "", ...bodyLines(res.summary)];
  if (res.correction) lines.push("", `**Correction:** ${oneLine(res.correction)}`);
  if (opts.includeSources && res.sources.length) {
    lines.push("", "**Sources**");
    res.sources.forEach((s, i) => {
      lines.push(sourceLine(s, i + 1));
      if (s.quote) lines.push(`   > ${oneLine(s.quote)}`);
    });
  }
  if (opts.insertStyle === "markdown") return `**Claim:** ${oneLine(res.claim)}\n\n${lines.join("\n")}\n`;
  return toggleBlock(`Fact-check: ${res.claim}`, lines, opts.style, VERDICT_CALLOUT[res.verdict]);
}

export function formatSearch(res: SearchResponse, opts: FormatOptions): string {
  if (!res.results.length) return `_No results for "${oneLine(res.query)}"._\n`;
  if (opts.insertStyle === "markdown") {
    const lines = res.results.map((r) => {
      const excerpt = r.excerpts[0] ? ` — ${oneLine(r.excerpts[0]).slice(0, 240)}` : "";
      return `- [${escapeBrackets(r.title)}](${r.url})${r.publishDate ? ` (${r.publishDate.slice(0, 10)})` : ""}${excerpt}`;
    });
    return `${lines.join("\n")}\n`;
  }
  // One toggle per source: title = source, body = excerpts + link.
  return res.results
    .map((r) => {
      const lines: string[] = [];
      for (const e of r.excerpts.slice(0, 3)) lines.push(...bodyLines(e), "");
      lines.push(`Source: [${escapeBrackets(r.title)}](${r.url})${r.publishDate ? ` · ${r.publishDate.slice(0, 10)}` : ""}`);
      return toggleBlock(r.title, lines, opts.style);
    })
    .join("\n");
}

export function formatPerplexity(res: PerplexityResponse, opts: FormatOptions): string {
  if (!res.results.length) return `_No results for "${oneLine(res.query)}"._\n`;
  const lines = res.results.map(
    (r) =>
      `- [${escapeBrackets(r.title)}](${r.url})${r.date ? ` (${r.date.slice(0, 10)})` : ""}${r.snippet ? ` — ${oneLine(r.snippet).slice(0, 240)}` : ""}`
  );
  if (opts.insertStyle === "markdown") return `${lines.join("\n")}\n`;
  return toggleBlock(`Quick search: ${res.query}`, lines, opts.style);
}

export function formatExtract(res: ExtractResponse, opts: FormatOptions): string {
  const blocks = res.results.map((r) => {
    const content = r.fullContent ? bodyLines(r.fullContent) : r.excerpts.flatMap((e) => [...bodyLines(e), ""]);
    const lines = [...content, `Source: [${escapeBrackets(r.title)}](${r.url})${r.publishDate ? ` · ${r.publishDate.slice(0, 10)}` : ""}`];
    if (opts.insertStyle === "markdown") return `### ${r.title}\n\n${lines.join("\n")}\n`;
    return toggleBlock(r.title, lines, opts.style);
  });
  const failed = res.errors.map((e) => `- Could not read ${e.url} (${e.errorType}${e.httpStatus ? ` ${e.httpStatus}` : ""})`);
  return [...blocks, ...(failed.length ? [failed.join("\n") + "\n"] : [])].join("\n");
}

/** One recall card → one toggle in the plugin's own MCQ / Q&A / cloze shape. */
export function formatRecallCard(card: RecallCard, style: ToggleStyle, kind: RecallResponse["style"], number?: number): string {
  const num = number != null ? `${number}. ` : "";
  if (kind === "mcq" && card.options?.length) {
    const letters = "ABCDEFGH";
    const lines = card.options.map((o, i) => `- [ ] ${letters[i] ?? i + 1}. ${oneLine(o)}`);
    const correct =
      card.correctIndex != null && card.options[card.correctIndex] != null
        ? `${letters[card.correctIndex] ?? card.correctIndex + 1}. ${oneLine(card.options[card.correctIndex])}`
        : oneLine(card.answer);
    lines.push("", `**Answer:** ${correct}`);
    if (card.hint) lines.push(`_Hint: ${oneLine(card.hint)}_`);
    return toggleBlock(`${num}${card.question}`, lines, style);
  }
  const lines = bodyLines(card.answer);
  if (card.hint) lines.push("", `_Hint: ${oneLine(card.hint)}_`);
  return toggleBlock(`${num}${card.question}`, lines, style);
}

export function formatRecall(res: RecallResponse, opts: FormatOptions & { numbered?: boolean; startNumber?: number }): string {
  const start = opts.startNumber ?? 1;
  const cards = res.cards.map((c, i) => formatRecallCard(c, opts.style, res.style, opts.numbered ? start + i : undefined));
  const sources = opts.includeSources && res.sources.length ? [sourcesSection(res.sources).join("\n") + "\n"] : [];
  return [...cards, ...sources].join("\n");
}

export function formatRun(run: Pick<TrackedRun, "objective" | "markdown" | "preset">, opts: FormatOptions): string {
  const md = (run.markdown ?? "").trim() || "_The report is empty._";
  if (opts.insertStyle === "markdown") return `${md}\n`;
  // Reports are long: demote headings one level so they nest under the toggle title.
  const lines = bodyLines(md).map((l) => (/^#{1,5}\s/.test(l) ? `#${l}` : l));
  return toggleBlock(run.objective, lines, opts.style);
}

/** Title shown on result cards in the panel. */
export function summarize(text: string, max = 80): string {
  const t = oneLine(text);
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
