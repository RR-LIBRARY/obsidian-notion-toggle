# Changelog

All notable changes to the Notion Toggle plugin. Older highlights live in `README.md → Changelog highlights`.

## 1.7.4 — 2026-09-25 — Top padding diagnostic

### Added
- **Command: "Diagnose top padding (theme / snippets)".** Walks from the note up to the window, measures every top padding / margin / border, finds the CSS rules that set them and says who owns each pixel: Obsidian (its own status-bar inset or header), Notion Toggle, or the active theme / a CSS snippet. The report shows the verdict ("OK" or "N px extra top gap"), a table per element, the matching rules, and which theme / snippets to switch off to test. "Copy report" puts it on the clipboard for a bug report.

### Internal
- New pure `src/padding-diagnose.ts` (`analyzeTopGap`, `formatGapReport`, `px`, `declaresTopGap`) and the UI shell `src/padding-diagnose-view.ts` (declared Obsidian shell). `main.ts` only registers it (3495 lines).
- New `tests/padding-diagnose.test.ts` (7 tests).

### Verified
- 1110 tests, typecheck and release build pass. See `AUDIT-sheet-1.7.4.md`.

## 1.7.3 — 2026-09-25 — Autoscroll: no status-bar strip, Open all stays out of the run's way

### Fixed
- **No more blank "status bar" strip while autoscroll is on.** Obsidian mobile already keeps the note below the phone's status bar (`body.is-mobile` is padded by the real inset, and the focus run never hides that padding). The plugin's distraction-free mode added the *same* inset again on top of the note, so a band exactly one status bar tall sat under the real status bar for the whole run. The plugin adds no top gap at all now; the bottom gap that keeps the last line clear of the gesture bar stays on the scroller. Themes that want a top gap can still set one under `body.ntt-focus-run.is-mobile`.
- **Open all / Close all no longer fights an autoscroll run or a quiz.** In 1.7.2 the command was remembered for the note and re-applied to every answer Obsidian rendered later — including while a run was closing answers behind the reader. Starting or resuming a run now drops any remembered command, and a command tapped *during* a run or quiz is a one-shot flip (it still opens everything on screen, it just is not re-applied later). Outside a run the sticky behaviour is unchanged.
- The mutation watcher stays quiet while a run or quiz owns the toggles, so a think badge or screen marker being inserted can never pop a just-closed answer open again.

### Internal
- `styles.css`: `--ntt-focus-top-gap` and the `.view-content` top-padding rule are gone; `--ntt-focus-bottom-gap` remains.
- `main.ts`: `answerWantCanStick()`, `applyAnswerWant()`; `startAutoScroll` / resume call `clearAnswerWant()`.
- `src/answer-state.ts`: `answerApplyIo()` — the quiz path re-applies the quiz's own visibility classes instead of touching the fold arrow.
- New `tests/autoscroll-focus-run.test.ts`: a real `NotionTogglePlugin` instance in happy-dom drives start / stop / resume, Open all during a run and during a quiz, and render mutations mid-run.

### Verified
- 1101 tests, typecheck and release build pass. See `AUDIT-sheet-1.7.3.md`.

## 1.7.2 — 2026-09-24 — Open all / Close all for the whole note

### Fixed
- **Open all / Close all now reaches every answer, not just the dozen on screen.** On mobile Obsidian keeps Reading View lazy even with the full-render flag, so a 71-answer note flipped 12 and asked the reader to scroll and tap again. The command is now remembered for the note, the rest of the note is swept into existence in small hops (scroll position restored afterwards), and anything Obsidian renders later — when the reader scrolls — is born in the remembered state.
- The remembered command is dropped the moment it stops being the reader's intent: switching notes, tapping a single fold arrow, or starting/stopping a quiz (the quiz keeps owning answer visibility).
- Foldable answers are counted from the note source by marker (`> [!q]-` / `+` and `<details>`), so a plain `> [!note]` is never reported as "not rendered yet".
- Honest notice: "Opened 71 of 71 answers.", or "Opened 12 of 71 answers — the rest will open as you scroll." instead of "scroll down and tap again".

### Internal
- New `src/answer-state.ts` (sticky state, `applyWanted*`, `sweepRender`, `runAnswerSweep`) and `src/answer-render-watch.ts` (render observer + manual-tap detection); `main.ts` only registers the wiring.

### Verified
- 1091 tests, typecheck and release build pass.

## 1.7.1 — 2026-09-24 — Autoscroll correctness

