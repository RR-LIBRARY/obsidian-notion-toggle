/** 1.9.19 — real controller: switching / closing the note mid-recording must not lose text. */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, describe, it, expect, mock } from "bun:test";
const mine = typeof globalThis.document === "undefined";
if (mine) GlobalRegistrator.register();
afterAll(() => { if (mine) GlobalRegistrator.unregister(); });
import { MarkdownView, TFile } from "obsidian";
import { requestUrlState } from "./setup";

let piece: (w: ArrayBuffer | null) => void = () => {};
mock.module("../src/voice/recorder", () => ({
  VoiceRecorder: class {
    startedAt = Date.now(); isPaused = false;
    constructor(ev: { onPiece: (w: ArrayBuffer | null) => void }) { piece = ev.onPiece; }
    async start() {} async stop() {} setPaused() {} onHidden() {} async revive() { return false; }
  },
}));
mock.module("../src/voice/bar", () => ({
  VoiceBar: class { level() {} status() {} transcript() {} setPaused() {} finishing() {} destroy() {} },
}));
const { installVoice } = await import("../src/voice/wire");

class Ed {
  constructor(public v: string, public cur = v.length) {}
  getValue() { return this.v; }
  getCursor() { return this.cur; }
  posToOffset(p: number) { return p; }
  offsetToPos(o: number) { return o; }
  setCursor(p: number) { this.cur = p; }
  replaceRange(t: string, from: number) { this.v = this.v.slice(0, from) + t + this.v.slice(from); }
}
function world() {
  const files: Record<string, string> = { "A.md": "Note A.", "B.md": "Note B." };
  const tf = (p: string) => new TFile(p);
  const views: MarkdownView[] = [];
  const open = (p: string) => { const v = new MarkdownView() as MarkdownView & { editor: Ed }; v.file = tf(p); v.editor = new Ed(files[p]); views.unshift(v); return v; };
  const app = {
    workspace: {
      getActiveViewOfType: () => views[0] ?? null,
      iterateAllLeaves: (f: (l: { view: unknown }) => void) => views.forEach((view) => f({ view })),
      on: () => ({}), onLayoutReady: () => {},
    },
    vault: {
      getAbstractFileByPath: (p: string) => (p in files ? tf(p) : null),
      process: async (f: TFile, fn: (c: string) => string) => { files[f.path] = fn(files[f.path]); },
      getMarkdownFiles: () => Object.keys(files).map(tf), getFiles: () => [], on: () => ({}),
    },
  };
  const cmds: Record<string, () => void> = {};
  const plugin = {
    app, settings: { voiceKey: "k", voiceAutoLink: false, voiceKeepAwake: false, voiceFab: false },
    addCommand: (c: { id: string; callback?: () => void }) => { if (c.callback) cmds[c.id] = c.callback; },
    addRibbonIcon: () => ({}), registerEvent: () => {}, register: () => {}, saveSettings: async () => {},
  };
  installVoice(plugin as never);
  return { files, views, open, cmds };
}
const say = (t: string) => { requestUrlState.impl = async () => ({ status: 200, text: JSON.stringify({ text: t }) }); piece(new ArrayBuffer(4000)); };
const tick = () => new Promise((r) => setTimeout(r, 30));
async function finish(w: ReturnType<typeof world>) { w.cmds["voice-mode-toggle"](); await new Promise((r) => setTimeout(r, 1200)); }

describe("note switched during recording", () => {
  it("writes into the NEW editor when Obsidian rebuilds note A", async () => {
    const w = world(); const a1 = w.open("A.md");
    w.cmds["voice-mode-toggle"](); await tick();
    say("Pehli baat."); await tick();
    w.views.splice(w.views.indexOf(a1), 1); const a2 = w.open("A.md") as MarkdownView & { editor: Ed };
    a2.editor.v = (a1 as MarkdownView & { editor: Ed }).editor.v; a2.editor.cur = a2.editor.v.length;
    say("Doosri baat."); await finish(w);
    expect(a2.editor.v).toBe("Note A. Pehli baat. Doosri baat.");
  }, 5000);
  it("user opens note B: text still goes into note A, not B", async () => {
    const w = world(); w.open("A.md");
    w.cmds["voice-mode-toggle"](); await tick();
    w.open("B.md"); w.views.splice(1, 1); // A closed, B open
    say("A ke liye."); await finish(w);
    expect(w.files["A.md"]).toBe("Note A. A ke liye.");
    expect((w.views[0] as MarkdownView & { editor: Ed }).editor.v).toBe("Note B.");
  }, 5000);
});
