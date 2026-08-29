# Notion Toggle — QA report (v1.2.0)

Scope: single floating button + deep verification of autoscroll, toggle types,
quiz timing and the auto open/close behaviour.

## Automated checks

| Check | Result |
| --- | --- |
| Unit tests (`bun test`) | **226 pass / 0 fail**, 12 files, 565 assertions |
| Typecheck | clean |
| Production bundle | `main.js` 202.3 kb, builds clean, `dist/` emitted |
| Versions | `manifest.json` / `package.json` / `versions.json` all `1.2.0` |

## 1. Floating UI

| Item | Result |
| --- | --- |
| Exactly one floating button on screen | PASS — the `↓` direction chip is removed; only the round ▶/⏸ button remains |
| Tap = start / pause | PASS |
| Long-press (500 ms) = the sheet with every other control | PASS — Autoscroll, Quiz, **Direction**, Speed, Dwell, Pause-at all live there |
| Direction still reachable | PASS — new "Direction" row in the sheet, plus the existing `Ctrl/Cmd+Shift+R` command |
| Auto-hide after 3 s while running, wake on tap/scroll, pinned when paused | PASS |
| Hold anywhere to freeze, release to resume at the same speed | PASS (3 unit tests on the hold logic) |

## 2. Toggle type coverage

| Item | Result |
| --- | --- |
| `> [!note]-`, `> [!question]-`, `> [!info]-`, `!tip`, `!warning`, `!quote`, custom types | PASS — detection is type-agnostic (`.callout, details, [data-callout]`) |
| Raw `<details>` blocks | PASS |
| Nested toggles counted once (outermost wins) | PASS |
| Colour filter keys only off `recall-red/yellow/green`, never the callout type | PASS |
| Reverse visits the same stops in opposite order | PASS |

## 3. Plain-text notes — **bug found and fixed**

Before: a note with no toggles refused to start ("Is note me koi toggle nahi
mila") — autoscroll simply did not run.
Now: the run starts as a **plain continuous scroll** (no stops, no dwell) with
an informational notice. The "no toggles match" error is now only shown when
toggles genuinely exist but the filter or pause-at mode excludes all of them.

## 4. Quiz mode

| Item | Result |
| --- | --- |
| Answer auto-releases after the question duration | PASS — fires exactly on time, not a tick early |
| Per-question overrides (`⏱30`, `[5s]`, `(45s)`, `@20s`) | PASS |
| Timer resets to the *next* question's own duration | PASS |
| Pause freezes the countdown; resume continues from the same point | PASS |
| Manual reveal / skip keep the phase machine consistent (double reveal is a no-op) | PASS |
| `Auto next = off` stops after the reveal instead of racing on | PASS |
| Loop mode restarts from question 1 | PASS |
| Toggles collapse at the start (active recall) and open at reveal | PASS |
| Late render on mobile | PASS — 700 ms one-shot re-scan before reporting "no toggles" |
| Quiz reachable without the toolbar | PASS — sheet row + `list-checks` toolbar command |

## 5. Auto open / close — **bug found and fixed**

Before: a quiz collapsed every toggle and, on stop, left them collapsed — the
note was unreadable afterwards and the reader had to reopen each one.
Now: the open/closed state of every toggle is recorded before the quiz starts
and **restored exactly** when the quiz stops, so the document reads normally
again. Autoscroll's own `scrollAutoClose` behaviour is unchanged.

## 6. Lifecycle

`onunload()` clears the recall timer, stops autoscroll (cancelling the rAF),
stops the quiz (clearing its interval), destroys the FAB (its own timers and
document listeners) and detaches hold-to-pause. No leaks with the new
single-button FAB.

## Findings summary

- **Critical:** none.
- **Fixed in 1.2.0:** plain-text notes could not autoscroll; quiz left the note
  fully collapsed after stopping; the second floating chip is gone.
- **Note:** the classic control bar stays off by default — Settings → "Classic
  control bar" restores the old scrubber if you want it back.
