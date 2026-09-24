/**
 * v1.7.3 — the *real* plugin class under happy-dom: an autoscroll run is
 * started and stopped on a rendered note and the things a phone shows are
 * asserted directly — the body classes that hide Obsidian's chrome, and how
 * the run and the sticky "Open all / Close all" (v1.7.2) share the toggles.
 *
 * The two audited bugs:
 *  - the "status bar strip": the focus run's own top gap counted the phone's
 *    safe-area inset a second time (Obsidian already pads the body) — covered
 *    by the stylesheet assertions at the bottom;
 *  - a sticky "Open all" surviving into a run: every DOM insert (the think
 *    badge, a lazily rendered section) re-applied "open" and popped the answer
 *    the run had just closed back open.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

import NotionTogglePlugin from "../main";
import { watchAnswerRenders } from "../src/answer-render-watch";
import { rememberAnswerWant } from "../src/answer-state";
import { isQuizVisible } from "../src/quiz-visibility";
import { FOCUS_RUN_CLASS, REDUCED_MOTION_CLASS, THINK_RUN_CLASS } from "../src/think-gate";
import { foldableToggleEls, isToggleOpen, setToggleOpen } from "../src/toggle-dom";
import { notices } from "./setup";

const TOTAL = 8;
const PATH = "Notes/Physics.md";

function calloutHtml(n: number) {
  return `
    <div class="callout is-collapsible is-collapsed" data-callout="question" id="q${n}">
      <div class="callout-title"><div class="callout-title-inner">Q${n}. Question ${n}</div><div class="callout-fold"></div></div>
      <div class="callout-content"><p>Answer ${n}</p></div>
    </div>`;
}

/** A Reading View leaf the way the plugin finds it through the workspace. */
function mountNote() {
  document.body.className = "is-mobile";
  document.body.innerHTML = `
    <div class="workspace-leaf mod-active"><div class="workspace-leaf-content" data-type="markdown">
      <div class="view-header"></div>
      <div class="view-content"><div class="markdown-reading-view">
        <div class="markdown-preview-view" id="note"><div class="markdown-preview-sizer">
          ${Array.from({ length: TOTAL }, (_, i) => calloutHtml(i + 1)).join("")}
        </div></div>
      </div></div>
    </div></div>`;
  const contentEl = document.querySelector(".view-content") as HTMLElement;
  const note = document.getElementById("note") as HTMLElement;
  // happy-dom has no layout: give the scroller a real height so it "can scroll".
  let top = 0;
  Object.defineProperty(note, "scrollHeight", { value: 4000, configurable: true });
  Object.defineProperty(note, "clientHeight", { value: 800, configurable: true });
  Object.defineProperty(note, "scrollTop", {
    get: () => top,
    set: (v: number) => {
      top = Math.max(0, Math.min(3200, v));
    },
    configurable: true,
  });
  return { contentEl, note };
}

function makePlugin() {
  const { contentEl, note } = mountNote();
  const source = Array.from({ length: TOTAL }, (_, i) => `> [!question]- Q${i + 1}. Question ${i + 1}\n> Answer ${i + 1}\n`).join("\n");
  const file = { path: PATH, basename: "Physics", extension: "md" };
  const view = {
    file,
    leaf: null,
    data: source,
    contentEl,
    previewMode: { containerEl: contentEl },
    getMode: () => "preview",
    editor: { getValue: () => source },
  };
  const app = {
    workspace: {
      getActiveViewOfType: () => view,
      getActiveFile: () => file,
      activeEditor: null,
      on: () => ({}),
    },
    vault: {},
  };
  const plugin = new NotionTogglePlugin(app as never, { id: "notion-toggle", version: "1.7.3" } as never);
  (plugin as unknown as { manifest: unknown }).manifest = { id: "notion-toggle", version: "1.7.3" };
  plugin.settings = {
    ...plugin.settings,
    scrollQuiet: true,
    scrollFab: false,
    scrollFocusChrome: true,
    scrollReducedMotion: false,
    scrollAutoOpen: true,
    scrollAutoClose: true,
    scrollFilter: [],
    scrollMode: "all",
    scrollAdvanceBy: "toggles",
  } as typeof plugin.settings;
  // The frame loop is real-time; these tests drive start / stop state only.
  (plugin as unknown as { scheduleScrollFrame: () => void }).scheduleScrollFrame = () => {};
  return { plugin, note, view, file };
}

