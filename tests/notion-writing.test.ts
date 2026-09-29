/**
 * v1.8.0 — the Obsidian-facing shell (src/notion-writing.ts): paste conversion,
 * the one-tap <details> nudge, the default-state command, the `>` + space
 * insertion, the settings section and the stylesheet contract.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { Editor } from "obsidian";
import type NotionTogglePlugin from "../main";
import {
  DEFAULT_NOTION_WRITING,
  NOTION_LOOK_CLASS,
  applyNotionLook,
  insertToggleFromShortcut,
  installNotionWriting,
  offerDetailsConversion,
  renderNotionWritingSettings,
} from "../src/notion-writing";
import { installObsidianDom, clickButton, flush } from "./research-dom";
import { noticeEls, notices } from "./setup";

installObsidianDom();
// Obsidian augments every Node (fragments included) with createDiv/createEl.
const helpers = ["createEl", "createDiv", "createSpan", "setText", "empty"] as const;
for (const k of helpers) {
  const proto = DocumentFragment.prototype as unknown as Record<string, unknown>;
  proto[k] ??= (HTMLElement.prototype as unknown as Record<string, unknown>)[k];
}

/* ---------- fakes ---------- */

class FakeEditor {
  lines: string[];
  cursor = { line: 0, ch: 0 };
  replaced: string[] = [];
  constructor(text: string) {
    this.lines = text.split("\n");
  }
  getCursor() {
    return this.cursor;
  }
  getLine(l: number) {
    return this.lines[l] ?? "";
  }
  setLine(l: number, t: string) {
    this.lines[l] = t;
  }
  getValue() {
    return this.lines.join("\n");
  }
  setValue(v: string) {
    this.lines = v.split("\n");
  }
  replaceSelection(t: string) {
    this.replaced.push(t);
  }
}

interface Fake {
  plugin: NotionTogglePlugin;
  handlers: Record<string, ((...a: unknown[]) => unknown)[]>;
  commands: { id: string; name: string; editorCallback?: (editor: Editor) => void }[];
  extensions: unknown[];
  cleanups: (() => void)[];
  calls: { save: number; updateOptions: number };
  setActive(editor: FakeEditor | null, path?: string): void;
  vault: Map<string, string>;
}

function fake(settings: Partial<NotionTogglePlugin["settings"]> = {}): Fake {
  const handlers: Fake["handlers"] = {};
  const commands: Fake["commands"] = [];
  const extensions: unknown[] = [];
  const cleanups: (() => void)[] = [];
  const calls = { save: 0, updateOptions: 0 };
  const vault = new Map<string, string>();
  let active: { editor: FakeEditor; file: { path: string } } | null = null;
  const plugin = {
    settings: {
      format: "callout",
      defaultCollapsed: true,
      boldSummary: true,
      numberedByDefault: false,
      ...DEFAULT_NOTION_WRITING,
      ...settings,
    },
    app: {
      workspace: {
        on: (name: string, cb: (...a: unknown[]) => unknown) => {
          (handlers[name] ??= []).push(cb);
          return { name };
        },
        getActiveViewOfType: () => active,
        updateOptions: () => {
          calls.updateOptions++;
        },
      },
      vault: { cachedRead: async (file: { path: string }) => vault.get(file.path) ?? "" },
    },
    registerEditorExtension: (ext: unknown) => extensions.push(ext),
    registerEvent: () => {},
    addCommand: (c: Fake["commands"][number]) => commands.push(c),
    register: (f: () => void) => cleanups.push(f),
    saveSettings: async () => {
      calls.save++;
    },
    activeCallout: () => "question",
    toggleHeader(title = "") {
      return `> [!question]${this.settings.defaultCollapsed ? "-" : "+"} ${title}`;
    },
    findHeaderLine(editor: Editor) {
      const cursor = editor.getCursor();
      for (let l = cursor.line; l >= 0 && l >= cursor.line - 40; l--) {
        const text = editor.getLine(l);
        if (/^>\s*\[![^\]]+\][+-]/.test(text)) return { line: l, text };
        if (!/^>/.test(text) && l !== cursor.line) break;
      }
      return null;
    },
  } as unknown as NotionTogglePlugin;
  return {
    plugin,
    handlers,
    commands,
    extensions,
    cleanups,
    calls,
    vault,
    setActive: (editor, path = "note.md") => {
      active = editor ? { editor, file: { path } } : null;
    },
  };
}

function pasteEvent(text: string, defaultPrevented = false) {
  let prevented = defaultPrevented;
  return {
    get defaultPrevented() {
      return prevented;
    },
    preventDefault: () => {
      prevented = true;
    },
    clipboardData: { getData: (kind: string) => (kind === "text/plain" ? text : "") },
  } as unknown as ClipboardEvent;
}

