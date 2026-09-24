/**
 * v1.7.0 — the "Web research" settings section: every control saves, the
 * URL is normalised, odd keys are flagged, and Test reports the bridge state.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { renderResearchSettings } from "../src/research/settings";
import { installObsidianDom, flush } from "./research-dom";
import { makeService, scriptedTransport } from "./research-fixtures";
import { notices } from "./setup";

installObsidianDom();
beforeEach(() => void (notices.length = 0));

function mount(opts: Parameters<typeof makeService>[0] = {}) {
  const made = makeService(opts);
  const container = document.createElement("div");
  renderResearchSettings(container, { settings: made.settings, research: made.service, saveSettings: made.host.saveSettings });
  const names = Array.from(container.querySelectorAll(".setting-item")).map((s) => s.firstElementChild?.textContent ?? "");
  const setting = (name: string) => {
    const idx = names.indexOf(name);
    if (idx < 0) throw new Error(`no setting "${name}" (have ${names.join(", ")})`);
    return container.querySelectorAll<HTMLElement>(".setting-item")[idx];
  };
  const change = (input: HTMLInputElement | HTMLSelectElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("change"));
  };
  return { ...made, container, names, setting, change };
}

describe("layout", () => {
  test("renders every research setting in a sensible order", () => {
    const { names } = mount();
    expect(names).toEqual([
      "Web research (v1.7.0)",
      "Bridge URL",
      "Plugin key",
      "Connection",
      "Insert as",
      "Insert where",
      "Sources list",
      "Search mode",
      "Answer effort",
      "Recall toggles per request",
      "Recall style",
      "Answer language",
      "Deep research default shape",
      "On-device cache",
      "Background runs",
    ]);
  });

  test("the plugin key field is masked, with an eye button to reveal it", () => {
    const { setting } = mount();
    const input = setting("Plugin key").querySelector<HTMLInputElement>("input")!;
    expect(input.type).toBe("password");
    setting("Plugin key").querySelector<HTMLButtonElement>('button[data-icon="eye"]')!.click();
    expect(input.type).toBe("text");
  });
});

describe("saving", () => {
  test("bridge URL is normalised to origin and saved", async () => {
    const { setting, change, settings, saved } = mount();
    const input = setting("Bridge URL").querySelector<HTMLInputElement>("input")!;
    change(input, "  my-bridge.lovable.app/dashboard/  ");
    await flush();
    expect(settings.researchBridgeUrl).toBe("https://my-bridge.lovable.app");
    expect(input.value).toBe("https://my-bridge.lovable.app");
    expect(saved).toHaveLength(1);
  });

  test("a key that does not look like ntr_… is saved but flagged", async () => {
    const { setting, change, settings } = mount();
    const input = setting("Plugin key").querySelector<HTMLInputElement>("input")!;
    change(input, " sk-wrong ");
    await flush();
    expect(settings.researchPluginKey).toBe("sk-wrong");
    expect(notices.at(-1)).toContain("does not look like a plugin key");
    change(input, "ntr_abcdefghijklmnopqrstuvwxyz");
    await flush();
    expect(notices).toHaveLength(1);
  });

  test("dropdowns, toggles and the slider write through to settings", async () => {
    const { setting, change, settings, saved } = mount();
    change(setting("Insert as").querySelector("select")!, "markdown");
    change(setting("Insert where").querySelector("select")!, "end");
    change(setting("Search mode").querySelector("select")!, "advanced");
    change(setting("Answer effort").querySelector("select")!, "high");
    change(setting("Recall style").querySelector("select")!, "qa");
    change(setting("Deep research default shape").querySelector("select")!, "timeline");
    const lang = setting("Answer language").querySelector<HTMLInputElement>("input")!;
    change(lang, " Hindi ");
    const slider = setting("Recall toggles per request").querySelector<HTMLInputElement>('input[type="range"]')!;
    slider.value = "12";
    slider.dispatchEvent(new Event("input")); // sliders report while dragging
    // Obsidian toggles are a clickable .checkbox-container, not a native checkbox.
    const sources = setting("Sources list").querySelector<HTMLElement>(".checkbox-container")!;
    expect(sources.classList.contains("is-enabled")).toBe(true);
    sources.click();
    await flush();
    expect(settings).toMatchObject({
      researchInsertStyle: "markdown",
      researchInsertTarget: "end",
      researchSearchMode: "advanced",
      researchEffort: "high",
      researchRecallStyle: "qa",
      researchDefaultPreset: "timeline",
      researchLanguage: "Hindi",
      researchRecallCount: 12,
    });
    expect(settings.researchIncludeSources).toBe(false);
    expect(saved.length).toBeGreaterThanOrEqual(9);
  });
});

describe("connection test", () => {
  test("reports the key name and provider health", async () => {
    const t = scriptedTransport({
      "GET /health": () => ({
        status: 200,
        body: { ok: true, version: "1.0.0", providers: { parallel: true, perplexity: false, ai: true }, key: { name: "iPad", prefix: "ntr_abc" }, serverTime: "now" },
      }),
    });
    const { setting } = mount({ transport: t });
    const row = setting("Connection");
    expect(row.children[1].textContent).toContain("Press Test");
    row.querySelector<HTMLButtonElement>("button.mod-cta")!.click();
    await flush();
    await flush();
    expect(row.children[1].textContent).toBe("Connected as key “iPad” (ntr_abc…). Parallel ✓ · Perplexity ✗ · AI ✓. Bridge v1.0.0.");
    expect(notices.at(-1)).toBe("Research bridge connected");
    expect(row.querySelector<HTMLButtonElement>("button.mod-cta")!.textContent).toBe("Test");
  });

  test("an unrecognised key and a dead bridge are both explained in place", async () => {
    const t = scriptedTransport({
      "GET /health": () => ({ status: 200, body: { ok: true, version: "1.0.0", providers: { parallel: true, perplexity: true, ai: true }, key: null, serverTime: "now" } }),
    });
    const a = mount({ transport: t });
    a.setting("Connection").querySelector<HTMLButtonElement>("button.mod-cta")!.click();
    await flush();
    await flush();
    expect(a.setting("Connection").children[1].textContent).toContain("key was not recognised");

    const dead = scriptedTransport({ "GET /health": () => ({ status: 401, body: { error: { code: "unauthorized", message: "bad key" } } }) });
    const b = mount({ transport: dead });
    b.setting("Connection").querySelector<HTMLButtonElement>("button.mod-cta")!.click();
    await flush();
    await flush();
    expect(b.setting("Connection").children[1].textContent).toContain("key");
    expect(notices.at(-1)).toBe(b.setting("Connection").children[1].textContent);
  });

  test("unconfigured: the description asks for URL and key first", () => {
    const { setting } = mount({ settings: { researchPluginKey: "" } });
    expect(setting("Connection").children[1].textContent).toBe("Add the URL and key above first.");
  });
});
