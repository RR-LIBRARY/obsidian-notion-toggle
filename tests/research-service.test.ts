/**
 * v1.7.0 — the research service against a scripted bridge: results, insertion
 * targets, recall input, background runs and polling.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { TFile } from "obsidian";
import { ResearchError, describeError } from "../src/research/client";
import { MAX_RESULTS, cleanLine, insertIntoEditor, recallInput } from "../src/research/service";
import { installObsidianDom, flush } from "./research-dom";
import {
  FakeEditor,
  answerResponse,
  fakeApp,
  factCheckResponse,
  makeService,
  markdownView,
  recallResponse,
  scriptedTransport,
  searchResponse,
  taskRun,
} from "./research-fixtures";
import { notices } from "./setup";

installObsidianDom();
beforeEach(() => void (notices.length = 0));

const bridge = () =>
  scriptedTransport({
    "POST /answer": (_r, b) => ({ status: 200, body: { ...answerResponse, question: (b as { question: string }).question } }),
    "POST /factcheck": () => ({ status: 200, body: factCheckResponse }),
    "POST /search": () => ({ status: 200, body: searchResponse }),
    "POST /perplexity": () => ({
      status: 200,
      body: { provider: "perplexity", query: "q", results: [{ title: "A", url: "https://a.example", snippet: "", date: null }], cached: false, latencyMs: 3 },
    }),
    "POST /extract": (_r, b) => ({
      status: 200,
      body: { provider: "parallel", results: (b as { urls: string[] }).urls.map((u) => ({ url: u, title: "Page", publishDate: null, excerpts: ["Text"], fullContent: null })), errors: [], latencyMs: 2 },
    }),
    "POST /recall": () => ({ status: 200, body: recallResponse }),
  });

describe("results history", () => {
  test("every operation pushes a result (newest first) and notifies listeners", async () => {
    const { service } = makeService({ transport: bridge() });
    let changes = 0;
    service.onChange(() => changes++);
    await service.ask("Why is the sky blue?");
    await service.factCheck("claim");
    await service.search("mitochondria");
    await service.quickSearch("q");
    await service.extract("see https://a.example/page");
    await service.recall({ topic: "Krebs" });
    expect(service.results.map((r) => r.kind)).toEqual(["recall", "extract", "quick", "search", "factcheck", "answer"]);
    expect(service.results[5]).toMatchObject({ title: "Why is the sky blue?", responseId: "resp_1", latencyMs: 1234 });
    expect(service.results[5].markdown).toContain("> [!question]-");
    expect(service.results[5].preview).not.toContain("> [!");
    expect(changes).toBeGreaterThanOrEqual(12); // busy on/off + push per call
    expect(service.busy.size).toBe(0);
  });

  test("history is capped, and forget / clear drop entries", async () => {
    const { service } = makeService({ transport: bridge() });
    for (let i = 0; i < MAX_RESULTS + 2; i++) await service.quickSearch(`q${i}`);
    expect(service.results).toHaveLength(MAX_RESULTS);
    const id = service.results[0].id;
    service.forget(id);
    expect(service.results.find((r) => r.id === id)).toBeUndefined();
    service.clearResults();
    expect(service.results).toHaveLength(0);
  });

  test("an unconfigured service refuses before touching the network", async () => {
    const t = bridge();
    const { service } = makeService({ transport: t, settings: { researchPluginKey: "" } });
    expect(service.configured).toBe(false);
    const err = await service.ask("x").catch((e) => e);
    expect(err).toBeInstanceOf(ResearchError);
    expect(err.code).toBe("not_configured");
    expect(t.calls).toHaveLength(0);
  });

  test("busy is cleared even when the bridge fails", async () => {
    const t = scriptedTransport({ "POST /answer": () => ({ status: 402, body: { error: { code: "payment_required", message: "no credits" } } }) });
    const { service } = makeService({ transport: t });
    const err = await service.ask("x").catch((e) => e);
    expect(describeError(err)).toContain("out of credits");
    expect(service.busy.size).toBe(0);
    expect(service.results).toHaveLength(0);
  });

  test("language and effort settings shape the request", async () => {
    const t = bridge();
    const { service } = makeService({ transport: t, settings: { researchLanguage: "Hindi", researchEffort: "high" } });
    await service.ask("q");
    const body = JSON.parse(t.calls[0].body ?? "{}");
    expect(body.effort).toBe("high");
    expect(body.instructions).toContain("Hindi");
    await service.recall({ topic: "t" });
    expect(JSON.parse(t.calls[1].body ?? "{}")).toMatchObject({ topic: "t", count: 8, style: "qa", language: "Hindi" });
  });
});

describe("inserting", () => {
  test("below the cursor line, then the cursor moves past the block", () => {
    const ed = new FakeEditor("line 0\nline 1\nline 2");
    ed.setCursor({ line: 1, ch: 3 });
    insertIntoEditor(ed as never, "> [!question]- **Q**\n> A\n", "cursor");
    expect(ed.lines).toEqual(["line 0", "line 1", "> [!question]- **Q**", "> A", "", "line 2"]);
    expect(ed.cursor).toEqual({ line: 4, ch: 0 });
  });

  test("at the end of the note with one blank line of separation", () => {
    const ed = new FakeEditor("a\nb");
    insertIntoEditor(ed as never, "X", "end");
    expect(ed.getValue()).toBe("a\nb\n\nX\n");
  });

  test("targetEditor prefers the focused note, then the note the result came from", () => {
    const app = fakeApp();
    const focused = new FakeEditor("focused");
    const other = new FakeEditor("other");
    app.workspace.activeView = markdownView(focused, "a.md");
    app.workspace.leaves = [{ view: markdownView(other, "b.md") }, { view: markdownView(focused, "a.md") }];
    const { service } = makeService({ app });
    expect(service.targetEditor(null)).toBe(focused);
    expect(service.targetEditor("b.md")).toBe(other);
    // Panel focused: no active markdown view → most recent leaf wins.
    app.workspace.activeView = null;
    app.workspace.recent = { view: markdownView(other, "b.md") };
    expect(service.targetEditor(null)).toBe(other);
    app.workspace.recent = null;
    expect(service.targetEditor(null)).toBe(other); // first open note
    app.workspace.leaves = [];
    expect(service.targetEditor(null)).toBeNull();
  });

  test("insertResult goes to the source note; with no editor it appends to the file", async () => {
    const app = fakeApp();
    app.files.set("notes/x.md", "# X\n");
    app.workspace.activeFile = null;
    const { service } = makeService({ app, transport: bridge() });
    app.workspace.activeFile = new TFile("notes/x.md");
    const r = await service.ask("q");
    expect(r.sourcePath).toBe("notes/x.md");
    app.workspace.activeFile = null;
    const ok = await service.insertResult(r);
    expect(ok).toBe(true);
    expect(app.files.get("notes/x.md")).toContain("> [!question]-");
    expect(notices.at(-1)).toBe("Added to x");
  });

  test("with nothing to insert into, the reader is told to open a note", async () => {
    const { service } = makeService();
    expect(await service.insertMarkdown("x")).toBe(false);
    expect(notices.at(-1)).toContain("Open a note first");
  });

  test("contextText: selection first, else the cleaned current line", () => {
    const { service } = makeService();
    const ed = new FakeEditor("> [!question]- **What is ATP?**\n- [ ] A. energy");
    expect(service.contextText(ed as never)).toEqual({ text: "What is ATP?", fromSelection: false });
    ed.selection = "  chosen words ";
    expect(service.contextText(ed as never)).toEqual({ text: "chosen words", fromSelection: true });
    expect(service.contextText(null)).toEqual({ text: "", fromSelection: false });
    expect(cleanLine("1. <summary><b>Title</b></summary>")).toBe("Title");
  });
});

describe("recallInput", () => {
  test("URL → url, long or multi-line text → text, short phrase → topic, empty → note", () => {
    expect(recallInput("https://a.example/page", "")).toEqual({ url: "https://a.example/page" });
    expect(recallInput("line one\nline two", "")).toEqual({ text: "line one\nline two" });
    expect(recallInput("x".repeat(401), "")).toEqual({ text: "x".repeat(401) });
    expect(recallInput("Krebs cycle", "")).toEqual({ topic: "Krebs cycle" });
    expect(recallInput("  ", "whole note")).toEqual({ text: "whole note" });
    expect(recallInput("", "   ")).toBeNull();
  });
});

describe("deep research", () => {
  test("starting a run stores it, saves settings and begins polling until it completes", async () => {
    let polls = 0;
    const t = scriptedTransport({
      "POST /tasks": (_r, b) => ({ status: 200, body: taskRun({ objective: (b as { objective: string }).objective }) }),
      "GET /tasks/:id": () => {
        polls++;
        return {
          status: 200,
          body: polls < 2 ? taskRun({ status: "running" }) : taskRun({ status: "completed", result: { markdown: "# Done", content: {}, basis: [], sources: [] } }),
        };
      },
    });
    const { service, settings, saved, intervals } = makeService({ transport: t });
    const run = await service.startDeepResearch("Silk Road", { preset: "timeline" });
    expect(run.status).toBe("queued");
    expect(settings.researchRuns).toHaveLength(1);
    expect(saved.length).toBeGreaterThan(0);
    expect(intervals).toHaveLength(1);
    // Drive the poll loop directly (the interval is 2 s; the fake clock is real).
    const tick = (service as unknown as { pollTick: () => Promise<void> }).pollTick.bind(service);
    const due = (service as unknown as { nextPollAt: Map<string, number> }).nextPollAt;
    due.set("trun_1", 0);
    await tick();
    expect(service.runs[0].status).toBe("running");
    due.set("trun_1", 0);
    await tick();
    expect(service.runs[0]).toMatchObject({ status: "completed", markdown: "# Done", consumed: false });
    expect(notices.some((n) => n.startsWith("Deep research ready"))).toBe(true);
    await flush();
    service.dispose();
  });

  test("insertRun fetches a missing report, inserts it as a toggle and marks it consumed", async () => {
    const t = scriptedTransport({
      "GET /tasks/:id": () => ({ status: 200, body: taskRun({ status: "completed", result: { markdown: "# Report\n\nBody", content: {}, basis: [], sources: [] } }) }),
    });
    const app = fakeApp();
    const ed = new FakeEditor("note");
    app.workspace.activeView = markdownView(ed, "notes/silk.md");
    const { service, settings } = makeService({ app, transport: t, settings: { researchRuns: [{ ...taskRun(), markdown: null, consumed: false } as never] } });
    expect(await service.insertRun("trun_1")).toBe(true);
    expect(ed.getValue()).toContain("> [!question]- **History of the Silk Road**");
    expect(ed.getValue()).toContain("> ## Report");
    expect(settings.researchRuns[0].consumed).toBe(true);
  });

  test("a run the bridge no longer knows is marked failed instead of polling forever", async () => {
    const t = scriptedTransport({ "GET /tasks/:id": () => ({ status: 404, body: { error: { code: "not_found", message: "gone" } } }) });
    const { service } = makeService({ transport: t, settings: { researchRuns: [{ ...taskRun({ status: "running" }), markdown: null, consumed: false } as never] } });
    const tick = (service as unknown as { pollTick: () => Promise<void> }).pollTick.bind(service);
    (service as unknown as { nextPollAt: Map<string, number> }).nextPollAt.set("trun_1", 0);
    await tick();
    expect(service.runs[0]).toMatchObject({ status: "failed", error: "Run not found on the bridge" });
  });

  test("dismissRun forgets the run and dispose stops polling", async () => {
    const { service, settings } = makeService({ settings: { researchRuns: [{ ...taskRun({ status: "running" }), markdown: null, consumed: false } as never] } });
    service.ensurePolling();
    await service.dismissRun("trun_1");
    expect(settings.researchRuns).toHaveLength(0);
    service.dispose();
    expect((service as unknown as { pollTimer: number | null }).pollTimer).toBeNull();
  });
});
