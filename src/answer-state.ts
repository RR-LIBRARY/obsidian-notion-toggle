/**
 * v1.7.2 — "Open all / Close all" that survives Obsidian's lazy Reading View.
 *
 * The reported bug: on a 71-answer note the phone only had ~12 answers on the
 * page, so the button flipped those twelve and the notice asked the reader to
 * "scroll down and tap again". Forcing `showAll` (see `full-render.ts`) fixes
 * desktop but not mobile, where the renderer stays lazy.
 *
 * Two pure pieces live here, so both rules are unit-tested without Obsidian:
 *
 *  1. **Sticky want state** — the last Open all / Close all command for a note
 *     is remembered. Whenever Obsidian renders a new section (post processor or
 *     DOM observer) the same state is applied to the answers that just
 *     appeared, so every answer ends up right whenever it is born.
 *  2. **`sweepRender`** — steps the scroller down the note in small hops so the
 *     renderer materialises the rest now, flipping each batch as it appears,
 *     then puts the reader back exactly where they were.
 *
 * No Obsidian import, no direct DOM globals: elements and the scroller are
 * injected structurally.
 */

export type AnswerWant = "open" | "closed";

/** The remembered command: which note, and what the reader asked for. */
export interface AnswerWantState {
  file: string | null;
  want: AnswerWant | null;
}

export function createAnswerWantState(): AnswerWantState {
  return { file: null, want: null };
}

/** Remember "the reader wants every answer in `file` open / closed". */
export function rememberAnswerWant(
  state: AnswerWantState,
  file: string | null | undefined,
  want: AnswerWant
): void {
  state.file = file ?? null;
  state.want = want;
}

/** Drop the command (note switch, a single manual toggle, quiz taking over). */
export function forgetAnswerWant(state: AnswerWantState): void {
  state.file = null;
  state.want = null;
}

/**
 * The state newly rendered answers of `file` should be given, or `null` when
 * no command is in force. A command recorded for another note never leaks.
 */
export function wantedAnswerState(
  state: AnswerWantState,
  file: string | null | undefined
): AnswerWant | null {
  if (!state.want) return null;
  const current = file ?? null;
  if (state.file !== current) return null;
  return state.want;
}

export interface ToggleIo {
  isOpen: (el: HTMLElement) => boolean;
  setOpen: (el: HTMLElement, open: boolean) => void;
}

/** Give one toggle the wanted state. Returns true when it actually changed. */
export function applyWanted(el: HTMLElement, want: AnswerWant, io: ToggleIo): boolean {
  const open = want === "open";
  if (io.isOpen(el) === open) return false;
  io.setOpen(el, open);
  return true;
}

/** Give every toggle the wanted state; returns how many changed. */
export function applyWantedToAll(
  els: readonly HTMLElement[],
  want: AnswerWant,
  io: ToggleIo
): number {
  let changed = 0;
  for (const el of els) if (applyWanted(el, want, io)) changed++;
  return changed;
}

export interface AnswerApplyIo extends ToggleIo {
  /** The quiz's own show / hide (its visibility classes, not the fold arrow). */
  setQuizVisible: (el: HTMLElement, open: boolean) => void;
}

/**
 * v1.7.3 — the toggle IO for one apply. Outside a quiz the real fold state is
 * read and written. During a quiz the quiz's visibility classes are re-applied
 * unconditionally (every toggle "changes"), so the run and the reader never
 * disagree about a revealed answer.
 */
export function answerApplyIo(want: AnswerWant, quiz: boolean, io: AnswerApplyIo): ToggleIo {
  if (!quiz) return { isOpen: io.isOpen, setOpen: io.setOpen };
  const open = want === "open";
  return { isOpen: () => !open, setOpen: (el, next) => io.setQuizVisible(el, next) };
}

export interface SweepScroller {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}

export interface SweepOptions {
  /** The element the note actually scrolls in. */
  scroller: SweepScroller;
  /** Flip whatever is rendered right now; called once per hop. */
  flush: () => void;
  /** Has the DOM caught up with the note source? */
  done: () => boolean;
  /** Wait for the renderer (a frame, a timeout — injected for tests). */
  frame: () => Promise<void>;
  now: () => number;
  /** Fraction of a viewport per hop. */
  stepRatio?: number;
  /** Give up after this long, so a huge note can never freeze the tap. */
  timeoutMs?: number;
  /** Safety net against a scroller whose height keeps growing. */
  maxHops?: number;
}

export interface SweepResult {
  /** Did the DOM reach the source count before we stopped? */
  complete: boolean;
  hops: number;
}

/**
 * Walk the note top-to-bottom in viewport-sized hops so the lazy renderer
 * builds the rest of it, flipping each freshly rendered batch, then restore
 * the reader's scroll position.
 */
export async function sweepRender(opts: SweepOptions): Promise<SweepResult> {
  const { scroller } = opts;
  const startedAt = opts.now();
  const timeout = Math.max(0, opts.timeoutMs ?? 4000);
  const maxHops = Math.max(1, opts.maxHops ?? 400);
  const viewport = Math.max(1, scroller.clientHeight || 1);
  const step = Math.max(1, Math.round(viewport * (opts.stepRatio ?? 0.8)));
  const home = scroller.scrollTop;
  let hops = 0;

  opts.flush();
  try {
    while (!opts.done() && hops < maxHops) {
      const bottom = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const next = Math.min(bottom, scroller.scrollTop + step);
      const atEnd = next <= scroller.scrollTop;
      scroller.scrollTop = next;
      hops++;
      await opts.frame();
      opts.flush();
      if (atEnd) break;
      if (opts.now() - startedAt >= timeout) break;
    }
  } finally {
    scroller.scrollTop = home;
  }
  return { complete: opts.done(), hops };
}

export interface AnswersCount {
  changed: number;
  rendered: number;
  total: number;
}

export interface AnswerSweepOptions {
  container: ParentNode;
  /** The scroller the note lives in, or `null` when nothing scrolls. */
  scroller: SweepScroller | null;
  foldableEls: (root: ParentNode) => HTMLElement[];
  /** How many foldable answers the note *source* declares. */
  sourceFoldable: number;
  /** Apply the remembered state inside `root`; returns how many changed. */
  apply: (root: ParentNode) => number;
  frame: () => Promise<void>;
  now: () => number;
}

/**
 * One "Open all / Close all" pass: flip what is rendered, and when the note is
 * still only partly built, sweep it into existence and flip the rest too.
 */
export async function runAnswerSweep(o: AnswerSweepOptions): Promise<AnswersCount> {
  const enough = () =>
    o.sourceFoldable > 0 && o.foldableEls(o.container).length >= o.sourceFoldable;
  let changed = o.apply(o.container);
  if (o.scroller && !enough()) {
    await sweepRender({
      scroller: o.scroller,
      flush: () => {
        changed += o.apply(o.container);
      },
      done: enough,
      frame: o.frame,
      now: o.now,
    });
  }
  return { changed, rendered: o.foldableEls(o.container).length, total: o.sourceFoldable };
}
