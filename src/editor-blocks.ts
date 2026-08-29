/**
 * v1.3.1 — pure document/editor transforms extracted out of main.ts.
 *
 * Everything here is a string in / string out helper with no Obsidian imports,
 * which is why the whole file is directly unit-testable (tests/planner.test.ts).
 */
export type ToggleFormat = "callout" | "details";
/* ---------- Conversion logic ---------- */

/**
 * Convert all <details><summary>...</summary>...</details> blocks in a
 * document to Obsidian foldable callout toggles.
 *
 * Handles:
 *  - <summary><b>Q1. ...</b></summary>  (bold inside summary tag)
 *  - <summary>Q1. ...</summary>        (plain)
 *  - multiline bodies with lists, bold, links
 *  - attributes on <details> tags (e.g. <details open>)
 */
export function convertDetailsToCallouts(
  doc: string,
  calloutType: string,
  collapsed: boolean,
  boldSummary: boolean
): string {
  const fold = collapsed ? "-" : "+";
  // Match a single <details ...> ... </details> block (non-greedy, multiline)
  const detailsRegex = /<details(\s[^>]*)?>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g;

  return doc.replace(detailsRegex, (_match, _attrs: string, summaryRaw: string, bodyRaw: string) => {
    const summary = cleanInlineHtml(summaryRaw).trim();
    const title = boldSummary && !summary.startsWith("**") ? `**${summary}**` : summary;
    const bodyText = bodyRaw.trim();
    if (bodyText.length === 0) {
      return `> [!${calloutType}]${fold} ${title}`;
    }
    const bodyLines = bodyText.split("\n").map((line: string) => {
      const cleaned = cleanInlineHtml(line);
      return cleaned.trim().length === 0 ? ">" : `> ${cleaned}`;
    });
    return `> [!${calloutType}]${fold} ${title}\n${bodyLines.join("\n")}`;
  });
}

/**
 * Reverse: convert foldable callout toggles back to <details> blocks.
 * Only converts callouts that are collapsible (have +/- marker).
 */
export function convertCalloutsToDetails(doc: string): string {
  const lines = doc.split("\n");
  const out: string[] = [];
  let i = 0;
  let changed = false;

  while (i < lines.length) {
    const line = lines[i];
    // Match a collapsible callout start:  > [!type]+/- Title...
    const m = line.match(/^>\s*\[!([^\]]+)\]([+-])\s?(.*)$/);
    if (m) {
      const _type = m[1];
      const marker = m[2];
      const title = m[3].trim();
      const body: string[] = [];
      i++;
      // Collect contiguous callout body lines (lines starting with > )
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        // stop if we hit another callout start
        if (/^>\s*\[![^\]]+\][+-]/.test(lines[i])) break;
        const bodyLine = lines[i].replace(/^>\s?/, "");
        body.push(bodyLine);
        i++;
      }
      const openAttr = marker === "+" ? " open" : "";
      const summary = title.length > 0 ? `<summary>${title}</summary>` : "<summary></summary>";
      const bodyHtml = body.length > 0 ? "\n\n" + body.join("\n") : "";
      out.push(`<details${openAttr}>`);
      out.push(summary);
      out.push(bodyHtml);
      out.push("</details>");
      changed = true;
      continue;
    }
    out.push(line);
    i++;
  }

  return changed ? out.join("\n") : doc;
}

/**
 * Strip a small set of inline HTML that Obsidian's callout renderer doesn't
 * need: <b>/<strong>, <i>/<em>, <br>. Keeps markdown bold/italic/links intact.
 */
function cleanInlineHtml(text: string): string {
  return text
    .replace(/<b>/g, "**")
    .replace(/<\/b>/g, "**")
    .replace(/<strong>/g, "**")
    .replace(/<\/strong>/g, "**")
    .replace(/<i>/g, "*")
    .replace(/<\/i>/g, "*")
    .replace(/<em>/g, "*")
    .replace(/<\/em>/g, "*")
    .replace(/<br\s*\/?>/g, "")
    .trim();
}

/* ---------- Auto-numbering (pure, testable) ---------- */

/** A numbered callout toggle header: "> [!x]- **12. Question**" */
export const NUMBERED_HEADER = /^(>\s*\[![^\]]+\][+-]\s*(?:\*\*)?)(\d+)\.\s?/;
/** A numbered <summary>: "<summary><b>12. Question</b></summary>" */
export const NUMBERED_SUMMARY = /^(\s*<summary>(?:<b>)?)(\d+)\.\s?/;

