import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, describe, it, expect } from "bun:test";
const mine = typeof globalThis.document === "undefined";
if (mine) GlobalRegistrator.register();
afterAll(() => { if (mine) GlobalRegistrator.unregister(); });
const P = HTMLElement.prototype as unknown as Record<string, unknown>;
P.createEl ??= function (this: HTMLElement, tag: string, o: { cls?: string; attr?: Record<string, string> } = {}) {
  const e = document.createElement(tag); if (o.cls) e.className = o.cls; for (const [k, v] of Object.entries(o.attr ?? {})) e.setAttribute(k, v); this.appendChild(e); return e; };
P.toggleClass ??= function (this: HTMLElement, c: string, on: boolean) { this.classList.toggle(c, on); };
const { installVoice, refreshVoiceFab } = await import("../src/voice/wire");

describe("floating mic on/off (1.9.21)", () => {
  it("OFF hides at once, ON shows again, and the command flips it", async () => {
    const cmds: Record<string, () => unknown> = {};
    const settings = { voiceKey: "k", voiceFab: true };
    const plugin = {
      app: { workspace: { getActiveViewOfType: () => ({}), on: () => ({}), onLayoutReady: (f: () => void) => f(), iterateAllLeaves: () => {} },
             vault: { getFiles: () => [], getMarkdownFiles: () => [], on: () => ({}) } },
      settings, addCommand: (c: { id: string; callback?: () => unknown }) => { if (c.callback) cmds[c.id] = c.callback; },
      addRibbonIcon: () => ({}), registerEvent: () => {}, register: () => {}, saveSettings: async () => {},
    };
    installVoice(plugin as never);
    const all = document.querySelectorAll(".ntt-voice-fab"); const fab = all[all.length - 1]!;
    expect(fab.classList.contains("is-disabled")).toBe(false);
    settings.voiceFab = false; refreshVoiceFab();
    expect(fab.classList.contains("is-disabled")).toBe(true);
    settings.voiceFab = true; refreshVoiceFab();
    expect(fab.classList.contains("is-disabled")).toBe(false);
    await cmds["voice-mode-fab"]();
    expect(settings.voiceFab).toBe(false);
    expect(fab.classList.contains("is-disabled")).toBe(true);
  });
});
