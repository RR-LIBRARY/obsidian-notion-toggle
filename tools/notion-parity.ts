/**
 * Notion ⇄ plugin parity harness (1.8.14).
 *
 * 1. Reads a real Notion page through the Notion API (via the Lovable connector gateway).
 * 2. Serialises that block tree into the markdown Notion puts on the clipboard
 *    (<details>/<summary> + tab-indented children, `{toggle="true"}` headings,
 *    <callout icon>, fenced code) — the format verified against a real copy.
 * 3. Runs the plugin's own convertNotionPaste() over it.
 * 4. Parses the resulting Obsidian callout markdown back into a tree.
 * 5. Diffs the two trees node by node and prints a pass/fail matrix.
 *
 * Run: bun tools/notion-parity.ts <page-id>
 */
import { convertNotionPaste, isNotionShaped } from "../src/notion-paste";

const GATEWAY = "https://connector-gateway.lovable.dev/notion";
const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!LOVABLE_API_KEY || !NOTION_API_KEY) throw new Error("LOVABLE_API_KEY and NOTION_API_KEY must be set");

const headers = {
  Authorization: `Bearer ${LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": NOTION_API_KEY,
  "Notion-Version": "2025-09-03",
};

export interface Node {
  kind: string; // toggle | text | bullet | callout | code | heading
  text: string;
  children: Node[];
}

async function children(id: string): Promise<any[]> {
  const res = await fetch(`${GATEWAY}/v1/blocks/${id}/children?page_size=100`, { headers });
  if (!res.ok) throw new Error(`Notion ${res.status}: ${await res.text()}`);
  return (await res.json()).results;
}

const plain = (rt: any[] = []) => rt.map((r) => r.plain_text ?? "").join("");

async function notionTree(id: string): Promise<Node[]> {
  const out: Node[] = [];
  for (const b of await children(id)) {
    const body = b[b.type] ?? {};
    const kids = b.has_children ? await notionTree(b.id) : [];
    const text = plain(body.rich_text);
    switch (b.type) {
      case "toggle":
        out.push({ kind: "toggle", text, children: kids });
        break;
      case "heading_1":
      case "heading_2":
      case "heading_3":
        out.push({ kind: body.is_toggleable ? "toggle" : "heading", text, children: kids });
        break;
      case "callout":
        out.push({ kind: "callout", text, children: kids });
        break;
      case "bulleted_list_item":
      case "numbered_list_item":
      case "to_do":
        out.push({ kind: "bullet", text, children: kids });
        break;
      case "code":
        out.push({ kind: "code", text, children: [] });
        break;
      default:
        out.push({ kind: "text", text, children: kids });
    }
  }
  return out;
}

/* ---------- Notion clipboard serialiser ---------- */

const TAB = "\t";
function toClipboard(nodes: Node[], depth = 0, headingToggle = false): string[] {
  const pad = TAB.repeat(depth);
  const lines: string[] = [];
  for (const n of nodes) {
    switch (n.kind) {
      case "toggle":
        if (headingToggle && depth === 0) {
          lines.push(`${pad}## ${n.text} {toggle="true"}`);
          lines.push(...toClipboard(n.children, depth + 1));
        } else {
          lines.push(`${pad}<details>`);
          lines.push(`${pad}<summary>${n.text}</summary>`);
          lines.push(...toClipboard(n.children, depth + 1));
          lines.push(`${pad}</details>`);
        }
        break;
      case "callout":
        lines.push(`${pad}<callout icon="💡">`);
        lines.push(`${pad}${TAB}${n.text}`);
        lines.push(...toClipboard(n.children, depth + 1));
        lines.push(`${pad}</callout>`);
        break;
      case "bullet":
        lines.push(`${pad}- ${n.text}`);
        lines.push(...toClipboard(n.children, depth + 1));
        break;
      case "code":
        lines.push(`${pad}\`\`\`javascript`);
        lines.push(`${pad}${n.text}`);
        lines.push(`${pad}\`\`\``);
        break;
      case "heading":
        lines.push(`${pad}## ${n.text}`);
        lines.push(...toClipboard(n.children, depth + 1));
        break;
      default:
        lines.push(`${pad}${n.text}`);
        lines.push(...toClipboard(n.children, depth + 1));
    }
  }
  return lines;
}

/* ---------- Obsidian callout parser (reads the converter's output back) ---------- */