### Fixed
- Open all / Close all now forces the complete Reading View render, waits for lazy sections, includes nested foldables, excludes plain callouts, and reports honest counts.
- Screen stops use their own pause duration; Toggles + screens gap-fills between stable toggle stops without backward rescue.
- Tall-answer continuation keeps the answer open, skips repeated think countdowns, and uses screen dwell; route first stops retain normal hold timing.
- Removed the permanent Android top strip by giving one wrapper ownership of the real safe area, with no artificial 24px floor.
- Research requests now stop stalled panel states with clear operation-specific timeout messages and generous ceilings for generated answers.

### Verified
- Screenshot control audit: 24/25 groups automated-pass; the remaining group is physical-device endurance, not a known failure.
- 1080 tests, 4361 assertions, typecheck and release build pass. See `AUDIT-sheet-1.7.1.md`.

## 1.7.0 — 2026-09-24 — Web research

### Added
- **Research side panel** (ribbon icon, *Research: open panel*): composer with six modes (Ask the web, Fact-check, Web search, Quick search, Read link, Recall toggles), *Use selection*, a *Deep…* dialog, a results history (30 newest, Insert / Copy per card, Clear all) and a background-run list (Insert / Insert again / Copy / Check now / Dismiss).
- **Commands**: `Research: ask the web (cited answer)`, `Research: fact-check selection`, `Research: web search → source toggles`, `Research: quick search (links)`, `Research: read link(s) into toggles`, `Research: recall toggles from selection / note`, `Research: deep research (background)`, `Research: insert latest finished deep research`, `Research: open panel`.
- **Formatters** (`src/research/format.ts`): answers with numbered `[n]` citation markers and a Sources list, fact-checks as verdict-coloured callouts with a Correction line, web-search results as one toggle per source, extracts with a Source line, recall cards in the plugin's own Q&A / MCQ (`- [ ]` options + `**Answer:**`) / cloze shapes. Every formatter honours the reader's callout type, collapsed, bold-summary and `callout` / `<details>` settings, so research toggles take part in autoscroll, quiz and spaced repetition unchanged.
- **Research bridge client** (`src/research/client.ts`, `transport.ts`): `ntr_…` key auth, typed errors (`not_configured`, `unauthorized`, `rate_limited`, `payment_required`, `not_found`, `upstream_error`, …) with reader-facing messages, an **on-device cache** (15 minutes, bounded) so repeat queries cost nothing.
- **Background deep research** (`src/research/runs.ts`, `service.ts`): Parallel task runs tracked in `data.json` (max 20), polling with backoff, a persistent notice with **Insert / Later** when a report is ready, restart-safe resume once the layout is ready, and a `Run not found on the bridge` failure instead of polling forever.
- **Settings → Web research (v1.7.0)**: Bridge URL (normalised to origin), masked Plugin key with reveal button and shape check, Connection → *Test* (key name + provider health), Insert as, Insert where, Sources list, Search mode, Answer effort, Recall toggles per request, Recall style, Answer language, Deep research default shape, On-device cache, Background runs (with *Forget finished*).
- **Styles**: `.ntt-research-panel` / `.ntt-rp-*` panel classes (mobile sizing included), prompt dialogs, notice action buttons.
- **Tests**: `research-format`, `research-client`, `research-runs`, `research-service`, `research-panel`, `research-settings`, `research-wire`, `research-architecture` (1037 tests in total).
- **Repo**: `backup/` snapshot of the research bridge web app source and `AUDIT-v1.7.0.md`.

### Changed
- `main.ts` stays an orchestrator: the research folder is reached through `src/research/wire.ts` only (guarded by `tests/research-architecture.test.ts`; type-only imports are allowed).
- Settings tab gained the *Web research* section; `data.json` from older versions is upgraded in place with research defaults.
- Docs: README, MANUAL (section 15), FEATURES, FEATURE-STATUS updated for 1.7.0.

### Fixed
- Panel section styles `.ntt-rp-runs` / `.ntt-rp-results` were referenced by the panel but not shipped in `styles.css`.

## 1.6.2 — 2026-09-01
- Holistic audit fixes: no frozen runs, safe toggle identities, bounded state, themeable focus mode.

## 1.6.1 — 2026-09-01
- Filter hard guard (red / yellow / green), think-time preview slider, per-note think override, reduced motion, timing debug overlay.

## 1.6.0 — 2026-09-01
- Park by stable identity (filter leak fix), no re-open of revised toggles, customisable think badge, focus-run safe-area.

## 1.5.9 — 2026-09-01
- Think time before the answer + distraction-free run.

## 1.5.8 — 2026-09-01
- Stable toggle identity across lazy renders.

## 1.5.7 — 2026-09-01
- Fixed the repeating toggle in filtered runs.

## 1.5.5 — 2026-09-01
- Filter counts come from the note source (no more "12 of 71"); smooth revert animation.

## 1.5.4 — 2026-09-01
- Lazy-render fix: full-note render before a run, source-truth filter counts, mid-run plan healing, live screen maths.
