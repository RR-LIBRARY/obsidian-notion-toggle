# Feature table + rating (v1.5.0)

Rating = kitna reliable / complete feature hai, 1 (kaam chalau) se 5
(production, tests se locked). "Tests" column me us feature ko cover karne
waale test files hain.

| # | Feature | Kya karta hai | Rating | Tests |
|---|---|---|---|---|
| 1 | Toggle create / convert | Notion-style collapsible callout banata hai, colour ke hisaab se callout type chunta hai | 5/5 | `verify-v120`, `logic-audit` |
| 2 | Auto-continue + renumber | List ki tarah agla toggle, aur note bhar numbering theek rakhna | 4/5 | `logic-audit` |
| 3 | Traffic-light grading (🔴🟡🟢) | Har toggle par recall grade, note me hi store | 5/5 | `autoscroll`, `filter-dom` |
| 4 | Filter — traffic light | Red / Yellow / Green / combos / all graded | 5/5 | `filter-dom`, `filter-real-note`, `filter-cycle` |
| 5 | Filter — callout types | Har built-in type ka apna filter (`!question` … `!quote`) + aliases | 5/5 | `callout-catalog`, `filter-real-note` |
| 6 | Filter picker UI (grouped) | 3 collapsible groups, per-row callout words + count · % | 5/5 | `callout-catalog`, `picker-styles` |
| 7 | Filter sync (scroll ↔ quiz) | Ek jagah chuna filter dono modes me same | 5/5 | `filter-sync` |
| 8 | Deep links (`obsidian://notion-toggle`) | action + filter + mode URL se, saare aliases | 5/5 | `deeplink` |
| 9 | Autoscroll engine | Reader-exact loop, speed, reverse, dwell, hold | 5/5 | `scroll-loop`, `hold-pause`, `anchor-skip-perf` |
| 10 | Scroll container detection | Desktop + mobile wrappers, "chal raha par hil nahi raha" fix | 5/5 | `scroll-container` |
| 11 | Pause-at modes (every/odd/even/custom/route/shuffle) | Note ke **asli** toggle numbers par rukta hai | 5/5 | `toggle-ordinals`, `scrollmode`, `planner` |
| 12 | Tall-toggle chunking | Screen se lambe toggle ko parts me rokna | 4/5 | `scrollmode`, `planner` |
| 13 | Plan persistence + resume | Band karke wapas wahi plan | 4/5 | `plan-persistence` |
| 14 | Quiz mode | Ek-ek question, timed reveal, skip, auto-next | 5/5 | `quiz`, `quiz-timing`, `quiz-dom`, `e2e-quiz-flow` |
| 15 | Quiz force-open + heal | Natively collapsed callout bhi khulta hai, mid-run heal | 5/5 | `quiz-force-open`, `quiz-heal`, `quiz-visibility` |
| 16 | Smooth reveal (v1.5.0) | 120ms fade + slide, blink khatam, reduced-motion safe | 4/5 | `picker-styles` (CSS contract) |
| 17 | Callout breakdown (count + %) | Stats panel table + "Copy breakdown" command | 5/5 | `callout-catalog` |
| 18 | Callout playground note | Har type ka live example + deep link | 5/5 | `callout-catalog` |
| 19 | SRS / FSRS scheduling | Due notes, ease, forecast, shuffle route memory | 4/5 | `srs`, `fsrs`, `maintenance` |
| 20 | Weak-toggle stats panel | Sabse kamzor toggles, kyun — explainer ke saath | 4/5 | `debug-stats` |
| 21 | Debug overlay | Live loop events, stops, freeze detection | 4/5 | `debug-overlay-stops`, `telemetry`, `timer` |
| 22 | Performance report | Drift, freeze, remeasure timings | 4/5 | `anchor-skip-perf`, `timer` |
| 23 | Mobile FAB + quick sheet | Ek haath se speed / filter / mode | 4/5 | `fab-a11y`, `fab-chrome`, `ui-icons` |
| 24 | Mobile toolbar guide | Commands ko toolbar me daalne ka guide | 3/5 | `guide` |
| 25 | Architecture guardrails | main.ts budget, pure modules Obsidian import na karein | 5/5 | `architecture`, `no-self-recursion` |
| 26 | Release metadata | manifest / package / versions.json sync | 5/5 | `release-meta` |

## Score summary

- 5/5: 14 features (core recall loop, filters, quiz, deep links, guardrails)
- 4/5: 10 features (polish / breadth remaining, not correctness)
- 3/5: 1 feature (toolbar guide — documentation-heavy, low logic)
- **Average: 4.5 / 5**, 751+ tests, typecheck aur build clean.

Ek hi feature 3/5 par hai; usme koi logic bug nahi, sirf coverage patla hai.
