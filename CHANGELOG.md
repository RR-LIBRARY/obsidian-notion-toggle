## 1.8.20

- Automatic releases: pushing a version tag (e.g. `1.8.20`) now creates the GitHub release and attaches `manifest.json`, `main.js` and `styles.css` for BRAT — no manual step.

## 1.8.19


- Fixed the one test that failed only in the full suite (the quiz dock test picked up a stale dock from an earlier test). Full suite now passes 1364/1364 every run.

## 1.8.18

- Dedicated **Toggle list** mobile action: at a cursor it makes a new toggle; selected text becomes a toggle. The existing smart-toggle action is unchanged.
- **Tools** opens a searchable menu of the existing commands grouped by purpose. Old command IDs and shortcuts still work.
- Mobile guide now recommends Toggle list + Tools, with Recall and Autoscroll as optional direct buttons. Remove old toolbar buttons manually in Obsidian settings.

## 1.8.17

- Pasted toggle headings keep their heading level (`## Title {toggle="true"}` becomes a toggle titled `## Title`), like Notion.

# Changelog

All notable changes to the Notion Toggle plugin. Older highlights live in `README.md → Changelog highlights`.

## 1.8.16

- Toggle rows now match Notion: every arrow sits in one fixed column, long titles wrap under the first word (hanging indent), opened bodies line up with the title, arrow pinned to the first line.
- Nested toggles step by one arrow width, so 12-level chains stay readable on phones.
- New real-browser layout check (`e2e/layout_check.py`, 22 checks at 360px and 1280px).

## 1.8.15

**Notion parity audit — and the two gaps it found.**

- New: **Ctrl/Cmd+Alt+T opens or closes every toggle in the note**, exactly like Notion. Anything still folded means "open everything", otherwise everything closes. Works at any nesting depth and on raw `<details>` blocks. Command: *Open / close all toggles (Notion Ctrl+Alt+T)*.
- Fix: Notion also writes callouts as `<callout 💡>` (icon without `icon="…"`). That form came through as a plain note; the icon now picks the right callout type.
- Audit: `AUDIT-notion-parity-1.8.14.md`. A real Notion page was built and read back through the Notion API, serialised the way Notion's clipboard serialises it, converted by the plugin and diffed node by node: **24/24 nodes match** (nested toggles, toggle heading, bullets, callout, code toggle, empty toggle, and a 12-level chain). Rating 9.0/10 for 1.8.14, 9.8/10 for 1.8.15.
- Answered from the reference video: at depth 9 Notion on the phone made a sibling instead of a child. The Notion API accepts at least 12 levels with no cap, so that is a narrow-mobile-column limit, not a rule — the plugin deliberately keeps nesting.
- Tests: 6 for the new shortcut, 2 parity fixtures frozen from the real Notion page. 1360 pass, browser checks 70/70.

## 1.8.14

**Paste from Notion.**

- Copy blocks in Notion, paste in Obsidian: nested toggles stay nested, toggle headings (`## Title {toggle="true"}`) become toggles, bullets keep their levels inside toggles, callouts become Obsidian callouts (💡 tip, ⚠️ warning, ❗ important, ℹ️ info, ✅ success, ❓ question, ❌ danger, others note), and code blocks are copied as they are. Before, nested toggles and toggle headings came out flat.
- A pasted toggle always starts on its own line, even if the cursor was after some text.
- New setting *Convert Notion paste to toggles* (on). Off = the 1.8.0 flat `<details>` conversion.
- Built from the text Notion really produces (checked on a live Notion page through the Notion API).
- Tests: 30 converter tests + 2 paste-handler tests; 3 new real-browser checks (the browser workbench now runs the same paste code as the plugin, which is why pasted toggles did not show up there before).

## 1.8.13

**Enter like the Notion app** (from the reference clip, frame by frame).

- Press Enter at the end of a toggle's title: the toggle opens and a new toggle waits inside it, caret on its title. Enter there again nests one level deeper; Enter on an empty title backs out to a plain line inside; Enter on that empty last line leaves the toggle. A closed toggle that already has an answer still starts the next toggle after it (the recall flow).
- New setting *Enter on a title makes a toggle inside* (on). Off = Enter opens the toggle with a plain line inside, as in 1.8.7–1.8.12.
- An empty title shows a grey "Toggle" hint, like Notion.
- Fix: the plugin's older Enter handler ran before the clean-editing one and always inserted a flat `> ` line, so the Notion-style Enter added in 1.8.7 never actually ran, and Enter inside a nested toggle broke the nesting. It now steps aside on titles and inside nested toggles.
- Tests: 24 planner + 10 editor tests for the Enter flow (including the real order of the two handlers), 4 tests for the 1.8.11 parser safety net and 3 for the drag-hook release on unload (both were shipped untested), 12 new real-browser checks.

