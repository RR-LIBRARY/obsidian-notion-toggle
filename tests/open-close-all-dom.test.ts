/**
 * v1.7.1 — "Answers — open / close all" against a lazily rendered note.
 *
 * The bug: Obsidian's Reading View renders a screenful at a time, and the old
 * button walked only the rendered DOM (outermost toggles only). On a 73-toggle
 * note it flipped the dozen on screen and said nothing. These tests replay the
 * exact sequence `setAllAnswersOpen` now runs — force the full render, wait
 * for the DOM to catch up with the source count, act on every *foldable*
 * toggle (nested ones included, plain non-foldable callouts skipped) and say
 * honestly what happened.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { ensureFullRender } from "../src/full-render";
import { answersNotice, answersNoticeIsImportant, waitFor } from "../src/screen-run";
import { scanSourceToggles } from "../src/source-toggles";
import { foldableToggleEls, isFoldableToggle, isToggleOpen, setToggleOpen } from "../src/toggle-dom";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

function callout(id: string, type: string, title: string, opts: { collapsed?: boolean; foldable?: boolean; inner?: string } = {}) {
  const foldable = opts.foldable ?? true;
  const cls = ["callout", foldable ? "is-collapsible" : "", opts.collapsed ? "is-collapsed" : ""].filter(Boolean).join(" ");
  return `
    <div class="${cls}" data-callout="${type}" id="${id}">
      <div class="callout-title">
        <div class="callout-title-inner">${title}</div>
        ${foldable ? '<div class="callout-fold"></div>' : ""}
      </div>
      <div class="callout-content">${opts.inner ?? `Answer for ${title}`}</div>
    </div>`;
}

/** Obsidian folds a callout by clicking its title — replicate that handler. */
function wire(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".callout.is-collapsible").forEach((el) => {
    const title = el.querySelector(":scope > .callout-title") as HTMLElement;
    title.addEventListener("click", (ev) => {
      ev.stopPropagation();
      el.classList.toggle("is-collapsed");
    });
  });
}

const TOTAL = 40;
function questionHtml(n: number) {
  return callout(`q${n}`, "recall-red", `Q${n}. Question ${n}`, { collapsed: true });
}

/** A fake Reading View: `render(n)` puts the first n sections on the page like Obsidian's lazy renderer. */
function makeNote() {
  document.body.innerHTML = `<div class="markdown-preview-view" id="note"><div class="markdown-preview-sizer"></div></div>`;
  const note = document.getElementById("note") as HTMLElement;
  const sizer = note.firstElementChild as HTMLElement;
  const sections: string[] = [];
  for (let n = 1; n <= TOTAL; n++) {
    // every 10th question carries a nested foldable sub-answer, and one plain note that must be left alone
    const nested = n % 10 === 0
      ? callout(`q${n}-inner`, "info", `Q${n} detail`, { collapsed: true })
        + callout(`q${n}-plain`, "note", "Just a note", { foldable: false })
      : "";
    sections.push(n % 10 === 0
      ? callout(`q${n}`, "recall-red", `Q${n}. Question ${n}`, { collapsed: true, inner: `Answer ${n}${nested}` })
      : questionHtml(n));
  }
  const render = (upTo: number) => {
    sizer.innerHTML = sections.slice(0, upTo).map((s) => `<div class="markdown-preview-section">${s}</div>`).join("");
    wire(sizer);
  };
  return { note, render };
}

/** The note's markdown source — what `scanSourceToggles` counts. */
function source(): string {
  const lines: string[] = [];
  for (let n = 1; n <= TOTAL; n++) {
    lines.push(`> [!recall-red]- Q${n}. Question ${n}`, `> Answer ${n}`, "");
    if (n % 10 === 0) lines.push(`> > [!info]- Q${n} detail`, `> > more`, `> > [!note] Just a note`, "");
  }
  return lines.join("\n");
}

/** What main.ts's setAllAnswersOpen does, with the Obsidian bits injected. */
async function setAllAnswersOpen(
  open: boolean,
  container: HTMLElement,
  view: { previewMode: { renderer: { showAll: boolean; rerender: (full?: boolean) => void } } },
  noteSource: string,
  clock: { setTimeout: (fn: () => void, ms: number) => unknown; now: () => number },
) {
  const src = scanSourceToggles(noteSource);
  const handle = ensureFullRender(view);
  if (handle.forced) {
    await waitFor(() => container.querySelectorAll(".callout, details").length >= src.total, {
      everyMs: 50, timeoutMs: 2500, setTimeout: clock.setTimeout, now: clock.now,
    });
  }
  const els = foldableToggleEls(container);
  let changed = 0;
  for (const el of els) {
    if (isToggleOpen(el) === open) continue;
    setToggleOpen(el, open);
    changed++;
  }
  const result = { changed, rendered: els.length, total: src.foldable };
  return { result, notice: answersNotice(open, result), important: answersNoticeIsImportant(result) };
}

