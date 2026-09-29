/**
 * v1.8.23 — src/indent-bridge.ts: Obsidian's own Indent / Unindent toolbar
 * buttons become the plugin's nest / un-nest on toggle lines, and stay
 * Obsidian's list indent everywhere else.
 */
import { describe, expect, test } from "bun:test";
import { EditorSelection, EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  AT_TOP_LEVEL,
  CORE_INDENT_ID,
  CORE_UNINDENT_ID,
  NO_TOGGLE_ABOVE,
  indentOwner,
  installIndentBridge,
  planCorePress,
  takeOverPress,
  type BridgeEditor,
  type CoreCommand,
  type IndentBridgeHost,
} from "../src/indent-bridge";
import { INDENT_COMMAND_ID, OUTDENT_COMMAND_ID, PRIMARY_NAMES, commandName } from "../src/naming";

describe("indentOwner — who handles the press", () => {
  const L = [
    "Plain intro", //                 0 plain
    "- list item", //                 1 plain (top-level list, Obsidian indents it)
    "> [!question]- Parent", //       2 toggle
    "> body text", //                 3 toggle (body)
    "> - [ ] option", //              4 toggle (body list item, not indented)
    ">   - nested option", //         5 list (indented text inside a body)
    "> > [!question]- Child", //      6 toggle (nested title)
    "", //                            7 plain blank
    "\t- sub item", //                8 list
  ];
  test.each([
    [0, "plain"],
    [1, "plain"],
    [2, "toggle"],
    [3, "toggle"],
    [4, "toggle"],
    [5, "list"],
    [6, "toggle"],
    [7, "plain"],
    [8, "list"],
  ] as const)("line %i -> %s", (n, owner) => {
    expect(indentOwner(L, n)).toBe(owner);
  });
});

describe("planCorePress", () => {
  test("plain / list lines keep Obsidian's command", () => {
    expect(planCorePress(["text"], 0, "in")).toBe("original");
    expect(planCorePress([">   - deep"], 0, "out")).toBe("original");
  });
  test("toggle lines move; a top-level toggle cannot outdent; blank body lines are a quiet no-op", () => {
    const L = ["> [!q]- A", "> a", "", "> [!q]- B", ">", "> > [!q]- C"];
    expect(planCorePress(L, 3, "in")).toBe("move");
    expect(planCorePress(L, 3, "out")).toBe("noop");
    expect(planCorePress(L, 5, "out")).toBe("move");
    expect(planCorePress(L, 4, "in")).toBe("noop");
  });
});

/* ---------- real EditorState behind a fake Obsidian editor (no editor DOM needed) ---------- */

function cmEditor(text: string, line: number): { editor: BridgeEditor; view: { state: EditorState } } {
  let pos = 0;
  for (let i = 0; i < line; i++) pos += (text.split("\n")[i] ?? "").length + 1;
  const view = {
    state: EditorState.create({ doc: text, selection: EditorSelection.cursor(pos) }),
    dispatch(spec: Parameters<EditorState["update"]>[0]) {
      view.state = view.state.update(spec).state;
    },
  };
  const editor: BridgeEditor = {
    cm: view as unknown as EditorView,
    getValue: () => view.state.doc.toString(),
    getCursor: () => {
      const l = view.state.doc.lineAt(view.state.selection.main.head);
      return { line: l.number - 1, ch: view.state.selection.main.head - l.from };
    },
  };
  return { editor, view };
}

function host(registry: Record<string, CoreCommand>, editor: BridgeEditor | null, enabled = true) {
  const notices: string[] = [];
  const cleanups: (() => void)[] = [];
  const h: IndentBridgeHost = {
    registry,
    activeEditor: () => editor,
    enabled: () => enabled,
    notify: (m) => void notices.push(m),
    register: (c) => void cleanups.push(c),
  };
  return { h, notices, cleanups };
}

