# Changelog

All notable changes to the Notion Toggle plugin. Older highlights live in `README.md → Changelog highlights`.

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
