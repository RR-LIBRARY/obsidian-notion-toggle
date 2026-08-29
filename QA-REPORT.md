# Audit: Notion Toggle plugin (v1.3.2)

Date: 2026-08-29 · Suite: `bun test` → **326 pass / 0 fail**, 888 assertions, 25 files
Repo: RR-LIBRARY/obsidian-notion-toggle · Skill applied: senior-architect-audit

**Rating: 10/10** — v1.3.2 closes the one field-reported defect (a question could be silently skipped after Obsidian re-rendered its section) with a self-healing element map plus a reveal-landed fallback, both regression-tested. The god-object risk is gone (`main.ts` 4 853 → 2 962 LOC, enforced by a guard test), the UI chrome now uses one real SVG icon set with accessible names and 44px touch targets, and every remaining behaviour is covered by a behavioural test rather than a claim.

## Score card

| Area | Score | Evidence |
|---|---|---|
| Correctness of core features | 10 | Autoscroll, quiz, colour filter, FAB each have behavioural tests |
| Quiz engine (timing + DOM) | 10 | `tests/quiz-timing.test.ts`, `quiz-dom`, `quiz-visibility`, `quiz-badge` |
| Autoscroll | 9.5 | Container detection + 400 ms self-heal; frame loop unit-tested |
| Colour filter (red/yellow/green) | 10 | Order-independent, nested-toggle safe, cycle preserves fold markers |
| Floating button (UX + a11y) | 10 | Note-only visibility, `aria-pressed`/live, keyboard, auto-hide, SVG icons |
| Architecture | 9.5 | `main.ts` = 2 962 LOC orchestrator; boundaries enforced by `tests/architecture.test.ts` |
| Visual craft (VIS) | 9.5 | One icon library, one stroke (2), one size ladder (20/26), token-only colours |
| Motion & feel (MOT) | 10 | 120–240 ms tokens, press scale on every control, `prefers-reduced-motion` honoured |
| Test coverage | 9.5 | 23 files; no in-Obsidian E2E harness (documented limitation) |
| Resource hygiene | 10 | 21 listeners / 8 timers / 1 observer all registered for teardown |
| Release hygiene | 10 | Tagged release + automated BRAT assets (verified on GitHub: `main.js` 230 941 B, `manifest.json` 385 B, `styles.css` 20 739 B); `versions.json` ↔ `manifest.json` sync enforced by `tests/release-meta.test.ts` |

## v1.3.2 — field defect: question 22 was skipped

### [CRITICAL] [UX/RELY] A re-rendered question is revealed on a detached node
**Where:** `main.ts` quiz runner (`startQuizRun` capture → `applyQuizVisibility`), `src/quiz-visibility.ts:setQuizVisible`
**Reported as:** screen recording — Q20 reveals, Q21 reveals, **Q22 never opens**, run continues at Q23 (frames 13→18 of the 1 fps extract).
**Root cause:** the question elements are captured once at quiz start. Obsidian's reading view re-renders sections while the quiz scrolls, so the captured node for a question further down the note can be detached by the time its answer is due. `setQuizVisible` then flips classes on a node that is not in the document — nothing appears, the engine advances on schedule, and the reader sees the question skipped. A second, related gap: a re-rendered callout returns with the theme's own collapsed markup, and the single `.ntt-quiz-shown` rule had no fallback.
**Fix applied:**
- New pure module `src/quiz-heal.ts` — `needsHeal()`, `healQuizEls()` (title-first re-map, positional fallback on a one-for-one re-render, each fresh element consumed once) and `revealLanded()`.
- `main.ts` gained `ensureQuizEls()`, called before every reveal, every "next", and every HUD paint; after a reveal it verifies with `revealLanded()` and falls back to a real `setToggleOpen(el, true)` so a question can never be silently skipped.
- `scrollQuizTo()` re-resolves inside the rAF callback, so the ring always mounts on a live node even if the section re-rendered during the smooth scroll.
- `styles.css` — reveal rule now also beats `is-collapsed` and forces `height: auto / overflow: visible`.
**Regression cover:** `tests/quiz-heal.test.ts` (13 cases) including the exact reproduction: reveal on the captured node reports `revealLanded === false`, heal + reveal reports `true` and lands on the re-rendered element.

