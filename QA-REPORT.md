# Notion Toggle — QA report (v1.2.0)

Scope: single floating button + deep verification of autoscroll, toggle types,
quiz timing and the auto open/close behaviour.

## Automated checks

| Check | Result |
| --- | --- |
| Unit tests (`bun test`) | **226 pass / 0 fail**, 12 files, 565 assertions |
| Typecheck | clean |
| Production bundle | `main.js` 202.3 kb, builds clean, `dist/` emitted |
| Versions | `manifest.json` / `package.json` / `versions.json` all `1.2.0` |

## 1. Floating UI

| Item | Result |
| --- | --- |
| Exactly one floating button on screen | PASS — the `↓` direction chip is removed; only the round ▶/⏸ button remains |
| Tap = start / pause | PASS |
| Long-press (500 ms) = the sheet with every other control | PASS — Autoscroll, Quiz, **Direction**, Speed, Dwell, Pause-at all live there |
| Direction still reachable | PASS — new "Direction" row in the sheet, plus the existing `Ctrl/Cmd+Shift+R` command |
| Auto-hide after 3 s while running, wake on tap/scroll, pinned when paused | PASS |
| Hold anywhere to freeze, release to resume at the same speed | PASS (3 unit tests on the hold logic) |

## 2. Toggle type coverage

| Item | Result |
| --- | --- |
| `> [!note]-`, `> [!question]-`, `> [!info]-`, `!tip`, `!warning`, `!quote`, custom types | PASS — detection is type-agnostic (`.callout, details, [data-callout]`) |
| Raw `<details>` blocks | PASS |
| Nested toggles counted once (outermost wins) | PASS |
| Colour filter keys only off `recall-red/yellow/green`, never the callout type | PASS |
| Reverse visits the same stops in opposite order | PASS |

## 3. Plain-text notes — **bug found and fixed**

