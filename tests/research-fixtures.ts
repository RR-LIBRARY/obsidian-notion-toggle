/**
 * v1.7.0 — shared fakes for the research tests: an editor, a workspace with
 * markdown leaves, a scripted bridge transport and a service host.
 */
import { MarkdownView, TFile } from "obsidian";
import type { Transport, TransportRequest } from "../src/research/client";
import { ResearchService, type ResearchHost } from "../src/research/service";
import { DEFAULT_RESEARCH_SETTINGS, type AnswerResponse, type FactCheckResponse, type RecallResponse, type SearchResponse, type TaskRun } from "../src/research/types";

/* ---------- editor ---------- */

export class FakeEditor {
  lines: string[];
  cursor = { line: 0, ch: 0 };
  selection = "";
  constructor(text = "") {
    this.lines = text.split("\n");
  }
  getValue(): string {
    return this.lines.join("\n");
  }
  getSelection(): string {
    return this.selection;
  }
  getCursor() {
    return { ...this.cursor };
  }
  setCursor(pos: { line: number; ch: number }) {
    this.cursor = { ...pos };
  }
  getLine(n: number): string {
    return this.lines[n] ?? "";
  }
  lastLine(): number {
    return this.lines.length - 1;
  }
  replaceRange(text: string, from: { line: number; ch: number }): void {
    const before = this.lines.slice(0, from.line);
    const line = this.lines[from.line] ?? "";
    const after = this.lines.slice(from.line + 1);
    const merged = `${line.slice(0, from.ch)}${text}${line.slice(from.ch)}`;
    this.lines = [...before, ...merged.split("\n"), ...after];
  }
}

/* ---------- workspace / app ---------- */

export function markdownView(editor: FakeEditor | null, path: string | null): InstanceType<typeof MarkdownView> {
  const v = new MarkdownView() as InstanceType<typeof MarkdownView> & { editor: unknown; file: unknown };
  v.editor = editor;
  v.file = path ? new TFile(path) : null;
  return v;
}

export interface FakeWorkspace {
  activeView: unknown;
  activeFile: InstanceType<typeof TFile> | null;
  leaves: Array<{ view: unknown }>;
  recent: { view: unknown } | null;
  getActiveViewOfType(_t: unknown): unknown;
  getActiveFile(): InstanceType<typeof TFile> | null;
  getLeavesOfType(type: string): Array<{ view: unknown }>;
  getMostRecentLeaf(): { view: unknown } | null;
  onLayoutReady(cb: () => void): void;
  detachLeavesOfType(type: string): void;
  detached: string[];
  on(): unknown;
  revealLeaf(): void;
  getRightLeaf(): unknown;
  getLeaf(): unknown;
}

export function fakeWorkspace(): FakeWorkspace {
  const ws: FakeWorkspace = {
    activeView: null,
    activeFile: null,
    leaves: [],
    recent: null,
    detached: [],
    getActiveViewOfType: () => ws.activeView,
    getActiveFile: () => ws.activeFile,
    getLeavesOfType: (type) => (type === "markdown" ? ws.leaves : []),
    getMostRecentLeaf: () => ws.recent,
    onLayoutReady: (cb) => cb(),
    detachLeavesOfType: (type) => void ws.detached.push(type),
    on: () => ({}),
    revealLeaf: () => {},
    getRightLeaf: () => null,
    getLeaf: () => null,
  };
  return ws;
}

export function fakeApp(ws = fakeWorkspace()) {
  const files = new Map<string, string>();
  return {
    workspace: ws,
    files,
    vault: {
      getAbstractFileByPath: (p: string) => (files.has(p) ? new TFile(p) : null),
      process: async (file: InstanceType<typeof TFile>, fn: (data: string) => string) => {
        files.set(file.path, fn(files.get(file.path) ?? ""));
      },
    },
  };
}

/* ---------- transport ---------- */

export type Route = (req: TransportRequest, body: unknown) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;

export function scriptedTransport(routes: Record<string, Route>): Transport & { calls: TransportRequest[] } {
  const calls: TransportRequest[] = [];
  const t = (async (req: TransportRequest) => {
    calls.push(req);
    const path = new URL(req.url).pathname.replace(/^\/api\/public\/research/, "");
    const key = `${req.method} ${path}`;
    const route = routes[key] ?? routes[`${req.method} ${path.replace(/\/[^/]+$/, "/:id")}`];
    if (!route) return { status: 404, text: JSON.stringify({ error: { code: "not_found", message: `no route ${key}` } }) };
    const res = await route(req, req.body ? JSON.parse(req.body) : undefined);
    return { status: res.status, text: JSON.stringify(res.body) };
  }) as Transport & { calls: TransportRequest[] };
  t.calls = calls;
  return t;
}

