# Feature check — Notion Toggle v1.7.5

Date: 2026-09-25. Suite: **1122 tests, 0 fail**, typecheck green, release build green (`main.js` = `dist/main.js`).

> Honest scope: every check below runs in the sandbox (bun + happy-dom, a real `NotionTogglePlugin` instance where noted). A real Android / iPhone run cannot be done from here — the "Phone check" column is for you to tick on the device.

## Result per feature area

| # | Area | What was checked | Tests | Sandbox | Phone check |
|---|---|---|---|---|---|
| 1 | Autoscroll engine | loop, speed, reverse, dwell, hold-pause, tall answers, anchor skip, scroller detection | 108 | PASS | [ ] |
| 2 | Autoscroll focus run (1.7.3 strip fix) | no plugin top gap, bottom gesture gap kept, body classes on start/stop/resume, reduced motion | 26 | PASS | [ ] no strip under status bar |
| 3 | Colour filter (Red / Yellow / Green) | picker, cycle, real note, filter guard (non-matching answers stay closed), scroll ↔ quiz sync | 100 | PASS | [ ] only chosen colour opens |
| 4 | Open all / Close all | whole note (lazy render sweep), sticky per note, one-shot during run / quiz, honest "X of Y" notice | 34 | PASS | [ ] 71/71 on long note |
| 5 | Quiz mode | timed reveal, skip, force-open, heal, dock UI, badge, e2e flow | 103 | PASS | [ ] |
| 6 | Screen mode / run plan | screen plan, screen run, resume | 49 | PASS | [ ] |
| 7 | Think time | think gate, scope, settings | 41 | PASS | [ ] |
| 8 | SRS / FSRS | due notes, ease, forecast | 28 | PASS | — |
| 9 | Timer | widget, drift | 36 | PASS | — |
| 10 | Research panel | composer, runs, citations, cache, settings | 99 | PASS | — |
| 11 | Deep links | `obsidian://notion-toggle?...&filter=red` | 6 | PASS | [ ] |
| 12 | Reader mode | view-mode shell | 11 | PASS | — |
| 13 | Callouts / numbering | breakdown, ordinals, repeat toggle | 34 | PASS | — |
| 14 | Mobile FAB + sheet + icons | a11y, chrome, picker styles | 34 | PASS | [ ] |
| 15 | **Top padding diagnostic (new)** | owner attribution, snippet / theme blame, plugin-leftover alarm, report text | 7 | PASS | [ ] run it once |
| 17 | **Floating button hidden under the sheet (new)** | button gone while Autoscroll sheet open, back on close | 2 | PASS | [ ] |
| 18 | **Pause on each screen (new)** | 1s–1h slider, chips, value, first screen of tall answer waits, old value carried | 10 | PASS | [ ] pick 20s, run a long answer |
| 16 | Settings / persistence / telemetry / debug | migrate, plan persistence, overlay | 47 | PASS | — |
| — | Architecture guards | main.ts 3495 < 3500, pure `src/` without Obsidian, no src → main imports | incl. | PASS | — |

## Phone test script (Android + iPhone), ~5 minutes

1. BRAT → update to **1.7.5**, restart Obsidian.
2. Open a long note (50+ answers). Start **autoscroll**. Look at the top: nothing blank between the status bar and the first line.
3. Command palette → **Diagnose top padding (theme / snippets)** while the run is on. Expect "Result: OK". If it shows "extra top gap", tap **Copy report** and send it.
4. **Filter:** pick Red only → start autoscroll → only red answers open. Repeat for Yellow, Green, and Red+Yellow.
5. **Open all** (not in a run) → notice "Opened N of N answers"; scroll down — lower answers are already open. **Close all** → same, closed.
6. Start autoscroll, tap Open all mid-run → the screen opens once, but the run can still close answers behind you (no reopening).
7. Switch note → Open all state is forgotten.
8. Long-press the floating button → sheet opens and the button is **gone**; close the sheet → it is back.
9. In the sheet under "Tall toggles screen-by-screen" tap **20s** → run a long answer: every screen of it stays 20s.

## Known limits
- Phone-only behaviour (Android WebView safe-area, iOS) is not reproducible in the sandbox — steps 2–3 confirm it.
- A theme/snippet gap is reported, never auto-removed: the diagnostic names the rule and the file to switch off.