function parseObsidian(src: string): Node[] {
  const lines = src.split("\n");
  const roots: Node[] = [];
  const stack: { depth: number; node: Node }[] = [];

  const quoteDepth = (l: string) => {
    // The 12-level chain is checked directly in tests/notion-paste.test.ts
// ("deep Notion chain"), where it converts to 12 nested toggles.
const depthRows: Row[] = [];

let d = 0;
    let s = l;
    while (/^\s*>/.test(s)) {
      d++;
      s = s.replace(/^\s*>\s?/, "");
    }
    return { d, rest: s };
  };

  let fence: string | null = null;
  for (const raw of lines) {
    const { d, rest } = quoteDepth(raw);
    if (!rest.trim() && !fence) continue;
    // a callout header opens a new container at its own quote depth; plain content
    // lines at that same depth are its children
    const container = (isHeader = false) => {
      while (stack.length && (isHeader ? stack[stack.length - 1].depth >= d : stack[stack.length - 1].depth > d))
        stack.pop();
      return stack.length ? stack[stack.length - 1].node.children : roots;
    };
    const f = /^\s*(```|~~~)/.exec(rest);
    if (fence) {
      if (f) fence = null;
      else {
        const list = container();
        const last = list[list.length - 1];
        if (last && last.kind === "code") last.text += (last.text ? "\n" : "") + rest.trim();
      }
      continue;
    }
    if (f) {
      fence = f[1];
      container().push({ kind: "code", text: "", children: [] });
      continue;
    }
    const head = /^\[!([a-z]+)\]([+-]?)\s*(.*)$/i.exec(rest.trim());
    if (head) {
      const title = head[3].replace(/^\*\*([\s\S]*)\*\*$/, "$1").trim();
      const node: Node = { kind: head[2] ? "toggle" : "callout", text: title, children: [] };
      container(true).push(node);
      stack.push({ depth: d, node });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(rest.trim());
    const heading = /^(#{1,6})\s+(.*)$/.exec(rest.trim());
    const node: Node = bullet
      ? { kind: "bullet", text: bullet[1].trim(), children: [] }
      : heading
        ? { kind: "heading", text: heading[2].trim(), children: [] }
        : { kind: "text", text: rest.trim(), children: [] };
    // a bullet indented under a previous bullet at the same quote depth nests under it
    const list = container();
    if (node.kind === "bullet") {
      const indent = rest.length - rest.trimStart().length;
      const prev = list[list.length - 1];
      if (prev && prev.kind === "bullet" && indent > 0) {
        prev.children.push(node);
        continue;
      }
    }
    list.push(node);
  }
  return roots;
}

/* ---------- diff ---------- */

interface Row {
  path: string;
  expected: string;
  got: string;
  ok: boolean;
}

function flatten(nodes: Node[], prefix = ""): string[] {
  const out: string[] = [];
  nodes.forEach((n, i) => {
    const p = `${prefix}${i}`;
    out.push(`${p}\t${n.kind}\t${n.text.replace(/\s+/g, " ").trim()}`);
    out.push(...flatten(n.children, `${p}.`));
  });
  return out;
}

function diff(expected: Node[], got: Node[]): Row[] {
  const a = flatten(expected);
  const b = flatten(got);
  const rows: Row[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const e = a[i] ?? "—";
    const g = b[i] ?? "—";
    rows.push({ path: (a[i] ?? b[i] ?? "").split("\t")[0], expected: e, got: g, ok: e === g });
  }
  return rows;
}

const pageId = process.argv[2];
if (!pageId) throw new Error("usage: bun tools/notion-parity.ts <page-id>");

const tree = await notionTree(pageId);
// drop the intro paragraph and the synthetic depth chain: they are measured separately
const subject = tree.filter((n) => !(n.kind === "text" && n.text.startsWith("Recreates")) && !/^depth 1$/.test(n.text));
const depthChain = tree.find((n) => n.text === "depth 1");

const clipboard = toClipboard(
  subject.map((n) => n),
  0,
).join("\n");
// the toggle heading must be serialised the way Notion does it
const clipboardWithHeading = clipboard.replace(
  /<details>\n<summary>Toggle heading H2<\/summary>\n([\s\S]*?)\n<\/details>/,
  '## Toggle heading H2 {toggle="true"}\n$1',
);

const converted = convertNotionPaste(clipboardWithHeading, { calloutType: "note", collapsed: true, boldSummary: false });
if (converted == null) throw new Error("convertNotionPaste returned null — isNotionShaped said no");

/** Notion stores a callout's first line as the callout's own text; the Obsidian
 * form puts it on the line below the `[!tip]` header. Fold it back for the diff. */
function foldCalloutText(nodes: Node[]): Node[] {
  for (const n of nodes) {
    foldCalloutText(n.children);
    if (n.kind === "callout" && !n.text && n.children[0]?.kind === "text") {
      n.text = n.children[0].text;
      n.children.shift();
    }
  }
  return nodes;
}

const rows = diff(subject, foldCalloutText(parseObsidian(converted)));

console.log("=== Notion clipboard (input) ===");
console.log(clipboardWithHeading);
console.log("\n=== Obsidian markdown (plugin output) ===");
console.log(converted);
console.log("\n=== tree diff (Notion ⇄ plugin) ===");
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.expected}   ${r.ok ? "" : "| got: " + r.got}`);

// the synthetic depth chain: does the plugin survive 12 levels of nesting?
let depthRows: Row[] = [];
if (depthChain) {
  const chainClip = toClipboard([depthChain], 0).join("\n");
  let chainOut: string | null = null;
  try { chainOut = convertNotionPaste(chainClip, { calloutType: "note", collapsed: true, boldSummary: false }); }
  catch (e) { console.log("convert threw:", (e as Error).message); }
  let parsed: Node[] = [];
  try { parsed = foldCalloutText(parseObsidian(chainOut ?? "")); }
  catch (e) { console.log("parse threw:", (e as Error).message); }
  depthRows = diff([depthChain], parsed);
  console.log("\n=== depth chain diff (12 levels) ===");
  for (const r of depthRows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.expected}   ${r.ok ? "" : "| got: " + r.got}`);
}

let d = 0;
let n: Node | undefined = depthChain;
while (n) {
  d++;
  n = n.children[0];
}
console.log(`\nNotion nesting depth reached by API: ${d}`);
console.log(`isNotionShaped: ${isNotionShaped(clipboardWithHeading)}`);
const failures = [...rows, ...depthRows].filter((r) => !r.ok).length;
const total = rows.length + depthRows.length;
console.log(`\nRESULT ${total - failures}/${total} nodes match`);
process.exit(failures ? 1 : 0);
