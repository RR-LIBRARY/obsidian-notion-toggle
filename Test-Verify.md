# Test-Verify.md — Deep verification report

## v1.4.10 verification (2026-08-31)

| Gate | Result |
|---|---|
| Tests | **664 pass / 0 fail**, 2,066 assertions, 38 files |
| TypeScript (`tsc --noEmit`) | **Clean** |
| Build | **Clean** — `main.js` 267.3 kb |
| New specs | `tests/scroll-container.test.ts`, `tests/quiz-force-open.test.ts` |
| Architecture guard | `main.ts` 3,197 lines (< 3,200) |

**Fix 1 — autoscroll container detection.** The picker now refuses non-scrolling wrappers.
Proved by `pickScrollContainer([wrapper, scroller])` returning the scroller, and by
`pickScrollContainer([wrapper])` returning `null` where the old code returned the wrapper —
that `null` is exactly the case that used to look like "running but frozen". Mobile wrappers
and the document scroller are asserted to be candidates, and `isScrollStuck()` is pinned to
the 3s grace period (`SCROLL_STUCK_MS - 1` → false, `SCROLL_STUCK_MS` → true).

**Fix 2 — quiz reveal.** `forceQuizOpen`'s rule is verified against the same primitives
main.ts uses (`setQuizVisible`, `revealLanded`, `setToggleOpen`): a `<details>` toggle really
opens, a collapsed callout loses `is-collapsed`, a detached node is a no-op (heal owns that),
a re-rendered node reveals, and three questions open in order with none skipped.

**Not automated (manual smoke, see SMOKE-TEST.md):** real Obsidian reading-view re-render,
Android momentum scrolling, and the notice text on a note that genuinely has nothing to scroll.


## v1.4.9 verification (2026-08-30)

| Gate | Result |
|---|---|
| Tests | **639 pass / 0 fail**, 2,025 assertions, 36 files |
| TypeScript (`tsc --noEmit`) | **Clean** |
| Build | **Clean** — `main.js` 263.5 kb |
| New spec | `tests/debug-overlay-stops.test.ts` — 15 tests / 34 assertions |

**Feature:** optional on-screen debug overlay ab stop index, anchor position, portrait vs
landscape orientation, skip recovery aur reverse-leg state bhi dikhata hai.

Covered by the new spec:
- stop line: `nth/total`, dwell key, visited + pending counts;
- anchor line for all four anchors (`top`, `third`, `middle`, `lower`) — asserted equal to
  `anchorScrollTop()`, the same function the loop uses, so the read-out cannot drift;
- orientation line: portrait vs landscape from the container box, viewport size, layout
  signature; plus a check that both orientations run the same anchor math;
- skip line: recovered count, last three keys only, and the unvisited warning — with no
  warning when nothing was skipped;
- reverse: direction arrow, up-leg dwell scoping note, wrap fallback stop; absent forward;
- graceful fallback: with no optional data the overlay renders exactly as before, no
  `undefined` anywhere.

No change to scroll math, dwell timing, filters, quiz or FAB logic — the overlay only reads
state. Architecture budget respected: `main.ts` 3,191 lines (< 3,200).


## v1.4.8 verification (2026-08-30)

| Gate | Result |
|---|---|
| Tests | **624 pass / 0 fail**, 1,990 assertions, 35 files |
| TypeScript (`tsc --noEmit`) | **Clean** |
| Build (`bun run build`) | **Clean** — `main.js` 259.7 kb |
| New audit spec | `tests/feature-logic-v148.test.ts` — 61 tests / 257 assertions |
| New guard | `tests/no-self-recursion.test.ts` — main.ts + all of `src/` |

**Defect found and fixed:** `main.ts` `resetDwell()` was `{ this.resetDwell(); }` — infinite
recursion (stack overflow) on every autoscroll start, pause, reverse and route-leg change.
Now clears the dwell key and the per-leg visited set as intended. See `issue.md` #A1.

**Areas re-verified against spec:** toggle colours and callout mapping, colour filters and
cycling, all scroll modes (all/odd/even/picks with `3-5`, `3–5`, `3 to 5` ranges) and route
ordering with duplicates, corrupt-mode fallback to `all`, portrait/landscape anchor math and
rotation re-measure, multi-stop skip recovery, quiz question/reveal phases, healing and
visibility, focus + recall timers with pause guards, SM-2 due dates and FSRS grading/shuffle
determinism, maintenance rename/remove/prune, deep links, command naming, FAB visibility,
and the performance report (timer accuracy, freeze detection, filter/render timings).

**Plugin:** Notion-style Toggle (obsidian-notion-toggle)
**Version verified:** 1.4.6 (logic audit pass on top of the 1.4.5 release)
**Date (UTC):** 2026-08-30
**Repo:** RR-LIBRARY/obsidian-notion-toggle

---

## 1. Final verdict