/** Next number = (last numbered toggle found in these lines) + 1, else 1. */
export function nextToggleNumber(lines: string[]): number {
  let last = 0;
  for (const line of lines) {
    const m = line.match(NUMBERED_HEADER) ?? line.match(NUMBERED_SUMMARY);
    if (m) last = parseInt(m[2], 10);
  }
  return last + 1;
}

/** Rewrite every numbered toggle in the document as 1..N, in order. */
export function renumberToggles(doc: string): string {
  let n = 0;
  const out = doc.split("\n").map((line) => {
    const m = line.match(NUMBERED_HEADER) ?? line.match(NUMBERED_SUMMARY);
    if (!m) return line;
    n += 1;
    return line.replace(m[0], `${m[1]}${n}. `);
  });
  return n === 0 ? doc : out.join("\n");
}

/* ---------- MCQ + Match the following (pure, testable) ---------- */

/** "> - [ ] Something" — a checkbox option line inside a toggle. */
export const MCQ_OPTION = /^>\s*- \[[ xX]\]\s+\S/;
/** "> - [ ] " with nothing typed yet. */
export const MCQ_EMPTY_OPTION = /^>\s*- \[[ xX]\]\s*$/;
/** "> **Answer:** ..." line. */
export const ANSWER_LINE = /^>\s*\*\*Answer:\*\*/;
/** "> **Answer:** " with nothing filled in yet. */
export const EMPTY_ANSWER_LINE = /^>\s*\*\*Answer:\*\*\s*$/;
/** A "Match the following" data row: "> | 2 | A | 2. B |". */
export const MATCH_ROW = /^>\s*\|\s*(\d+)\s*\|(.*)\|\s*$/;
/** A match row where both columns are still blank. */
export const EMPTY_MATCH_ROW = /^>\s*\|\s*\d*\s*\|\s*\|\s*\d*\.?\s*\|\s*$/;
/** The "|---|---|---|" separator row. */
export const MATCH_SEPARATOR = /^>\s*\|[\s-|]+\|\s*$/;

/**
 * Flip "- [ ]" <-> "- [x]" on a checkbox option line.
 * Works for callout lines ("> - [ ] a"), plain list lines and <details> bodies.
 * Non-option lines are returned unchanged.
 */
export function toggleOptionCheckbox(line: string): string {
  const m = line.match(/^(\s*(?:>\s*)?-\s\[)([ xX])(\].*)$/);
  if (!m) return line;
  return `${m[1]}${m[2] === " " ? "x" : " "}${m[3]}`;
}

/** Build the next empty match row after a given row number. */
export function nextMatchRow(rowNumber: number): string {
  const n = rowNumber + 1;
  return `| ${n} |  | ${n}.  |`;
}


export interface QuestionBlockOptions extends EnterOptions {
  /** Options (MCQ) or rows (match) to generate. */
  count: number;
  /** Number prefix to place in the question title (already resolved). */
  number?: number;
  /** Title text for the question line (default empty so the caret starts there). */
  title?: string;
}

/** Shared skeleton builder: header + body lines, with caret inside the title. */
function buildToggleBlock(
  opts: QuestionBlockOptions,
  bodyLines: string[]
): { text: string; cursorOffset: number } {
  const num = opts.numbered && opts.number ? `${opts.number}. ` : "";
  const title = opts.title ?? "";

  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";
    const body = bodyLines.join("\n");
    const head = `<details${openAttr}>\n${sOpen}${num}`;
    const text = `${head}${title}${sClose}\n\n${body}\n\n</details>\n`;
    return { text, cursorOffset: head.length + title.length };
  }

  const fold = opts.collapsed ? "-" : "+";
  const bold = opts.boldSummary ? "**" : "";
  const head = `> [!${opts.calloutType}]${fold} ${bold}${num}`;
  const body = bodyLines.map((l) => (l.length ? `> ${l}` : "> ")).join("\n");
  const text = `${head}${title}${bold}\n${body}\n`;
  return { text, cursorOffset: head.length + title.length };
}

/** MCQ skeleton: question toggle with checkbox options (+ optional answer line). */
export function buildMcqBlock(opts: QuestionBlockOptions): { text: string; cursorOffset: number } {
  const count = Math.max(2, Math.min(6, opts.count || 4));
  const lines: string[] = [];
  for (let i = 0; i < count; i++) lines.push("- [ ] ");
  if (opts.addAnswerLine !== false) {
    lines.push("");
    lines.push("**Answer:** ");
  }
  return buildToggleBlock(opts, lines);
}

