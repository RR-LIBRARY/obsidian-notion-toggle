# Deep QA report — Notion Toggle v1.5.2

Date: 2026-08-31 · Repository: `RR-LIBRARY/obsidian-notion-toggle`

## Release verdict

**Candidate: ready for release after the final full-suite, typecheck, build, and GitHub asset checks.**

The core claim is verified by the repository's deterministic tests: autoscroll uses the active rendered view, filters preserve note-wide ordinals, tall answers are chunked and top-anchored, quiz reveal heals after re-render, and the Reading View switch restores only the leaf it changed.

## End-to-end verification matrix

| Flow | Expected proof | Result / evidence |
|---|---|---|
| Start from Source mode | Switch to Reading View before measuring stops | PASS — `tests/reader-mode.test.ts` |
| Stop after mode switch | Restore Source mode on the same leaf | PASS — `tests/reader-mode.test.ts` |
| Start already in Reading View | Do not issue a redundant view change | PASS — `tests/reader-mode.test.ts` |
| Disable force-reading | Leave the user's mode unchanged | PASS — `tests/reader-mode.test.ts` |
| Filter real note | 14 red, 37 yellow, 20 green, 2 ungraded | PASS — real-note fixture tests |
| Filter combinations | All seven colour combinations plus ungraded/all states | PASS — filter and deep-link tests |
| Odd/even/custom | Use document-order ordinals, not post-filter indexes | PASS — `toggle-ordinals`, `scrollmode`, planner tests |
| Mixed callouts | Resolve supported built-in types and aliases | PASS — `callout-catalog`, real-note tests |
| Quiz sequence | One question, timed reveal, next, skip, loop | PASS — quiz timing/DOM/E2E tests |
| Obsidian re-render | Heal detached question/toggle references | PASS — `quiz-heal`, scroll self-heal tests |
| Collapsed callout | Force-open before reveal, no skipped question | PASS — `quiz-force-open`, visibility tests |
| Tall answer | Every screen slice is reached; question stays visible on small screens | PASS — `tall-answer.test.ts`, anchor tests |
| Screen mode | Viewport-aware stops, overlap, and last partial screen | PASS — `screen-mode.test.ts` |
| Stop and restore | Fold state and mode return to the pre-run state | PASS — quiz DOM and reader-mode tests |
| Mobile controls | FAB / quick sheet remain usable with accessible targets | PASS — FAB and UI contract tests |
| No movement | Stop with a clear message instead of a silent loop | PASS — scroll-container / loop tests |

## Plus / minus review

### Plus

- Reading View gives autoscroll one stable rendered surface.
- Filter counts make an empty or unexpectedly small deck visible before starting.
- Note-wide ordinals align the algorithm with what a reader sees.
- Re-render healing addresses the class of bug where a question is silently skipped.
- The core loop is offline and does not need an API call.

### Minus / accepted risks

- Source mode is temporarily unavailable while forced Reading View is active.
- DOM shape can vary across Obsidian versions and community themes.
- A fixture and unit suite cannot replace a real phone, screen reader, or clean-vault install.
- Auto-grade is a helpful heuristic, not a substitute for a user's own recall judgement.
- Large notes need a benchmark before claiming a universal performance ceiling.

## Final commands

```text
bun test
bun run typecheck
bun run build
```

Do not call the release production-ready until all three commands are green and the release contains `main.js`, `manifest.json`, and `styles.css`.
