/**
 * v1.9.0 — installs voice mode: ribbon mic, commands, the bar, and writing
 * into the note at the cursor. One call from onload() keeps main.ts small.
 */
import { MarkdownView, Modal, Notice, TFile, requestUrl, setIcon, type Editor, type Plugin } from "obsidian";
import { VoiceBar } from "./bar";
import { DEFAULT_VOICE_SETTINGS, VoiceError, autoLink, buildContext, friendlyError, transcribe, transcribeWithRetry, wavSeconds, type VoiceSettings, type VoiceTransport } from "./client";
import { VoiceRecorder } from "./recorder";
import { CursorAnchor } from "./cursor";
import { encodeWav } from "./audio";
import { DictationSession } from "./session";

export interface VoicePluginHost extends Plugin {
  settings: object;
  addCommand(cmd: Parameters<Plugin["addCommand"]>[0]): ReturnType<Plugin["addCommand"]>;
}

export const voiceTransport: VoiceTransport = async (req) => {
  const res = await requestUrl({ url: req.url, method: req.method, headers: req.headers, body: req.body, contentType: req.contentType, throw: false });
  return { status: res.status, text: res.text };
};

export function withVoiceDefaults(settings: object): VoiceSettings {
  const s = settings as Record<string, unknown>;
  for (const [k, v] of Object.entries(DEFAULT_VOICE_SETTINGS)) if (s[k] === undefined || s[k] === null) s[k] = Array.isArray(v) ? [...v] : v;
  return settings as VoiceSettings;
}

/** v1.9.3 — one-step setup: paste the key, it is checked and saved, then recording starts. */
class VoiceSetupModal extends Modal {
  constructor(private readonly host: VoicePluginHost, private readonly then: () => void) {
    super(host.app);
  }
  onOpen(): void {
    const s = this.host.settings as VoiceSettings;
    this.contentEl.addClass("ntt-voice-setup");
    this.titleEl.setText("Set up voice mode");
    this.contentEl.createEl("p", { text: "Paste your voice key once (Lovable → Settings → Secrets → VOICE_PLUGIN_KEY). After that, just tap the mic." });
    const input = this.contentEl.createEl("input", { type: "password", attr: { placeholder: "Voice key" } });
    const row = this.contentEl.createDiv({ cls: "ntt-voice-setup-row" });
    const paste = row.createEl("button", { text: "Paste" });
    const go = row.createEl("button", { text: "Connect & start", cls: "mod-cta" });
    paste.onclick = async () => {
      try { input.value = (await navigator.clipboard.readText()).trim(); } catch { new Notice("Long-press the box and paste instead."); }
    };
    go.onclick = async () => {
      const key = input.value.trim();
      if (!key) return void new Notice("Paste the key first.");
      go.disabled = true;
      go.setText("Checking…");
      const old = s.voiceKey;
      s.voiceKey = key;
      try {
        await transcribe(voiceTransport, s, encodeWav(new Float32Array(16000), 16000));
      } catch (e) {
        const msg = (e as Error).message;
        if (!/empty|no speech/i.test(msg)) {
          s.voiceKey = old;
          go.disabled = false;
          go.setText("Connect & start");
          return void new Notice(`Voice: ${msg}`, 8000);
        }
      }
      await (this.host as unknown as { saveSettings?: () => Promise<void> }).saveSettings?.();
      new Notice("Voice mode is connected ✓");
      this.close();
      this.then();
    };
  }
  onClose(): void {
    this.contentEl.empty();
  }
}

const today = () => new Date().toISOString().slice(0, 10);
/** v1.9.9 — count spoken seconds per day so the user sees credit use. */
export function addUsage(s: VoiceSettings, sec: number): void {
  if (s.voiceUsageDay !== today()) {
    s.voiceUsageDay = today();
    s.voiceUsageSec = 0;
  }
  s.voiceUsageSec += sec;
}
const marker = (path: string) => `[voice not written — audio saved: ${path}]`;
const saveOf = (p: VoicePluginHost) => (p as unknown as { saveSettings?: () => Promise<void> }).saveSettings?.() ?? Promise.resolve();

class VoiceController {
  private rec: VoiceRecorder | null = null;
  private bar: VoiceBar | null = null;
  private session: DictationSession | null = null;
  private wake: { release(): Promise<void> } | null = null;
  fab: HTMLElement | null = null;