/** "Match the following" skeleton: a two-column table inside the toggle. */
export function buildMatchBlock(opts: QuestionBlockOptions): { text: string; cursorOffset: number } {
  const rows = Math.max(2, Math.min(8, opts.count || 4));
  const lines: string[] = ["| # | Column A | Column B |", "|---|---|---|"];
  for (let i = 1; i <= rows; i++) lines.push(`| ${i} |  | ${i}.  |`);
  if (opts.addAnswerLine !== false) {
    lines.push("");
    const key = Array.from({ length: rows }, (_, i) => `${i + 1}-`).join(", ");
    lines.push(`**Answer:** ${key}`);
  }
  return buildToggleBlock({ ...opts, title: opts.title ?? "Match the following" }, lines);
}

/* ---------- Enter-key planning (pure, testable) ---------- */

export interface EnterOptions {
  calloutType: string;
  collapsed: boolean;
  boldSummary: boolean;
  format: ToggleFormat;
  /** Auto-number the next toggle. */
  numbered?: boolean;
  /** Number to use for the next toggle when `numbered` is true. */
  nextNumber?: number;
  /** Add an "**Answer:** " line in MCQ / match skeletons (default true). */
  addAnswerLine?: boolean;
}


export interface EnterPlan {
  /** Replace from the start of the line, or from the cursor (line end). */
  from: "lineStart" | "cursor";
  insert: string;
  cursorOffset: number;
}

/**
 * Decide what Enter should do based on the current line text.
 * Returns null to let Obsidian's default Enter run.
 */
