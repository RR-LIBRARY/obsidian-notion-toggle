/**
 * v1.8.23 — Obsidian's own Indent / Unindent buttons, taught about toggles.
 *
 * Obsidian's mobile toolbar ships "Indent" (`editor:indent-list`) and
 * "Unindent" (`editor:unindent-list`). On a toggle line those insert or remove
 * a leading tab in front of the `>` marker, which turns the callout into a code
 * block — the note looks broken and the toggle "moves" somewhere odd. Notion's
 * Indent / Outdent instead nest the block under the toggle above or lift it out
 * one level, which is what the plugin's Tab / Shift+Tab already do.
 *
 * This bridge wraps the two core commands: when the caret sits on a toggle (its
 * title or anything in its body, any depth) the press becomes the plugin's
 * block move; on plain text and on indented list items the original command
 * runs untouched. Everything Obsidian-specific comes in through `IndentBridgeHost`
 * so the decision logic stays pure and unit-tested.
 */
import type { EditorView } from "@codemirror/view";
import { unitAt } from "./block-move";
import { markerDepth, markerEnd } from "./clean-toggles";
import { runBlockMove, type MoveHow } from "./clean-toggles-view";

export const CORE_INDENT_ID = "editor:indent-list";
export const CORE_UNINDENT_ID = "editor:unindent-list";

export type IndentOwner = "toggle" | "list" | "plain";

/**
 * Who handles an Indent / Unindent press on line `n`?
 *  - "list"   — the visible text is itself indented (a nested list item or a
 *               continuation line): Obsidian's own list indent, even inside a toggle.
 *  - "toggle" — the line is a toggle title or lives in a toggle body: the plugin.
 *  - "plain"  — ordinary top-level text: Obsidian.
 */
export function indentOwner(lines: readonly string[], n: number): IndentOwner {
  const text = lines[n] ?? "";
  const cut = markerEnd(text, markerDepth(text));
  if (/^[ \t]/.test(cut >= 0 ? text.slice(cut) : text)) return "list";
  const unit = unitAt(lines, n);
  if (unit && (unit.toggle || unit.cd > 0)) return "toggle";
  return "plain";
}

/** What the wrapped command should do for a press with the caret on line `n`. */
export function planCorePress(lines: readonly string[], n: number, how: "in" | "out"): "move" | "original" | "noop" {
  const owner = indentOwner(lines, n);
  if (owner !== "toggle") return "original";
  const unit = unitAt(lines, n);
  if (!unit || unit.blank) return "noop";
  return how === "in" || unit.cd > 0 ? "move" : "noop";
}

/** The slice of Obsidian's Editor the bridge needs (structurally typed). */
export interface BridgeEditor {
  getValue(): string;
  getCursor(): { line: number; ch: number };
  /** Obsidian exposes the CodeMirror view as `editor.cm`. */
  cm?: EditorView;
}

/** One entry of `app.commands.commands` (only the callback shapes Obsidian uses). */
export interface CoreCommand {
  id: string;
  callback?: () => unknown;
  checkCallback?: (checking: boolean) => boolean | void;
  editorCallback?: (editor: BridgeEditor, view: unknown) => unknown;
  editorCheckCallback?: (checking: boolean, editor: BridgeEditor, view: unknown) => boolean | void;
}

export interface IndentBridgeHost {
  /** `app.commands.commands` — the live registry (commands are looked up by id at call time). */
  registry: Record<string, CoreCommand> | undefined;
  /** The editor of the active markdown view, if any (for `callback`-style commands). */
  activeEditor: () => BridgeEditor | null;
  /** Block moves on + callout format (the bridge steps aside otherwise). */
  enabled: () => boolean;
  notify: (message: string) => void;
  /** Plugin lifecycle hook: restore the original callbacks on unload. */
  register: (cleanup: () => void) => void;
}

export const NO_TOGGLE_ABOVE = "Nothing to nest under — put a toggle above this one first.";
export const AT_TOP_LEVEL = "Already at the top level.";

/**
 * Run the plugin's move for a core press. Returns true when the press was
 * consumed (moved, or a deliberate no-op), false to let Obsidian's command run.
 */
export function takeOverPress(host: IndentBridgeHost, editor: BridgeEditor, how: "in" | "out"): boolean {
  if (!host.enabled()) return false;
  const lines = editor.getValue().split("\n");
  const n = editor.getCursor().line;
  const plan = planCorePress(lines, n, how);
  if (plan === "original") return false;
  if (plan === "noop") {
    if (!(unitAt(lines, n)?.blank ?? false)) host.notify(how === "in" ? NO_TOGGLE_ABOVE : AT_TOP_LEVEL);
    return true;
  }
  const cm = editor.cm;
  if (!cm) return false;
  if (!runBlockMove(cm, how as MoveHow)) host.notify(how === "in" ? NO_TOGGLE_ABOVE : AT_TOP_LEVEL);
  return true;
}

/** Wrap Obsidian's Indent / Unindent commands; restores them through `host.register`. */
export function installIndentBridge(host: IndentBridgeHost): void {
  const registry = host.registry;
  if (!registry) return;
  const pairs: [string, "in" | "out"][] = [
    [CORE_INDENT_ID, "in"],
    [CORE_UNINDENT_ID, "out"],
  ];
  for (const [id, how] of pairs) {
    const cmd = registry[id];
    if (!cmd) continue;
    const orig = {
      callback: cmd.callback,
      checkCallback: cmd.checkCallback,
      editorCallback: cmd.editorCallback,
      editorCheckCallback: cmd.editorCheckCallback,
    };
    if (orig.editorCallback) {
      cmd.editorCallback = (editor, view) => (takeOverPress(host, editor, how) ? undefined : orig.editorCallback?.call(cmd, editor, view));
    }
    if (orig.editorCheckCallback) {
      cmd.editorCheckCallback = (checking, editor, view) => {
        if (!checking && takeOverPress(host, editor, how)) return true;
        return orig.editorCheckCallback?.call(cmd, checking, editor, view);
      };
    }
    if (orig.callback) {
      cmd.callback = () => {
        const editor = host.activeEditor();
        if (editor && takeOverPress(host, editor, how)) return undefined;
        return orig.callback?.call(cmd);
      };
    }
    if (orig.checkCallback) {
      cmd.checkCallback = (checking) => {
        if (!checking) {
          const editor = host.activeEditor();
          if (editor && takeOverPress(host, editor, how)) return true;
        }
        return orig.checkCallback?.call(cmd, checking);
      };
    }
    host.register(() => {
      const live = registry[id];
      if (!live) return;
      live.callback = orig.callback;
      live.checkCallback = orig.checkCallback;
      live.editorCallback = orig.editorCallback;
      live.editorCheckCallback = orig.editorCheckCallback;
    });
  }
}
