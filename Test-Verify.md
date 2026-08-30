# Test-Verify.md — Deep verification report

**Plugin:** Notion-style Toggle (obsidian-notion-toggle)
**Version verified:** 1.4.5 (built on the 1.4.4 release code + v1.4.3 docs)
**Date (UTC):** 2026-08-30
**Repo:** RR-LIBRARY/obsidian-notion-toggle

---

## 1. Final verdict

| Gate | Result |
|---|---|
| Unit + integration tests | **453 pass / 0 fail**, 1405 assertions, 31 files |
| TypeScript (`tsc --noEmit`) | **Clean** — 0 errors |
| Production build (`bun run build`) | **OK** — `main.js` 245.8 kb, `dist/` written |
| Browser harness (Chromium, hostile mobile theme) | **Pass** — FAB fully transparent, layer animation intact |
| Release metadata guard | **Pass** — manifest / versions.json consistent |

**Verdict: SHIP.** No open defects found in this pass.

---

## 2. Environment

- Runtime: Bun 1.3.3 test runner, happy-dom for real DOM assertions
- Type checker: TypeScript via `tsconfig.json`, strict
- Browser: Chromium (Playwright, headless), viewport 420×900, mobile theme fixture
- Build: esbuild bundle → `main.js` (Obsidian plugin entry)

---

## 3. Coverage by feature area

| # | Area | Where tested | Tests | Result |
|---|---|---|---|---|
| 1 | Plan persistence (v1.4.3) | `deep-e2e.test.ts`, `plan-persistence.test.ts` | 4 + existing | ✅ |
| 2 | Plan toast / one-tap resume | `deep-e2e.test.ts` | 3 | ✅ |
| 3 | Autoscroll pause-at modes | `deep-e2e.test.ts`, `scrollmode.test.ts`, `planner.test.ts` | 7 + existing | ✅ |
| 4 | Colour filters 🔴🟡🟢 | `deep-e2e.test.ts`, `filter-dom.test.ts`, `filter-cycle.test.ts` | 8 + existing | ✅ |
| 5 | Quiz mode (timed run) | `deep-e2e.test.ts`, `quiz*.test.ts` (7 files) | 10 + existing | ✅ |
| 6 | Recall timer + focus guard | `deep-e2e.test.ts`, `timer.test.ts` | 5 + existing | ✅ |
| 7 | SM-2 / FSRS scheduling | `deep-e2e.test.ts`, `srs.test.ts`, `fsrs.test.ts` | 2 + existing | ✅ |
| 8 | FAB chrome + a11y | `fab-chrome.test.ts`, `fab-a11y.test.ts`, browser harness | existing | ✅ |
| 9 | Cross-feature session replay | `deep-e2e.test.ts` | 2 | ✅ |
| 10 | Architecture guardrails | `architecture.test.ts` | existing | ✅ |

New this pass: `tests/deep-e2e.test.ts` — **41 tests, 128 assertions**, all green.

---

## 4. What was verified, in detail

### 4.1 Plan persistence — "reload ke baad plan zinda rehta hai"
- Mode, custom picks, route, `loopRoute`, shuffle `from`/`to`, colour filter and
  reverse all round-trip through `data.json` unchanged.
- The `loadSettings` sanitiser drops junk (`"x"`, `0`, negatives, floats, non-arrays)
  instead of crashing; `5.9 → 5`, `-4` dropped, `"yes" → true`.
- **Route survives shuffle:** shuffle overwrites the live route, but the typed route
  is kept separately in `scrollUserRoute`, so tapping 🧭 Route restores `7, 2, 9, 2`
  even after a restart.
- Empty custom/route plans fall back to `every toggle` rather than a dead run.

### 4.2 Plan toast + one-tap resume
- `planSummary()` produces the exact confirmation lines for every combination:
  `every toggle`, `route (n) · loop ON`, `shuffle … · range 2–6`, `range 3–end`.
- The empty-plan sheet offers **▶ Resume with every toggle**; verified that this path
  resolves to mode `all` and a valid plan.

### 4.3 Autoscroll planning
- odd / even / custom membership rules.
- Route keeps duplicates **and** its own order (`7, 2, 9, 2`), ignoring document order.
- Reverse flips document order but never reorders a route.
- Shuffle range clips both stop set and visit order (`3–6` over `[1,4,8,5]` → `[4,5]`).
- Tall toggles chunk into unique screen-sized stops when chunking is enabled.
- Loop replays from leg 0: `2,5,9,2,5,9,2`.
- Speed clamps inside the documented band; direction inverts the frame delta; a
  negative frame time yields 0 movement (no jump).