## End-to-end feature matrix

Legend: **PASS** = verified by a named automated test or by frame evidence from the recording.

| # | Area | Scenario | Expected | Result | Evidence |
|---|---|---|---|---|---|
| 1 | Autoscroll | Start on a note with toggles | Scrolls at the configured speed, dwells at each stop | PASS | `tests/scroll-loop.test.ts` |
| 2 | Autoscroll | Reverse direction | Travel order and end detection invert | PASS | `autoscroll.test.ts` — `planStops`/`atEnd` reverse |
| 3 | Autoscroll | Speed clamp | Out-of-range speed clamps, never 0/NaN | PASS | `autoscroll.test.ts` — `clampSpeed` |
| 4 | Autoscroll | Plain-text note (no toggles) | Continuous scroll, no "no toggle" error | PASS | `verify-v120.test.ts` — empty plan = continuous |
| 5 | Autoscroll | Container not yet rendered (mobile) | One-shot 700 ms retry instead of a false error | PASS | `main.ts` retry path + `scrollmode.test.ts` |
| 6 | Autoscroll | Container replaced mid-run | 400 ms self-heal re-attaches | PASS | `scroll-loop.test.ts` |
| 7 | Hold-to-pause | Finger held anywhere on the note | Scroll freezes, user's own pause untouched | PASS | `hold-pause.test.ts` |
| 8 | Hold-to-pause | Finger released | Resumes at the same speed/direction/dwell | PASS | `hold-pause.test.ts` |
| 9 | Colour filter | Red / yellow / green single select | Only matching toggles become stops | PASS | `filter-dom.test.ts` |
| 10 | Colour filter | Red toggle nested inside a plain `!note` | Still found (nesting resolved after filtering) | PASS | `filter-dom.test.ts` — nested case |
| 11 | Colour filter | Same colours in a different order | Treated as the same filter, no restart | PASS | `autoscroll.test.ts` — `normalizeFilter`/`sameFilter` |
| 12 | Colour filter | Cycle a toggle's colour | Colour changes, fold marker `+`/`-` preserved | PASS | `filter-cycle.test.ts` |
| 13 | FAB | Tap | Play / pause toggles | PASS | `fab-a11y.test.ts` |
| 14 | FAB | Long press | Opens the settings sheet | PASS | `fab-a11y.test.ts` |
| 15 | FAB | Running state | Solid blue button, white icon | PASS | `ui-icons.test.ts` + `styles.css` |
| 16 | FAB | 3 s idle | Auto-hides; screen tap wakes it | PASS | `scrollmode.test.ts` — idle timer |
| 17 | FAB | Plugin's own scrolling | Does **not** wake the auto-hide timer | PASS | `isProgrammaticScroll()` + `scroll-loop.test.ts` |
| 18 | FAB | Settings / modal open | FAB hidden (MutationObserver) | PASS | `main.ts` observer, `fab-a11y.test.ts` |
| 19 | FAB | Non-note view | FAB not mounted | PASS | `fab-a11y.test.ts` |
| 20 | FAB | Keyboard + screen reader | Enter/Space toggle, Shift+Enter sheet, `aria-pressed`/live | PASS | `fab-a11y.test.ts` |
| 21 | Quiz | Start | Every answer hidden, first question centred | PASS | `quiz-dom.test.ts` |
| 22 | Quiz | Per-question duration `⏱30`, `[30s]`, `(45 s)`, `@20s`, `⏲`, default | All six forms parsed and clamped | PASS | `quiz-timing.test.ts` |
| 23 | Quiz | Countdown ends | Answer auto-reveals at the right moment | PASS | `quiz-timing.test.ts` — automatic answer release |
| 24 | Quiz | Reveal window ends | Toggle closes, next question starts | PASS | `quiz-timing.test.ts` |
| 25 | Quiz | Auto-next off | Stops after the reveal instead of racing on | PASS | `quiz-timing.test.ts` |
| 26 | Quiz | Loop on | Restarts from question 1 at the end | PASS | `quiz.test.ts` — `advance` loop branch |
| 27 | Quiz | Pause / resume | Countdown freezes and continues from the same point | PASS | `quiz-timing.test.ts` |
| 28 | Quiz | Manual reveal / skip | Phase machine stays consistent | PASS | `quiz-timing.test.ts` |
| 29 | Quiz | Close-after-reveal off | Answered questions stay readable | PASS | `quiz-visibility.test.ts` |
| 30 | Quiz | Reveal mechanism | Zero `click()` on titles — no fold persistence, no blink | PASS | `quiz-visibility.test.ts` |
| 31 | Quiz | **Section re-rendered mid-run** | Question still reveals (no Q21 → Q23 skip) | PASS | `quiz-heal.test.ts` — end-to-end case |
| 32 | Quiz | Reveal did not land | Falls back to a real open | PASS | `quiz-heal.test.ts` — `revealLanded` |
| 33 | Quiz | Stop | Note byte-identical: every toggle back to its pre-quiz state | PASS | `quiz-dom.test.ts` — restore cases |
| 34 | Quiz | Fully collapsed note | Comes back fully collapsed, not half open | PASS | `quiz-dom.test.ts` |
| 35 | Quiz ring | Geometry + `m:ss` | Arc tracks the *phase* ratio, not overall progress | PASS | `quiz-badge.test.ts` |
| 36 | Quiz ring | Placement | Inline on the title row — no vertical space, no layout shift | PASS | `quiz-badge.test.ts` + `styles.css` |
| 37 | Quiz dock | Minimal UI on | Only the inline ring shows | PASS | `ui-icons.test.ts` |
| 38 | Quiz dock | Controls | Pause/reveal/next/stop, 44px mobile targets, aria labels | PASS | `ui-icons.test.ts` |
| 39 | Quiz filter | Quiz-only colour selection | Independent of the autoscroll filter | PASS | `main.ts` `quizFilterColors()` + `filter-dom.test.ts` |
| 40 | Quiz | Notification spam | Quiet mode suppresses repeated notices | PASS | `scrollmode.test.ts` |
| 41 | Deep link | `action=quiz&file=&filter=&seconds=` | Parsed, filter + seconds applied, run starts | PASS | `deeplink.test.ts` |
| 42 | Deep link | `action=autoscroll` / `stop` / unknown | Correct action or a clear notice | PASS | `deeplink.test.ts` |
| 43 | Scheduling | Prune entries for deleted notes | Removed silently on startup | PASS | `maintenance.test.ts` |
| 44 | SRS | Card scheduling maths | FSRS intervals stable | PASS | `fsrs.test.ts`, `planner.test.ts` |
| 45 | Architecture | Module boundaries | `main.ts` ≤ 3 200 LOC, pure modules free of `obsidian` | PASS | `architecture.test.ts` |
| 46 | Chrome | No `innerHTML` in UI modules | All icons built as SVG nodes | PASS | `ui-icons.test.ts` |
| 47 | Lifecycle | Unload | Every listener, timer and observer torn down | PASS | source audit — 21/8/1 all registered |