const DETAILS = "<details>\n<summary>Q7. NCERT example ke hisaab se nematode-resistant plant kaunsa tha?</summary>\n\n**Answer:** **Tobacco plant** ko nematode-resistant banaya gaya tha.\n</details>";
const AS_TOGGLE =
  "> [!question]- **Q7. NCERT example ke hisaab se nematode-resistant plant kaunsa tha?**\n> **Answer:** **Tobacco plant** ko nematode-resistant banaya gaya tha.";

beforeEach(() => {
  notices.length = 0;
  noticeEls.length = 0;
  document.body.className = "";
});

/* ---------- install ---------- */

describe("v1.8.0 notion writing — install", () => {
  test("registers the editor extension, paste + file-open listeners, the command and the body class", () => {
    const f = fake();
    installNotionWriting(f.plugin);
    expect(f.extensions.length).toBe(1);
    expect(f.handlers["editor-paste"]?.length).toBe(1);
    expect(f.handlers["file-open"]?.length).toBe(1);
    expect(f.commands.map((c) => c.id)).toContain("toggle-default-state");
    expect(document.body.classList.contains(NOTION_LOOK_CLASS)).toBe(true);
    for (const c of f.cleanups) c();
    expect(document.body.classList.contains(NOTION_LOOK_CLASS)).toBe(false);
  });

  test("defaults: everything on (the whole point of the release)", () => {
    expect(DEFAULT_NOTION_WRITING).toEqual({
      blockMoves: true,
      nestedEnter: true,
      cleanEditing: true,
      notionLook: true,
      notionShortcut: true,
      convertDetailsOnPaste: true,
      detailsNudge: true,
      cleanMoreChip: false,
    });
  });

  test("applyNotionLook follows the setting both ways", () => {
    const f = fake({ notionLook: false });
    applyNotionLook(f.plugin);
    expect(document.body.classList.contains(NOTION_LOOK_CLASS)).toBe(false);
    f.plugin.settings.notionLook = true;
    applyNotionLook(f.plugin);
    expect(document.body.classList.contains(NOTION_LOOK_CLASS)).toBe(true);
  });
});

/* ---------- paste ---------- */

describe("v1.8.0 notion writing — pasting <details>", () => {
  test("a pasted <details> block lands as a toggle and the default paste is cancelled", () => {
    const f = fake();
    installNotionWriting(f.plugin);
    const editor = new FakeEditor("");
    const evt = pasteEvent(DETAILS);
    f.handlers["editor-paste"][0](evt, editor);
    expect(evt.defaultPrevented).toBe(true);
    expect(editor.replaced).toEqual([AS_TOGGLE]);
    expect(notices.some((n) => n.includes("turned into toggles"))).toBe(true);
  });

  test("plain text, an already-handled event, the setting off, or <details> format: untouched", () => {
    const cases: [Fake, ClipboardEvent][] = [
      [fake(), pasteEvent("just words")],
      [fake(), pasteEvent(DETAILS, true)],
      [fake({ convertDetailsOnPaste: false }), pasteEvent(DETAILS)],
      [fake({ format: "details" } as Partial<NotionTogglePlugin["settings"]>), pasteEvent(DETAILS)],
    ];
    for (const [f, evt] of cases) {
      installNotionWriting(f.plugin);
      const editor = new FakeEditor("");
      const before = evt.defaultPrevented;
      f.handlers["editor-paste"][0](evt, editor);
      expect(evt.defaultPrevented).toBe(before);
      expect(editor.replaced).toEqual([]);
    }
  });
});

/* ---------- nudge ---------- */

