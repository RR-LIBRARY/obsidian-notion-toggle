# Open all / Close all audit — 1.7.2

Date: 2026-09-24

## The report

On a phone, a 71-answer note: tapping **Answers — open all** showed
*"Opened 12 answers — 59 more not rendered yet; scroll down and tap again."*
Scrolling down and tapping again was the only workaround, and answers that
appeared later came back closed.

## Root cause (confirmed in code)

1. Obsidian's Reading View builds a note a screenful at a time. Only ~12
   answers existed in the DOM when the command ran, so only those flipped.
2. The 1.7.1 fix (`showAll` + rerender + wait) is honoured on desktop, but the
   mobile renderer stays lazy, so the wait times out and the command acts on
   the same dozen.
3. Nothing remembered the command, so every answer rendered afterwards (when
   the reader scrolled) was created in its default state.
4. The "not rendered yet" count came from all callouts, including plain
   non-foldable `> [!note]` blocks, so the number could be wrong too.

## Fix — three layers

| Layer | What it does | Where |
|---|---|---|
| Sticky state | Remembers `open` / `closed` for the active note; newly rendered answers get that state | `src/answer-state.ts` |
| Render watch | Markdown post processor + `MutationObserver`, coalesced to one apply per frame; a manual fold-arrow tap hands control back | `src/answer-render-watch.ts`, `main.ts` onload |
| Background sweep | Steps the scroller down in ~0.8-viewport hops so the rest renders now, flips each batch, restores the reader's scroll position (4 s budget) | `sweepRender` / `runAnswerSweep` |

The state is cleared on note switch (`file-open`, `active-leaf-change`), on a
single manual toggle tap, and on quiz start/stop — the quiz keeps sole
ownership of answer visibility.

`src/source-toggles.ts` now counts *foldable* answers by marker (`-` / `+`
callouts and `<details>`), so plain callouts are never counted as missing.

## Notice wording

| Case | 1.7.1 | 1.7.2 |
|---|---|---|
| Complete | `Opened 71 answers.` | `Opened 71 of 71 answers.` |
| Partial | `Opened 12 answers — 59 more not rendered yet; scroll down and tap again.` | `Opened 12 of 71 answers — the rest will open as you scroll.` |

## Verification

| Check | Result |
|---|---|
| `bun test` | 1091 pass, 0 fail, 4394 assertions |
| `bun run typecheck` | clean (also fixed the pre-existing `src.foldable` TS2339) |
| `bun run build` | `main.js` built, `dist/` written |
| Lazy-note simulation (71 answers, 12 rendered) | all 71 opened, scroll position restored |
| Stuck renderer | stops inside the 4 s budget, honest partial notice |
| Quiz interaction | quiz visibility wins; sticky state cleared on start/stop |
| Nested toggles, note switch, other-note leak | covered by `tests/answer-state.test.ts` and `tests/open-close-all-dom.test.ts` |

## Residual risk

Physical-device endurance (Android/iOS, 500+ toggles) remains a manual pass, as
in 1.7.1. If the renderer is slower than the 4 s sweep budget, the remaining
answers still resolve as the reader scrolls — the command is no longer lost.