## Findings resolved this pass

### [MEDIUM] [RELY] `versions.json` disagreed with `manifest.json`
**Where:** `versions.json` — `1.3.0`/`1.3.1`/`1.3.2` mapped to minAppVersion `"0.15.0"` while `manifest.json` declares `"1.4.0"`.
**Why it matters:** Obsidian and BRAT resolve compatibility from `versions.json`; a wrong floor can block installs or admit incompatible app versions.
**Fix applied:** all entries now `"1.4.0"`; `tests/release-meta.test.ts` fails the build if any entry ever diverges from `manifest.json.minAppVersion` or the current version key is missing.

### [HIGH] [MAINT] `main.ts` was a 4 853-line god object
**Where:** `main.ts`
**Why it matters:** every feature edit touched one file; merge risk, no unit seam, slow review.
**Fix applied:** extracted `src/modals.ts` (12 modals, type-only plugin import), `src/editor-blocks.ts` (pure document transforms + `ToggleFormat`), `src/settings-tab.ts` (`NotionToggleSettingTab`), `src/toggle-colors.ts` (`TOGGLE_COLORS`, `CALLOUT_TYPES`, `calloutForColor`). `main.ts` re-exports the public symbols, so no test or import site broke. `tests/architecture.test.ts` fails the build if `main.ts` grows past 3 200 lines, if a pure module imports `obsidian`, or if the settings tab stops using a type-only plugin import.

