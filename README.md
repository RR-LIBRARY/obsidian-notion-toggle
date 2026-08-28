# Notion Toggle — Obsidian Plugin

Notion-style collapsible toggles for Obsidian, plus a recall workflow built on top of them: traffic-light grading, a floating Pomodoro timer, and SM-2 spaced repetition. You never type `<details>`, `<summary>` or `>` brackets by hand.

Works on desktop and mobile. Version 1.0.8.

## Install

### BRAT (recommended)

1. Install the **BRAT** community plugin.
2. BRAT → *Add a beta plugin* → paste `RR-LIBRARY/obsidian-notion-toggle`.
3. Enable **Notion Toggle** in *Settings → Community plugins*.
4. Later updates: BRAT → *Check for updates*.

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

## Settings

Callout type, collapsed by default, auto-bold the question, auto-continue on Enter, toggle format (`callout` / `details`), auto-numbering, colour palette, MCQ option count, Match row count, auto Answer line, the full Pomodoro block, minimal command names, and the **Recall schedule** section.

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
bun test         # 127 pure tests
bun run typecheck
bun run build    # regenerates main.js
```

Logic lives in pure modules — `src/smart.ts`, `src/naming.ts`, `src/timer.ts`, `src/timer-ui.ts`, `src/srs.ts`, `src/maintenance.ts` — so behaviour is tested without the Obsidian API.

## Changelog highlights

- **1.0.8** — schedule follows renames/moves and is pruned on delete, Recall schedule settings section, Obsidian-native modal/settings headings, CSS classes instead of inline styles, MIT LICENSE, `versions.json`.
- **1.0.7** — minimal five-command surface with smart context actions, SM-2 spaced repetition, due-notes list.
- **1.0.6** — mobile UX pass: attention-aware auto-pause, pinned session note, compact draggable widget, 44px touch targets.
- **1.0.5** — floating recall timer (Pomodoro) with recall intelligence.
- **1.0.4** — MCQ and Match the following toggles.
- **1.0.3** — auto-numbering and the colour palette.
- **1.0.2** — Notion parity for Enter and Backspace.

## License

MIT — see [LICENSE](LICENSE).
