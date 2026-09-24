# Notion Toggle — Obsidian Plugin

Notion-style collapsible toggles for Obsidian, plus a recall workflow built on top of them: traffic-light grading, a floating Pomodoro timer, and SM-2 spaced repetition. You never type `<details>`, `<summary>` or `>` brackets by hand.

Works on desktop and mobile. Version 1.6.2.

Full guide: **[MANUAL.md](MANUAL.md)** — install/enable, **every setting explained one by one** (Toggle basics, Recall timer, Focus guard, Minimal mode, Auto-scroll revision, Quiz mode), commands list for the mobile toolbar, ready-made presets, debug overlay, stats panel and troubleshooting.

## Install

### BRAT (recommended)

1. Install the **BRAT** community plugin.
2. BRAT → *Add a beta plugin* → paste `RR-LIBRARY/obsidian-notion-toggle`.
3. Enable **Notion Toggle** in *Settings → Community plugins*.
4. Later updates: BRAT → *Check for updates*.

> If BRAT reports *"A manifest.json file does not exist in the latest release"*, the release is missing its assets. Every release since v1.2.0 ships `manifest.json`, `main.js` and `styles.css` as attached assets — remove and re-add the plugin in BRAT, then restart Obsidian.

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/RR-LIBRARY/obsidian-notion-toggle/releases/latest).
2. Copy them into `<vault>/.obsidian/plugins/notion-toggle/`.
3. Reload Obsidian and enable the plugin.


## Minimal command surface

Five context-aware commands cover the daily workflow — add them to the mobile toolbar (*Settings → Toolbar*) or to hotkeys.

| Command | What it does |
|---|---|
| **Toggle (smart add)** | One button that adds whatever fits the cursor: a new toggle, an MCQ option, a table row, or an answer line. |
| **Colour (red → yellow → green)** | Grades the toggle under the cursor with the traffic-light palette. |
| **Recall (start / pause session)** | Starts the Pomodoro recall session on the current note, or pauses/resumes it. |
| **Review (grade this note)** | Grades the note for spaced repetition; the suggested grade comes from your red/yellow/green toggles. |
| **Due notes** | Lists every note that is due today, soonest first. |

All older commands still exist (insert toggle, wrap selection, Quick Q&A, MCQ, Match the following, numbering, `<details>` conversion, timer controls). They are simply no longer required for the common path.

## Writing toggles

Type a question, press `Enter`, type the answer, press `Enter` twice — the next toggle is created for you, numbered automatically.

```markdown
> [!question]- **Q6. Bt crop ke liye cry gene ka selection kis par depend karta hai?**
> **Answer:** Target pest pe depend karta hai — kaunsa insect, uska gut receptor.
```

The trailing `-` starts the toggle collapsed, which is what makes active recall work.

### Enter and Backspace

| Cursor position | `Enter` |
|---|---|
| End of a toggle header | moves inside the toggle (`> ` answer line) |
| Answer line with text | new answer line in the same toggle |
| Empty `> ` line | closes the toggle and starts the next one |
| Empty toggle header | unwraps to plain text (double-Enter escape) |
| MCQ option line | next `- [ ]` option; empty option → `**Answer:** ` line |
| Filled table row | next numbered row of the Match table |

`Backspace` mirrors this: empty answer lines, empty headers and half-typed options unwrap cleanly instead of leaving stray markup. Mid-line `Enter` never splits a block — the remaining text moves to a fresh answer line. Both keys respect the *Auto-continue on Enter* setting and work in `<details>` mode.

## Recall features

- **Colours** — traffic-light red/yellow/green plus blue, purple, orange, gray and a plain Notion black, themed through Obsidian's native `--callout-color`.
- **Numbering** — new toggles get `1.`, `2.`, `3.` automatically; *Renumber toggles in note* fixes gaps.
- **MCQ** — question toggle with 2–6 `- [ ]` options and an `**Answer:**` line; options are tickable from the editor.
- **Match the following** — a two-column table skeleton (2–8 rows) inside a toggle, with an answer key line.
- **Floating recall timer** — draggable Pomodoro widget with presets (Classic 25/5, Deep 50/10, Quick recall 15/3, Custom), session counter, compact mode, phase notices with 🔴/🟡/🟢 counts and a **🔴 Jump** button, auto-collapse of answers on session start, idle and attention-aware auto-pause, and safe-area/orientation handling on mobile.
- **Spaced repetition (SM-2)** — grade a note *Again / Hard / Good / Easy* and the next recall date is computed for you (ease 1.3–2.7, interval up to 365 days). The widget shows *Next recall: 6 days (Sat)* and the status bar shows how many notes are due.

