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
  new Setting(containerEl).setName("Floating mic button").setDesc("A mic button on notes; restart Obsidian after changing.").addToggle((t) =>
    t.setValue(s.voiceFab).onChange(async (v) => {
      s.voiceFab = v;
      await save();
    })
  );
  new Setting(containerEl)
    .setName("Voice card look")
    .setDesc("Tip: long-press the voice card and slide it up or down to move it.")
    .addDropdown((d) =>
      d.addOption("full", "With live text").addOption("compact", "Compact (wave + buttons)").setValue(s.voiceBarStyle ?? "full").onChange(async (v) => {
        s.voiceBarStyle = v as VoiceSettings["voiceBarStyle"];
        await save();
      })
    )
    .addDropdown((d) =>
      d.addOption("muted", "Grey wave").addOption("accent", "Colour wave").setValue(s.voiceBarWave ?? "muted").onChange(async (v) => {
        s.voiceBarWave = v as VoiceSettings["voiceBarWave"];
        await save();
      })
    )
    .addButton((btn) =>
      btn.setButtonText("Reset position").onClick(async () => {
        s.voiceBarLift = 0;
        await save();
        new Notice("Voice card is back in its normal spot.");
      })
    );
  new Setting(containerEl).setName("Keep screen on while recording").setDesc("Zaroor ON rakhein — screen lock hone par phone mic rok sakta hai.").addToggle((t) =>
    t.setValue(s.voiceKeepAwake).onChange(async (v) => {
      s.voiceKeepAwake = v;
      await save();
    })
  );
  new Setting(containerEl)
    .setName("Auto-link note names")
    .setDesc("Bolte waqt kisi bane hue note ka naam aaye to wo [[link]] ban jayega.")
    .addToggle((t) =>
      t.setValue(s.voiceAutoLink).onChange(async (v) => {
        s.voiceAutoLink = v;
        await save();
      })
    );
  new Setting(containerEl)
    .setName("Advanced: link terms from other notes")
    .setDesc("Thinking mode — bolte waqt koi khaas shabd (jaise 'ophthalmologist') kisi aur note me likha ho, to us note se link ho jayega. Sirf 7+ letter wale aur 1–3 notes me milne wale shabd; ek hisse me max 3 link. Note-name linking alag hai aur waise hi chalta hai.")
    .addToggle((t) =>
      t.setValue(s.voiceTermLink).onChange(async (v) => {
        s.voiceTermLink = v;
        await save();
      })
    );
  const mins = s.voiceUsageDay === new Date().toISOString().slice(0, 10) ? s.voiceUsageSec / 60 : 0;
  new Setting(containerEl)
    .setName("Today's voice use")
    .setDesc(`${mins.toFixed(1)} min bola aaj. Har minute Lovable workspace ke AI credits use karta hai. Bacha hua audio: ${s.voicePending.length}.`);
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