| Gate | Result |
|---|---|
| Unit + integration tests | **503 pass / 0 fail**, 1633 assertions, 32 files |
| TypeScript (`tsc --noEmit`) | **Clean** — 0 errors |
| Production build (`bun run build`) | **OK** — `main.js` 245.8 kb, `dist/` written |
| Browser harness (Chromium, hostile mobile theme) | **Pass** — FAB fully transparent, layer animation intact |
| Release metadata guard | **Pass** — manifest / versions.json consistent |

**Verdict: SHIP.** The v1.4.6 logic audit found **three real defects**; all three are
fixed and guarded by named tests. Remaining findings are Low / by-design and are listed
in `issue.md`.

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
bun test                    # 503 pass
npx tsc --noEmit -p tsconfig.json
bun run build               # main.js
```


---

## 8. v1.4.6 logic audit

New suite: `tests/logic-audit.test.ts` — **50 tests, 226 assertions**. Written against
each module's *stated contract* rather than its implementation, so silent behaviour
changes fail here.

| Area | Checks | Result |
|---|---|---|
| Colour filters (🔴 🟡 🟢 / other) | 7 | Pass |
| Autoscroll engine (speed, direction, targets, resume, speed ladder) | 9 | Pass — 1 defect found and fixed |
| Plans (parity, custom, route, shuffle range, tall chunking, summary) | 11 | Pass — 2 defects found and fixed |
| Quiz (per-question time, phases, skip, pause, loop, healing) | 9 | Pass |
| Timer + SM-2 + card maintenance | 7 | Pass |
| Gestures, smart add, deep links | 3 | Pass |

### Defects found and fixed in this pass

1. **Corrupt saved mode became "odd toggles"** — `normalizeMode()` inherited the reader
   engine's `odd` fallback, so a damaged plan silently skipped half the note. Now falls
   back to `all`. (`issue.md` #1)
2. **`3-5` in a custom pick list dropped toggle 4** — the engine splits on non-digits, so
   ranges were read as two separate numbers. `parsePicks()` now expands ranges first.
   (`issue.md` #2)
3. **Reverse run wrapped to the bottom-most stop** — with nothing above the reader,
   `firstStopFrom()` returned index 0 of a descending plan, a target *behind* an upward
   run, so `reachedTarget()` fired on the first frame and every dwell was skipped. The
   wrap now goes to the edge the run is heading for. (`issue.md` #3)

The vendored reader engine (`src/reader/dwellEngine.ts`) was left verbatim; all three
fixes live in the plugin-side adapter.

### Gates after the audit

| Gate | Result |
|---|---|
| `bun test` | 503 pass / 0 fail, 1633 assertions, 32 files |
| `tsc --noEmit` | Clean |
| `bun run build` | OK — `main.js` 246.2 kb |

Companion documents: `issue.md` (issue register) and `Strongwincode.md`
(strengths / weaknesses review).


## 9. v1.4.7 verification — anchoring, skip recovery, performance report

**Version verified:** 1.4.7 · Date: 2026-08-30 · Baseline before this pass: 503 tests.

### What was broken (from the user's screen recording)

The 15s portrait recording showed the autoscroll gliding past toggles without
opening them. Three independent causes were confirmed in code:

1. Stops were parked with `targetOffset()` (fixed upper-third, height-blind), so
   in landscape the toggle sat at the very top and its answer was off-screen.
2. The target cache key used the *count* of measured boxes. Opening a toggle
   moves every box below it without changing the count, so stale tops kept being
   served and the loop walked straight past the moved stops.
3. `crossedTarget()` returned only one target per frame and the dwell guard was a
   single key, so a fast frame (or a phone that dropped frames) silently ate
   every stop but one.

### Fixes

| Area | Fix | Where |
|---|---|---|
| Anchoring | `anchorOffset()` / `anchorScrollTop()` — height-aware anchor fraction, clamped to the scroll range | `src/autoscroll.ts`, `src/scroll-anchor.ts` |
| Orientation | resize + orientationchange re-measure and re-anchor | `main.ts` |
| Cache | `layoutSignature()` + `targetsKey()` keyed on positions | `src/scrollmode.ts`, `src/scroll-anchor.ts` |
| Skips | `crossedTargets()` (all hits), `pendingAfterPark()`, `pickStops()` with a per-stop visited set | `src/scrollmode.ts`, `src/scroll-anchor.ts` |
| Report | `TimerAccuracy`, `FreezeDetector`, `formatQuizReport()`, modal | `src/quiz-perf.ts`, `src/perf-report-modal.ts` |

### New tests — `tests/anchor-skip-perf.test.ts` (24 tests)

| Group | Tests | Result |
|---|---|---|
| Stop anchoring (defaults, centring, oversized toggle, clamping, portrait == landscape, legacy helper untouched) | 6 | Pass |
| Layout invalidation (signature, cache key, ordered anchored targets) | 3 | Pass |
| Skip prevention (multi-crossing, reverse order, visited filter, queueing, re-measure recovery, no false positives, per-slice guard) | 7 | Pass |
| Timer accuracy (drift, pauses excluded, empty run + reset) | 3 | Pass |
| Freeze detection (freeze, steady ticks, ignore + reset) | 3 | Pass |
| Report contents (all sections, bad run names its problems) | 2 | Pass |

The portrait/landscape test is the direct proof of the fix: the toggle's centre
lands at the same screen fraction (0.5) with a 900px viewport and a 400px one.

### Architecture guard

`main.ts` was kept an orchestrator: HUD painting moved to `src/quiz-ui.ts`
(`paintQuizHud`), the filter read-out to `src/debug-overlay.ts` (`filterFrame`),
anchoring/skip maths to `src/scroll-anchor.ts`, and the metrics to
`src/quiz-perf.ts`. `src/perf-report-modal.ts` is registered as a declared UI
shell. All ten architecture tests pass.

### Gates

| Gate | Result |
|---|---|
| `bun test` | **527 pass / 0 fail**, 1696 assertions, 33 files |
| `tsgo --noEmit` | Clean |
| `bun run build` | OK — `main.js` 259.6 kb |

A missing `MarkdownRenderer` / `Component` stub in `tests/setup.ts` surfaced as a
module-load failure in an unrelated file; the stub was completed.

---

## v1.4.11 — deep verification: traffic-light filter + quiz over a filtered deck

Ab tak ke filter tests choti hand-written markup par chalte the. Is round me ek
**real note** ko fixture bana diya gaya: `tests/fixtures/zoology-recall.md`
(RENEET 2026 NCERT Recall — 73 toggles: 14 🔴 / 37 🟡 / 20 🟢 + 2 plain
`!tip`/`!note`). `tests/fixtures/note-parser.ts` markdown ko wahi reading-view
markup me badalta hai jo Obsidian banata hai (`.callout.is-collapsed`,
`.callout-title-inner`, `.callout-content`), aur `tests/filter-real-note.test.ts`
usi DOM par plugin ke asli helpers chalata hai.

### Kya verify hua (`tests/filter-real-note.test.ts` — 37 pass / 0 fail, 660 assertions)

| Group | Tests | Result |
|---|---|---|
| Fixture sanity (parse count, per-colour count, `]-` = collapsed render) | 2 | Pass |
| DOM colour path (`collectToggleEls` → `toggleTypeOf` → `colorOf`, counts + document order) | 2 | Pass |
| Har filter permutation (7 combos + all + all-graded + empty result) | 11 | Pass |
| Filtered stop planning (`planStops` travel order, sirf selected colours) | 7 | Pass |
| Deep-link round trip (`filter=` for all 7 combos, `graded`, `all`, labels) | 10 | Pass |
| Colour cycling note ke asli 71 header lines par (red→yellow→green→red) | 1 | Pass |
| Quiz over a filtered deck (red-only deck, yellow+green deck, reveal, full walk + restore, mid-run heal) | 5 | Pass |

### Concrete results

- **Counts match the note's own legend exactly:** DOM se pada gaya
  `{ red: 14, yellow: 37, green: 20, other: 2 }` — koi toggle drop nahi hua
  (v1.2.4 ka nested-drop bug real data par bhi wapas nahi aaya) aur koi double
  count nahi hua.
- **Har permutation ka deck bit-for-bit expected titles ke barabar hai**, aur
  document order me — 🔴 = 14, 🟡 = 37, 🟢 = 20, 🔴🟡 = 51, 🔴🟢 = 34,
  🟡🟢 = 57, all-graded = 71, empty filter = 73.
- **Plain toggles graded run me kabhi nahi aate:** `!tip` legend aur `!note`
  preface all-graded deck se bahar rehte hain, lekin "All toggles" me shaamil.
- **Jo colour note me nahi hai wo chup-chaap full run nahi banta:** khaali deck
  → khaali plan.
- **Quiz sequence filtered deck par sahi chalta hai:** red-only run 14 red
  questions ko order me visit karta hai, ek time par ek hi answer visible hota
  hai, natively collapsed callout par bhi reveal land karta hai (v1.4.10
  `forceQuizOpen`), run ke baad har toggle ka className bilkul pehle jaisa
  restore hota hai, aur mid-run poora section re-render hone par heal question
  ko title se dobara pakad leta hai — skip nahi hota.

**Koi naya bug nahi mila** — production code me is round me koi change nahi
karna pada; sirf tests + fixture + docs add hue.

### Gates

| Gate | Result |
|---|---|
| `bun test` | **701 pass / 0 fail**, 2727 assertions, 39 files |
| `tsc --noEmit` | Clean |
| `bun run build` | OK — `main.js` 267.3 kb |
