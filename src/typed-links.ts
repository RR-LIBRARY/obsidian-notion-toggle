import { Annotation, type ChangeSpec } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";

export interface NoteTitle { basename: string; path: string }
export interface TypedLinkHost {
  enabled(): boolean;
  notes(): NoteTitle[];
  currentPath(view: EditorView): string;
  target(note: NoteTitle, source: string): string;
}
const linked = Annotation.define<boolean>();
const word = /[\p{L}\p{N}\p{M}_]/u;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Only newly edited prose is linked. Never rewrite existing note contents. */
export function planTypedLinks(text: string, edits: Array<{ from: number; to: number }>, notes: NoteTitle[], current: string, target: (note: NoteTitle) => string): ChangeSpec[] {
  const locks: Array<{ from: number; to: number }> = [];
  const protectedText = /(?:^---\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)(?:\r?\n|$))|(?:^[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^[ \t]{0,3}\1[^\n]*(?:\n|$)|$(?![\s\S])))|(?:`+[^`\n]*`+)|(?:!?\[\[[^\n]*?(?:\]\]|$))|(?:!?\[[^\]\n]*\]\([^\n)]*\))|(?:https?:\/\/\S+)|(?:<[^>\n]*>)/gm;
  for (const m of text.matchAll(protectedText)) locks.push({ from: m.index, to: m.index + m[0].length });
  const names = new Map<string, NoteTitle[]>();
  for (const note of notes) {
    if (note.basename.length < 3 || /[\[\]|#^]/.test(note.basename)) continue;
    const key = note.basename.toLocaleLowerCase();
    names.set(key, [...(names.get(key) ?? []), note]);
  }
  const changes: Array<{ from: number; to: number; insert: string }> = [];
  for (const candidates of [...names.values()].sort((a, b) => (b[0]?.basename.length ?? 0) - (a[0]?.basename.length ?? 0))) {
    const note = candidates[0];
    // Ambiguous titles are intentionally skipped rather than linking to the wrong page.
    if (!note || candidates.length !== 1 || note.path === current) continue;
    const re = new RegExp(escape(note.basename), "giu");
    for (const edit of edits) {
      const start = Math.max(0, edit.from - note.basename.length);
      const end = Math.min(text.length, edit.to + note.basename.length);
      for (const m of text.slice(start, end).matchAll(re)) {
        const from = start + m.index, to = from + m[0].length;
        if (to <= edit.from || from >= edit.to) continue;
        if ((from > 0 && word.test(text[from - 1] ?? "")) || word.test(text[to] ?? "")) continue;
        if (locks.some((r) => from < r.to && to > r.from) || changes.some((r) => from < r.to && to > r.from)) continue;
        const link = target(note);
        changes.push({ from, to, insert: link === m[0] ? `[[${link}]]` : `[[${link}|${m[0]}]]` });
      }
    }
  }
  return changes.sort((a, b) => a.from - b.from);
}

/** Debounce real typing; wait for mobile IME, preserve cursor and native undo. */
export function typedLinkExtension(host: TypedLinkHost) {
  return ViewPlugin.fromClass(class {
    pending: Array<{ from: number; to: number }> = [];
    timer: ReturnType<typeof setTimeout> | undefined;
    constructor(readonly view: EditorView) {}
    update(update: ViewUpdate) {
      if (!update.docChanged) return;
      clearTimeout(this.timer);
      if (!host.enabled() || update.transactions.some((tr) => tr.annotation(linked) || tr.isUserEvent("undo") || tr.isUserEvent("redo"))) {
        this.pending = []; return;
      }
      this.pending = this.pending.map((r) => ({ from: update.changes.mapPos(r.from, -1), to: update.changes.mapPos(r.to, 1) }));
      const typed = update.transactions.some((tr) => tr.isUserEvent("input.type") || tr.isUserEvent("input.paste"));
      if (!typed) { this.pending = []; return; }
      update.changes.iterChanges((_a, _b, from, to) => { if (to > from) this.pending.push({ from, to }); });
      this.timer = setTimeout(() => this.flush(), 500);
    }
    flush() {
      // CodeMirror 6.43 made `destroyed` private in its typings; the runtime
      // flag is still the safest way to stop a delayed flush after unload.
      const destroyed = (this.view as unknown as { destroyed?: boolean }).destroyed;
      if (!host.enabled() || destroyed) { this.pending = []; return; }
      if (this.view.composing) { this.timer = setTimeout(() => this.flush(), 200); return; }
      const source = host.currentPath(this.view);
      if (!source) { this.pending = []; return; }
      const changes = planTypedLinks(this.view.state.doc.toString(), this.pending, host.notes(), source, (note) => host.target(note, source));
      this.pending = [];
      if (changes.length) this.view.dispatch({ changes, annotations: linked.of(true), userEvent: "input.autolink" });
    }
    destroy() { clearTimeout(this.timer); this.pending = []; }
  });
}
