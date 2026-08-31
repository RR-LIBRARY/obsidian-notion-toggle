/**
 * v1.4.11 — turn a real Obsidian note into reading-view markup.
 *
 * The filter tests below must run over the same DOM shape Obsidian renders, so
 * this parser reads a `.md` fixture, pulls out every callout toggle
 * (`> [!type]- Title` + `> body…`) in document order, and emits markup that
 * matches `.callout` / `.callout-title` / `.callout-content`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface NoteToggle {
  type: string;
  title: string;
  body: string;
  /** Rendered collapsed (fold marker `-`), like Obsidian does. */
  collapsed: boolean;
}

const HEADER = /^>\s*\[!([^\]]+)\]([+-]?)\s*(.*)$/;

/** Parse every callout toggle out of raw markdown, in document order. */
export function parseNoteToggles(markdown: string): NoteToggle[] {
  const out: NoteToggle[] = [];
  let current: NoteToggle | null = null;
  for (const raw of markdown.split(/\r?\n/)) {
    const header = raw.match(HEADER);
    if (header) {
      current = {
        type: header[1]!.trim(),
        title: header[3]!.trim(),
        body: "",
        collapsed: header[2] !== "+",
      };
      out.push(current);
      continue;
    }
    if (current && /^>/.test(raw)) {
      current.body += `${raw.replace(/^>\s?/, "")}\n`;
      continue;
    }
    current = null;
  }
  return out;
}

export function readFixture(name: string): string {
  return readFileSync(join(import.meta.dir, name), "utf8");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Reading-view markup for parsed toggles, `id="t{index}"` per toggle. */
export function renderToggles(toggles: NoteToggle[]): string {
  return toggles
    .map(
      (t, i) =>
        `<div class="callout is-collapsible${t.collapsed ? " is-collapsed" : ""}" data-callout="${t.type}" id="t${i}">` +
        `<div class="callout-title"><div class="callout-title-inner">${esc(t.title)}</div></div>` +
        `<div class="callout-content">${esc(t.body)}</div>` +
        `</div>`
    )
    .join("\n");
}

/** Full note markup: headings/paragraph noise around the toggles. */
export function renderNoteMarkdown(markdown: string): {
  html: string;
  toggles: NoteToggle[];
} {
  const toggles = parseNoteToggles(markdown);
  return {
    html: `<p>Traffic-light legend (plugin filter):</p>${renderToggles(toggles)}<p>End of note.</p>`,
    toggles,
  };
}
