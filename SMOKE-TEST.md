# Autoscroll smoke test — real Obsidian (v1.1.3)

Install: copy `main.js`, `manifest.json`, `styles.css` into
`<vault>/.obsidian/plugins/obsidian-notion-toggle/`, then Settings → Community
plugins → reload → enable. Open a note in **Reading** or **Live Preview** with
at least 12 toggles, a few graded 🔴/🟡/🟢, and one very long answer.

Run each row and tick it. Anything unticked blocks the release.

| # | Step | Expected |
|---|---|---|
| 1 | Command `Autoscroll (start / stop)` | Floating bar appears, scrolling starts, notice names filter + mode |
| 2 | Bar `−` / `+` | Speed label steps through the multipliers; motion visibly changes |
| 3 | Speed presets → `0.02x` | Page still creeps (sub-pixel `translate3d`), never frozen |
| 4 | Bar `↑` reverse | Direction flips and it pauses again on stops it already used going down |
| 5 | Colour filter → Red + Yellow | Green toggles are skipped; progress denominator shrinks |
| 6 | Pause at → `Every page`, Pause for → `10s` | Stops on each toggle, opens it, holds ~10s, closes, moves on |
| 7 | Pause at → `Odd` / `Even` | Only odd / even numbered toggles get a stop |
| 8 | Pause at → `Route`, pick 6, 3, 8 | Travels down → up → down; "Route finished" notice at the end |
| 9 | Loop the route ON, rerun route | Restarts from waypoint 1 instead of stopping |
| 10 | Pause at → `Shuffle` | Order is not 1,2,3; weak toggles come first |
| 11 | Linger on one shuffle stop, skip another quickly | `Autoscroll: revision stats` shows the lingered one as weaker |
| 12 | Tall toggles screen-by-screen ON, long answer | Read one screenful at a time before the next toggle |
| 13 | Debug overlay ON while running | Top-right read-out updates: pos/frac, dir, leg or stop index, dwellKey, event, grade |
| 14 | Scroll manually mid-run | Loop re-seeds at your position instead of yanking back |
| 15 | Switch note mid-run | Route/dwell state resets; per-note speed / direction / hold are restored |
| 16 | Bar `✕`, then check the note | Bar and overlay gone, transform cleaned up, `scroll-behavior` restored, no stuck open toggle |
| 17 | Mobile (Obsidian iOS/Android) | Bar sits above the safe area, all buttons ≥44px, overlay readable |
| 18 | Reduced motion enabled | No transform smoothing; whole-pixel scrolling only |

Release gate (all green before tagging):

```
bun test         # 197 pass
bun run typecheck
bun run build    # emits main.js
node --check main.js
```
