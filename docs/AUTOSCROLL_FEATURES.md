# Autoscroll — full feature list & test report (1.9.15)

Open: tap the floating layers button (long-press / Shift+Enter) → **Autoscroll — quick controls**.

## 1. Start / stop
| # | Feature | What it does | Tested |
|---|---|---|---|
| 1 | Autoscroll switch | ON = scroll this note; press & hold the screen to pause while held | ✅ |
| 2 | Floating button | Tap start/pause, chevron shows direction, accessible label | ✅ |

## 2. Think time (answer hidden first)
| 3 | Think time before the answer | Toggle opens with only the question; answer after the think window | ✅ |
| 4 | Think seconds | Slider + box; per-toggle `🤔20s`, per-note `think: 20s` | ✅ |
| 5 | Preview the countdown | Plays the think window with your countdown face | ✅ |
| 6 | Countdown icon | Emoji/text or .png/.gif/.svg/.webp | ✅ |
| 7 | Distraction-free mode | Hides status bar, header and ribbon during a run | ✅ |
| 8 | Reduced motion | Instant countdown/reveal, no fades | ✅ |
| 9 | Timing debug overlay | Shows open / countdown / reveal timestamps | ✅ |

## 3. Quiz
| 10 | Quiz (timed question run) | Timer per toggle, auto reveal, auto next | ✅ |
| 11 | Time per question | 1 s–12 h; `⏱30` / `⏱15m` / `⏱2h` in title overrides | ✅ |
| 12 | Answer time | How long the answer stays open | ✅ |
| 13 | Auto next | Next question by itself | ✅ |
| 14 | Kaunse toggle | All or by colour (🔴🟡🟢…) | ✅ |
| 15 | Minimal UI | Small dock only | ✅ |
| 16 | Loop | Restart from question 1 | ✅ |
| 17 | Quiz dock | Pause/resume, reveal now, next, stop | ✅ (bug fixed) |

## 4. Answers
| 18 | Open all / Close all | One tap for every answer toggle | ✅ |
| 19 | Open with auto-quiz | Answers stay open when quiz starts | ✅ |

## 5. Scrolling
| 20 | Direction | Forward (down) / Reverse (up) | ✅ |
| 21 | Speed | Multiplier picker | ✅ |
| 22 | Pause for | Hold time at each stop | ✅ |
| 23 | Pause at | Every toggle / headings / modes | ✅ |
| 24 | Colour filter | Only stop at chosen colours | ✅ |
| 25 | Loop the note | Restart from top at the end | ✅ |
| 26 | Open toggles automatically | Closed toggle opens on arrival | ✅ |
| 27 | Close them when leaving | Closes again when moving on (waits for tall answers) | ✅ |

## 6. Tall answers (screen by screen)
| 28 | Tall toggles screen-by-screen | Long answers read one screen at a time | ✅ |
| 29 | Pause on each screen | 1 s–1 h, quick 10/20/30/60 s, 1 h | ✅ |
| 30 | Advance by | Toggles, screens, or both | ✅ |
| 31 | Screen calculation (live) | Shows px, overlap, step, screens | ✅ |
| 32 | Screen overlap | Part of the previous screen stays visible | ✅ |
| 33 | Usable viewport | % of screen height used per step | ✅ |
| 34 | Debug overlay | Draws stop lines | ✅ |

## 7. Other
| 35 | Quiet mode | No popups | ✅ |
| 36 | Go to first / Stats / Toolbar guide | Extra buttons under "More" | ✅ |
| 37 | Drawer guard | Swipe-open drawer closes during a run | ✅ |

## Polish in 1.9.15
- Removed the duplicate **"Reverse direction ↑"** switch (same as "Direction") — one switch, no confusion.
- Added one-line help to **Loop the note**, **Open toggles automatically**, **Close them when leaving** (they had none).
- **Bug fix:** after dragging a toggle, the next tap on the quiz dock / autoscroll buttons within 0.4 s could be swallowed. Now only a click back inside the note is ignored.

## Test result
- 1,474 automated tests, 95 files: **all pass** (the long-standing quiz-dock failure is fixed).
- Not tested: real Obsidian on a phone; visual look of the sheet on device.
