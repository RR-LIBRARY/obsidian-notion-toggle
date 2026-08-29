# Single floating button + deep verification pass (v1.2.0)

## 1. One floating button only

Right now the FAB is a pair: a small `↓` direction chip plus the big `▶` button.
The screenshot marks only one round button, so:

- Remove the direction chip from the floating UI entirely.
- Keep exactly one circular button (the `▶` / `⏸` one) at the bottom-right.
- Tap = start / pause autoscroll (unchanged).
- Long-press (500 ms) = open the Autoscroll sheet — the sheet stays the single
  place where every other control lives: Autoscroll ON/OFF, Quiz ON/OFF,
  direction (forward / reverse), speed, dwell, pause-at mode.
- Direction moves into the sheet as its own row (it currently only exists on the
  chip and as a command), so nothing is lost by removing the chip.
- Auto-hide behaviour stays as-is: fades 3 s after the last activity while
  running, comes back on any tap/scroll, pinned while paused.

## 2. Deep verification (what gets tested and reported)

Each item gets an automated test where it is testable as pure logic, plus a
manual read-through of the code path where it depends on Obsidian's DOM.

- **Toggle detection**: autoscroll and quiz must stop at every callout type —
  `> [!note]-`, `> [!question]-`, `> [!info]-`, custom types, plus raw
  `<details>` blocks. Confirm the selector is type-agnostic and that only the
  outermost toggle is counted when they nest.
- **Plain text notes**: a note with no toggles at all must still autoscroll
  smoothly end-to-end instead of showing the "no toggle" notice.
- **Auto-open closed toggles**: verify a closed toggle is expanded when the run
  reaches it, and that the reading-mode document stays readable (text visible,
  no layout jump) while the quiz has toggles collapsed.
- **Quiz answer release**: verify each question's answer reveals automatically
  after the configured duration, that the per-question timer resets on the next
  stop, and that pause/resume and skip keep the timer honest.
- **Quiz + autoscroll together**: run order, dwell handling, and that stopping
  one does not leave the other in a stuck state.
- **Lifecycle**: no leaked timers/listeners after unload with the new
  single-button FAB.

Output: an updated `QA-REPORT.md` with a pass/fail table, plus any bugs found
get fixed in the same release.

## 3. GitHub

The GitHub API connector authenticates API calls; it does not push this
project's source. To get these changes into
`RR-LIBRARY/obsidian-notion-toggle`, connect the repo from the chat box:
**Plus (+) → GitHub → Connect project**. After that every change syncs
automatically. I can use the API connector afterwards to read the repo, check
releases, or open issues if you want.

## Technical notes

- `src/scroll-fab.ts`: drop `rev` element, `setReverse()`, and the `onReverse`
  callback; keep tap / long-press / auto-hide logic. Update its tests.
- `main.ts`: remove the `onReverse` wiring in `syncScrollFab()`; add a direction
  row to `ScrollSheetModal` calling the existing `setScrollReverse()`.
- `styles.css`: remove `.ntt-fab-rev` rules, re-center the single button.
- New tests in `tests/` for callout-type detection, plain-text runs, and quiz
  reveal timing; version bump to 1.2.0 across manifest / package / versions.
