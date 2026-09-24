/**
 * v1.7.2 — the reported bug, reproduced: a 71-answer note where the phone has
 * only 12 answers on the page. "Open all" must end with all 71 open, whether
 * they exist now, get built by the sweep, or appear later when the reader
 * scrolls. These tests cover the pure rules behind that.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, test } from "bun:test";
import {
  applyWanted,
  applyWantedToAll,
  createAnswerWantState,
  forgetAnswerWant,
  rememberAnswerWant,
  runAnswerSweep,
  answerApplyIo,
  sweepRender,
  wantedAnswerState,
  type ToggleIo,
} from "../src/answer-state";
import { isManualToggleClick, watchAnswerRenders } from "../src/answer-render-watch";

if (!(globalThis as { document?: unknown }).document) GlobalRegistrator.register();

type Fake = { open: boolean };
const io: ToggleIo = {
  isOpen: (el) => (el as unknown as Fake).open,
  setOpen: (el, open) => {
    (el as unknown as Fake).open = open;
  },
};
const toggle = (open: boolean) => ({ open }) as unknown as HTMLElement;

describe("v1.7.2 — sticky Open all / Close all", () => {
  test("remembers the command for one note and never leaks to another", () => {
    const state = createAnswerWantState();
    expect(wantedAnswerState(state, "a.md")).toBeNull();
    rememberAnswerWant(state, "a.md", "open");
    expect(wantedAnswerState(state, "a.md")).toBe("open");
    expect(wantedAnswerState(state, "b.md")).toBeNull();
    forgetAnswerWant(state);
    expect(wantedAnswerState(state, "a.md")).toBeNull();
  });

  test("applies the wanted state, counting only real changes", () => {
    const already = toggle(true);
    const shut = toggle(false);
    expect(applyWanted(already, "open", io)).toBe(false);
    expect(applyWanted(shut, "open", io)).toBe(true);
    expect((shut as unknown as Fake).open).toBe(true);
    const mixed = [toggle(true), toggle(false), toggle(false)];
    expect(applyWantedToAll(mixed, "closed", io)).toBe(1);
    expect(mixed.every((t) => !(t as unknown as Fake).open)).toBe(true);
  });

  test("answers rendered later are born in the remembered state", () => {
    const state = createAnswerWantState();
    rememberAnswerWant(state, "note.md", "open");
    const late = [toggle(false), toggle(false)];
    const want = wantedAnswerState(state, "note.md");
    expect(want).not.toBeNull();
    expect(applyWantedToAll(late, want!, io)).toBe(2);
  });
});

/** A scroller whose note only materialises the answers it has scrolled past. */
function lazyNote(total: number, rendered: number, perHop: number) {
  const els: HTMLElement[] = Array.from({ length: rendered }, () => toggle(false));
  const scroller = {
    scrollTop: 900,
    clientHeight: 800,
    get scrollHeight() {
      return 400 * total;
    },
  };
  return {
    scroller,
    els,
    grow() {
      for (let i = 0; i < perHop && els.length < total; i++) els.push(toggle(false));
    },
  };
}

