/**
 * v1.9.0 — installs voice mode: ribbon mic, commands, the bar, and writing
 * into the note at the cursor. One call from onload() keeps main.ts small.
 */
import { MarkdownView, Modal, Notice, requestUrl, setIcon, type Editor, type Plugin } from "obsidian";
import { VoiceBar } from "./bar";
import { DEFAULT_VOICE_SETTINGS, transcribe, transcribeWithRetry, type VoiceSettings, type VoiceTransport } from "./client";
import { VoiceRecorder } from "./recorder";
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
  for (const [k, v] of Object.entries(DEFAULT_VOICE_SETTINGS)) if (s[k] === undefined || s[k] === null) s[k] = v;
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
    let anchor = editor.posToOffset(editor.getCursor("to"));
    const write = (ed: Editor, text: string) => {
      ed.replaceRange(text, ed.offsetToPos(anchor));
      anchor += text.length;
      ed.setCursor(ed.offsetToPos(anchor));
    };
    this.session = new DictationSession({
      transcribe: (wav) => transcribeWithRetry(voiceTransport, this.s, wav),
      write: (t) => {
        write(editor, t);
        try {
          this.bar?.transcript(t);
        } catch {
          /* the box is only a preview — never block writing */
        }
      },
      before: () => editor.getValue().slice(0, anchor),
      rescue: (wav) => this.rescue(wav),
      onPending: (n) => this.bar?.status(n ? `Writing ${n} piece${n > 1 ? "s" : ""}…` : this.rec?.isPaused ? "Paused" : "Listening…"),
      onError: (e) => new Notice(`Voice: ${e.message}`, 8000),
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
    const h = async () => {
      const rec = this.rec;
      if (!rec) return;
      if (document.visibilityState === "hidden") return rec.onHidden();
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
