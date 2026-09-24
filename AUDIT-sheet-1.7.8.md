# Audit — v1.7.8: faded yellow screen on swipe during autoscroll

## 1. Video analysis (screen-20260924-191353.mp4, 12 s, 720×1600)
| Time | What happens | Measured note background (RGB) |
|---|---|---|
| 0.0–2.1 s | Normal note, autoscroll run (header hidden = focus run), floating button visible | 255,252,239 |
| 2.4–2.7 s | Finger slides sideways → whole note fades in ~300 ms | 245,241,224 → 236,230,209 |
| 2.7–6.3 s | Note stays washed-out yellow; text lighter, background darker; no sidebar visible | 236,230,209 |
| 6.6–7.2 s | Tap → fade clears | back to 255,252,239 |
| 7.5–12 s | Second slide → same fade again | 236,230,209 |

Key signal: the Android clock/status icons did **not** dim (darkest pixel 80 in every frame), only Obsidian content did → not the phone's eye-comfort / night light, it is inside Obsidian.

## 2. Root cause
Sideways swipe = Obsidian mobile sidebar (drawer) gesture. The focus run hides `.workspace-drawer` with `display:none`, but Obsidian still fades in `.workspace-drawer-backdrop` (dim layer). Result: only the dim layer shows, no sidebar, and it closes only on the next tap (which also "eats" that tap).

## 3. Fix
- `src/drawer-guard.ts` (pure, no obsidian import): while a focus run is live on mobile, watches the page and closes any open left/right drawer at once via `workspace.leftSplit/rightSplit.collapse()` (only if `!collapsed`). Stops with the run and on unload.
- `styles.css`: `body.ntt-focus-run .workspace-drawer-backdrop { display:none; opacity:0; pointer-events:none }` — no fade even for one frame, taps go to the note.
- Sidebar swipe works normally again as soon as autoscroll stops. With "Focus chrome" off nothing changes.

## 4. Checks
| Check | Result |
|---|---|
| `tests/drawer-guard.test.ts` (left/right swipe, 5 repeated swipes, open-at-start, after stop, error safety, CSS + wiring) | 7/7 pass |
| Full suite | 1170/1170 pass |
| Typecheck / build | clean / green |
| main.ts lines | 3499 (< 3500) |
| src never imports "obsidian" | yes |

## 5. Not verifiable here (please do on phone, BRAT → 1.7.8)
1. Start autoscroll (Focus chrome on) → slide sideways from left edge and middle, 5 times → note must NOT turn yellow; autoscroll keeps going.
2. Same from right edge.
3. Stop autoscroll → left-edge swipe must open the sidebar normally.
4. Turn Focus chrome off → sidebar swipe behaves as stock Obsidian.
The backdrop class name `.workspace-drawer-backdrop` comes from Obsidian's mobile DOM; if a future Obsidian renames it, the guard still closes the drawer (it reads the split API, not the class).