describe("v1.7.2 — sweeping a lazily rendered note", () => {
  test("opens all 71 answers when only 12 were on the page, and comes home", async () => {
    const note = lazyNote(71, 12, 9);
    let clock = 0;
    const result = await runAnswerSweep({
      container: document.createElement("div"),
      scroller: note.scroller,
      foldableEls: () => note.els,
      sourceFoldable: 71,
      apply: () => applyWantedToAll(note.els, "open", io),
      frame: async () => {
        clock += 16;
        note.grow();
      },
      now: () => clock,
    });
    expect(result.rendered).toBe(71);
    expect(result.total).toBe(71);
    expect(result.changed).toBe(71);
    expect(note.els.every((el) => (el as unknown as Fake).open)).toBe(true);
    expect(note.scroller.scrollTop).toBe(900); // reader put back where they were
  });

  test("gives up politely on a note that never catches up, leaving nothing half done", async () => {
    const note = lazyNote(71, 12, 0); // renderer is stuck
    let clock = 0;
    const result = await runAnswerSweep({
      container: document.createElement("div"),
      scroller: note.scroller,
      foldableEls: () => note.els,
      sourceFoldable: 71,
      apply: () => applyWantedToAll(note.els, "open", io),
      frame: async () => {
        clock += 250;
      },
      now: () => clock,
    });
    expect(result.rendered).toBe(12);
    expect(clock).toBeLessThanOrEqual(4500); // the 4 s budget, not a freeze
    expect(note.scroller.scrollTop).toBe(900);
  });

  test("no scroller (short note) still flips what is there", async () => {
    const els = [toggle(false), toggle(false)];
    const result = await runAnswerSweep({
      container: document.createElement("div"),
      scroller: null,
      foldableEls: () => els,
      sourceFoldable: 2,
      apply: () => applyWantedToAll(els, "closed", io),
      frame: async () => {},
      now: () => 0,
    });
    expect(result).toEqual({ changed: 0, rendered: 2, total: 2 });
  });

  test("sweepRender stops at the end of the note instead of hopping forever", async () => {
    const scroller = { scrollTop: 0, clientHeight: 500, scrollHeight: 1500 };
    const { complete, hops } = await sweepRender({
      scroller,
      flush: () => {},
      done: () => false,
      frame: async () => {},
      now: () => 0,
    });
    expect(complete).toBe(false);
    expect(hops).toBeLessThan(10);
    expect(scroller.scrollTop).toBe(0);
  });
});

describe("v1.7.2 — watching Obsidian render the rest", () => {
  test("applies the remembered state once per burst of inserts", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    let applied = 0;
    let busy = false;
    const pending: Array<() => void> = [];
    const stop = watchAnswerRenders(host, {
      active: () => true,
      busy: () => busy,
      apply: () => applied++,
      schedule: (fn) => pending.push(fn),
    });
    host.appendChild(document.createElement("p"));
    host.appendChild(document.createElement("p"));
    await new Promise((r) => setTimeout(r, 10));
    expect(pending.length).toBe(1); // a burst is one apply, not one per node
    pending.forEach((fn) => fn());
    expect(applied).toBe(1);

    busy = true; // our own flips must not re-trigger the watcher
    host.appendChild(document.createElement("p"));
    await new Promise((r) => setTimeout(r, 10));
    expect(pending.length).toBe(1);
    stop();
    host.remove();
  });

  test("a tap on a fold arrow is the reader taking over", () => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="callout is-collapsible"><div class="callout-title"><span id="arrow">x</span></div></div><p id="text">body</p>`;
    expect(isManualToggleClick(wrap.querySelector("#arrow"))).toBe(true);
    expect(isManualToggleClick(wrap.querySelector("#text"))).toBe(false);
    expect(isManualToggleClick(null)).toBe(false);
  });
});

describe("v1.7.3 — the toggle IO for one apply", () => {
  const quizLog: Array<[string, boolean]> = [];
  const base = {
    isOpen: (el: HTMLElement) => (el as unknown as Fake).open,
    setOpen: (el: HTMLElement, open: boolean) => {
      (el as unknown as Fake).open = open;
    },
    setQuizVisible: (el: HTMLElement, open: boolean) => quizLog.push([(el as unknown as { id: string }).id, open]),
  };

  test("outside a quiz it reads and writes the real fold state, skipping toggles already right", () => {
    quizLog.length = 0;
    const els = [toggle(false), toggle(true), toggle(false)];
    expect(applyWantedToAll(els, "open", answerApplyIo("open", false, base))).toBe(2);
    expect(els.map((e) => (e as unknown as Fake).open)).toEqual([true, true, true]);
    expect(quizLog).toEqual([]);
  });

  test("during a quiz every toggle goes through the quiz's own show / hide, unconditionally", () => {
    quizLog.length = 0;
    const els = [{ id: "a", open: true }, { id: "b", open: false }] as unknown as HTMLElement[];
    expect(applyWantedToAll(els, "open", answerApplyIo("open", true, base))).toBe(2);
    expect(quizLog).toEqual([["a", true], ["b", true]]);
    expect(els.map((e) => (e as unknown as Fake).open)).toEqual([true, false]); // the fold arrow is untouched
    quizLog.length = 0;
    expect(applyWantedToAll(els, "closed", answerApplyIo("closed", true, base))).toBe(2);
    expect(quizLog).toEqual([["a", false], ["b", false]]);
  });
});