## 1.8.12

- Mobile: tapping a toggle arrow now opens/closes reliably (finger jitter up to ~12px allowed, no dependence on the delayed mobile click; never flips twice).
- Mobile: dragging a block no longer selects text — any selection started by the long-press is cleared, new selection is blocked while dragging, arrow is never a text target.
- Tests: 5 unit + 7 real-browser touch checks.

## 1.8.11

**Audit release — no new features, three safety fixes.**

- Shift+Tab on a nested list item inside a toggle (`>   - sub`) now outdents the list as Obsidian normally does; it used to pull the item out of the toggle. Tab on indented text is likewise left to Obsidian.
- If the clean-editing parser ever hits something unexpected, the note now shows plain markdown for that edit and logs once, instead of the editor rejecting every keystroke. Key handlers (Enter, Tab, End, …) fall back to Obsidian's default the same way.
- Disabling the plugin now drops its drag-and-drop hook; a plain-http research bridge address shows a warning that the plugin key would travel unencrypted.

## 1.8.10

- Arrow direction fixed: closed toggles always show ▶, open ones ▼. On the phone some closed toggles showed ▲ because Obsidian turned the arrow a second time.
- Arrow shape is now the Notion triangle (solid, slightly wider), the same while reading and while editing.

## 1.8.9

**Rearrange + shove into toggle, like Notion.**

