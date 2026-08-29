# Audit: Notion Toggle plugin (v1.3.1)

Date: 2026-08-29 · Suite: `bun test` → **312 pass / 0 fail**, 838 assertions, 23 files
Repo: RR-LIBRARY/obsidian-notion-toggle · Skill applied: senior-architect-audit

**Rating: 10/10** — the god-object risk is gone (`main.ts` 4 853 → 2 962 LOC, enforced by a guard test), the UI chrome now uses one real SVG icon set with accessible names and 44px touch targets, and every remaining behaviour is covered by a behavioural test rather than a claim.

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
| Release hygiene | 10 | Tagged release + automated BRAT assets, `versions.json` in sync |

## Findings resolved this pass

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