describe("v1.8.0 notion writing — one-tap offer for old notes", () => {
  test("opening a note with <details> shows the offer once; Convert rewrites the open editor", async () => {
    const f = fake();
    installNotionWriting(f.plugin);
    const file = { path: "bio.md", extension: "md" };
    f.vault.set(file.path, `# Bio\n${DETAILS}\n\n${DETAILS.replace("Q7", "Q8")}`);
    const editor = new FakeEditor(f.vault.get(file.path)!);
    f.setActive(editor, file.path);

    await offerDetailsConversion(f.plugin, file as never);
    const el = noticeEls.at(-1)!;
    expect(el.textContent).toContain("2 <details> blocks");
    expect(el.textContent).toContain("Turn them into toggles");
    clickButton(el, "Convert to toggles");
    await flush();
    expect(editor.getValue()).not.toContain("<details");
    expect(editor.getValue()).toContain("> [!question]- **Q7.");
    expect(editor.getValue()).toContain("> [!question]- **Q8.");
    expect(notices.some((n) => n.includes("every <details> block is now a toggle"))).toBe(true);

    // Same note again in this session: quiet.
    const count = noticeEls.length;
    await offerDetailsConversion(f.plugin, file as never);
    expect(noticeEls.length).toBe(count);
  });

  test("Not now just closes; a note without <details>, a non-markdown file, or the setting off: no offer", async () => {
    const f = fake();
    installNotionWriting(f.plugin);
    const file = { path: "a.md", extension: "md" };
    f.vault.set(file.path, DETAILS);
    await offerDetailsConversion(f.plugin, file as never);
    clickButton(noticeEls.at(-1)!, "Not now");
    expect(notices.length).toBe(1);

    const clean = { path: "clean.md", extension: "md" };
    f.vault.set(clean.path, "> [!question]- already a toggle\n> body");
    await offerDetailsConversion(f.plugin, clean as never);
    const pdf = { path: "x.pdf", extension: "pdf" };
    await offerDetailsConversion(f.plugin, pdf as never);
    await offerDetailsConversion(f.plugin, null);
    expect(noticeEls.length).toBe(1);

    const off = fake({ detailsNudge: false });
    installNotionWriting(off.plugin);
    off.vault.set("b.md", DETAILS);
    await offerDetailsConversion(off.plugin, { path: "b.md", extension: "md" } as never);
    expect(noticeEls.length).toBe(1);
  });

  test("Convert with the note not open in an editor explains what to do instead of failing", async () => {
    const f = fake();
    installNotionWriting(f.plugin);
    f.vault.set("c.md", DETAILS);
    f.setActive(null);
    await offerDetailsConversion(f.plugin, { path: "c.md", extension: "md" } as never);
    clickButton(noticeEls.at(-1)!, "Convert to toggles");
    expect(notices.some((n) => n.includes("Open the note in editing mode"))).toBe(true);
  });

  test("the file-open listener feeds the offer", async () => {
    const f = fake();
    installNotionWriting(f.plugin);
    f.vault.set("d.md", DETAILS);
    f.handlers["file-open"][0]({ path: "d.md", extension: "md" });
    await flush();
    expect(noticeEls.length).toBe(1);
  });
});

/* ---------- command ---------- */

describe("v1.8.0 notion writing — open/closed by default command", () => {
  const run = (f: Fake, editor: FakeEditor) => f.commands.find((c) => c.id === "toggle-default-state")!.editorCallback!(editor as unknown as Editor);

  test("flips - to + (and back) on the toggle under the caret, from the body too", () => {
    const f = fake();
    installNotionWriting(f.plugin);
    const editor = new FakeEditor("> [!question]- Title\n> body");
    editor.cursor = { line: 1, ch: 3 };
    run(f, editor);
    expect(editor.getLine(0)).toBe("> [!question]+ Title");
    expect(notices.at(-1)).toContain("opens by default");
    run(f, editor);
    expect(editor.getLine(0)).toBe("> [!question]- Title");
    expect(notices.at(-1)).toContain("starts closed");
  });

  test("outside a toggle it asks for the caret to be inside one", () => {
    const f = fake();
    installNotionWriting(f.plugin);
    const editor = new FakeEditor("plain line");
    run(f, editor);
    expect(editor.getLine(0)).toBe("plain line");
    expect(notices.at(-1)).toContain("inside a toggle");
  });
});

/* ---------- `>` + space ---------- */

describe("v1.8.0 notion writing — `>` + space inserts a toggle skeleton", () => {
  function viewFor(doc: string, pos: number) {
    const box = { state: EditorState.create({ doc, selection: EditorSelection.cursor(pos) }) };
    return {
      box,
      view: {
        get state() {
          return box.state;
        },
        dispatch(spec: Parameters<EditorState["update"]>[0]) {
          box.state = box.state.update(spec).state;
        },
      } as unknown as EditorView,
    };
  }

  test("the lone `>` becomes a bold-ready toggle header with the caret in the title", () => {
    const f = fake();
    const { box, view } = viewFor("Intro\n>", 7);
    expect(insertToggleFromShortcut(f.plugin, view)).toBe(true);
    const text = box.state.doc.toString();
    expect(text.split("\n")[1]).toBe("> [!question]- ****");
    expect(text.split("\n")[2]).toBe("> ");
    expect(text).not.toMatch(/\n>$/);
    const head = box.state.selection.main.head;
    expect(text.slice(0, head)).toBe("Intro\n> [!question]- **");
  });

  test("open-by-default and numbering settings are honoured", () => {
    const f = fake({ defaultCollapsed: false, boldSummary: false, numberedByDefault: true } as Partial<NotionTogglePlugin["settings"]>);
    const { box, view } = viewFor("> [!question]+ 1. First\n> a\n\n>", 30);
    expect(insertToggleFromShortcut(f.plugin, view)).toBe(true);
    expect(box.state.doc.toString().split("\n")[3]).toBe("> [!question]+ 2. ");
  });

  test("anything other than a lone `>` is refused", () => {
    const f = fake();
    const { box, view } = viewFor("> x", 3);
    expect(insertToggleFromShortcut(f.plugin, view)).toBe(false);
    expect(box.state.doc.toString()).toBe("> x");
  });
});