const wait = (ms = 0) => new Promise<void>((r) => setTimeout(r, ms));
const openCount = (root: ParentNode) => foldableToggleEls(root).filter(isToggleOpen).length;

let cleanup: (() => void)[] = [];
beforeEach(() => {
  notices.length = 0;
});
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.className = "";
  document.body.innerHTML = "";
});

describe("v1.7.3 — a real autoscroll run on a phone", () => {
  test("starting a run hides Obsidian's chrome via body classes; stopping restores it", () => {
    const { plugin } = makePlugin();
    expect(document.body.classList.contains(FOCUS_RUN_CLASS)).toBe(false);

    plugin.startAutoScroll();
    expect(plugin.scrollRunning).toBe(true);
    expect(plugin.scrollPlan.length).toBe(TOTAL);
    expect(document.body.classList.contains(THINK_RUN_CLASS)).toBe(true);
    expect(document.body.classList.contains(FOCUS_RUN_CLASS)).toBe(true);
    expect(document.body.classList.contains(REDUCED_MOTION_CLASS)).toBe(false);
    expect(document.body.classList.contains("is-mobile")).toBe(true); // Obsidian's own class is untouched

    plugin.stopAutoScroll(false);
    expect(plugin.scrollRunning).toBe(false);
    for (const cls of [THINK_RUN_CLASS, FOCUS_RUN_CLASS, REDUCED_MOTION_CLASS]) {
      expect(document.body.classList.contains(cls)).toBe(false);
    }
    expect(document.body.classList.contains("is-mobile")).toBe(true);
  });

  test("'Hide Obsidian chrome' off: the focus class never appears, the think class still does", () => {
    const { plugin } = makePlugin();
    plugin.settings.scrollFocusChrome = false;
    plugin.settings.scrollReducedMotion = true;
    plugin.startAutoScroll();
    expect(document.body.classList.contains(FOCUS_RUN_CLASS)).toBe(false);
    expect(document.body.classList.contains(THINK_RUN_CLASS)).toBe(true);
    expect(document.body.classList.contains(REDUCED_MOTION_CLASS)).toBe(true);
    plugin.stopAutoScroll(false);
    expect(document.body.classList.contains(REDUCED_MOTION_CLASS)).toBe(false);
  });

  test("a sticky 'Open all' is dropped the moment a run starts, so the run owns the toggles", async () => {
    const { plugin, note } = makePlugin();
    await plugin.setAllAnswersOpen(true);
    expect(openCount(note)).toBe(TOTAL);
    expect(plugin.answerWant).toEqual({ file: PATH, want: "open" });

    plugin.startAutoScroll();
    expect(plugin.answerWant.want).toBeNull();
    // Nothing was closed by the start itself — the run closes as it goes.
    expect(openCount(note)).toBe(TOTAL);
    plugin.stopAutoScroll(false);
  });

  test("during a run the render watcher never re-opens an answer the run closed (the think-badge insert)", async () => {
    const { plugin, note } = makePlugin();
    const container = note;
    cleanup.push(
      watchAnswerRenders(document.body, {
        active: () => !!plugin.answerWant.want,
        busy: () => false,
        apply: () => void plugin.applyWantedAnswers(container),
        schedule: (fn) => fn(),
      })
    );
    await plugin.setAllAnswersOpen(true);
    plugin.startAutoScroll();

    // The run closes the toggle it is leaving and shows a countdown badge on the next one.
    const q1 = note.querySelector("#q1") as HTMLElement;
    setToggleOpen(q1, false);
    const badge = document.createElement("span");
    badge.className = "ntt-think-badge";
    (note.querySelector("#q2 .callout-title") as HTMLElement).appendChild(badge);
    await wait(10);
    expect(isToggleOpen(q1)).toBe(false);

    // Even a want that sneaks back in while running is ignored by the apply path.
    rememberAnswerWant(plugin.answerWant, PATH, "open");
    expect(plugin.applyWantedAnswers(container)).toBe(0);
    expect(isToggleOpen(q1)).toBe(false);
    plugin.stopAutoScroll(false);
  });

  test("'Open all' tapped mid-run is a one-shot: it flips the toggles but is not remembered", async () => {
    const { plugin, note } = makePlugin();
    plugin.startAutoScroll();
    expect(openCount(note)).toBe(0);
    await plugin.setAllAnswersOpen(true);
    expect(openCount(note)).toBe(TOTAL);
    expect(plugin.answerWant.want).toBeNull();
    expect(notices).toEqual([]); // quiet mode: a complete flip says nothing
    plugin.settings.scrollQuiet = false;
    await plugin.setAllAnswersOpen(false);
    expect(openCount(note)).toBe(0);
    expect(plugin.answerWant.want).toBeNull();
    expect(notices.at(-1)).toBe(`Closed ${TOTAL} of ${TOTAL} answers.`);
    plugin.stopAutoScroll(false);
  });

  test("resuming a paused run drops a command given while paused", async () => {
    const { plugin, note } = makePlugin();
    plugin.startAutoScroll();
    plugin.toggleAutoScroll(); // pause
    expect(plugin.scrollRunning).toBe(false);
    expect(plugin.scrollPlan.length).toBe(TOTAL);
    await plugin.setAllAnswersOpen(false);
    expect(plugin.answerWant).toEqual({ file: PATH, want: "closed" });
    plugin.toggleAutoScroll(); // resume
    expect(plugin.scrollRunning).toBe(true);
    expect(plugin.answerWant.want).toBeNull();
    expect(openCount(note)).toBe(0);
    plugin.stopAutoScroll(false);
  });

  test("during a quiz 'Open all' updates the quiz's own classes once and is not remembered", async () => {
    const { plugin, note } = makePlugin();
    plugin.quizState = { at: 0, phase: "think", remaining: 1000, total: TOTAL, answered: 0, running: true, elapsedMs: 0 } as never;
    await plugin.setAllAnswersOpen(true);
    const els = foldableToggleEls(note);
    expect(els.every(isQuizVisible)).toBe(true);
    expect(els.some(isToggleOpen)).toBe(false); // the fold arrow is the quiz's business, not ours
    expect(plugin.answerWant.want).toBeNull();
    // and the render watcher path stays inert while the quiz runs
    rememberAnswerWant(plugin.answerWant, PATH, "closed");
    expect(plugin.applyWantedAnswers(note)).toBe(0);
    expect(els.every(isQuizVisible)).toBe(true);
    plugin.quizState = null;
  });

  test("outside any run the command stays sticky and newly rendered answers are born open", async () => {
    const { plugin, note } = makePlugin();
    cleanup.push(
      watchAnswerRenders(document.body, {
        active: () => !!plugin.answerWant.want,
        busy: () => false,
        apply: () => void plugin.applyWantedAnswers(note),
        schedule: (fn) => fn(),
      })
    );
    await plugin.setAllAnswersOpen(true);
    const sizer = note.firstElementChild as HTMLElement;
    sizer.insertAdjacentHTML("beforeend", calloutHtml(TOTAL + 1));
    await wait(10);
    expect(isToggleOpen(note.querySelector(`#q${TOTAL + 1}`) as HTMLElement)).toBe(true);
    // a finished run leaves the reader's later commands alone
    plugin.startAutoScroll();
    plugin.stopAutoScroll(false);
    expect(plugin.answerWant.want).toBeNull();
    await plugin.setAllAnswersOpen(false);
    expect(plugin.answerWant).toEqual({ file: PATH, want: "closed" });
    sizer.insertAdjacentHTML("beforeend", calloutHtml(TOTAL + 2).replace("is-collapsed", ""));
    await wait(10);
    expect(isToggleOpen(note.querySelector(`#q${TOTAL + 2}`) as HTMLElement)).toBe(false);
  });
});
