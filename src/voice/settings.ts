/** v1.9.0 — the "Voice mode" section of the settings tab. */
import { Notice, Setting } from "obsidian";
import { refreshVoiceFab } from "./wire";
import { TERM_PRESETS, transcribe, type VoiceSettings } from "./client";
import { encodeWav } from "./audio";
import { voiceTransport, withVoiceDefaults } from "./wire";

export function renderVoiceSettings(containerEl: HTMLElement, host: { settings: object; saveSettings(): Promise<void> }): void {
  const s = withVoiceDefaults(host.settings);
  const save = () => host.saveSettings();
  new Setting(containerEl).setName("Voice mode (v1.9.0)").setHeading();
  new Setting(containerEl)
    .setName("Floating mic button")
    .setDesc("Note par neeche-daayein gol mic button. OFF karte hi turant chhup jaata hai. Mic ribbon aur command se phir bhi chalega.")
    .addToggle((t) =>
      t.setValue(s.voiceFab).onChange(async (v) => {
        s.voiceFab = v;
        refreshVoiceFab();
        await save();
      })
    );
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
  new Setting(containerEl)
    .setName("Listening: accurate or fast")
    .setDesc("Accurate (default): poora vaakya sun kar likhta hai — galtiyan kam, text ~6 sec baad. Fast: text jaldi, par galtiyan zyada.")
    .addDropdown((d) =>
      d.addOption("accurate", "Accurate").addOption("fast", "Fast").setValue(s.voiceAccuracy ?? "accurate").onChange(async (v) => {
        s.voiceAccuracy = v === "fast" ? "fast" : "accurate";
        await save();
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
    .setDesc("Thinking mode — bolte waqt koi khaas shabd (jaise 'ophthalmologist') kisi aur note me likha ho, to us note se link ho jayega. Shabd ki lambai aur notes ki ginti neeche ke 2 slider se badlein; ek hisse me max 3 link. Note-name linking alag hai aur waise hi chalta hai.")
    .addToggle((t) =>
      t.setValue(s.voiceTermLink).onChange(async (v) => {
        s.voiceTermLink = v;
        await save();
      })
    );
  let minS: { setValue(v: number): unknown } | null = null;
  let maxS: { setValue(v: number): unknown } | null = null;
  new Setting(containerEl)
    .setName("Term link: preset")
    .setDesc("Ek tap me sahi setting. Shuru me 'Balanced' rakhein; doctor/science notes ke liye 'Medical / technical'.")
    .addDropdown((d) => {
      d.addOption("", "Custom");
      for (const [k, v] of Object.entries(TERM_PRESETS)) d.addOption(k, v.label);
      const cur = Object.entries(TERM_PRESETS).find(([, v]) => v.minLen === s.voiceTermMinLen && v.maxNotes === s.voiceTermMaxNotes);
      d.setValue(cur?.[0] ?? "").onChange(async (k) => {
        const p = TERM_PRESETS[k];
        if (!p) return;
        s.voiceTermMinLen = p.minLen;
        s.voiceTermMaxNotes = p.maxNotes;
        await save();
        minS?.setValue(p.minLen);
        maxS?.setValue(p.maxNotes);
        new Notice(`Term link: ${p.label}`);
      });
    });
  new Setting(containerEl)
    .setName("Term link: shortest word")
    .setDesc("Itne ya zyada letter wala shabd hi link banega. Sujhav: 7; medical/technical ke liye 8–9. 5 se kam par aam shabd bhi link hone lagenge.")
    .addSlider((sl) => {
      minS = sl;
      sl.setLimits(4, 15, 1).setValue(s.voiceTermMinLen || 7).setDynamicTooltip().onChange(async (v) => {
        s.voiceTermMinLen = v;
        await save();
      });
    });
  new Setting(containerEl)
    .setName("Term link: max notes")
    .setDesc("0 = Auto (vault ke size se: 100 se kam notes → 2, 1000 tak → 3, zyada → 5). Bahut link aayein to pehle ise ghatayein.")
    .addSlider((sl) => {
      maxS = sl;
      sl.setLimits(0, 10, 1).setValue(s.voiceTermMaxNotes ?? 0).setDynamicTooltip().onChange(async (v) => {
        s.voiceTermMaxNotes = v;
        await save();
      });
    });
  new Setting(containerEl)
    .setName("Advanced: link matching lines")
    .setDesc("Bolte waqt 4 ya zyada shabdon ki line agar kisi aur note me hu-ba-hu likhi ho, to wo line us note (aur uske heading) se link ho jayegi, jaise [[My work#Voice|offline me live text nahi dikhega]]. 2 se zyada notes me mili line ko aam maan kar chhod diya jata hai; ek hisse me max 2 line-link.")
    .addToggle((t) =>
      t.setValue(s.voicePhraseLink).onChange(async (v) => {
        s.voicePhraseLink = v;
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