  constructor(private readonly plugin: VoicePluginHost) {}
  private get s(): VoiceSettings {
    return this.plugin.settings as VoiceSettings;
  }
  get active(): boolean {
    return !!this.rec;
  }

  toggle(): void {
    if (this.rec) void this.finish(true);
    else void this.start();
  }

  async start(): Promise<void> {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return void new Notice("Open a note first, then start voice mode.");
    if (!this.s.voiceKey.trim()) {
      new VoiceSetupModal(this.plugin, () => void this.start()).open();
      return;
    }
    const editor = view.editor;
    // Anchor = character offset in the note; moves forward as we write.
    const anchor = new CursorAnchor(editor.posToOffset(editor.getCursor("to")));
    const here = (ed: Editor) => anchor.follow(ed.posToOffset(ed.getCursor("to")));
    const write = (ed: Editor, text: string) => {
      ed.replaceRange(text, ed.offsetToPos(here(ed)));
      ed.setCursor(ed.offsetToPos(anchor.wrote(text.length)));
    };
    const notePath = view.file?.path ?? "";
    const title = view.file?.basename ?? "";
    let last: { at: number; len: number } | null = null;
    this.session = new DictationSession({
      transcribe: async (wav) => {
        const ctx = buildContext(title, editor.getValue().slice(0, here(editor)));
        let t = await transcribeWithRetry(voiceTransport, this.s, wav, ctx);
        if (this.s.voiceAutoLink) t = autoLink(t, this.plugin.app.vault.getMarkdownFiles().map((f) => f.basename), title);
        addUsage(this.s, wavSeconds(wav));
        void saveOf(this.plugin);
        return t;
      },
      undo: () => {
        if (!last) return void new Notice("Voice: mitane ke liye kuch nahi hai.");
        const { at, len } = last;
        editor.replaceRange("", editor.offsetToPos(at), editor.offsetToPos(at + len));
        anchor.follow(at);
        editor.setCursor(editor.offsetToPos(at));
        last = null;
        new Notice("Voice: pichhla hissa hata diya ✓");
      },
      write: (t) => {
        last = { at: here(editor), len: t.length };
        write(editor, t);
        try {
          this.bar?.transcript(t);
        } catch {
          /* the box is only a preview — never block writing */
        }
      },
      before: () => editor.getValue().slice(0, here(editor)),
      rescue: async (wav) => {
        const path = await this.rescue(wav);
        if (path && notePath) {
          this.s.voicePending.push({ path, note: notePath });
          await saveOf(this.plugin);
        }
        return path;
      },
      onPending: (n) => this.bar?.status(n ? `Writing ${n} piece${n > 1 ? "s" : ""}…` : this.rec?.isPaused ? "Paused" : "Listening…"),
      onError: (e) => new Notice(`Voice: ${friendlyError(e instanceof VoiceError ? e.status : -1, e.message)}`, 8000),
    });
    const session = this.session;
    this.rec = new VoiceRecorder({
      onLevel: (l) => this.bar?.level(l),
      onPiece: (wav) => session.add(wav),
    });
    try {
      await this.rec.start();
    } catch (e) {
      this.rec = null;
      this.session = null;
      const msg = (e as Error).name === "NotAllowedError" ? "Microphone permission was denied. Allow it for Obsidian in system settings." : (e as Error).message;
      new Notice(`Voice: ${msg}`, 8000);
      return;
    }
    this.fab?.addClass("is-hidden");
    this.bar = new VoiceBar(
      {
        cancel: () => void this.finish(false),
        done: () => void this.finish(true),
        togglePause: () => {
          if (!this.rec) return;
          this.rec.setPaused(!this.rec.isPaused);
          this.bar?.setPaused(this.rec.isPaused);
        },
      },
      this.rec.startedAt,
      {
        lift: this.s.voiceBarLift ?? 0,
        style: this.s.voiceBarStyle ?? "full",
        wave: this.s.voiceBarWave ?? "muted",
        onMoved: (lift) => {
          this.s.voiceBarLift = lift;
          void (this.plugin as unknown as { saveSettings?: () => Promise<void> }).saveSettings?.();
        },
      }
    );
    this.watchScreen();
    if (this.s.voiceKeepAwake) {
      try {
        this.wake = await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen") ?? null;
      } catch {
        this.wake = null;
      }
    }
  }

