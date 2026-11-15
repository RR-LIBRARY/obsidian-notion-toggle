# Verify 1.9.25

## Fixed behaviour
- `Callout format filter → All Notion` now works even when the global appearance was previously **Native callouts**. It turns Notion appearance on, clears native-type selections, updates open views and saves.
- `All callouts` selects every native type. Individual switches select mixed Notion/native appearance.
- The Settings appearance dropdown and filter summary update with the modal choice.
- Number-specific note rules keep priority; the filter does not silently delete them.

## Verification performed
- Full unit/integration suite: **1,518 passed, 0 failed**, **6,985 assertions**, 103 files.
- TypeScript native-preview check: passed.
- Production build: passed; `dist/` written. Root `main.js` and `dist/main.js` match byte-for-byte.
- Existing clean-editing browser suite: **67/67 passed**.
- Actual plugin appearance code in the Obsidian browser harness at **390×844** and **1280×1800**:
  - Native → All Notion changes every displayed card to a Notion row.
  - All Notion → All callouts changes every displayed card to a native callout.
  - Notion and native title clicks both close and reopen their answer.
  - Late-rendered cards, number/range appearance, colour grading/readback, visible red, measurement heights, Undo plus prior Undo, autoscroll mic hide/restore and note isolation remain passing.
  - No browser page errors.
- Visual screenshots inspected for both formats at phone and desktop sizes.

## Not verified here
- The user's physical Android phone and real Obsidian mobile app were not available. The browser harness uses the plugin's real appearance/modal logic with a simplified Obsidian shell; install this release and confirm the same two switches on the phone.
- This appearance fix does not change voice transcription or claim a real-microphone test.
