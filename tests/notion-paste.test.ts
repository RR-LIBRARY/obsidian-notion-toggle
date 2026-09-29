import { describe, expect, test } from "bun:test";
import { convertNotionPaste, isNotionShaped, onOwnLine } from "../src/notion-paste";

const O = { calloutType: "question", collapsed: true, boldSummary: false };
const conv = (s: string, o = O) => convertNotionPaste(s, o);

describe("v1.8.14 isNotionShaped", () => {
  test("plain text is not Notion", () => expect(isNotionShaped("hello\nworld")).toBe(false));
  test("a flat single <details> is left to the 1.8.0 converter", () =>
    expect(isNotionShaped("<details>\n<summary>A</summary>\nbody\n</details>")).toBe(false));
  test("tab-indented children inside <details>", () =>
    expect(isNotionShaped("<details>\n<summary>A</summary>\n\tbody\n</details>")).toBe(true));
  test("nested <details> without indentation", () =>
    expect(isNotionShaped("<details><summary>A</summary>\n<details><summary>B</summary>\nx\n</details>\n</details>")).toBe(true));
  test("toggle heading", () => expect(isNotionShaped('## Title {toggle="true"}\n\tchild')).toBe(true));
  test("callout", () => expect(isNotionShaped('<callout icon="💡">\n\thi\n</callout>')).toBe(true));
  test("examples inside a code fence are ignored", () =>
    expect(isNotionShaped('```\n## T {toggle="true"}\n<callout>\n```')).toBe(false));
  test("null / undefined", () => {
    expect(isNotionShaped(null)).toBe(false);
    expect(isNotionShaped(undefined)).toBe(false);
  });
});

describe("v1.8.14 convertNotionPaste", () => {
  test("returns null for non-Notion text", () => expect(conv("just text")).toBeNull());

  test("one toggle with an indented child (real Notion shape)", () => {
    expect(conv("<details>\n<summary>Toggle title</summary>\n\tchild line\n</details>")).toBe(
      "> [!question]- Toggle title\n> child line"
    );
  });

  test("nested toggles become nested callouts", () => {
    const src = "<details>\n<summary>Outer</summary>\n\tintro\n\t<details>\n\t<summary>Inner</summary>\n\t\tdeep\n\t</details>\n</details>";
    expect(conv(src)).toBe("> [!question]- Outer\n> intro\n> \n> > [!question]- Inner\n> > deep".replace("> \n", ">\n"));
  });

  test("three levels deep", () => {
    const src = [
      "<details>", "<summary>A</summary>",
      "\t<details>", "\t<summary>B</summary>",
      "\t\t<details>", "\t\t<summary>C</summary>",
      "\t\t\tleaf", "\t\t</details>",
      "\t</details>", "</details>",
    ].join("\n");
    expect(conv(src)).toBe("> [!question]- A\n> > [!question]- B\n> > > [!question]- C\n> > > leaf");
  });

  test("nested bullets inside a toggle keep their indentation", () => {
    const src = "<details>\n<summary>List</summary>\n\t- one\n\t\t- one.a\n\t- two\n</details>";
    expect(conv(src)).toBe("> [!question]- List\n> - one\n> \t- one.a\n> - two");
  });

  test("toggle heading with children", () => {
    expect(conv('## Chapter {toggle="true"}\n\tfirst\n\tsecond\nafter')).toBe(
      "> [!question]- ## Chapter\n> first\n> second\n\nafter"
    );
  });

  test("toggle heading keeps a blank line only when indented content follows", () => {
    expect(conv('# H {toggle="true"}\n\ta\n\n\tb\n\noutside')).toBe("> [!question]- # H\n> a\n>\n> b\n\noutside");
  });

  test("toggle heading containing a nested toggle", () => {
    const src = '### Topic {toggle="true"}\n\t<details>\n\t<summary>Q</summary>\n\t\tA\n\t</details>';
    expect(conv(src)).toBe("> [!question]- ### Topic\n> > [!question]- Q\n> > A");
  });

  test("callout icons map to Obsidian callout types", () => {
    expect(conv('<callout icon="💡">\n\tIdea\n</callout>')).toBe("> [!tip]\n> Idea");
    expect(conv('<callout icon="⚠️">\n\tCareful\n</callout>')).toBe("> [!warning]\n> Careful");
    expect(conv('<callout icon="🐱">\n\tCat\n</callout>')).toBe("> [!note]\n> Cat");
  });

  test("<aside> (Notion HTML export) becomes a note callout", () => {
    expect(conv("<aside>\nHello\n</aside>")).toBe("> [!note]\n> Hello");
  });

  test("one-line callout", () => {
    expect(conv('<callout icon="💡">Quick tip</callout>')).toBe("> [!tip]\n> Quick tip");
  });

  test("code inside a toggle is copied verbatim, even if it looks like a toggle", () => {
    const src = "<details>\n<summary>Code</summary>\n\t```js\n\t</details>\n\tconst a = 1;\n\t```\n\tafter\n</details>";
    expect(conv(src)).toBe("> [!question]- Code\n> ```js\n> </details>\n> const a = 1;\n> ```\n> after");
  });

  test("text before and after is kept and separated by blank lines", () => {
    const src = "before\n<details>\n<summary>T</summary>\n\tx\n</details>\nafter";
    expect(conv(src)).toBe("before\n\n> [!question]- T\n> x\n\nafter");
  });

  test("open-by-default setting and bold summary", () => {
    expect(conv("<details>\n<summary>T</summary>\n\tx\n</details>", { calloutType: "faq", collapsed: false, boldSummary: true })).toBe(
      "> [!faq]+ **T**\n> x"
    );
  });

  test("already-bold / HTML-bold summaries are not double wrapped", () => {
    const o = { ...O, boldSummary: true };
    expect(conv("<details>\n<summary><strong>T</strong></summary>\n\tx\n</details>", o)).toBe("> [!question]- **T**\n> x");
  });

  test("Windows line endings", () => {
    expect(conv("<details>\r\n<summary>T</summary>\r\n\tx\r\n</details>")).toBe("> [!question]- T\n> x");
  });

  test("space-indented children (4 spaces) work like tabs", () => {
    expect(conv("<details>\n<summary>T</summary>\n    - a\n        - b\n</details>")).toBe("> [!question]- T\n> - a\n>     - b");
  });

  test("two sibling toggles stay separate", () => {
    const src = "<details>\n<summary>A</summary>\n\ta\n</details>\n<details>\n<summary>B</summary>\n\tb\n</details>";
    expect(conv(src)).toBe("> [!question]- A\n> a\n\n> [!question]- B\n> b");
  });

  test("empty toggle keeps just its title", () => {
    expect(conv('## Empty {toggle="true"}')).toBe("> [!question]- ## Empty");
  });
});

