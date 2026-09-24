/**
 * v1.7.0 — installing the research features into a plugin: defaults, view
 * and command registration, ribbon, polling resume, teardown, panel opening.
 */
import { describe, expect, test } from "bun:test";
import { RESEARCH_COMMAND_IDS } from "../src/research/commands";
import { RESEARCH_VIEW_ICON, RESEARCH_VIEW_TYPE, ResearchView } from "../src/research/panel";
import { ResearchService } from "../src/research/service";
import { DEFAULT_RESEARCH_SETTINGS } from "../src/research/types";
import { installResearch, openResearchPanel, uninstallResearch, withResearchDefaults } from "../src/research/wire";
import { installObsidianDom } from "./research-dom";
import { fakeApp, hostSettings, taskRun } from "./research-fixtures";

installObsidianDom();

function fakePlugin(settingsOverrides: Record<string, unknown> = {}) {
  const app = fakeApp();
  const views = new Map<string, (leaf: unknown) => unknown>();
  const commands: Array<{ id: string; name: string }> = [];
  const ribbons: Array<{ icon: string; title: string; cb: () => void }> = [];
  const events: unknown[] = [];
  const intervals: number[] = [];
  let layoutReady: (() => void) | null = null;
  app.workspace.onLayoutReady = (cb) => void (layoutReady = cb);
  const plugin = {
    app,
    settings: { ...hostSettings(), ...settingsOverrides } as Record<string, unknown>,
    research: null as ResearchService | null,
    clientVersion: "test/1.7.0",
    saveSettings: async () => {},
    activeCallout: () => "question",
    nextNumberAt: () => 1,
    registerView: (type: string, factory: (leaf: unknown) => unknown) => void views.set(type, factory),
    addRibbonIcon: (icon: string, title: string, cb: () => void) => (ribbons.push({ icon, title, cb }), {}),
    addCommand: (cmd: { id: string; name: string }) => (commands.push(cmd), cmd),
    registerEvent: (ref: unknown) => void events.push(ref),
    registerInterval: (id: number) => (intervals.push(id), id),
    openSettings: () => {},
  };
  return { plugin, app, views, commands, ribbons, events, intervals, layoutReady: () => layoutReady };
}

describe("withResearchDefaults", () => {
  test("fills gaps, keeps values the reader set, and never shares array instances", () => {
    const s = withResearchDefaults({ researchEffort: "high" as const, researchRuns: undefined });
    expect(s.researchEffort).toBe("high");
    expect(s.researchBridgeUrl).toBe(DEFAULT_RESEARCH_SETTINGS.researchBridgeUrl);
    expect(s.researchRuns).toEqual([]);
    expect(s.researchRuns).not.toBe(DEFAULT_RESEARCH_SETTINGS.researchRuns);
    const keys = Object.keys(DEFAULT_RESEARCH_SETTINGS);
    for (const k of keys) expect((s as Record<string, unknown>)[k]).not.toBeUndefined();
  });
});

describe("installResearch", () => {
  test("registers the view, ribbon and every command; resumes polling once the layout is ready", () => {
    const f = fakePlugin({ researchRuns: [{ ...taskRun({ status: "running" }), markdown: null, consumed: false }] });
    const service = installResearch(f.plugin as never);
    expect(service).toBeInstanceOf(ResearchService);
    expect(f.plugin.research).toBe(service);
    expect(Array.from(f.views.keys())).toEqual([RESEARCH_VIEW_TYPE]);
    const view = f.views.get(RESEARCH_VIEW_TYPE)!({ app: f.app });
    expect(view).toBeInstanceOf(ResearchView);
    expect(f.ribbons.map((r) => [r.icon, r.title])).toEqual([[RESEARCH_VIEW_ICON, "Research"]]);
    expect(f.commands.map((c) => c.id)).toEqual([...RESEARCH_COMMAND_IDS]);
    expect(f.commands.every((c) => c.name.startsWith("Research: "))).toBe(true);
    expect(f.events).toHaveLength(1); // editor-menu
    expect(f.intervals).toHaveLength(0);
    f.layoutReady()!();
    expect(f.intervals).toHaveLength(1);
    uninstallResearch(f.plugin as never);
    expect(f.app.workspace.detached).toEqual([RESEARCH_VIEW_TYPE]);
    expect((service as unknown as { pollTimer: number | null }).pollTimer).toBeNull();
  });

  test("older data.json without research keys gets defaults in place", () => {
    const f = fakePlugin();
    for (const k of Object.keys(DEFAULT_RESEARCH_SETTINGS)) delete f.plugin.settings[k];
    installResearch(f.plugin as never);
    expect(f.plugin.settings["researchRuns"]).toEqual([]);
    expect(f.plugin.settings["researchInsertStyle"]).toBe(DEFAULT_RESEARCH_SETTINGS.researchInsertStyle);
    expect(f.plugin.research?.configured).toBe(false);
  });

  test("the ribbon opens the panel: reveals an existing leaf, else opens one on the right", async () => {
    const f = fakePlugin();
    installResearch(f.plugin as never);
    const revealed: unknown[] = [];
    const states: unknown[] = [];
    const leaf = { setViewState: async (s: unknown) => void states.push(s) };
    const ws = f.app.workspace as unknown as Record<string, unknown>;
    ws["revealLeaf"] = (l: unknown) => void revealed.push(l);
    ws["getRightLeaf"] = () => leaf;
    ws["getLeavesOfType"] = (type: string) => (type === RESEARCH_VIEW_TYPE ? [] : []);
    await openResearchPanel(f.plugin as never);
    expect(states).toEqual([{ type: RESEARCH_VIEW_TYPE, active: true }]);
    expect(revealed).toEqual([leaf]);

    const existing = {};
    ws["getLeavesOfType"] = (type: string) => (type === RESEARCH_VIEW_TYPE ? [existing] : []);
    f.ribbons[0].cb();
    await Promise.resolve();
    expect(revealed).toEqual([leaf, existing]);
    expect(states).toHaveLength(1);
  });

  test("falls back to a new main leaf when there is no right sidebar (mobile)", async () => {
    const f = fakePlugin();
    installResearch(f.plugin as never);
    const states: unknown[] = [];
    const leaf = { setViewState: async (s: unknown) => void states.push(s) };
    const ws = f.app.workspace as unknown as Record<string, unknown>;
    ws["getRightLeaf"] = () => null;
    ws["getLeaf"] = () => leaf;
    ws["revealLeaf"] = () => {};
    await openResearchPanel(f.plugin as never);
    expect(states).toEqual([{ type: RESEARCH_VIEW_TYPE, active: true }]);
  });
});