- Press and hold a line (or drag a toggle's arrow) to move it. A blue line shows where it lands; hover the middle of a toggle to see a blue box — let go there and the block goes inside that toggle.
- Tab puts the line (or a whole toggle) inside the toggle right above it; Shift+Tab takes it back out.
- Ctrl/Cmd+Shift+↑/↓ (or Alt+Shift+↑/↓) moves a block up or down; a toggle moves with everything inside it.
- Four new commands: Move block up / down, Put block inside the toggle above, Move block out of its toggle.
- Nested toggles now look clean while editing too: each level steps in, no `>` markers shown. Enter and Backspace work inside nested toggles.
- Blank separator lines are added automatically so moved toggles never merge into each other.
- New setting "Rearrange and shove into toggles" (on by default).

## 1.8.8

- The new toggle made by Enter keeps an empty line above it, so Obsidian never merges it into the toggle before.

## 1.8.7

- Enter like Notion: on a closed toggle title it starts the next toggle; on an empty toggle it turns into a plain line; on an open title it goes inside.

## 1.8.6

- Arrow tuned to the Notion app: smaller solid triangle, normal-weight title.

## 1.8.5

- Fold arrow on every toggle is now a small solid dark triangle (right when closed, down when open), like the Notion / Lovable FAQ — no coloured outline chevron.

## 1.8.4 — 2026-09-28 — Closer to the Notion / Lovable FAQ look

With "Plain Notion look" on, the editing view now matches the reference accordion:
- small solid triangle (same big tap target), centred on the title text, no hover box,
- medium-weight title instead of heavy bold,
- body text starts exactly under the title text, no guide line.
E2E grew to 26 real-browser checks (size, centring, alignment, no guide line).

## 1.8.3 — 2026-09-28 — Real-browser E2E + Right-arrow fix

- Fix: Right at the end of a bold or closed title sometimes left the caret stuck; it now always moves to the first body character (open) or the line after the toggle (closed).
- New real-browser E2E suite (`e2e/`): Chromium at phone width drives the shipped clean-editing code — no visible `**`/`[!question]`/`>`, End+type, Ctrl/Cmd+Enter, Right/Home/Delete/Backspace, arrow tap, hanging indent, chip setting, `>` + space. 22/22 checks; runs in GitHub Actions on every push.

## 1.8.2 — 2026-09-28 — Bold titles without `**`, hanging indent, quieter header

### Fixed
- A title saved as `**Question**` (the "Bold the question" setting) no longer shows its `**` markers while the caret is on it. The arrow swallows the opening pair, the closing pair is hidden, and the title keeps its bold weight — the note text is unchanged.
- A long title that wraps now continues under the title text (hanging indent), not under the arrow — like Notion.
- The header line no longer highlights on hover; only the arrow reacts.
- `End` / `Shift+End` on a bold title stop before the hidden `**`; `Delete` at the end of a bold title is a no-op instead of eating one hidden marker; `Backspace` at the very start of a title turns the toggle back into plain text (prefix and `**` removed together).
- A tap that lands behind a closed title parks the caret at the title end instead of jumping to the next line (only keyboard `Right` / `End` skip forward).

### Added
- Setting **Show "…" after a closed title** (off by default). Off = arrow + title only, exactly like Notion; on = the 1.8.0 chip is back.

### Tests
- 1260 tests pass (`bun test`).

## 1.8.1 — 2026-09-28 — Caret fixes on closed toggles + workbench

### Fixed
- On a closed toggle title, `End` / `Right` no longer move the caret into the hidden answer (which also opened the toggle). `End` now stops at the end of the title; `Right` at the title end jumps to the next line after the toggle.

### Added
- `Ctrl/Cmd+Enter` opens / closes the toggle under the caret.
- `Shift+End` selects only the title of a closed toggle.
- Web preview page (workbench) that runs the real plugin code in the browser for quick visual checks.

### Changed
- Open/closed choices made with the arrow are remembered for the whole session.
- The toggle arrow is slightly larger and easier to tap.

## 1.8.0 — 2026-09-28 — Notion-like writing: no more visible `>` / `[!question]-` while typing

Why: a toggle is stored as `> [!question]- Title` + `> answer` (or as a `<details>` block). Reading view already shows an arrow, but the moment you start typing Live Preview reveals the raw code — non-technical writers found that uncomfortable, and it is the biggest visual difference from Notion. Research for this release (Obsidian API docs, CodeMirror 6 docs, Notion's shortcut docs and Obsidian forum CSS threads) is summarised in `NOTION-WRITING-RESEARCH.md`.

### Added
- **Clean editing** (`src/clean-toggles.ts`, `src/clean-toggles-view.ts`). While the caret is inside a toggle, the `> [!type]- ` prefix is replaced by a clickable **▸ arrow** and every `> ` on the answer lines is hidden; answer lines get a thin indent guide in the toggle's colour instead of Obsidian's quote border. A closed toggle shows a `…` chip; the arrow and the chip open/close the toggle (mouse and touch). Choices made with the arrow are remembered per block and survive typing. Blocks the caret is not in are left to Obsidian's own callout rendering. Only active in Live Preview and only for the callout format.
- **Caret safety.** A transaction filter keeps a lone caret out of the hidden code: `Home`, a tap at the left edge or `Up`/`Down` from column 0 land after the arrow / after the hidden `> `; closing a toggle from inside its answer parks the caret on the title. Drag selections are never touched.
- **`>` + space starts a toggle** (Notion habit). Works through the keymap (hardware keyboards) and the input handler (phone keyboards). Uses the current colour, numbering and open/closed defaults.
- **Paste conversion.** Pasted text that carries `<details>` blocks arrives as toggles (`editor-paste`; respects `defaultPrevented`). `<details open>` keeps its open state (`+`); nested `<details>` become nested callouts (innermost first).
- **One-tap offer for old notes.** Opening a note that still contains `<details>` shows a notice with **Convert to toggles** / **Not now** — once per note per session, never automatic.
- **Plain Notion look** (`body.ntt-notion-look`). Collapsible callouts in reading view render as arrow + title without the coloured box or icon; colour toggles keep a coloured arrow. Scoped to `.is-collapsible` so plain informational callouts are untouched.
- **Command:** *Toggle: open by default ↔ closed by default (this toggle)* flips `-`/`+` on the header under the caret.
- **Settings → Notion-like writing:** Clean editing, Plain Notion look, `>` + space, Convert pasted `<details>`, Offer to convert old notes (all on by default). Flipping Clean editing or the shortcut re-runs the editor extension immediately (`Workspace.updateOptions()`).
- Tests: `tests/clean-toggles.test.ts` (28, pure planner), `tests/clean-toggles-view.test.ts` (17, against the real `@codemirror/state` — decorations, caret filter, effects, widgets, input handlers), `tests/notion-writing.test.ts` (18, paste / nudge / command / shortcut / settings / stylesheet contract). The CodeMirror stand-ins in `tests/setup.ts` were replaced by the real packages that ship with `obsidian`.

### Changed
- `convertDetailsToCallouts` now honours `<details open>` and converts nested blocks instead of stopping at the first inner `</details>`.
- `styles.css`: Obsidian draws the Live Preview quote border with a `::before` pseudo-element (`.is-live-preview .HyperMD-quote:before`, `.cm-blockquote-border:before`); clean lines switch it off explicitly and also reset `text-indent` / `padding-inline-start`. Reduced-motion users get no arrow rotation animation.
- `main.ts` gained one import, one settings mixin and one `installNotionWriting(this)` call; the size guard moved from 3500 to 3510 lines with a note.

### Notes
- Storage format is unchanged: notes stay ordinary Markdown callouts and open fine in any other Markdown app.
- `<details>` format users are unaffected; every new feature checks `format === "callout"`.

## 1.7.8 — 2026-09-24 — Fix: note turns faded yellow on a sideways swipe during autoscroll

### Fixed
- **Yellow / faded screen on swipe (phone).** During a focus (distraction-free) run, a sideways swipe started Obsidian's mobile sidebar gesture. The run hides the sidebar, but Obsidian still faded in its dim backdrop, so the whole note looked washed-out yellow with no sidebar visible until the next tap. Now any drawer that opens during the run is closed immediately (`src/drawer-guard.ts`, via the left/right split API), and `body.ntt-focus-run .workspace-drawer-backdrop` is hidden and click-through.

### Added
- `tests/drawer-guard.test.ts` (7 tests).

## 1.7.7 — 2026-09-24 — Autoscroll sheet: deep parameter stress tests + student presets

### Added
- **`tests/sheet-stress.test.ts`** (28 tests) — every sheet setting at its limits and in odd combinations: speed min/max/NaN and rapid changes, pause 1s/20s/1h and broken saved values, toggle hold vs screen pause both ways, all advance-mode × chunking combos, empty / one-toggle / 600-toggle / 25-screen notes, filter with no matches, reverse runs, floating button under overlays.
- **Guide:** "Student ke liye best settings" — 6 presets, expert tips, common mistakes.
- **`SHEET-MINIMAL-IDEAS.md`** — how the sheet could shrink to ~10 everyday rows without removing features (proposal only).

### Notes
- No behaviour change. No bugs found by the stress tests.

## 1.7.6 — 2026-09-24 — Autoscroll sheet: full feature audit + Hindi guide

### Added
- **`AUTOSCROLL-SHEET-GUIDE.md`** — Hindi guide to every Autoscroll sheet option (35 items, in on-screen order): what it does, how to use it, tips, FAQ. Linked from README.
- **`tests/sheet-features.test.ts`** (12 tests) — opens the real sheet and checks every row is present in order and wired (switches save, Open/Close all, Advance by, overlap/viewport sliders, More buttons, floating button returns on close).

### Notes
- No behaviour change. "Direction" and "Reverse direction ↑" are the same setting (documented).

## 1.7.5 — 2026-09-25 — Autoscroll sheet: no floating button, pause time per screen

### Changed
- **The floating autoscroll button hides while the Autoscroll quick-controls sheet is open** (it used to sit on top of Play and the sliders). It comes back when the sheet closes.
- **New "Pause on each screen" control** right under "Tall toggles screen-by-screen" (sheet and Settings): a 1 s … 1 h slider (fine steps at the short end, coarse at the long end) plus 10s / 20s / 30s / 60s / 1h chips and a live value. It replaces the old 0.25–30 s "Screen pause duration" slider; your saved value carries over (values under 1 s round up to 1 s).
- A tall toggle's **first** screen now also waits at least this long (or the toggle hold, whichever is longer), so every screenful of a long answer can be read. Screen stops keep using the same pause.
- The control greys out only when tall-toggle chunking is off *and* the run advances by toggles only.

### Internal
- New pure `src/pause-scale.ts`, DOM helper `src/screen-pause-ui.ts` (no Obsidian import), `stopHoldMs(..., chunked)`, `MAX_SCREEN_DWELL_MS` = 1 h, `MIN` = 1 s. New `tests/screen-pause.test.ts` (12 tests).

### Verified
- 1122 tests, typecheck and release build pass. See `AUDIT-sheet-1.7.5.md`.

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