  private screenOff: (() => void) | null = null;
  /** v1.9.6 — keep going around screen-off: send the audio captured so far when
   *  the screen goes off, and on return wake the mic and the keep-awake lock. */
  private watchScreen(): void {
    let hiddenAt = 0;
    const h = async () => {
      const rec = this.rec;
      if (!rec) return;
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return rec.onHidden();
      }
      if (hiddenAt) {
        const sec = Math.round((Date.now() - hiddenAt) / 1000);
        hiddenAt = 0;
        if (sec >= 3) new Notice(`Voice: screen ${sec} sec band rahi. Usse pehle ka sab bol bhej diya gaya; band screen ke dauran phone mic rok sakta hai.`, 7000);
      }
      try {
        if (await rec.revive()) new Notice("Voice: mic re-opened after the screen was off — keep talking.", 5000);
      } catch (e) {
        new Notice(`Voice: could not re-open the mic (${(e as Error).message}). Tap ✓ to save what you said.`, 8000);
      }
      if (this.s.voiceKeepAwake) {
        try {
          this.wake = (await (navigator as unknown as { wakeLock?: { request(t: string): Promise<{ release(): Promise<void> }> } }).wakeLock?.request("screen")) ?? this.wake;
        } catch { /* not allowed */ }
      }
    };
    const fn = () => void h();
    document.addEventListener("visibilitychange", fn);
    this.screenOff = () => document.removeEventListener("visibilitychange", fn);
  }

  async finish(send: boolean): Promise<void> {
    this.screenOff?.();
    this.screenOff = null;
    const rec = this.rec;
    const bar = this.bar;
    const session = this.session;
    if (!rec || !session) return;
    this.rec = null;
    await rec.stop(send);
    void this.wake?.release().catch(() => undefined);
    this.wake = null;
    if (!send) {
      this.fab?.removeClass("is-hidden");
      bar?.destroy();
      this.bar = null;
      this.session = null;
      return;
    }
    bar?.finishing();
    await session.end();
    await new Promise((r) => setTimeout(r, 900)); // let the reader see the final text
    bar?.destroy();
    this.fab?.removeClass("is-hidden");
    if (this.bar === bar) this.bar = null;
    if (this.session === session) this.session = null;
  }

  private async rescue(wav: ArrayBuffer): Promise<string | null> {
    const vault = this.plugin.app.vault;
    const folder = (this.s.voiceRescueFolder || "Voice recordings").replace(/^\/+|\/+$/g, "");
    if (!vault.getAbstractFileByPath(folder)) await vault.createFolder(folder).catch(() => undefined);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const path = `${folder}/voice-${stamp}-${Math.random().toString(36).slice(2, 6)}.wav`;
    await vault.createBinary(path, wav);
    return path;
  }

  private retrying = false;
  /** v1.9.9 — write saved recordings into their notes once the internet / credits are back. */
  async retryPending(manual = false): Promise<void> {
    const list = this.s.voicePending;
    if (this.retrying || !list.length) {
      if (manual) new Notice("Voice: koi bacha hua audio nahi hai ✓");
      return;
    }
    this.retrying = true;
    const vault = this.plugin.app.vault;
    let done = 0;
    try {
      for (const item of [...list]) {
        const wavFile = vault.getAbstractFileByPath(item.path);
        const note = vault.getAbstractFileByPath(item.note);
        if (!(wavFile instanceof TFile)) {
          list.splice(list.indexOf(item), 1);
          continue;
        }
        let text: string;
        try {
          text = await transcribeWithRetry(voiceTransport, this.s, await vault.readBinary(wavFile));
          if (this.s.voiceAutoLink) text = autoLink(text, vault.getMarkdownFiles().map((f) => f.basename), item.note.replace(/^.*\//, "").replace(/\.md$/, ""));
        } catch (e) {
          if (manual) new Notice(`Voice: ${friendlyError(e instanceof VoiceError ? e.status : -1, (e as Error).message)}`, 8000);
          break;
        }
        addUsage(this.s, wavSeconds(await vault.readBinary(wavFile)));
        if (note instanceof TFile) await vault.process(note, (c) => c.replace(marker(item.path), text));
        await vault.delete(wavFile).catch(() => undefined);
        list.splice(list.indexOf(item), 1);
        done++;
      }
    } finally {
      this.retrying = false;
      await saveOf(this.plugin);
    }
    if (done) new Notice(`Voice: ${done} bacha hua hissa note me likh diya ✓${list.length ? ` (${list.length} baaki)` : ""}`, 6000);
  }

  /** v1.9.9 — 5-second check on the real phone; writes a report into the note. */
  async selfTest(): Promise<void> {
    const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return void new Notice("Pehle koi note kholein, phir self-test chalayein.");
    if (this.rec) return void new Notice("Pehle chal rahi recording band karein.");
    const lines: string[] = [`> [!info]- Voice self-test ${new Date().toLocaleString()}`];
    const add = (ok: boolean, t: string) => lines.push(`> ${ok ? "✅" : "❌"} ${t}`);
    add(!!this.s.voiceKey.trim(), "Voice key saved");
    add(navigator.onLine !== false, "Internet");
    const pieces: ArrayBuffer[] = [];
    let peak = 0;
    const rec = new VoiceRecorder({ onLevel: (l) => (peak = Math.max(peak, l)), onPiece: (w) => w && pieces.push(w) });
    const notice = new Notice("Self-test: 5 second kuch boliye… (jaise 'aaj 2 + 3 = 5')", 6000);
    try {
      await rec.start();
      add(true, "Microphone opened");
      await new Promise((r) => setTimeout(r, 5000));
      await rec.stop(true);
      add(peak > 0.02, `Voice heard (level ${peak.toFixed(2)})`);
    } catch (e) {
      add(false, `Microphone: ${(e as Error).message}`);
    }
    notice.hide();
    const sec = pieces.reduce((a, w) => a + wavSeconds(w), 0);
    add(sec > 0, `Speech captured: ${sec.toFixed(1)} s`);
    if (pieces.length && this.s.voiceKey.trim()) {
      const t0 = Date.now();
      try {
        const out: string[] = [];
        for (const w of pieces) out.push(await transcribe(voiceTransport, this.s, w));
        addUsage(this.s, sec);
        add(true, `Server reply in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
        lines.push(`> Text: ${out.join(" ").trim() || "(empty)"}`);
      } catch (e) {
        add(false, `Server: ${friendlyError(e instanceof VoiceError ? e.status : -1, (e as Error).message)}`);
      }
    }
    lines.push(`> Platform: ${navigator.userAgent.slice(0, 120)}`);
    const ed = view.editor;
    ed.replaceRange(`\n${lines.join("\n")}\n`, ed.getCursor("to"));
    await saveOf(this.plugin);
    new Notice("Self-test report note me likh di — screenshot bhejein.", 6000);
  }

  destroy(): void {
    void this.finish(false);
  }
}

export function installVoice(plugin: VoicePluginHost): void {
  withVoiceDefaults(plugin.settings);
  const ctl = new VoiceController(plugin);
  plugin.addRibbonIcon("mic", "Voice mode — speak to write", () => ctl.toggle());
  plugin.addCommand({ id: "voice-mode-toggle", name: "Voice mode: start / finish", icon: "mic", callback: () => ctl.toggle() });
  plugin.addCommand({ id: "voice-mode-cancel", name: "Voice mode: discard recording", icon: "x", checkCallback: (check) => {
    if (!ctl.active) return false;
    if (!check) void ctl.finish(false);
    return true;
  } });
  plugin.addCommand({ id: "voice-mode-self-test", name: "Voice mode: self-test (5 sec)", icon: "stethoscope", callback: () => void ctl.selfTest() });
  plugin.addCommand({ id: "voice-mode-retry", name: "Voice mode: write saved recordings now", icon: "refresh-cw", callback: () => void ctl.retryPending(true) });
  const onOnline = () => void ctl.retryPending();
  window.addEventListener("online", onOnline);
  plugin.register(() => window.removeEventListener("online", onOnline));
  plugin.app.workspace.onLayoutReady(() => setTimeout(() => void ctl.retryPending(), 4000));
  // Floating mic button on notes — one tap to start talking.
  const s = plugin.settings as VoiceSettings;
  if (s.voiceFab) {
    const fab = document.body.createEl("button", { cls: "ntt-voice-fab", attr: { "aria-label": "Voice mode — tap to speak" } });
    setIcon(fab, "mic");
    fab.onclick = () => ctl.toggle();
    ctl.fab = fab;
    const sync = () => fab.toggleClass("is-off", !plugin.app.workspace.getActiveViewOfType(MarkdownView));
    plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", sync));
    plugin.app.workspace.onLayoutReady(sync);
    plugin.register(() => fab.remove());
  }
  plugin.register(() => ctl.destroy());
}