/* ---------- host + service ---------- */

export function hostSettings(overrides: Partial<ResearchHost["settings"]> = {}): ResearchHost["settings"] {
  return {
    ...DEFAULT_RESEARCH_SETTINGS,
    researchBridgeUrl: "https://bridge.example.com",
    researchPluginKey: "ntr_testkey_0123456789abcdef",
    researchRuns: [],
    calloutType: "question",
    defaultCollapsed: true,
    boldSummary: true,
    format: "callout",
    numberedByDefault: false,
    ...overrides,
  };
}

export function makeService(opts: { settings?: Partial<ResearchHost["settings"]>; transport?: Transport; app?: ReturnType<typeof fakeApp> } = {}) {
  const app = opts.app ?? fakeApp();
  const settings = hostSettings(opts.settings);
  const saved: number[] = [];
  const intervals: number[] = [];
  const host: ResearchHost = {
    app: app as unknown as ResearchHost["app"],
    settings,
    saveSettings: async () => void saved.push(Date.now()),
    registerInterval: (id) => (intervals.push(id), id),
    activeCallout: () => settings.calloutType,
    nextNumberAt: () => 1,
    clientVersion: "test/1.7.0",
  };
  const service = new ResearchService(host);
  if (opts.transport) {
    const transport = opts.transport;
    // Swap in the scripted transport without touching the network module.
    const original = service.client.bind(service);
    service.client = () => {
      const c = original();
      (c as unknown as { transport: Transport }).transport = transport;
      return c;
    };
  }
  return { service, host, app, settings, saved, intervals };
}

/* ---------- canned responses ---------- */

export const answerResponse: AnswerResponse = {
  provider: "parallel",
  responseId: "resp_1",
  question: "Why is the sky blue?",
  answer: "Rayleigh scattering favours short wavelengths. Blue light scatters most.",
  citations: [
    { url: "https://a.example/sky", title: "Sky colour", startIndex: 0, endIndex: 46 },
    { url: "https://b.example/light", title: "Light", startIndex: 47, endIndex: 72 },
  ],
  sources: [{ url: "https://a.example/sky", title: "Sky colour" }],
  searches: ["why sky blue"],
  latencyMs: 1234,
};

export const factCheckResponse: FactCheckResponse = {
  provider: "parallel",
  responseId: "resp_2",
  claim: "The Great Wall is visible from space",
  verdict: "contradicted",
  confidence: "high",
  summary: "Astronauts report it is not visible to the naked eye from low orbit.",
  correction: "It is not visible without aid.",
  sources: [{ url: "https://nasa.example/wall", title: "NASA", quote: "not visible" }],
  latencyMs: 900,
};

export const searchResponse: SearchResponse = {
  provider: "parallel",
  query: "mitochondria",
  mode: "fast",
  results: [
    { url: "https://bio.example/mito", title: "Mitochondria", publishDate: "2024-03-01T00:00:00Z", excerpts: ["Powerhouse of the cell."] },
    { url: "https://bio.example/atp", title: "ATP synthesis", publishDate: null, excerpts: ["Made in the inner membrane."] },
  ],
  warnings: [],
  cached: false,
  latencyMs: 700,
} as SearchResponse;

export const recallResponse: RecallResponse = {
  title: "Krebs cycle",
  style: "mcq",
  cards: [
    { question: "Where does the Krebs cycle happen?", answer: "Mitochondrial matrix", options: ["Cytosol", "Mitochondrial matrix", "Nucleus", "Golgi"], correctIndex: 1 },
    { question: "How many CO2 per turn?", answer: "Two", options: ["One", "Two", "Three", "Four"], correctIndex: 1, hint: "Count the decarboxylations" },
  ],
  sources: [],
  latencyMs: 2000,
};

export function taskRun(overrides: Partial<TaskRun> = {}): TaskRun {
  return {
    runId: "trun_1",
    status: "queued",
    objective: "History of the Silk Road",
    preset: "report",
    processor: "base",
    notePath: "notes/silk.md",
    createdAt: "2026-09-24T05:00:00.000Z",
    updatedAt: "2026-09-24T05:00:00.000Z",
    completedAt: null,
    error: null,
    result: null,
    estimate: "15–100 s",
    ...overrides,
  };
}