describe("v1.8.14 onOwnLine", () => {
  test("after text on the line: a new line first", () => expect(onOwnLine("> [!q]- T", "start")).toBe("\n> [!q]- T"));
  test("at line start or after spaces: unchanged", () => {
    expect(onOwnLine("> [!q]- T", "")).toBe("> [!q]- T");
    expect(onOwnLine("> [!q]- T", "  ")).toBe("> [!q]- T");
  });
  test("paste that begins with plain text: unchanged", () => expect(onOwnLine("hi\n> [!q]- T", "x")).toBe("hi\n> [!q]- T"));
});

/**
 * v1.8.15 — parity fixtures taken from a REAL Notion page. The page was built
 * through the Notion API, read back block by block and serialised the way
 * Notion's clipboard serialises it; the plugin's output was parsed back into a
 * tree and diffed node by node (24/24 nodes matched). These two tests freeze
 * the two hardest cases from that run.
 */
describe("Notion parity fixtures (real page, API ground truth)", () => {
  test("a 12-level Notion chain stays 12 levels deep", () => {
    const clip = Array.from({ length: 12 }, (_, i) => `${"\t".repeat(i)}<details>\n${"\t".repeat(i)}<summary>depth ${i + 1}</summary>`).join("\n") + "\n" + Array.from({ length: 12 }, (_, i) => `${"\t".repeat(11 - i)}</details>`).join("\n");
    expect(isNotionShaped(clip)).toBe(true);
    const out = convertNotionPaste(clip, { calloutType: "note", collapsed: true, boldSummary: false });
    const lines = out.split("\n").filter((l) => l.includes("[!note]"));
    expect(lines.length).toBe(12);
    lines.forEach((line, i) => {
      expect(line.startsWith("> ".repeat(i + 1))).toBe(true);
      expect(line).toContain(`depth ${i + 1}`);
    });
  });

  test("a toggle heading, bullets, a callout and a code toggle survive one paste", () => {
    const clip = [
      "<details>",
      "<summary>1</summary>",
      "\t<details>",
      "\t<summary>2</summary>",
      "\t\t- point a",
      "\t\t- point b",
      "\t</details>",
      "</details>",
      "",
      '## Toggle heading {toggle="true"}',
      "",
      "<callout 💡>",
      "Remember this",
      "</callout>",
      "",
      "<details>",
      "<summary>Toggle with code</summary>",
      "\t```js",
      "\tconsole.log('hi');",
      "\t```",
      "</details>",
    ].join("\n");
    expect(isNotionShaped(clip)).toBe(true);
    const out = convertNotionPaste(clip, { calloutType: "note", collapsed: true, boldSummary: false });
    expect(out).toContain("> [!note]- 1");
    expect(out).toContain("> > [!note]- 2");
    expect(out).toContain("> > - point a");
    expect(out).toContain("> [!note]- ## Toggle heading");
    expect(out).toContain("[!tip]");
    expect(out).toContain("Remember this");
    expect(out).toContain("console.log('hi');");
  });
});
