# Audit sheet — v1.7.5

| Check | Result |
|---|---|
| Floating button hidden while Autoscroll sheet open (`scrollSheetOpen` counts as overlay) | PASS |
| Button returns on sheet close (`onClose` → `syncScrollFab`) | PASS (unchanged path) |
| Slider 0–100 → 1 s … 1 h, round trip stable, 5 s / 7 s reachable | PASS |
| Format 7s / 1m 30s / 45m / 1h | PASS |
| Chips 10s 20s 30s 60s 1h set + highlight + save + replan | PASS (happy-dom) |
| Disabled only when chunking off and advance = toggles | PASS |
| Old saved pause carried; <1 s → 1 s; >1 h → 1 h | PASS |
| Tall toggle first screen = max(hold, pause); continuation = pause | PASS |
| Old 0.25–30 s slider removed from sheet and settings | PASS |
| Full suite | 1122 pass / 0 fail |
| Typecheck / build | PASS |
| main.ts lines | 3494 (< 3500) |
| Timing inside a live run (real plugin) | Covered via `stopHoldMs` call-site unit; end-to-end timing to confirm on device |
| Real device | Pending — steps 8–9 in FEATURE-CHECK-1.7.5.md |
