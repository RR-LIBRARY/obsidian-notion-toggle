/** v1.9.0 — the "Voice mode" section of the settings tab. */
import { Notice, Setting } from "obsidian";
import { transcribe, type VoiceSettings } from "./client";
import { encodeWav } from "./audio";
import { voiceTransport, withVoiceDefaults } from "./wire";

export function renderVoiceSettings(containerEl: HTMLElement, host: { settings: object; saveSettings(): Promise<void> }): void {
  const s = withVoiceDefaults(host.settings);
  const save = () => host.saveSettings();
  new Setting(containerEl).setName("Voice mode (v1.9.0)").setHeading();
  containerEl.createDiv({
    cls: "setting-item-description",
    text: "Tap the mic in the ribbon (or the 'Voice mode' command / mobile toolbar), speak, then tap ✓. Long talks are written piece by piece while you speak.",
  });
  const text = (name: string, desc: string, key: keyof VoiceSettings, password = false) =>
    new Setting(containerEl).setName(name).setDesc(desc).addText((t) => {
      if (password) {
        t.inputEl.type = "password";
        t.inputEl.autocomplete = "off";
      }
      t.setValue(String(s[key] ?? "")).onChange(async (v) => {
        (s as unknown as Record<string, unknown>)[key] = v.trim();
        await save();
      });
    });
  text("Voice key", "The key from your Lovable voice project (VOICE_PLUGIN_KEY).", "voiceKey", true);
  text("Voice address", "Transcription address of the voice project (…/api/public/transcribe).", "voiceEndpoint");
  text("Languages", "Languages you speak, e.g. hi,en", "voiceLanguages");
  new Setting(containerEl)
    .setName("Hindi written as")
    .addDropdown((d) =>
      d
        .addOption("roman", "Hinglish (Roman letters)")
        .addOption("native", "Devanagari")
        .setValue(s.voiceScript)
        .onChange(async (v) => {
          s.voiceScript = v as VoiceSettings["voiceScript"];
          await save();
        })
    );
  text("Special words", "Names or terms you often say, comma separated.", "voiceKeywords");
  text("Rescue folder", "If writing fails, the audio is saved here so nothing is lost.", "voiceRescueFolder");
  new Setting(containerEl).setName("Keep screen on while recording").addToggle((t) =>
    t.setValue(s.voiceKeepAwake).onChange(async (v) => {
      s.voiceKeepAwake = v;
      await save();
    })
  );
  new Setting(containerEl).setName("Test connection").addButton((b) =>
    b.setButtonText("Test").onClick(async () => {
      try {
        await transcribe(voiceTransport, s, encodeWav(new Float32Array(16000), 16000));
        new Notice("Voice mode is connected ✓");
      } catch (e) {
        const msg = (e as Error).message;
        // A silent test clip may be rejected as empty — that still proves the key works.
        new Notice(/empty|no speech/i.test(msg) ? "Voice mode is connected ✓" : `Voice: ${msg}`, 8000);
      }
    })
  );
}