/* ---------- settings ---------- */

describe("v1.8.0 notion writing — settings section", () => {
  test("renders a heading and eight switches with the current values", () => {
    const f = fake({ notionShortcut: false });
    const root = document.createElement("div");
    renderNotionWritingSettings(root, f.plugin);
    const names = Array.from(root.querySelectorAll(".setting-item")).map((el) => el.querySelector("div")?.textContent);
    expect(names[0]).toBe("Notion-like writing");
    expect(names).toEqual(
      expect.arrayContaining([
        "Clean editing",
        "Plain Notion look",
        "“>” + space starts a toggle",
        "Convert pasted <details> automatically",
        "Offer to convert old notes",
        "Show “…” after a closed title",
        "Rearrange and shove into toggles",
        "Enter on a title makes a toggle inside",
      ])
    );
    const toggles = Array.from(root.querySelectorAll(".checkbox-container"));
    expect(toggles.length).toBe(8);
    expect(toggles[5].classList.contains("is-enabled")).toBe(true);
    expect(toggles[6].classList.contains("is-enabled")).toBe(true); // v1.8.13 Enter-on-title, on by default
    expect(toggles[7].classList.contains("is-enabled")).toBe(false);
    expect(toggles[0].classList.contains("is-enabled")).toBe(true);
    expect(toggles[2].classList.contains("is-enabled")).toBe(false);
  });

  test("flipping Clean editing saves and re-runs the editors; Plain Notion look updates the body class at once", async () => {
    const f = fake();
    const root = document.createElement("div");
    renderNotionWritingSettings(root, f.plugin);
    const toggles = Array.from(root.querySelectorAll(".checkbox-container")) as HTMLElement[];
    toggles[0].click();
    await flush();
    expect(f.plugin.settings.cleanEditing).toBe(false);
    expect(f.calls.updateOptions).toBe(1);
    expect(f.calls.save).toBe(1);

    document.body.classList.add(NOTION_LOOK_CLASS);
    toggles[1].click();
    await flush();
    expect(f.plugin.settings.notionLook).toBe(false);
    expect(document.body.classList.contains(NOTION_LOOK_CLASS)).toBe(false);
    expect(f.calls.save).toBe(2);
  });
});

/* ---------- stylesheet contract ---------- */

describe("v1.8.0 notion writing — stylesheet", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

  test("clean lines lose Obsidian's quote border (drawn with ::before in Live Preview) and their padding", () => {
    expect(css).toMatch(/\.cm-line\.ntt-clean-header::before[\s\S]*?display:\s*none\s*!important/);
    expect(css).toMatch(/\.cm-line\.ntt-clean-body::before/);
    expect(css).toMatch(/\.cm-blockquote-border::before/);
    expect(css).toMatch(/\.ntt-clean-header[\s\S]{0,400}padding-inline-start:\s*0\s*!important/);
  });

  test("arrow, chip and body guide are styled, with a per-colour arrow", () => {
    expect(css).toContain(".ntt-clean-arrow");
    expect(css).toMatch(/\.ntt-clean-arrow\.is-open svg\s*\{\s*transform:\s*rotate\(90deg\)/);
    expect(css).toContain(".ntt-clean-more");
    for (const c of ["red", "yellow", "green", "blue", "purple", "orange", "gray", "plain"]) {
      expect(css).toContain(`.ntt-clean-t-recall-${c}`);
    }
  });

  test("plain Notion look is scoped to the body class and to collapsible callouts only", () => {
    const rules = css.match(/body\.ntt-notion-look[^{]+\{/g) ?? [];
    expect(rules.length).toBeGreaterThan(5);
    // rendered-callout rules stay on collapsible callouts; v1.8.4 editing rules stay on clean-editing classes
    for (const r of rules) expect(r.includes(".is-collapsible") || r.includes(".ntt-clean-")).toBe(true);
    expect(css).toMatch(/body\.ntt-notion-look[\s\S]{0,600}\.callout-icon[\s\S]{0,200}display:\s*none/);
  });

  test("touch targets and reduced motion are handled", () => {
    expect(css).toMatch(/\.is-mobile \.ntt-clean-arrow/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]{0,300}ntt-clean-arrow/);
  });
});