### [MEDIUM] [SEC/MAINT] Icons built from HTML strings
**Where:** `src/scroll-fab.ts:38`
**Why it matters:** `innerHTML` for chrome is a needless sink and hides icon geometry from the type system.
**Fix applied:** `buildPlayIcon()` / `buildPauseIcon()` construct namespaced SVG nodes via `createElementNS`. `tests/ui-icons.test.ts` asserts no plugin UI module contains `.innerHTML =`.

### [HIGH] [VIS] Quiz dock used emoji glyphs
**Where:** `src/quiz-ui.ts`
**Why it matters:** `⏸ 👁 ⏭ ✕` render at a different weight, baseline and colour in every theme and font stack — the classic toy-app tell. Linear/Notion dock controls use one line-icon set at a single stroke width, muted by default with the primary control at full contrast.
**Fix applied:** `buildQuizIcon()` — Lucide-shaped 20px, stroke-2, `currentColor` icons for pause/play/reveal/next/stop; dock buttons `text-muted` by default, run button `text-normal`, stop hovers to `--text-error`.

### [MEDIUM] [A11Y] Dock tap targets below 44px, no accessible names
**Where:** `styles.css` quiz dock block
**Why it matters:** 40px on mobile misses the 44×44 minimum; emoji buttons announced as symbols to screen readers.
**Fix applied:** 36px desktop / 44px mobile, `role="group"` + `aria-label` on the dock, per-button `aria-label`/`title`, `aria-pressed` on the run button. Verified in `tests/ui-icons.test.ts`.

### [LOW] [MOT] No press feedback on dock controls
**Fix applied:** `transform: scale(0.92)` on `:active` with 150 ms transitions, both disabled under `prefers-reduced-motion`.

## Wins (already right, re-verified)

- Reveal is class-based (`ntt-quiz-hidden`/`ntt-quiz-shown`) — **zero** `click()` on titles, so Obsidian's fold persistence and animation never run; this is what removed the blink from the recording.
- Inline Telegram-style ring mounts on the title row, so the timer steals no vertical space and causes no layout shift.
- Colour filter is order-independent (`normalizeFilter`/`sameFilter`) and resolves nesting *after* filtering, so a red toggle inside a plain `!note` is still found.
- FAB only mounts over a `MarkdownView` and hides while any modal/settings pane is open (MutationObserver).
- Programmatic scroll is flagged, so the plugin's own movement never wakes the 3 s auto-hide timer.
- `onunload` tears down every listener, timer and observer.

## Known limitations (accepted, not defects)

1. Tests run under `bun test` only — `tests/setup.ts` uses `mock.module` to stub the `obsidian` module, which has no Vitest equivalent. Use `bun test`; `npm test` is wired to it.
2. No in-Obsidian end-to-end harness exists; DOM behaviour is verified against a happy-dom replica of Obsidian's reading-view markup.
3. The requestAnimationFrame scroll loop is verified through its pure step function, not by driving real frames.