## Conversion

- **Convert `<details>` blocks to callouts** — migrates a whole HTML note to native foldable callouts in one command (verified on a 179-block note).
- **Convert callouts to `<details>`** — the reverse, when you need portable HTML.

## Auto-scroll revision (1.0.9)

Hands-free revision: the note scrolls by itself, stops at each toggle, opens it, then closes it again as it moves on.

- **Autoscroll (start / pause revision)** — primary command; a floating bar appears with pause, speed −/+, direction and filter buttons.
- **Reverse direction** — revise bottom → top for a fast second pass.
- **Colour filter** — stop only at 🔴 / 🟡 / 🟢 toggles (or Red + Yellow "weak spots", or all graded ones). Only the selected toggles open.
- **Hold time** — how long each opened toggle stays visible before moving on.
- **Loop** — start over from the other end instead of stopping.

## Quiz mode (1.1.0)

A timed, Telegram-quiz style run through the toggles of the current note:

1. A countdown runs on the question while the toggle stays closed.
2. When the time is up, the **answer is revealed automatically**.
3. After the answer time, the toggle **closes by itself**.
4. The next question scrolls into view and its timer starts.

- **Quiz (timed question run)** — primary command; a floating HUD shows `00:14`, `Q 3/12`, the phase, a progress bar, and pause / reveal-now / next / stop buttons.
- **Time per question** (1s–12h) and **answer time** (1s–1h) are set in settings or the quick-controls sheet (slider + exact number input); `Quiz: set time per question` offers 10s / 30s / 1m / 5m / 15m / 1h or a custom value. Per-question overrides in the title: `⏱30`, `⏱15m`, `⏱2h`.
- **Per-question override** — write `⏱30` (also `[30s]`, `(30s)`, `@30s`) in a toggle title and that question gets its own time.
- **Colour filter** — quiz only red, yellow or green toggles, reusing the auto-scroll filter.
- **Auto-next**, **close after the answer**, **loop the quiz** and **notify when the time is up** are all optional.

## Settings

Callout type, collapsed by default, auto-bold the question, auto-continue on Enter, toggle format (`callout` / `details`), auto-numbering, colour palette, MCQ option count, Match row count, auto Answer line, the full Pomodoro block, minimal command names, the **Recall schedule** section, the **Auto-scroll revision** section, and the **Quiz mode** section.

### Recall schedule maintenance (new in 1.0.8)

Schedules are stored per note path, so the plugin now keeps them in sync with the vault:

- renaming or moving a note carries its schedule along;
- deleting a note removes its schedule;
- **Clean up** removes schedules for notes that no longer exist (also run automatically on load);
- **Clear all** resets the whole schedule store.

## Development

```bash
cd obsidian-toggle-plugin
bun install
bun test         # 159 pure tests
bun run typecheck
bun run build    # regenerates main.js
```

Logic lives in pure modules — `src/smart.ts`, `src/naming.ts`, `src/timer.ts`, `src/timer-ui.ts`, `src/srs.ts`, `src/maintenance.ts`, `src/autoscroll.ts`, `src/quiz.ts` — so behaviour is tested without the Obsidian API.

## Changelog highlights

