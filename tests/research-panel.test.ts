/**
 * v1.7.0 — the research side panel rendered under happy-dom: composer,
 * results, background runs, and the unconfigured state.
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { COMPOSER_KINDS, RESEARCH_VIEW_ICON, RESEARCH_VIEW_TYPE, ResearchView, isMarkdownLeaf, statusLabel } from "../src/research/panel";
import { clickButton, flush, installObsidianDom } from "./research-dom";
import { FakeEditor, answerResponse, fakeApp, makeService, markdownView, scriptedTransport, taskRun } from "./research-fixtures";
import { notices } from "./setup";

installObsidianDom();
beforeEach(() => void (notices.length = 0));

function mountPanel(opts: Parameters<typeof makeService>[0] = {}) {
  const made = makeService(opts);
  const opened: string[] = [];
  const host = {
    research: made.service,
    settings: made.settings,
    openSettings: () => void opened.push("settings"),
  };
  const view = new ResearchView({ app: made.app } as never, host as never);
  return { ...made, view, opened, root: view.contentEl };
}

const textarea = (root: HTMLElement) => root.querySelector<HTMLTextAreaElement>("textarea.ntt-rp-input")!;
const select = (root: HTMLElement) => root.querySelector<HTMLSelectElement>("select.ntt-rp-kind")!;
const goButton = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('button[aria-label="Run research"]')!;
const type = (root: HTMLElement, text: string) => {
  const ta = textarea(root);
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
};

const bridge = () =>
  scriptedTransport({
    "POST /answer": () => ({ status: 200, body: answerResponse }),
    "POST /factcheck": () => ({ status: 500, body: { error: { code: "upstream_error", message: "Parallel is down" } } }),
    // Like the real bridge, a poll answers for the run that was asked about.
    "GET /tasks/:id": (req) => ({
      status: 200,
      body: taskRun({
        runId: decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? ""),
        status: "completed",
        result: { markdown: "# R", content: {}, basis: [], sources: [] },
      }),
    }),
  });

describe("chrome", () => {
  test("identifies itself to Obsidian", () => {
    const { view } = mountPanel();
    expect(view.getViewType()).toBe(RESEARCH_VIEW_TYPE);
    expect(view.getDisplayText()).toBe("Research");
    expect(view.getIcon()).toBe(RESEARCH_VIEW_ICON);
  });

  test("renders header, composer with every mode, and an empty results section", async () => {
    const { view, root } = mountPanel();
    await view.onOpen();
    expect(root.classList.contains("ntt-research-panel")).toBe(true);
    expect(root.querySelector(".ntt-rp-status")?.textContent).toBe("Connected");
    expect(Array.from(select(root).options).map((o) => o.value)).toEqual(COMPOSER_KINDS.map((k) => k.id));
    expect(textarea(root).placeholder).toBe(COMPOSER_KINDS[0].placeholder);
    expect(root.querySelector('button[aria-label="Use selection"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="Start deep research"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="Refresh runs"]')).not.toBeNull();
    expect(root.querySelector('button[aria-label="Research settings"]')).not.toBeNull();
    expect(goButton(root).textContent).toBe("Ask");
    expect(goButton(root).disabled).toBe(true);
    expect((root.querySelector(".ntt-rp-setup") as HTMLElement).style.display).toBe("none");
    expect((root.querySelector(".ntt-rp-runs") as HTMLElement).style.display).toBe("none");
    expect(root.querySelector(".ntt-rp-empty")?.textContent).toContain("Nothing yet");
  });

  test("unconfigured: shows the setup card, and Go sends the reader to settings", async () => {
    const { view, root, opened } = mountPanel({ settings: { researchPluginKey: "" } });
    await view.onOpen();
    expect(root.querySelector(".ntt-rp-status")?.textContent).toBe("Not set up");
    expect(root.querySelector(".ntt-rp-setup-title")?.textContent).toBe("Connect your research bridge");
    expect(root.querySelector(".ntt-rp-empty")?.textContent).toContain("once the bridge is connected");
    clickButton(root, "Open settings");
    expect(opened).toEqual(["settings"]);
    type(root, "anything");
    await view.submit();
    expect(opened).toHaveLength(2);
    expect(notices.at(-1)).toContain("not configured");
  });

  test("typing enables Go; switching mode relabels the button and placeholder", async () => {
    const { view, root } = mountPanel();
    await view.onOpen();
    type(root, "hello");
    expect(goButton(root).disabled).toBe(false);
    select(root).value = "factcheck";
    select(root).dispatchEvent(new Event("change"));
    expect(goButton(root).textContent).toBe("Check");
    expect(textarea(root).placeholder).toBe("A claim to verify");
    type(root, "   ");
    expect(goButton(root).disabled).toBe(true);
  });

  test("recall mode can run on the whole note even with nothing typed", async () => {
    const app = fakeApp();
    app.workspace.activeView = markdownView(new FakeEditor("body"), "n.md");
    const { view, root } = mountPanel({ app });
    await view.onOpen();
    select(root).value = "recall";
    select(root).dispatchEvent(new Event("change"));
    expect(goButton(root).textContent).toBe("Generate");
    expect(goButton(root).disabled).toBe(false);
  });
});

describe("asking and results", () => {
  test("submit runs the service, expands the new card, and the card inserts / copies / closes", async () => {
    const app = fakeApp();
    const ed = new FakeEditor("note line");
    app.workspace.activeView = markdownView(ed, "n.md");
    const { view, root, service } = mountPanel({ app, transport: bridge() });
    await view.onOpen();
    type(root, "Why is the sky blue?");
    await view.submit();
    expect(service.results).toHaveLength(1);
    expect(textarea(root).value).toBe("");
    const card = root.querySelector<HTMLElement>(".ntt-rp-card.is-answer")!;
    expect(card).not.toBeNull();
    expect(card.querySelector(".ntt-rp-chip")?.textContent).toBe("Ask the web");
    expect(card.querySelector(".ntt-rp-card-title")?.textContent).toBe("Why is the sky blue?");
    expect(card.querySelector(".ntt-rp-meta")?.textContent).toContain("1.2 s");
    await flush();
    expect(card.querySelector(".ntt-rp-card-body")?.textContent).toContain("Rayleigh scattering");
    expect(card.querySelector('button[aria-label="Hide preview"]')).not.toBeNull();
    expect(root.querySelector(".ntt-rp-section-title .ntt-rp-chip")?.textContent).toBe("1");

    clickButton(card, "Hide preview");
    expect(root.querySelector(".ntt-rp-card-body")).toBeNull();
    clickButton(root, "Show preview");
    await flush();
    expect(root.querySelector(".ntt-rp-card-body")).not.toBeNull();

    clickButton(root, `Insert “Why is the sky blue?” into the note`);
    await flush();
    expect(ed.getValue()).toContain("> [!question]- **Why is the sky blue?**");

    expect(root.querySelector('button[aria-label="Remove this result"]')).not.toBeNull();
    clickButton(root, "Remove this result");
    expect(service.results).toHaveLength(0);
    expect(root.querySelector(".ntt-rp-empty")).not.toBeNull();
  });

  test("Follow-up is offered only for answers with a response id", async () => {
    const { view, root, service } = mountPanel({ transport: bridge() });
    await view.onOpen();
    await service.ask("q");
    expect(root.querySelector('.ntt-rp-card button[title="Ask another question in the same thread"]')).not.toBeNull();
    service.results[0].responseId = undefined;
    view.refresh();
    expect(root.querySelector('.ntt-rp-card button[title="Ask another question in the same thread"]')).toBeNull();
  });

  test("a failing request becomes a notice; nothing is added and the composer keeps the text", async () => {
    const { view, root, service } = mountPanel({ transport: bridge() });
    await view.onOpen();
    select(root).value = "factcheck";
    select(root).dispatchEvent(new Event("change"));
    type(root, "The moon is cheese");
    await view.submit();
    expect(service.results).toHaveLength(0);
    expect(notices.at(-1)).toContain("Parallel is down");
    expect(textarea(root).value).toBe("The moon is cheese");
    expect(goButton(root).disabled).toBe(false);
  });

  test("Read link without a link, and Recall with nothing at all, explain what to do", async () => {
    const { view, root, service } = mountPanel({ transport: bridge() });
    await view.onOpen();
    select(root).value = "extract";
    select(root).dispatchEvent(new Event("change"));
    type(root, "no link here");
    await view.submit();
    expect(notices.at(-1)).toBe("Paste a link first.");
    select(root).value = "recall";
    select(root).dispatchEvent(new Event("change"));
    type(root, "");
    // Nothing typed and no note open: submit() is reachable via the shortcut even with Go disabled.
    await view.submit();
    expect(notices.at(-1)).toBe("Type a topic or open a note first.");
    expect(service.results).toHaveLength(0);
  });

  test("Use selection copies the note's selection (or line) into the composer; Ctrl+Enter submits", async () => {
    const app = fakeApp();
    const ed = new FakeEditor("- [ ] **A claim** on this line");
    app.workspace.activeView = markdownView(ed, "n.md");
    const { view, root, service } = mountPanel({ app, transport: bridge() });
    await view.onOpen();
    clickButton(root, "Use selection");
    expect(textarea(root).value).toBe("A claim on this line");
    ed.selection = "picked words";
    clickButton(root, "Use selection");
    expect(textarea(root).value).toBe("picked words");
    textarea(root).dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
    await flush();
    await flush();
    expect(service.results).toHaveLength(1);
    expect(service.results[0].kind).toBe("answer");
  });

  test("Use selection with nothing to copy explains itself", async () => {
    const { view, root } = mountPanel();
    await view.onOpen();
    clickButton(root, "Use selection");
    expect(notices.at(-1)).toBe("Select some text in a note first.");
  });

  test("Clear empties the history", async () => {
    const { view, root, service } = mountPanel({ transport: bridge() });
    await view.onOpen();
    await service.ask("one");
    await service.ask("two");
    expect(root.querySelectorAll(".ntt-rp-card")).toHaveLength(2);
    clickButton(root, "Clear all results");
    expect(service.results).toHaveLength(0);
    expect(root.querySelectorAll(".ntt-rp-card")).toHaveLength(0);
  });

  test("busy strip lists what is in flight and disables Go", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const t = scriptedTransport({ "POST /answer": async () => (await gate, { status: 200, body: answerResponse }) });
    const { view, root } = mountPanel({ transport: t });
    await view.onOpen();
    type(root, "slow");
    const p = view.submit();
    await flush();
    const busy = root.querySelector<HTMLElement>(".ntt-rp-busy")!;
    expect(busy.style.display).toBe("");
    expect(busy.textContent).toContain("Ask the web");
    expect(goButton(root).disabled).toBe(true);
    release();
    await p;
    expect(busy.style.display).toBe("none");
  });
});

describe("deep research runs", () => {
  test("lists runs newest first with status, and offers Insert / Copy / Dismiss / Check now as appropriate", async () => {
    const runs = [
      { ...taskRun({ runId: "a", status: "running", createdAt: "2026-09-24T05:00:00.000Z" }), markdown: null, consumed: false },
      { ...taskRun({ runId: "b", status: "completed", objective: "Newer", createdAt: "2026-09-24T06:00:00.000Z" }), markdown: "# Done", consumed: false },
      { ...taskRun({ runId: "c", status: "failed", error: "boom", createdAt: "2026-09-24T04:00:00.000Z" }), markdown: null, consumed: false },
    ];
    const app = fakeApp();
    const ed = new FakeEditor("");
    app.workspace.activeView = markdownView(ed, "notes/silk.md");
    const { view, root, service } = mountPanel({ app, transport: bridge(), settings: { researchRuns: runs as never } });
    await view.onOpen();
    const rows = Array.from(root.querySelectorAll<HTMLElement>(".ntt-rp-run"));
    expect(rows.map((r) => r.dataset["runId"])).toEqual(["b", "a", "c"]);
    expect(root.querySelector(".ntt-rp-runs .ntt-rp-chip")?.textContent).toBe("1 running");
    expect(rows[0].querySelector(".ntt-rp-meta")?.textContent).toContain("Ready");
    expect(rows[1].querySelector('button[aria-label="Check now"]')).not.toBeNull();
    expect(rows[2].querySelector(".ntt-rp-error")?.textContent).toBe("boom");

    clickButton(rows[0], "Insert");
    await flush();
    expect(ed.getValue()).toContain("> [!question]- **Newer**");
    expect(service.runs.find((r) => r.runId === "b")?.consumed).toBe(true);
    const again = root.querySelector<HTMLElement>('.ntt-rp-run[data-run-id="b"]')!;
    expect(again.textContent).toContain("Inserted");
    expect(again.querySelector('button[aria-label="Insert again"]')).not.toBeNull();

    clickButton(root.querySelector<HTMLElement>('.ntt-rp-run[data-run-id="c"]')!, "Dismiss this run");
    await flush();
    expect(service.runs.map((r) => r.runId).sort()).toEqual(["a", "b"]);

    clickButton(root.querySelector<HTMLElement>('.ntt-rp-run[data-run-id="a"]')!, "Check now");
    await flush();
    expect(service.runs.find((r) => r.runId === "a")?.status).toBe("completed");
    expect(notices.some((n) => n.startsWith("Deep research ready"))).toBe(true);
    service.dispose();
  });

  test("Refresh runs with nothing active just says so", async () => {
    const { view, root } = mountPanel();
    await view.onOpen();
    clickButton(root, "Refresh runs");
    expect(notices.at(-1)).toBe("No deep research is running.");
  });

  test("onClose stops listening", async () => {
    const { view, root, service } = mountPanel({ transport: bridge() });
    await view.onOpen();
    await view.onClose();
    expect(root.childNodes.length).toBe(0);
    await service.ask("after close");
    expect(root.querySelector(".ntt-rp-card")).toBeNull();
  });
});

describe("helpers", () => {
  test("statusLabel and isMarkdownLeaf", () => {
    expect(["queued", "running", "completed", "failed", "cancelled"].map((s) => statusLabel({ status: s as never }))).toEqual(["Queued", "Running", "Ready", "Failed", "Cancelled"]);
    expect(isMarkdownLeaf(null)).toBe(false);
    expect(isMarkdownLeaf({ view: markdownView(null, null) } as never)).toBe(true);
    expect(isMarkdownLeaf({ view: {} } as never)).toBe(false);
  });
});
