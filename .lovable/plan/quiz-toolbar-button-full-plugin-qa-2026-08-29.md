# Quiz toolbar button + full plugin QA

## 1. GitHub (RR-LIBRARY/obsidian-notion-toggle)

Two different things share the name "GitHub" here:

- **Repo sync** (what you actually want): pushes this plugin code to your repo. It can only be started by you from the editor — Plus (+) menu in the chat box → GitHub → Connect project → pick `RR-LIBRARY`. After that every change I make syncs automatically.
- **GitHub API connector**: gives the *app* API access with your account. It cannot sync this project's source code, so it does not help here.

So: no connector will be linked; I will only confirm the repo state and prepare a clean `v1.1.9` version bump so a release/tag is ready the moment sync is on.

## 2. Quiz mode as a mobile-toolbar button

The `smart-quiz` command already exists ("Notion Toggle: Quiz (timed question run)") but it is easy to miss in the long toolbar list and there is no guided way to enable it.

Changes:

- Add `smart-quiz` (and `quiz-pause`) to the mobile-toolbar guide checklist in `src/guide.ts` so the in-plugin "Configure mobile toolbar" helper ticks Quiz off like the other primaries.
- Add a `Quiz` row to the autoscroll long-press sheet (`ScrollSheetModal`) as an on/off toggle, so quiz can be started without the toolbar at all.
- Give the quiz command a clearer toolbar label and distinct icon (`help-circle` → `list-checks` style) so it reads as "Quiz" at a glance in the toolbar picker.
- Better empty-state notice: if no toggles are found, reuse the same source-scan retry the autoscroll fix uses, instead of failing instantly.

## 3. Expert test pass over the whole plugin

Run and report on:

- `bun test` (213 unit tests: fsrs, srs, quiz, autoscroll, hold-pause, planner, timer, guide, maintenance, scrollmode, debug-stats)
- `tsc --noEmit` typecheck and esbuild production bundle
- Static audit of every registered command: id, name, icon, and whether its callback can fail silently on mobile (no active view, no toggles, no editor)
- Settings audit: every field in `NotionToggleSettings` has a default, is reachable from the settings tab, and persists
- Lifecycle audit: `onunload` cleans up intervals, RAF loops, FAB, HUD, hold-pause listeners (leak check)
- Manifest/version consistency (`manifest.json`, `package.json`, `versions.json`, `minAppVersion`, mobile support flag)

Output: a written report in chat plus `QA-REPORT.md` in the repo with findings graded Critical / Warning / Note, and I fix any Critical items found in the same pass.

## Technical notes

- Files touched: `src/guide.ts`, `main.ts` (command registration + `ScrollSheetModal`), `styles.css` if the sheet row needs spacing, `QA-REPORT.md`, version files.
- No behaviour change to autoscroll, FAB auto-hide, or hold-to-pause added in 1.1.8.
- New unit tests: guide checklist now includes quiz; sheet quiz toggle helper.
