# Notion Toggle — Holistic QA & Code Rating (v1.3.0)

Date: 2026-08-29 · Suite: `bun test` → **304 pass / 0 fail**, 784 assertions, 21 test files, 365 ms
Repo: RR-LIBRARY/obsidian-notion-toggle · main = `0a15a04` · release `1.3.0` published with BRAT assets `main.js`, `manifest.json`, `styles.css`.

---

## Overall: **8.6 / 10**

| Area | Score | Notes |
|---|---|---|
| Correctness of core features | 9.0 | Autoscroll, quiz, filter, FAB all covered by behavioural tests |
| Quiz engine (timing + DOM) | 9.0 | Phase timing, auto-next, loop, restore verified; ring is phase-driven |
| Autoscroll | 8.5 | Real container detection + self-heal; frame loop only unit-tested |
| Colour filter (red/yellow/green) | 9.0 | Order-independent, nested-toggle safe, cycle preserves fold markers |
| Floating button (UX + a11y) | 9.0 | Note-only visibility, aria-pressed/live, keyboard, auto-hide |
| Architecture | 6.5 | `main.ts` = 4 853 LOC; the one real structural risk |
| Test coverage | 8.5 | 21 files, logic well isolated; no end-to-end Obsidian harness |
| Performance | 8.5 | No per-frame `querySelectorAll`; stops measured once + re-measure |
| Resource hygiene | 9.0 | Observer/timers/listeners registered for teardown; `onunload` complete |
| Release hygiene | 9.5 | Tagged release + automated BRAT assets, versions.json in sync |

---

## 1. What was verified this pass

**Quiz timing & auto-release** (`tests/quiz-timing.test.ts`, `tests/quiz.test.ts`)
- All six duration formats parse (`30`, `30s`, `1m`, `1:30`, `m:ss`, inline `⏱`).
- Question phase → reveal phase → auto-next chain fires at the right tick; pause freezes both phases and resume continues at the same remaining time, not from zero.
- Loop mode restarts from question 1 with a fresh phase clock.
- Skip advances without leaking the previous question's remaining time.

**Quiz DOM behaviour** (`tests/quiz-dom.test.ts`, `tests/quiz-visibility.test.ts`)
- Reveal is class-based (`ntt-quiz-hidden` / `ntt-quiz-shown`): **zero** `click()` calls on titles or `<summary>`, so Obsidian's fold persistence and animation never run — this is what removed the blink seen in the video.
- Obsidian's own `is-collapsed` class is left untouched during a run.
- One answer visible at a time when close-after-reveal is on; earlier answers stay readable when it's off.
- On stop the note is restored exactly, including when no snapshot existed (fail-safe: nothing is left hidden).

**Inline Telegram-style ring** (`tests/quiz-badge.test.ts`)
- Badge mounts on the callout title row / `<summary>`, never in the body → no layout shift, no space stolen above the toggle.
- Arc geometry matches `quizPhaseRatio`; label is `m:ss` and carries an accessible name.

**Colour filter** (`tests/filter-dom.test.ts`, `tests/filter-cycle.test.ts`, `tests/verify-v120.test.ts`)
- A coloured toggle nested inside a plain `!note` is still found (`collectToggleElsFiltered` filters before de-nesting).
- `normalizeFilter`/`sameFilter` make `["red","green"]` and `["green","red"]` identical, so the picker highlights the right rows after a round-trip.
- Colour cycling preserves the `+`/`-` fold marker.

**Autoscroll & FAB** (`tests/autoscroll.test.ts`, `tests/scroll-loop.test.ts`, `tests/hold-pause.test.ts`, `tests/fab-a11y.test.ts`)
- Stop planning, filtered stops, plain-text notes (no toggles) all scroll.
- Hold anywhere pauses; release resumes at the same speed.
- FAB: tap = play/pause, long-press = sheet, 3 s auto-hide that does **not** wake on the plugin's own programmatic scroll, `aria-pressed` + live-region announcements, Enter/Space and Shift+Enter.

**Deep links** (`tests/deeplink.test.ts`) — full quiz link, shorthand filters, junk rejected, seconds/speed clamped, bare `stop`, unknown actions refused.

**Resource hygiene** (source audit) — 21 listeners with the DOM ones bound via `registerDomEvent`; every `setInterval`/`setTimeout` has a matching clear; the overlay `MutationObserver` is disconnected through `this.register`; `onunload` stops timer, autoscroll, quiz, FAB and hold-pause. No `console.*` left in shipped code. Only two `any` casts in 4.8 k lines.

---

## 2. Findings (ranked)

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | Medium | `main.ts` is 4 853 LOC — commands, settings tab, sheet modal, quiz orchestration and FAB wiring all in one class. Hardest part of the codebase to change safely. | Split into `commands/`, `settings/`, `ui/` modules; the pure logic already lives in `src/*`. |
| 2 | Low | `tests/*` import from `bun:test`, so `vitest` cannot run the suite (fails on every file). Only `bun test` works. | Document it in README, or add a thin vitest alias. |
| 3 | Low | `scroll-fab.ts` sets icons with `innerHTML` (static local SVG strings — not a security issue, but bypasses Obsidian's DOM helpers). | Build the SVG with `createSvg` / `setIcon`. |
| 4 | Low | No end-to-end harness inside real Obsidian: mobile render delays, fold internals and theme contrast are covered by heuristics + retries, not tests. | Keep the 400/700 ms self-heal retries; manual smoke test per release (`SMOKE-TEST.md`). |
| 5 | Info | `styles.css` is 787 lines with several near-duplicate FAB/quiz blocks. | Consolidate with CSS variables. |

Nothing critical or high found. No behaviour bugs surfaced in this pass.

---

## 3. Manual-verify list (cannot be asserted from tests)

1. On a long mobile note, quiz reveal shows **no** flicker and the ring shrinks smoothly.
2. FAB never appears over Settings / Search / Graph / Canvas.
3. Dark and light theme contrast for the white → blue running FAB.
4. BRAT install of `1.3.0` picks up the three assets (confirmed present on the release).
