# Autoscroll audit — 1.7.3

Date: 2026-09-25

## The report

On a phone, with autoscroll on, a blank strip sits at the top of the note for
the whole run — right under the real status bar, one status bar tall. It never
goes away until the run stops. Request: deep-test the whole feature for real
and audit it; no status-bar strip while autoscroll is on.

## Root cause (confirmed in code)

1. Obsidian mobile pads the *body* by the real status-bar inset
   (`body.is-mobile { padding: var(--safe-area-inset-top) 0 0 0 }`, from
   Obsidian's own `app.css`). The focus run hides the view header *inside*
   that body; it never removes the body padding, so the note is already kept
   clear of the status bar during a run.
2. The plugin's distraction-free mode (1.6.0 → 1.7.2) added
   `padding-top: var(--ntt-focus-top-gap)` on `.view-content` as well. On a
   phone that is the same inset counted a second time — a band exactly one
   status bar tall, with nothing in it, directly under the real status bar.
   1.7.1 fixed the *doubling* of the plugin's own gap (two nested elements)
   and the fixed 24 px floor, but kept one plugin gap on top of Obsidian's.
3. A second, quieter clash found while testing the whole feature: 1.7.2 made
   *Open all / Close all* sticky per note and re-applied it to every answer
   rendered later. An autoscroll run closes answers behind the reader and
   inserts think badges / screen markers into the DOM; each insert woke the
   watcher, which re-opened the answer the run had just closed. A quiz had the
   same exposure.

## Fix

| Layer | What changed | Where |
|---|---|---|
| No plugin top gap | `--ntt-focus-top-gap` and the `.view-content` top-padding rule removed; only `--ntt-focus-bottom-gap` on `.markdown-preview-view` remains (the scroller must clear the gesture bar once the navbar is gone) | `styles.css` |
| Run owns the toggles | `startAutoScroll` and the paused → resume branch call `clearAnswerWant()`; `answerWantCanStick()` is false while `scrollRunning` or a quiz is active, so `applyWantedAnswers()` (post processor + mutation watcher) is a no-op during a run | `main.ts` |
| One-shot during a run / quiz | `setAllAnswersOpen` remembers the command only when it can stick; otherwise it forgets any previous one and applies once | `main.ts` |
| Quiz path | `answerApplyIo()` routes a quiz-time Open all through `setQuizVisible` (visibility classes), leaving the fold arrow to the quiz | `src/answer-state.ts` |

Sticky behaviour outside a run is unchanged from 1.7.2: switch note, tap a
single fold arrow, or start/stop a quiz to clear it; newly rendered answers
are still born in the remembered state.

## Real-plugin tests (`tests/autoscroll-focus-run.test.ts`)

A real `NotionTogglePlugin` instance in happy-dom, under the same Obsidian
stubs as the rest of the suite, with a rendered note of foldable callouts.

| # | Scenario | Expectation | Result |
|---|---|---|---|
| 1 | Start a run, then stop it | `body.ntt-focus-run` / think class added on start, all removed on stop | pass |
| 2 | Focus chrome setting off, reduced motion on | no focus class; reduced-motion class present | pass |
| 3 | Open all, then start a run | remembered state is cleared at run start | pass |
| 4 | Run closes an answer, then a think badge is inserted | mutation watcher does **not** reopen it | pass |
| 5 | Open all while a run is active | all rendered answers open once; nothing remembered; notice honours quiet mode | pass |
| 6 | Pause, Open all, resume | resume clears the command set while paused | pass |
| 7 | Open all during a quiz | quiz visibility classes updated, fold arrows untouched, nothing remembered | pass |
| 8 | Open all outside a run, then a new answer renders | new answer is born open (1.7.2 behaviour intact) | pass |

## Stylesheet guards

- `tests/styles.test.ts`: every `ntt-focus-run` rule (comments stripped) has
  no `padding-top`, `margin-top`, shorthand `padding` or
  `safe-area-inset-top`; `--ntt-focus-top-gap` no longer exists; the bottom
  gap on `.markdown-preview-view` is still there. The debug overlay's own
  `top: calc(env(safe-area-inset-top) + 8px)` (a fixed-position panel, not the
  note) is deliberately outside the guard.
- `tests/architecture.test.ts`: `main.ts` / `styles.css` keep the bottom token
  and never reintroduce the top one.

## Verification

| Check | Result |
|---|---|
| `bun test` | 1101 pass, 0 fail, 70 files |
| `bun run typecheck` | clean |
| `bun run build` | `main.js` built, `dist/` written |
| `main.ts` size budget | 3493 lines (< 3500) |
| Pure-module rule | `src/answer-state.ts` still imports nothing from Obsidian |
| GitHub | `main.js`, `manifest.json`, `styles.css` byte-match the release assets |

## Residual risk

- Physical-device endurance (Android/iOS, 500+ toggles, rotation mid-run)
  remains a manual pass, as in 1.7.1 / 1.7.2.
- A community theme that *also* hides Obsidian's body padding during a run
  would now put the first line under the status bar; the documented override
  (`body.ntt-focus-run.is-mobile { padding-top: … }` in a snippet) covers it.