export function planEnter(text: string, opts: EnterOptions): EnterPlan | null {
  const bold = opts.boldSummary ? "**" : "";
  const num = opts.numbered && opts.nextNumber ? `${opts.nextNumber}. ` : "";
  const fold = opts.collapsed ? "-" : "+";
  const calloutHeader = `> [!${opts.calloutType}]${fold} `;

  // --- HTML <details> format ---
  if (opts.format === "details") {
    const openAttr = opts.collapsed ? "" : " open";
    const sOpen = opts.boldSummary ? "<summary><b>" : "<summary>";
    const sClose = opts.boldSummary ? "</b></summary>" : "</summary>";

    // Empty summary -> remove the skeleton line (escape to plain text)
    if (/^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/.test(text)) {
      return { from: "lineStart", insert: "", cursorOffset: 0 };
    }

    // Summary with content -> move into the toggle body
    if (/<\/summary>\s*$/.test(text)) {
      return { from: "cursor", insert: "\n", cursorOffset: 1 };
    }

    // MCQ parity inside a <details> body (plain markdown lines, no "> " prefix)
    if (/^\s*-\s\[[ xX]\]\s*$/.test(text)) {
      const insert = opts.addAnswerLine === false ? "" : "**Answer:** ";
      return { from: "lineStart", insert, cursorOffset: insert.length };
    }
    if (/^\s*-\s\[[ xX]\]\s+\S/.test(text)) {
      return { from: "cursor", insert: "\n- [ ] ", cursorOffset: 7 };
    }

    // After </details> -> start the next toggle skeleton
    if (text.trim() === "</details>") {
      const insert = `\n\n<details${openAttr}>\n${sOpen}${num}${sClose}\n\n\n</details>\n`;
      const cursorOffset = `\n\n<details${openAttr}>\n${sOpen}${num}`.length;
      return { from: "cursor", insert, cursorOffset };
    }
    return null;
  }


  // --- Native foldable-callout format ---
  const isCalloutHeader = /^>\s*\[![^\]]+\][+-]/.test(text);
  const isCalloutLine = /^>/.test(text);
  if (!isCalloutLine) return null;

  // Empty toggle header (no question typed) -> drop the toggle, back to plain text
  if (isCalloutHeader && /^>\s*\[![^\]]+\][+-]\s*(\*\*\s*(?:\d+\.\s*)?\*\*)?\s*(?:\d+\.)?\s*$/.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }

  // --- MCQ (checkbox) lines inside a toggle ---
  // Empty option line -> jump to the "**Answer:** " line (or a plain body line)
  if (MCQ_EMPTY_OPTION.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  // Option line with content -> next checkbox option
  if (MCQ_OPTION.test(text)) {
    return { from: "cursor", insert: "\n> - [ ] ", cursorOffset: 9 };
  }
  // Empty "**Answer:** " line -> escape out of the toggle (nothing to fill in)
  if (EMPTY_ANSWER_LINE.test(text)) {
    return { from: "lineStart", insert: "", cursorOffset: 0 };
  }
  // --- "Match the following" table rows ---
  // Separator row -> start the first data row
  if (MATCH_SEPARATOR.test(text)) {
    const insert = `\n> ${nextMatchRow(0)}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }
  // Blank data row -> leave the table (jump to the answer key / body line)
  if (EMPTY_MATCH_ROW.test(text)) {
    const insert = opts.addAnswerLine === false ? "> " : "> **Answer:** ";
    return { from: "lineStart", insert, cursorOffset: insert.length };
  }
  // Filled data row -> next numbered row, caret in Column A
  const rowMatch = text.match(MATCH_ROW);
  if (rowMatch) {
    const insert = `\n> ${nextMatchRow(Number(rowMatch[1]))}`;
    return { from: "cursor", insert, cursorOffset: insert.indexOf("|  |") + 2 };
  }



  // Empty body line ("> " or ">") -> close this toggle and start the NEXT one
  if (!isCalloutHeader && /^>\s*$/.test(text)) {
    const insert = `\n${calloutHeader}${bold}${num}${bold}`;
    return {
      from: "lineStart",
      insert,
      cursorOffset: 1 + calloutHeader.length + bold.length + num.length,
    };
  }

  // Header with a question -> jump INSIDE the toggle (answer line), Notion-style.
  // Body line with content -> next answer line inside the same toggle.
  return { from: "cursor", insert: "\n> ", cursorOffset: 3 };
}

/* ---------- Backspace planning (pure, testable) ---------- */

export interface BackspacePlan {
  /** Full replacement text for the current line. */
  insert: string;
  /** Caret column inside the new line text. */
  cursorOffset: number;
}

/**
 * Decide what Backspace should do based on the current line and caret column.
 * Returns null to let Obsidian's default Backspace run (nothing is deleted).
 *
 * Rules (Notion parity):
 *  - caret right after an empty "> " answer line  -> drop the prefix (plain text)
 *  - caret right before the question text         -> unwrap the toggle marker
 *  - <details> skeleton lines                     -> same escapes
 */
export function planBackspace(text: string, col: number, opts: EnterOptions): BackspacePlan | null {
  if (opts.format === "details") {
    // Empty <summary></summary> skeleton line -> remove it entirely
    const emptySummary = /^\s*<summary>(<b>)?\s*(<\/b>)?<\/summary>\s*$/;
    if (emptySummary.test(text)) {
      return { insert: "", cursorOffset: 0 };
    }
    // Caret right at the start of the summary text -> unwrap to plain text
    const sm = text.match(/^(\s*<summary>(?:<b>)?)([\s\S]*?)((?:<\/b>)?<\/summary>\s*)$/);
    if (sm && col === sm[1].length && sm[2].length > 0) {
      return { insert: sm[2], cursorOffset: 0 };
    }
    return null;
  }

  const headerMatch = text.match(/^(>\s*\[![^\]]+\][+-]\s*)(\*\*)?([\s\S]*?)(\*\*)?\s*$/);
  const isHeader = /^>\s*\[![^\]]+\][+-]/.test(text);

  // Empty answer line ("> " / ">") -> unwrap to plain empty line
  if (!isHeader && /^>\s*$/.test(text) && col === text.length) {
    return { insert: "", cursorOffset: 0 };
  }

  // Empty checkbox option / empty "**Answer:**" line / blank match row
  // -> drop that scaffolding, keep a plain "> " body line inside the toggle
  if (
    !isHeader &&
    col === text.length &&
    (MCQ_EMPTY_OPTION.test(text) || EMPTY_ANSWER_LINE.test(text) || EMPTY_MATCH_ROW.test(text))
  ) {
    return { insert: "> ", cursorOffset: 2 };
  }

  // Caret right before an option's text -> drop the checkbox marker, keep the text
  const optionMatch = text.match(/^(>\s*-\s\[[ xX]\]\s)(\S[\s\S]*)$/);
  if (!isHeader && optionMatch && col === optionMatch[1].length) {
    return { insert: `> ${optionMatch[2]}`, cursorOffset: 2 };
  }


  if (isHeader && headerMatch) {
    const prefix = headerMatch[1] + (headerMatch[2] ?? "");
    const title = headerMatch[3] ?? "";
    // Empty header (also "**3. **" numbered skeleton) -> remove the toggle line
    if (title.length === 0 || /^\d+\.\s*$/.test(title)) {
      return { insert: "", cursorOffset: 0 };
    }
    // Caret right before the question text -> keep the text, drop the marker
    if (col === prefix.length) {
      return { insert: title, cursorOffset: 0 };
    }
    return null;
  }

  // Answer line with content, caret right after "> " -> unwrap that line only
  const bodyMatch = text.match(/^(>\s)([\s\S]+)$/);
  if (!isHeader && bodyMatch && col === bodyMatch[1].length) {
    return { insert: bodyMatch[2], cursorOffset: 0 };
  }

  return null;
}