- **1.1.0** — quiz mode: per-question countdown, automatic answer reveal, auto-close, auto-next, floating quiz HUD, per-question `⏱30` override.
- **1.0.9** — auto-scroll revision with auto-open/auto-close toggles, reverse direction, speed control and colour filter.
- **1.0.8** — schedule follows renames/moves and is pruned on delete, Recall schedule settings section, Obsidian-native modal/settings headings, CSS classes instead of inline styles, MIT LICENSE, `versions.json`.
- **1.0.7** — minimal five-command surface with smart context actions, SM-2 spaced repetition, due-notes list.
- **1.0.6** — mobile UX pass: attention-aware auto-pause, pinned session note, compact draggable widget, 44px touch targets.
- **1.0.5** — floating recall timer (Pomodoro) with recall intelligence.
- **1.0.4** — MCQ and Match the following toggles.
- **1.0.3** — auto-numbering and the colour palette.
- **1.0.2** — Notion parity for Enter and Backspace.

## License

MIT — see [LICENSE](LICENSE).

## v1.1.1 — Autoscroll "pause on toggles" (Naveen Bharat reader parity)

The reader app's autoscroll sheet is now available for toggles:

- **Speed presets** — `0.02x … 20x` (1x = 60 px/s). Double-tap the play button on the floating bar, or use *Autoscroll: speed presets*.
- **Pause at** — every toggle / odd / even / **custom list** (`2, 5, 9`) / **route** (your own order, repeats allowed) / **shuffle** (weakest toggles first).
- **Pause for** — hold time from `1s` to `1h` with quick chips (5s, 10s, 20s, 30s, 1m, 2m, 5m, 10m, 30m, 1h) plus a custom value.
- **Tall toggles screen-by-screen** — long answers scroll one screen at a time before the next toggle (the reader's "A4 sheet" behaviour).
- **Go to first toggle** (`⤒`) and **reverse** (`↑/↓`) for fast backwards revision.
- **Loop the route** — route / shuffle runs restart instead of stopping.
- **Smart shuffle memory (FSRS)** — each toggle gets a difficulty/stability card per note. The time you linger on an open toggle is auto-graded (lingered ≥ 2x → *Again*, quick → *Easy*), so the next shuffle puts your weak toggles and leeches first and mixes in new ones (`New toggles mixed into shuffle`). Reset it any time with *Autoscroll: reset revision memory for this note*.
- Colour filter (🔴/🟡/🟢) still applies on top of every mode.

New commands: `Autoscroll: pause at`, `Autoscroll: pause for`, `Autoscroll: speed presets`, `Autoscroll: go to first toggle`, `Autoscroll: smart shuffle`, `Autoscroll: reset revision memory for this note`.

### Where the autoscroll logic comes from

The v1.1.1 autoscroll rules are the reader's own code, not a rewrite:

| Plugin file | Upstream source (`mranujbabu/navinbharat`) |
| --- | --- |
| `src/reader/dwellEngine.ts` | `src/lib/reader/dwellEngine.ts` (verbatim) — clamps, page/route parsing, parity matching, A4 screen-by-screen stops, `crossedTarget` / `waypointReached` |
| `src/reader/fsrsScheduler.ts` | `src/lib/reader/fsrsScheduler.ts` (verbatim) — FSRS-5 weights, retrievability, `reviewCard`, `inferGrade`, `buildShuffleRoute`, `deckStats`, `forecastDue` |
| `src/reader/shuffleDeck.ts` | `src/lib/reader/shuffleDeck.ts` (adapted: deck per note in plugin settings instead of localStorage) |
| `src/scrollmode.ts` | adapter — a reader "page" is a toggle; speed chips from `src/components/viewer/AutoScrollSheet.tsx` (`0.02 … 20x`, ceiling `MAX_SPEED = 20`) |

## v1.1.2 — reader-exact autoscroll loop

The rules were already the reader's; now the **loop mechanics** are too (ported from `src/hooks/useAutoScroll.ts`):

- **Float scroll position + sub-pixel remainder** — `scrollTop` snaps to whole pixels, so the position is owned as a float and the fraction is painted with `translate3d`. The slow chips (0.02x–0.2x) now really creep instead of stalling.
- **Per-leg direction in Route / Shuffle** — each leg heads to its waypoint (`legDirection` + `waypointReached`), so `6 → 3 → 8` travels down, up, down. Previously a waypoint above the cursor was never reached.
- **`crossedTarget` + stop-key guard** — the stop that a frame actually crossed is chosen (last passed going up, first going down) and fires once per direction, so no double pauses and no missed stops after a jump.
- **Route end handling** — `isRouteMode`, `loopRoute` restart, and a "Route / Shuffle finished" notice.
- **Shuffle range, deck summary and 7-day due forecast** in the "pause at" sheet (`deckStats`, `forecastDue`).
- **Per-note memory** of speed, direction and hold time (the reader's per-document keys).

## v1.1.4 — settings, debug overlay, weak-toggle stats

- **Autoscroll settings, all in one place** — Settings → Notion Toggle → *Auto-scroll revision*: speed slider + speed presets (0.02x–20x), pause-at mode (Odd / Even / Every / Custom / Route / Shuffle), pause-for duration, reverse, colour filter (🔴/🟡/🟢), auto-open / auto-close, loop note, loop route, tall-toggle screen-by-screen, shuffle range, auto-grade, new-toggle mix. Everything is stored in the plugin's own `data.json`, so it survives restarts, and speed / direction / hold are also remembered **per note**.
- **Debug overlay** (toggle in settings) — a fixed read-out while autoscroll runs: float position and sub-pixel remainder, direction, `waypointReached` / `crossedTarget` events, the dwell guard key, the last dwell → FSRS grade, and route progress.
- **Revision stats panel** — command `Autoscroll: revision stats (weak toggles)`, or the *Show stats* button in settings: deck summary, 7-day due forecast, and one row per toggle (`#7 · 42% recall · D 7.4 · S 3.1d · 2 lapses`) with a plain reason such as "forgotten 2× — kept close".
- **Smoke test checklist** for a real vault in `SMOKE-TEST.md`.

## v1.4.0 — 12-hour quiz timer, clipboard perf report, store-ready

- **Quiz time range 1s–12h** (`QUIZ_SECONDS_MAX = 43200`) with slider + exact seconds input in settings and the quick-controls sheet.
- Per-question title overrides now accept units: `⏱30` (seconds), `⏱15m`, `⏱2h`, plus `[5m]` / `(1 h)` / `@30m`.
- Durations render as friendly labels (`45s`, `15m`, `2h 30m`); the HUD ring shows `h:mm:ss` for hour-long questions.
- **Performance report** command now copies the telemetry report (quiz-timer jitter, re-measure latency) to the clipboard, and optionally appends it to `perf-log.md` (Settings → Quiz mode → *Log performance to perf-log.md*) for real-device profiling.
- `SUBMISSION.md` added — official community-plugin store metadata and checklist.

## v1.1.6 — ON/OFF switch, one-tap reverse, default hotkeys

- **Autoscroll running switch** at the top of *Auto-scroll revision* settings — start and stop without the command palette or toolbar.
- **Floating button upgrade** — a small ↑/↓ chip next to it flips direction in one tap, and the button now stays visible during a running session (offset above the control bar).
- **Clear on-screen messages** — running-session actions (reverse, faster, slower, stop) now explain the exact command and hotkey to run instead of doing nothing; notes without toggles say so.
- **Default hotkeys** — `Ctrl/Cmd+Shift+S` start/pause, `Ctrl/Cmd+Shift+R` reverse, `Ctrl/Cmd+Shift+A` sheet; shown in the command names and changeable in Settings → Hotkeys.

## v1.1.5 — floating launch button, autoscroll sheet, mobile toolbar guide

- **Floating ▶ button** on every open note (bottom-right, safe-area aware): tap = start / pause autoscroll, **long-press = autoscroll sheet**. It hides while the running control bar is on screen, and can be turned off in settings (*Floating autoscroll button*).
- **Autoscroll sheet** — every control in one mobile-friendly sheet: start/pause, speed, pause-for, pause-at, colour filter, reverse, loop, auto-open/close, tall-toggle chunking, debug overlay, plus shortcuts to *go to first*, *stats* and the toolbar guide. Also available as the command `Autoscroll: sheet (all controls)`.
- **Mobile toolbar guide** (command `Autoscroll: mobile toolbar guide`, or the button in settings) — in-app steps for Settings → Mobile → Manage toolbar with a **one-tap checklist** of the exact commands to add; the checklist persists, so you can tick commands off as you add them.