Before: a note with no toggles refused to start ("Is note me koi toggle nahi
mila") — autoscroll simply did not run.
Now: the run starts as a **plain continuous scroll** (no stops, no dwell) with
an informational notice. The "no toggles match" error is now only shown when
toggles genuinely exist but the filter or pause-at mode excludes all of them.

## 4. Quiz mode

| Item | Result |
| --- | --- |
| Answer auto-releases after the question duration | PASS — fires exactly on time, not a tick early |
| Per-question overrides (`⏱30`, `[5s]`, `(45s)`, `@20s`) | PASS |
| Timer resets to the *next* question's own duration | PASS |
| Pause freezes the countdown; resume continues from the same point | PASS |
| Manual reveal / skip keep the phase machine consistent (double reveal is a no-op) | PASS |
| `Auto next = off` stops after the reveal instead of racing on | PASS |
| Loop mode restarts from question 1 | PASS |
| Toggles collapse at the start (active recall) and open at reveal | PASS |
| Late render on mobile | PASS — 700 ms one-shot re-scan before reporting "no toggles" |
| Quiz reachable without the toolbar | PASS — sheet row + `list-checks` toolbar command |

## 5. Auto open / close — **bug found and fixed**

Before: a quiz collapsed every toggle and, on stop, left them collapsed — the
note was unreadable afterwards and the reader had to reopen each one.
Now: the open/closed state of every toggle is recorded before the quiz starts
and **restored exactly** when the quiz stops, so the document reads normally
again. Autoscroll's own `scrollAutoClose` behaviour is unchanged.

## 6. Lifecycle

`onunload()` clears the recall timer, stops autoscroll (cancelling the rAF),
stops the quiz (clearing its interval), destroys the FAB (its own timers and
document listeners) and detaches hold-to-pause. No leaks with the new
single-button FAB.

## Findings summary

- **Critical:** none.
- **Fixed in 1.2.0:** plain-text notes could not autoscroll; quiz left the note
  fully collapsed after stopping; the second floating chip is gone.
- **Note:** the classic control bar stays off by default — Settings → "Classic
  control bar" restores the old scrubber if you want it back.

## v1.2.1 — autoscroll fix, new FAB, quiet notices

| Area | Result |
| --- | --- |
| Autoscroll actually moves the page | FIXED — `findScrollContainer()` now picks an element that can really scroll (`scrollHeight - clientHeight > 2`). Reading mode was returning `previewMode.containerEl`, a wrapper, so `scrollTop` writes were no-ops. |
| Self-healing container | The frame loop re-resolves the scroller after 400 ms if the current one cannot scroll (lazy render / view swap). |
| Floating button UI | Single circular halo button with an orange rounded-square SVG icon (▶ / ⏸), matching the screenshot. |
| Auto-hide | Fades 3 s after the last real user activity; the plugin's own programmatic scrolling no longer keeps it awake; pinned while paused or while the sheet is open. |
| Popup spam | New "Quiet mode" (default ON, in Settings and in the sheet): status notices (session label, plain-scroll, direction, filter, stop, finish) are suppressed. Errors still show. |
| Pause-at modes | every / odd / even / custom / route / shuffle + A4 tall-page chunking covered by `tests/scrollmode.test.ts` and `tests/planner.test.ts`. |
| Toggle types | `!note`, `!question`, `!info`, custom types, raw `<details>`, nested outermost-only — `tests/verify-v120.test.ts`. |
| Quiz timing | Per-question duration, `⏱30` override, auto-next, pause/resume, skip, post-quiz toggle restore — `tests/verify-v120.test.ts`. |
| New regression test | `tests/scroll-loop.test.ts` proves frames advance `scrollTop` and that a non-scrollable wrapper is skipped. |
| Suite | 231 tests pass, typecheck clean, bundle 207 kb. |

## v1.2.3 — deep verification: quiz timing + automatic toggle open/close

Toggle DOM handling was extracted from `main.ts` into `src/toggle-dom.ts`
(`collectToggleEls`, `isToggleOpen`, `setToggleOpen`, `toggleTitleOf`,
`applyQuizVisibility`, `restoreToggles`). `main.ts` now calls those helpers, so
the tests below exercise the *production* code path instead of a copy.

### Engine timing — `tests/quiz-timing.test.ts`

| Check | Result |
| --- | --- |
| Per-question markers `⏱30`, `⏱ 45s`, `⏲25`, `[30s]`, `(45 s)`, `@20s` | PASS |
| Fallback to the setting, clamp 3 s … 600 s, NaN → default | PASS |
| Question ends exactly on its own duration → `reveal` | PASS |
| Reveal ends on `quizRevealSeconds` → `next`, timer resets to the next question's own time | PASS |
| Last question → `done`, `answered` counted, loop stopped | PASS |
| `quizAutoNext = false` halts after the reveal; manual next resumes | PASS |
| `quizLoop = true` wraps back to Q1 with the correct duration | PASS |
| Pause freezes the countdown; resume continues from the same value | PASS |
| `reveal now` / `skip` mid-phase | PASS |

Driven in 250 ms frames — the same interval as the live loop — so the timings
match what runs on the device.

### Automatic open / close — `tests/quiz-dom.test.ts` (happy-dom)

Fixture note: `!note` (collapsed), `!question` (open, with a nested `!info`),
`<details>`, `<details open>`, plus plain paragraphs.

| Check | Result |
| --- | --- |
| Discovery finds all four toggles, skips the nested one and plain text | PASS |
| Callout type / `<details>` reported for the colour filter | PASS |
| Titles readable for the per-question duration marker | PASS |
| Initial open state read correctly for callouts *and* `<details>` | PASS |
| Open/close idempotent on both flavours | PASS |
| Quiz start collapses everything (active recall) | PASS |
| Question phase keeps the answer hidden; reveal opens **only** the current toggle | PASS |
| Moving on closes the previous toggle automatically | PASS |
| `quizCloseAfterReveal = false` keeps revealed answers open | PASS |
| Quiz stop restores every toggle to its exact pre-quiz state — document stays readable | PASS |
| Shorter/stale saved-state array does not crash the restore | PASS |

### Fix included

`setToggleOpen()` for callouts relied purely on Obsidian's title click handler.
If a theme or a re-render swallowed that click, the toggle silently stayed in
the wrong state. It now verifies the result and syncs `is-collapsed` itself.

**Suite: 249 tests pass**, build clean (207 kb).

## v1.2.4 — FAB colour, dark mode, a11y, note-only visibility + hardcoded-parameter audit

**Tests:** 259 pass / 0 fail (new `tests/fab-a11y.test.ts`, extended `tests/guide.test.ts`).

### Changes verified
| Area | Behaviour | Evidence |
|---|---|---|
| Running colour | Running = solid blue circle (`--interactive-accent`) with white icon; idle = white circle, dark chevrons | `fab-a11y.test.ts` "running state uses the solid blue circle class" + `.ntt-fab.is-running` in styles.css |
| Dark mode | `.theme-dark .ntt-fab` uses `--background-secondary-alt` + `--text-normal`, stronger shadow; running keeps `--text-on-accent`; `prefers-contrast: more` bumps the border | styles.css |
| A11y | `type=button`, `aria-label`, `aria-pressed`, `title`, `aria-keyshortcuts`, sr-only `aria-live="polite"` state text, `:focus-visible` ring (inverted while running), Enter/Space = tap, Shift+Enter = sheet, focus wakes the button | `fab-a11y.test.ts` (5 cases) |
| Note-only floating | FAB only renders when a **MarkdownView** is active and no modal/settings overlay is open; MutationObserver + `layout-change` re-evaluate | `fabShouldShow` (5 new cases) + `syncScrollFab()` |

### Hardcoded parameter audit (top → bottom)
| Value | Where | Rating | Note |
|---|---|---|---|
| `FAB_AUTO_HIDE_MS = 3000` | src/scroll-fab.ts | OK (overridable via `hideAfterMs`) | not user-facing yet — candidate setting |
| `FAB_LONG_PRESS_MS = 500` | src/scroll-fab.ts | OK | matches platform long-press |
| `FAB_MOVE_TOLERANCE_PX = 12` | src/scroll-fab.ts | OK | prevents scroll/long-press conflicts |
| `FAB_PROGRAMMATIC_WINDOW_MS = 150` | src/scroll-fab.ts | OK | > one frame at 60fps, < human tap cadence |
| `HOLD_PAUSE_MS = 250`, `HOLD_MOVE_TOLERANCE_PX = 12` | src/hold-pause.ts | OK | hold-to-pause feels immediate |
| `BASE_SPEED = 60`, `MAX_SPEED_MULTIPLIER = 20` | src/scrollmode.ts | OK | derived from settings, clamped |
| `SPEED_MAX = 1200`, `SPEED_STEP = 20` | src/autoscroll.ts | OK | slider bounds |
| `QUIZ_SECONDS_MAX = 600` (min 3s) | src/quiz.ts | OK | clamp for parsed `⏱30` markers |
| 400 ms scroll-container re-resolve | main.ts scroll loop | OK | self-healing, cheap |
| 700 ms render retry | main.ts start/quiz | OK | mobile render delay |
| `timerX = 24`, `timerY = 120` | main.ts settings reset | OK | reset-to-default only |
| FAB size 64 / 68 px, bottom 96 px | styles.css | Minor | fine on phones; could become CSS vars |
| Notice durations (6000 ms) | main.ts | Minor | consistent but not configurable |

**Verdict:** no blocking hardcoded values; every timing constant is exported and unit-tested, the two "minor" rows are cosmetic-only.
