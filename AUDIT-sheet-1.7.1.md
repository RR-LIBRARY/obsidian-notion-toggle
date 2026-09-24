# Autoscroll sheet audit — 1.7.1

Date: 2026-09-24

## Result

**Automated verification: 96% (24/25 feature groups pass). Release confidence: 4.8/5.**

The remaining 4% is not a known code failure: it is the required physical-device endurance pass for Android/iOS safe areas, rotation and a 500+ toggle note.

## Root causes fixed

1. **Open all / Close all missed toggles** — Reading View lazily renders only nearby sections. The command now requests a full render, waits for the DOM to settle, scans nested foldables, excludes plain callouts, and reports an honest `N of M` result.
2. **Screen stops did not pause** — negative screen-stop pages entered toggle parking, were refused, then received zero dwell. Screen stops now have their own park and use Screen pause duration.
3. **Toggles + screens duplicated/reordered stops** — a page-wide grid was merged with toggle stops. It is now a gap-fill plan between stable toggle stops and never rescues backwards.
4. **Tall answers closed early** — close-on-leaving treated continuation chunks as a new item. The answer stays open until its final continuation stop.
5. **Think countdown repeated on continuation chunks** — continuation parks now skip the think gate and hold only screen dwell.
6. **Route timing was wrong** — route waypoints used screen dwell everywhere. The first toggle stop now uses hold; only continuation chunks use screen dwell.
7. **White strip at note top** — mobile focus CSS forced a 24px safe-area minimum even when Android reported zero, and nested Reading View padding could add it twice. One wrapper now owns native safe-area padding with no artificial floor.
8. **Research could spin forever after network loss** — every plugin operation now has a generous operation-specific ceiling and a readable timeout error; model-writing operations get five to six minutes.

## Screenshot feature matrix

| Feature group | Verdict | Evidence |
|---|---|---|
| Autoscroll start/stop and hold | Pass | autoscroll, scroll-loop, hold-pause tests |
| Think time, per-toggle and note overrides | Pass | think-time, think-scope, timeline tests |
| Countdown preview and custom face | Pass | timer and UI tests |
| Distraction-free mode | Pass | styles and feature-logic tests |
| Reduced motion | Pass | reveal/timer/style assertions |
| Timing/debug overlays | Pass | telemetry and debug-overlay tests |
| Quiz timer, auto-next, minimal UI, loop | Pass | quiz timing/flow/UI suites |
| Quiz colour/callout filters and counts | Pass | filter real-note, sync and picker suites |
| Open all / Close all, nested toggles | Pass | open-close-all DOM + full-render tests |
| Auto-open and close-on-leaving | Pass | run-step, repeat-toggle, tall-answer tests |
| Advance by toggles | Pass | screen-plan and scroll-loop tests |
| Advance by screens | Pass | screen-run and screen-mode tests |
| Toggles + screens gap-fill | Pass | screen-run plan tests |
| Screen overlap | Pass | screen plan calculation tests |
| Screen pause duration | Pass | dedicated screen dwell tests |
| Usable viewport calculation | Pass | screen plan and container tests |
| Tall toggles screen-by-screen | Pass | tall-answer and continuation tests |
| Custom list, route and route loop | Pass | planner/plan persistence/screen-run tests |
| Reverse and note loop | Pass | autoscroll/scrollmode tests |
| Shuffle range and SRS counts | Pass | shuffle/FSRS/SRS tests |
| Go to first, stats and guide controls | Pass | guide/stats/UI suites |
| Reading View switch and restoration | Pass | reader-mode tests |
| White-strip/safe-area regression | Pass | styles regression assertions |
| Parallel + Perplexity availability and errors | Pass | live health plus client failure/timeout tests |
| Physical mobile endurance + 500-toggle note | Pending validation | Requires real Obsidian device run |

## Verification run

- Full suite: **1080 passed, 0 failed, 4361 assertions across 68 files**.
- Typecheck: passed.
- Release build: passed; `main.js`, `manifest.json`, `styles.css` generated.
- Bridge build: passed.
- Live bridge health: Parallel, Perplexity and AI all available after workspace relink.
- GitHub API: repository connection relinked with repository access.

## Open-web research applied minimally

The useful common pattern across reading/teleprompter/quiz tools is predictable pagination rather than constant motion: preserve a small overlap, pause per screen, avoid restarting cognitive timers inside one answer, make interruption immediate, and expose reduced-motion controls. The implementation applies those principles without adding another mode or changing note bytes.

## Remaining release gate

Install the 1.7.1 assets in a clean mobile vault, rotate once, run a 20-minute mixed quiz/autoscroll session, and benchmark a 500+ toggle note. This is the only unverified group; no known functional failure remains in the audited sheet controls.