describe("takeOverPress", () => {
  test("Indent on a sibling toggle nests it under the toggle above (Notion Tab)", () => {
    const { editor, view } = cmEditor("> [!q]- A\n> a\n\n> [!q]- B\n> b", 3);
    const { h, notices } = host({}, editor);
    expect(takeOverPress(h, editor, "in")).toBe(true);
    expect(view.state.doc.toString()).toBe("> [!q]- A\n> a\n>\n> > [!q]- B\n> > b");
    expect(notices).toEqual([]);
  });

  test("Unindent on a nested toggle lifts it out after its parent (Notion Shift+Tab)", () => {
    const { editor, view } = cmEditor("> [!q]- A\n> a\n>\n> > [!q]- B\n> > b", 3);
    const { h } = host({}, editor);
    expect(takeOverPress(h, editor, "out")).toBe(true);
    expect(view.state.doc.toString()).toBe("> [!q]- A\n> a\n\n> [!q]- B\n> b");
  });

  test("Indent with no toggle above: consumed with a hint, the callout is NOT tab-indented", () => {
    const { editor, view } = cmEditor("Intro\n> [!q]- First\n> body", 1);
    const { h, notices } = host({}, editor);
    expect(takeOverPress(h, editor, "in")).toBe(true);
    expect(view.state.doc.toString()).toBe("Intro\n> [!q]- First\n> body");
    expect(notices).toEqual([NO_TOGGLE_ABOVE]);
  });

  test("Unindent on a top-level toggle: hint, nothing changes", () => {
    const { editor } = cmEditor("> [!q]- First\n> body", 0);
    const { h, notices } = host({}, editor);
    expect(takeOverPress(h, editor, "out")).toBe(true);
    expect(notices).toEqual([AT_TOP_LEVEL]);
  });

  test("plain text and indented list items are left to Obsidian", () => {
    const { editor } = cmEditor("plain\n> [!q]- T\n>   - deep", 0);
    const { h } = host({}, editor);
    expect(takeOverPress(h, editor, "in")).toBe(false);
    const deep = cmEditor("plain\n> [!q]- T\n>   - deep", 2);
    expect(takeOverPress(h, deep.editor, "out")).toBe(false);
  });

  test("disabled (block moves off / <details> format) never interferes", () => {
    const { editor } = cmEditor("> [!q]- A\n> a\n\n> [!q]- B", 3);
    const { h } = host({}, editor, false);
    expect(takeOverPress(h, editor, "in")).toBe(false);
  });
});

describe("installIndentBridge — wraps the core commands and restores them", () => {
  test("editorCallback-style core commands: toggle line -> plugin move, plain line -> original", () => {
    const calls: string[] = [];
    const registry: Record<string, CoreCommand> = {
      [CORE_INDENT_ID]: { id: CORE_INDENT_ID, editorCallback: () => void calls.push("indent") },
      [CORE_UNINDENT_ID]: { id: CORE_UNINDENT_ID, editorCallback: () => void calls.push("unindent") },
    };
    const originalIndent = registry[CORE_INDENT_ID]!.editorCallback;
    const onToggle = cmEditor("> [!q]- A\n> a\n\n> [!q]- B", 3);
    const { h, cleanups } = host(registry, onToggle.editor);
    installIndentBridge(h);
    expect(registry[CORE_INDENT_ID]!.editorCallback).not.toBe(originalIndent);

    registry[CORE_INDENT_ID]!.editorCallback!(onToggle.editor, null);
    expect(onToggle.view.state.doc.toString()).toBe("> [!q]- A\n> a\n>\n> > [!q]- B");
    expect(calls).toEqual([]);

    const onPlain = cmEditor("plain\n> [!q]- A", 0);
    registry[CORE_INDENT_ID]!.editorCallback!(onPlain.editor, null);
    registry[CORE_UNINDENT_ID]!.editorCallback!(onPlain.editor, null);
    expect(calls).toEqual(["indent", "unindent"]);

    for (const c of cleanups) c();
    expect(registry[CORE_INDENT_ID]!.editorCallback).toBe(originalIndent);
  });

  test("checkCallback-style core commands use the active editor; checking never mutates", () => {
    const calls: string[] = [];
    const registry: Record<string, CoreCommand> = {
      [CORE_UNINDENT_ID]: {
        id: CORE_UNINDENT_ID,
        checkCallback: (checking) => {
          if (!checking) calls.push("unindent");
          return true;
        },
      },
    };
    const nested = cmEditor("> [!q]- A\n> a\n>\n> > [!q]- B", 3);
    const { h } = host(registry, nested.editor);
    installIndentBridge(h);
    expect(registry[CORE_UNINDENT_ID]!.checkCallback!(true)).toBe(true);
    expect(nested.view.state.doc.toString()).toBe("> [!q]- A\n> a\n>\n> > [!q]- B");
    expect(registry[CORE_UNINDENT_ID]!.checkCallback!(false)).toBe(true);
    expect(nested.view.state.doc.toString()).toBe("> [!q]- A\n> a\n\n> [!q]- B");
    expect(calls).toEqual([]);
  });

  test("missing registry or missing core commands: no-op, nothing registered", () => {
    const { h, cleanups } = host({}, null);
    installIndentBridge(h);
    installIndentBridge({ ...h, registry: undefined });
    expect(cleanups).toEqual([]);
  });
});

describe("Indent / Outdent are first-class toolbar commands", () => {
  test("IDs are the 1.8.9 ones (hotkeys survive) and the names read like Notion in both naming modes", () => {
    expect(INDENT_COMMAND_ID).toBe("shove-into-toggle");
    expect(OUTDENT_COMMAND_ID).toBe("move-out-of-toggle");
    expect(PRIMARY_NAMES[INDENT_COMMAND_ID]).toMatch(/^Indent/);
    expect(PRIMARY_NAMES[OUTDENT_COMMAND_ID]).toMatch(/^Outdent/);
    expect(commandName(INDENT_COMMAND_ID, "legacy", true)).not.toMatch(/^Advanced/);
    expect(commandName(OUTDENT_COMMAND_ID, "legacy", false)).toMatch(/^Outdent/);
  });
});
