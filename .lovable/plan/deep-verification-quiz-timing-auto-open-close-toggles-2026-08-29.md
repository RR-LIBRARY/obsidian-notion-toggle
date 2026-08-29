# Deep Verification: Quiz Timing + Auto Open/Close Toggles

Goal: prove (not assume) that quiz mode ka timing, answer reveal, auto-next, aur toggle ka
automatic open/close + restore sahi chalta hai — pure logic level par bhi aur real DOM par bhi.

## What exists today (confirmed by reading the code)

- `src/quiz.ts` — pure engine: `startQuiz`, `quizTick` (question -> reveal -> next/done),
  per-question time parsing from the toggle title (`⏱30`, `[30s]`, `(45 s)`, `@20s`),
  `quizAutoNext`, `quizLoop`, `revealNow`, `skipQuestion`, pause/resume.
- `main.ts` — DOM side: quiz start collapses every stop (`setToggleOpen(el, false)`),
  opens the current one on reveal, closes the previous one when `quizCloseAfterReveal` is on,
  and on stop restores each toggle to its pre-quiz open/closed state via `quizWasOpen`.
- `setToggleOpen` / `isToggleOpen` handle both `<details>` and callout (`is-collapsed`) toggles.

Not yet verified: whether the DOM-side sequencing actually matches the engine events over real
time, and whether restore works after loop / early stop / note switch.

## Verification plan

1. Engine-level tests (`tests/quiz-timing.test.ts`)
   - Per-question duration parsing for all 5 title formats + fallback + clamping (3s..600s).
   - Full timeline drive with a fake clock: question end fires `reveal`, reveal end fires
     `next`, last question fires `done`; `quizAutoNext=false` stops after reveal.
   - `quizLoop=true` wraps to question 1 with the correct duration.
   - Pause/resume freezes remaining time; `revealNow` / `skipQuestion` mid-phase.

2. DOM-level tests (`tests/quiz-dom.test.ts`)
   - Build a fake note containing mixed toggles: `> [!note]-`, `> [!question]+`,
     `<details>`, `<details open>`, plus plain paragraphs.
   - Assert: on start all stops collapse; on `reveal` only the current toggle opens;
     on `next` the previous closes (and stays open when `quizCloseAfterReveal=false`);
     on stop each toggle returns to its exact original open/closed state (including the
     ones that were open before the quiz).
   - Assert the "document readable" case: quiz stop leaves no toggle stuck collapsed.

3. Live run in Obsidian-like DOM (Playwright against a rendered fixture page)
   - Drive the real `main.js` bundle over a fixture note, screenshot at question / reveal /
     after-stop to visually confirm open/close behaviour and HUD countdown.

4. Report
   - Update `QA-REPORT.md` with a pass/fail table per feature and note any bug found.
   - If a real bug surfaces (e.g. restore missed after note switch), fix it in the same pass
     and bump to v1.2.3 with a GitHub push + BRAT asset workflow trigger.

## Technical notes

- Tests run with `bunx vitest run`; existing `tests/setup.ts` already stubs the Obsidian API.
- Timing tests use injected elapsed values into `quizTick`, no real waiting.
- DOM tests extract the toggle helpers through the plugin class instance already used by
  `tests/verify-v120.test.ts`, so no production refactor is needed for testability.
