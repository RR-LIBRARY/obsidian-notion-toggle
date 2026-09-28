# Research notes — v1.8.0 "Notion-like writing"

What was looked up before building clean editing, and what each finding changed in the code. Sources were read through the Parallel and Perplexity search connectors plus the official docs; anything marked *unverified* was not confirmed against Obsidian's own source and is covered by a defensive fallback instead.

## Goal
A toggle stored as `> [!question]- Title` / `> body` must never show `>` or `[!type]-` while typing (Live Preview), and must behave like Notion: an arrow you tap to open/close, `>` + space to start one, and pasted `<details>` blocks arriving as toggles.

## Findings → decisions

| Finding | Source | What it changed |
|---|---|---|
| Replace decorations that span line breaks (our folded body) may only come from a **StateField**, never a ViewPlugin; ViewPlugin decorations cannot change vertical layout. | CodeMirror 6 reference, Obsidian developer docs (Decorations) | The whole layer is one `StateField` providing `EditorView.decorations.from(field)`. |
| Atomic ranges only affect cursor motion, not typing at the range edge. | CodeMirror 6 reference | Added a `transactionFilter` (`nudgeCaret`) so a lone caret can never rest inside the hidden prefix (Home / left-edge tap / Up-Down from column 0). |
| `editor-paste` callback is `(evt, editor, info)`; check `evt.defaultPrevented`, call `preventDefault()` when handled. | Obsidian API docs (`Workspace.on('editor-paste')`) | Paste handler respects other plugins and cancels the default paste only when it converted something. |
| `file-open` receives `TFile \| null`; `Notice` accepts a `DocumentFragment` and a duration. | Obsidian API docs | One-tap conversion offer is a fragment notice with two buttons, guarded for `null`. |
| Editor extensions can be re-run on the fly with `Workspace.updateOptions()`. | Obsidian API docs / developer docs | Settings toggles for clean editing and the shortcut call it so the change is immediate. |
| `editorLivePreviewField` is a `StateField<boolean>`. | Obsidian API | Layer is inert in Source mode. |
| Callout fold markers: `-` = collapsed by default, `+` = expanded. | Obsidian help (Callouts) | `flipFoldMarker` + the "open ↔ closed by default" command. |
| Live Preview draws the blockquote border with a `::before` pseudo-element: `.markdown-source-view.mod-cm6.is-live-preview .HyperMD-quote:before` and `.cm-blockquote-border:before` (`border-inline-start: var(--blockquote-border-thickness) solid var(--blockquote-border-color)`). | Obsidian forum, "CSS that targets when Callout is being edited?" (2025) | Clean lines disable exactly those pseudo-elements and reset `padding-inline-start` / `text-indent`; the body guide is our own border. |
| Live Preview callout lines carry `HyperMD-quote`, `HyperMD-quote-1`, `HyperMD-callout`; the quote marker is `cm-formatting cm-formatting-quote`. | Obsidian forum / theme sources | Extra `display: none` on `.cm-formatting-quote` inside clean lines to stop a flash before the replace decoration paints. |
| Notion's `>` + space shortcut creates a toggle block. | Notion help / community docs | `isShortcutTrigger` + keymap (`Space`) and `inputHandler` (phone keyboards mostly deliver input events, *unverified* on every Android keyboard — both paths exist). |
| Plugin guidelines: sentence case, no "settings" in headings, headings only when there are several sections. | Obsidian plugin guidelines | Settings copy follows this ("Notion-like writing", "Clean editing", …). |
| Obsidian callout CSS variables (`--callout-color`, `--callout-title-padding`, `--callout-content-padding`, …). | Obsidian CSS variables reference | Plain Notion look overrides padding/background through these variables scoped to `body.ntt-notion-look … .is-collapsible`. |

## Unverified / covered defensively
- Exact internals of Obsidian's callout widget while editing (class names beyond the ones above) — we do not depend on them; only lines the caret is in are decorated.
- Behaviour of every mobile keyboard for `>` + space — two interception paths; the command palette remains the fallback.
- Theme CSS that draws its own quote border on `.HyperMD-quote` — documented in `MANUAL.md → 16.8`.

## Verification
- `tests/clean-toggles.test.ts` — 28 planner tests.
- `tests/clean-toggles-view.test.ts` — 17 tests against the real `@codemirror/state` / `@codemirror/view` (decoration sets, caret filter, effects mapping through edits, widget DOM, input handler, keymap).
- `tests/notion-writing.test.ts` — 18 tests for paste, nudge, command, shortcut insertion, settings and the stylesheet contract.
- Full suite: 1238 tests, 78 files, green.
