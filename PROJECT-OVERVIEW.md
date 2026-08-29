# Notion Toggle — project overview

Obsidian plugin (`id: notion-toggle`, author **Anuj Yadav**, desktop + mobile) that brings
Notion-style collapsible toggles to Obsidian — as native callouts (`> [!question]-`) or
`<details>` blocks — plus a full active-recall workflow: colours, Pomodoro timer, SM-2
spaced repetition, auto-scroll revision and timed quiz mode.

Everything is local/offline: Obsidian API + CodeMirror + esbuild + bun tests. No backend,
no network calls, no telemetry.

## Layout

```text
obsidian-toggle-plugin/
  main.ts               Obsidian glue: commands, settings tab, modals, DOM wiring
  main.js               esbuild output (committed, what Obsidian loads)
  manifest.json         plugin manifest (version 1.1.0)
  versions.json         version → minAppVersion map
  styles.css            toggle colours, timer widget, scroll bar, quiz HUD
  src/
    smart.ts            context-aware "smart add" actions
    naming.ts           command naming (primary vs "Advanced: …")
    timer.ts            Pomodoro engine + recall stats (pure)
    timer-ui.ts         floating draggable timer widget
    srs.ts              SM-2 scheduling, due notes (pure)
    maintenance.ts      schedule rename/delete/prune helpers (pure)
    autoscroll.ts       auto-scroll engine: speed, direction, colour filter, stops (pure)
    autoscroll-ui.ts    floating auto-scroll control bar
    quiz.ts             quiz engine: countdown, reveal, auto-next, labels (pure)
    quiz-ui.ts          floating quiz HUD
  tests/                bun tests for every pure module (159 tests)
```

Rule of thumb: all logic lives in `src/*.ts` without Obsidian/DOM imports so it is unit
tested; `main.ts` only wires it to the editor.

## Commands

Primary (clean names): `smart-toggle`, `smart-colour`, `smart-recall`, `smart-review`,
`smart-autoscroll`, `smart-quiz`. Everything else appears as "Advanced: …" when
**minimal command names** is on. Command IDs never change, so hotkeys and mobile toolbar
entries survive upgrades.

## Feature history

- **1.0.2** — Notion parity for Enter / Backspace inside toggles.
- **1.0.3** — auto-numbering + traffic-light colour palette (`recall-red/yellow/green`,
  blue, purple, orange, gray, plain).
- **1.0.4** — MCQ and "Match the following" toggles.
- **1.0.5** — floating Pomodoro recall timer.
- **1.0.6** — mobile UX: attention-aware auto-pause, compact draggable widget, 44px targets.
- **1.0.7** — minimal command surface + SM-2 spaced repetition + due-notes list.
- **1.0.8** — schedule follows renames/moves, prune, MIT LICENSE, `versions.json`, English README.
- **1.0.9** — auto-scroll revision: auto-open/auto-close toggles, reverse direction,
  speed control, hold time, colour filter, loop.
- **1.1.0** — quiz mode: per-question countdown, automatic answer reveal, auto-close,
  auto-next, floating HUD, `⏱30` per-question override, quiz colour filter, loop.

## Development

```bash
cd obsidian-toggle-plugin
bun install
bun test
bun run typecheck
bun run build      # esbuild → main.js
```

Release: bump `manifest.json`, `package.json`, `versions.json`, rebuild `main.js`, push to
`RR-LIBRARY/obsidian-notion-toggle`, then tag a GitHub release with `main.js`,
`manifest.json`, `styles.css` attached.
