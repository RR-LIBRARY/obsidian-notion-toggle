/**
 * v1.8.14 — "Paste from Notion".
 *
 * Copying blocks out of Notion puts Notion-flavoured markdown on the clipboard
 * (verified against a real page through the Notion API):
 *
 *     <details>
 *     <summary>Toggle title</summary>
 *     	child line               ← children are tab-indented
 *     	<details>
 *     	<summary>Nested</summary>
 *     		deeper
 *     	</details>
 *     </details>
 *     ## Heading toggle {toggle="true"}
 *     	child of the heading toggle
 *     <callout icon="💡">
 *     	callout text
 *     </callout>
 *
 * The 1.8.0 `<details>` converter flattened this: nested toggles, nested bullets
 * and toggle headings collapsed into one level. This module rebuilds the tree
 * from the indentation and emits nested Obsidian callout toggles. Pure string
 * in → string out; no Obsidian or CodeMirror imports (tests/notion-paste.test.ts).
 */

export interface NotionPasteOptions {
  calloutType: string;
  collapsed: boolean;
  boldSummary: boolean;
}

const FENCE = /^[ \t]*(```|~~~)/;
const HEADING_TOGGLE = /^(#{1,6})[ \t]+(.*?)[ \t]*\{toggle="?true"?\}[ \t]*$/;
const DETAILS_OPEN = /^<details(?:\s[^>]*)?>/i;
const DETAILS_CLOSE = /^<\/details>\s*$/i;
const CALLOUT_OPEN = /^<(callout|aside)(\s[^>]*)?>/i;

/** True when the text looks like it came out of Notion and needs the tree-aware converter. */
export function isNotionShaped(text: string | null | undefined): boolean {
  const src = stripFences(String(text ?? "").replace(/\r\n?/g, "\n"));
  if (/^#{1,6}[ \t]+.*\{toggle="?true"?\}[ \t]*$/m.test(src)) return true;
  if (/^[ \t]*<(callout|aside)[\s>]/im.test(src)) return true;
  if (!/<details[\s>]/i.test(src)) return false;
  // indented children, or a <details> opened before the previous one closed
  if (/^[ \t]+\S/m.test(src)) return true;
  let depth = 0;
  for (const m of src.matchAll(/<(\/?)details[\s>]/gi)) {
    depth += m[1] ? -1 : 1;
    if (depth > 1) return true;
  }
  return false;
}

function stripFences(src: string): string {
  return src.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, "");
}

/** Convert Notion-shaped paste to nested callout toggles; null when there is nothing Notion-specific. */
export function convertNotionPaste(text: string, opts: NotionPasteOptions): string | null {
  if (!isNotionShaped(text)) return null;
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const out = render(lines, opts).join("\n");
  return out === text ? null : out;
}

/* ---------- tree walk ---------- */

function indentOf(line: string): number {
  let n = 0;
  for (const ch of line) {
    if (ch === "\t") n += 4;
    else if (ch === " ") n += 1;
    else break;
  }
  return n;
}

/** Remove the smallest common indent from a block of lines (tabs count as 4 columns). */
function dedent(lines: string[]): string[] {
  const widths = lines.filter((l) => l.trim()).map(indentOf);
  const min = widths.length ? Math.min(...widths) : 0;
  if (!min) return lines;
  return lines.map((l) => {
    let cut = 0;
    let i = 0;
    while (i < l.length && cut < min && (l[i] === " " || l[i] === "\t")) {
      cut += l[i] === "\t" ? 4 : 1;
      i++;
    }
    return l.slice(i);
  });
}

function quote(lines: string[]): string[] {
  return lines.map((l) => (l.length ? `> ${l}` : ">"));
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/<\/?(strong|b)>/gi, "**")
    .replace(/<\/?(em|i)>/gi, "*")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function header(title: string, opts: NotionPasteOptions, type = opts.calloutType, foldable = true): string {
  let t = cleanTitle(title);
  if (t && opts.boldSummary && !/^\*\*[\s\S]*\*\*$/.test(t)) t = `**${t}**`;
  const fold = foldable ? (opts.collapsed ? "-" : "+") : "";
  return `[!${type}]${fold}${t ? " " + t : ""}`;
}

const ICONS: [RegExp, string][] = [
  [/💡/u, "tip"],
  [/⚠️?|🚧/u, "warning"],
  [/❗|‼️?|🚨/u, "important"],
  [/ℹ️?/u, "info"],
  [/✅|✔️?/u, "success"],
  [/❓|🤔/u, "question"],
  [/❌|⛔/u, "danger"],
  [/📝|✏️?/u, "note"],
];

function calloutType(attrs: string): string {
  // Notion writes either `<callout icon="💡">` or a bare `<callout 💡>`, so fall
  // back to scanning the whole attribute string for a known icon.
  const icon = /icon="([^"]*)"/.exec(attrs)?.[1] ?? attrs;
  for (const [re, type] of ICONS) if (re.test(icon)) return type;
  return "note";
}

/** Push a finished block, making sure it is separated from neighbouring text by a blank line. */
function pushBlock(out: string[], block: string[]): void {
  if (out.length && out[out.length - 1].trim() !== "") out.push("");
  out.push(...block);
}

function render(lines: string[], opts: NotionPasteOptions): string[] {
  const out: string[] = [];
  let afterBlock = false;
  let i = 0;
  const emitText = (l: string) => {
    if (afterBlock && l.trim() !== "" && out.length && out[out.length - 1].trim() !== "") out.push("");
    afterBlock = false;
    out.push(l);
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // fenced code: copy verbatim
    const fence = FENCE.exec(line);
    if (fence) {
      const mark = fence[1];
      emitText(line);
      i++;
      while (i < lines.length) {
        out.push(lines[i]);
        if (lines[i].trim().startsWith(mark)) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // <details> … </details>
    if (DETAILS_OPEN.test(trimmed)) {
      let rest = trimmed.replace(DETAILS_OPEN, "").trim();
      i++;
      let title = "";
      if (!rest) {
        while (i < lines.length && !lines[i].trim()) i++;
        if (i < lines.length && /^<summary>/i.test(lines[i].trim())) rest = lines[i++].trim();
      }
      const sum = /^<summary>([\s\S]*?)<\/summary>(.*)$/i.exec(rest);
      const body: string[] = [];
      if (sum) {
        title = sum[1];
        if (sum[2].trim()) body.push(sum[2].trim());
      } else if (rest) body.push(rest);
      let depth = 1;
      let inFence: string | null = null;
      while (i < lines.length) {
        const t = lines[i].trim();
        const f = FENCE.exec(lines[i]);
        if (inFence) {
          if (t.startsWith(inFence)) inFence = null;
        } else if (f) inFence = f[1];
        else if (DETAILS_OPEN.test(t)) depth++;
        else if (DETAILS_CLOSE.test(t) && --depth === 0) {
          i++;
          break;
        }
        body.push(lines[i]);
        i++;
      }
      pushBlock(out, [`> ${header(title, opts)}`, ...quote(trimBlank(render(dedent(body), opts)))]);
      afterBlock = true;
      continue;
    }

    // <callout icon="…"> / <aside> … </callout>
    const co = CALLOUT_OPEN.exec(trimmed);
    if (co) {
      const tag = co[1].toLowerCase();
      const close = new RegExp(`</${tag}>\\s*$`, "i");
      let rest = trimmed.slice(co[0].length);
      i++;
      const body: string[] = [];
      if (close.test(rest)) rest = rest.replace(close, "");
      else {
        while (i < lines.length && !close.test(lines[i].trim())) body.push(lines[i++]);
        const last = (lines[i] ?? "").trim().replace(close, "");
        if (last) body.push(last);
        i++;
      }
      if (rest.trim()) body.unshift(rest.trim());
      pushBlock(out, [`> ${header("", opts, calloutType(co[2] ?? ""), false)}`, ...quote(trimBlank(render(dedent(body), opts)))]);
      afterBlock = true;
      continue;
    }

    // ## Heading {toggle="true"} + indented children
    const ht = HEADING_TOGGLE.exec(line);
    if (ht) {
      i++;
      const body: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") {
          // a blank only belongs to the toggle if indented content follows
          let j = i;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && indentOf(lines[j]) > 0) {
            body.push(...lines.slice(i, j));
            i = j;
            continue;
          }
          break;
        }
        if (indentOf(l) === 0) break;
        body.push(l);
        i++;
      }
      // keep the heading level inside the toggle title, like Notion does
      let htTitle = cleanTitle(ht[2]);
      if (htTitle && opts.boldSummary && !/^\*\*[\s\S]*\*\*$/.test(htTitle)) htTitle = `**${htTitle}**`;
      pushBlock(out, [`> ${header(`${ht[1]} ${htTitle}`, { ...opts, boldSummary: false })}`, ...quote(trimBlank(render(dedent(body), opts)))]);
      afterBlock = true;
      continue;
    }

    emitText(line);
    i++;
  }
  return out;
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

/** Toggles must start on their own line: when the caret sits after text, begin the paste on a new line. */
export function onOwnLine(converted: string, textBeforeCaret: string): string {
  return textBeforeCaret.trim() && converted.startsWith(">") ? "\n" + converted : converted;
}