### 4.4 Colour filters (red / yellow / green)
Fixture: red, yellow, green, plain wrapper containing a nested red, yellow.
- Outermost collection reports `[red, yellow, green, other, yellow]`; the nested red
  is reachable through the filtered collector (2 reds), so nested toggles are not lost.
- Counts: red 1, yellow 2, green 1, other 1.
- Labels: `["red"] → 🔴`, all three → `🔴 🟡 🟢`, empty → `all toggles`.
- All six colour combinations keep exactly the expected counts (1, 2, 1, 2, 3, 4).
- Empty selection = no filtering (not an empty run).
- A filter matching nothing yields **0 stops** — the documented warning path.
- Filter + reverse + mid-note resume compose correctly (`firstStopFrom`).
- Route ordering is applied **on top of** the filter.

### 4.5 Quiz mode + timers
- Full question → reveal → next cycle for every question; exactly 3 reveals then `done`.
- Per-question `(45s)` in the title overrides the global default; seconds clamp to the
  supported 12-hour range.
- Pause freezes the countdown to the millisecond; resume continues from the same value.
- **Q22 skip bug:** skipping advances `0 → 1 → 2` with no gap and counts as answered.
- Loop restarts at Q1 instead of finishing.
- `revealNow` works only from a question phase (no double-reveal).
- **Open-all / close-all answers** are class-driven (`QUIZ_SHOWN/HIDDEN`), never a fold
  click — so Obsidian's own fold state is not disturbed.
- **Self-healing:** a detached/re-rendered question element is remapped by title back
  onto the live element.
- Quiz honours the colour filter when picking questions (2 yellow → total 2).
- An empty question list ends immediately instead of hanging.

### 4.6 Recall timer, focus guard, spaced repetition
- Focus phase counts down and rolls into the break; `formatTime(90000) = 01:30`.
- Long break arrives after the configured session count.
- Focus guard auto-pauses on `hidden` and on `other-note` (only when pinned), and does
  nothing when disabled or already stopped.
- Idle detection respects the configured minutes; `0` disables it.
- Auto-resume restarts only a run the guard itself paused — a manual pause stays paused.
- SM-2: `again ≤ good ≤ easy` intervals; due-dates behave accordingly; grade suggestion
  follows the note's red/yellow/green mix.

### 4.7 FAB chrome (grey pill fix from v1.4.4) — re-verified in a browser
Hostile fixture: `button { background: var(--interactive-normal) }`,
`.is-mobile button { background:#dcdcdc }`, `.theme-light .ntt-fab { background:#e8e8e8 }`.

| State | Button background | Border | Shadow | Wrapper bg | Layer animation |
|---|---|---|---|---|---|
| idle | `rgba(0,0,0,0)` | 0px | none | `rgba(0,0,0,0)` | `ntt-layer-step 1.5s infinite` |
| hover | `rgba(0,0,0,0)` | — | none | — | — |
| pressed | `rgba(0,0,0,0)` | 0px | none | `rgba(0,0,0,0)` | `ntt-layer-step 1.5s infinite` |
| reverse | `rgba(0,0,0,0)` | 0px | none | `rgba(0,0,0,0)` | `ntt-layer-step 1.5s infinite` |

`background-image: none` in all states, and layer 2's stagger delay is still `0.18s` —
the stepping animation is **bit-for-bit unchanged** while the grey pill stays gone.

---

## 5. Cross-feature session replay

1. Reader builds route `5, 1, 4` + loop ON + filter 🔴🟡.
2. Obsidian restarts; `data.json` is re-read and sanitised.
3. The plan rebuilds against the same note → visit order `[5, 1]` (4 is green,
   filtered out) and the toast reads `Plan: route (3) · loop ON`.
4. A quiz runs on the filtered subset while the pomodoro keeps counting; at the end the
   quiz is `done` with 2 answered, the timer is still running, and every answer is
   closed again — the note is handed back exactly as it was found.

---

## 6. Known gaps (not defects)

- **Real device rendering** is verified through a Chromium harness with a hostile theme,
  not on a physical Android/iOS Obsidian build. Computed styles and animation names are
  authoritative; pixel-level font rendering is not.
- **Obsidian API surface** (`Plugin`, `MarkdownView`, workspace events) is mocked in
  `tests/setup.ts`; a breaking upstream Obsidian API change would not be caught here.
- **Actual scroll physics** (requestAnimationFrame timing on a loaded note) is tested
  through the deterministic `frameDelta`/`planStops` math, not by measuring real frames.
- **FSRS long-horizon behaviour** (months of review history) is covered by unit maths,
  not by a simulated multi-month study log.

---

## 7. How to reproduce

```bash
bun install
bun test                    # 453 pass
npx tsc --noEmit -p tsconfig.json
bun run build               # main.js
```