function fakeClock() {
  let now = 0;
  const queue: { at: number; fn: () => void }[] = [];
  return {
    now: () => now,
    setTimeout: (fn: () => void, ms: number) => { queue.push({ at: now + ms, fn }); return 0; },
    async run(untilMs: number) {
      while (queue.length && queue[0].at <= untilMs) {
        const next = queue.shift()!;
        now = next.at;
        next.fn();
        await Promise.resolve();
        await Promise.resolve();
      }
      now = untilMs;
    },
  };
}

let note: HTMLElement;
let render: (upTo: number) => void;
beforeEach(() => {
  ({ note, render } = makeNote());
});
afterAll(() => {
  document.body.innerHTML = "";
});

describe("isFoldableToggle / foldableToggleEls", () => {
  test("keeps foldable callouts and <details>, drops plain non-foldable callouts, includes nested ones", () => {
    render(TOTAL);
    document.body.insertAdjacentHTML("beforeend", `<details id="d1"><summary>Extra</summary>x</details>`);
    const els = foldableToggleEls(document.body);
    const ids = els.map((e) => e.id);
    expect(ids).toContain("q1");
    expect(ids).toContain("q10-inner"); // nested foldable → included
    expect(ids).not.toContain("q10-plain"); // plain !note → not a toggle
    expect(ids).toContain("d1");
    expect(els.length).toBe(TOTAL + TOTAL / 10 + 1);
    expect(isFoldableToggle(document.getElementById("q10-plain") as HTMLElement)).toBe(false);
  });

  test("a collapsed callout without the is-collapsible class still counts (older themes)", () => {
    document.body.innerHTML = `<div class="callout is-collapsed" data-callout="question" id="old"><div class="callout-title"><div class="callout-title-inner">Q</div></div></div>`;
    expect(isFoldableToggle(document.getElementById("old") as HTMLElement)).toBe(true);
  });
});

describe("Open all / Close all on a lazily rendered note", () => {
  test("source count: every callout is counted, but only the `-`/`+` ones are foldable", () => {
    const src = scanSourceToggles(source());
    expect(src.total).toBe(TOTAL + TOTAL / 10 + TOTAL / 10); // 40 questions + 4 nested + 4 plain notes
    expect(src.foldable).toBe(TOTAL + TOTAL / 10); // the plain `> [!note]` has no fold arrow
  });

  test("the OLD behaviour (no full render) flips only the rendered screenful — the reported bug", () => {
    render(12);
    const els = foldableToggleEls(note);
    for (const el of els) setToggleOpen(el, true);
    expect(els.length).toBe(13); // 12 questions + the nested one under Q10
    expect(note.querySelectorAll(".callout.is-collapsed").length).toBe(0);
    // …but the other 27 questions were never rendered, so they are still closed in the note.
    const r = { changed: 13, rendered: 13, total: scanSourceToggles(source()).foldable };
    expect(answersNotice(true, r)).toBe("Opened 13 answers — 31 more not rendered yet; scroll down and tap again.");
  });

  test("NEW: forces the full render, waits for the DOM, then opens every foldable toggle", async () => {
    render(12);
    const view = { previewMode: { renderer: { showAll: false, rerender: (_full?: boolean) => { /* async in Obsidian */ } } } };
    const clock = fakeClock();
    const done = setAllAnswersOpen(true, note, view, source(), clock);
    // Obsidian's rerender lands a few frames later
    clock.setTimeout(() => render(TOTAL), 120);
    await clock.run(3000);
    const { result, notice, important } = await done;
    expect(view.previewMode.renderer.showAll).toBe(true);
    expect(result).toEqual({ changed: TOTAL + TOTAL / 10, rendered: TOTAL + TOTAL / 10, total: TOTAL + TOTAL / 10 });
    expect(notice).toBe("Opened 44 answers.");
    expect(important).toBe(false);
    expect(note.querySelectorAll(".callout.is-collapsible.is-collapsed").length).toBe(0);
    // the plain note callout was left untouched (it has no fold state at all)
    expect(document.getElementById("q10-plain")!.classList.contains("is-collapsed")).toBe(false);
  });

  test("Close all after Open all folds every foldable toggle again", async () => {
    render(TOTAL);
    const view = { previewMode: { renderer: { showAll: true, rerender: (_full?: boolean) => {} } } };
    const clock = fakeClock();
    await setAllAnswersOpen(true, note, view, source(), clock);
    const closed = await setAllAnswersOpen(false, note, view, source(), clock);
    expect(closed.notice).toBe("Closed 44 answers.");
    expect(note.querySelectorAll(".callout.is-collapsible:not(.is-collapsed)").length).toBe(0);
    const again = await setAllAnswersOpen(false, note, view, source(), clock);
    expect(again.notice).toBe("All 44 answers already closed.");
    expect(again.important).toBe(false);
  });

  test("when the render never completes it still acts on what is there and says N of M", async () => {
    render(12);
    const view = { previewMode: { renderer: { showAll: false, rerender: (_full?: boolean) => {} } } };
    const clock = fakeClock();
    const done = setAllAnswersOpen(true, note, view, source(), clock);
    await clock.run(4000); // past the 2.5 s wait
    const { result, notice, important } = await done;
    expect(result.rendered).toBe(13);
    expect(notice).toBe("Opened 13 answers — 31 more not rendered yet; scroll down and tap again.");
    expect(important).toBe(true); // shown even in quiet mode
  });
});
