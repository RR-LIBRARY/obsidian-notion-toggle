# Feature status — v1.5.5

**Verification rule:** Working means covered by a passing automated test, a deterministic source audit, or an explicitly named end-to-end fixture. Remaining means the capability is not broken; it still needs the validation gate listed below.

## Status summary

| Status | Count | Meaning |
|---|---:|---|
| Working | 36 | Implemented and verified in the current suite / audit |
| Remaining validation | 4 | Needs real-device, long-note, or accessibility proof |
| **Total tracked** | **40** | Full product surface |

## Working features

1. Source-truth filter counts in every picker (v1.5.5)
2. Smooth reveal *and* revert animation (v1.5.5)
3. Full-note render before a run (lazy-render fix, v1.5.4)
2. Source-truth toggle counts per filter (v1.5.4)
3. Mid-run plan healing for late-rendered toggles (v1.5.4)
4. Toggle create, wrap, convert, and native callout output
2. Auto-numbering and note-wide document-order ordinals
3. Auto-continue on Enter
4. Traffic-light grading: red / yellow / green
5. Granular filters for supported Obsidian callout types
6. Ungraded / other filter for non-colour toggles
7. Filter combinations and filter synchronisation
8. Expandable filter picker groups
9. Per-filter count and percentage breakdown
10. Odd / even / custom / route / shuffle pause modes
11. Stable scroll-container detection on desktop and mobile wrappers
12. Autoscroll speed, direction, hold, loop, and stop anchoring
13. Smooth toggle reveal and reduced-motion fallback
14. Automatic Reading View on autoscroll
15. Safe restoration of the user's original view mode
16. Auto-open / auto-close matched toggles
17. Hold-to-pause without consuming dwell time
18. Re-render healing during scroll and quiz
19. Quiz one-question-at-a-time flow
20. Per-question timers and reveal phase
21. Quiz force-open for natively collapsed callouts
22. Quiz filtering, deep links, and clean restoration
23. FSRS/SRS memory, shuffle deck, due forecast, and auto-grade
24. Mobile FAB, quick sheet, touch targets, and accessible labels
25. Debug overlay and performance telemetry
26. Callout breakdown stats and copy action
27. Playground note for supported callout types
28. Command palette / hotkey / settings integration
29. Release metadata and architecture guardrails
30. Screen-by-screen reading with viewport-aware stops and overlap
31. Tall-answer chunking and top anchoring on mobile and desktop

## Remaining validation gates

| Gate | Why it remains | Pass condition |
|---|---|---|
| Obsidian mobile device run | Browser fixtures cannot prove every mobile wrapper and safe-area quirk | 20-minute run with filter picker, start/stop, and rotation |
| 500+ toggle benchmark | The normal fixture proves correctness, not large-note latency | No skipped stops, bounded frame work, no silent freeze |
| Accessibility review | Automated labels do not replace assistive-technology review | Keyboard + screen reader + reduced-motion pass |
| Published release smoke test | Source build is not the same as BRAT installation | Install v1.5.1 assets in a clean vault and run quiz + autoscroll |

## Evidence baseline

- Full suite target: `bun test`
- Type safety: `bun run typecheck`
- Release bundle: `bun run build`
- Real-note fixture: `zoology_Recall_1.md` with 14 red, 37 yellow, 20 green, and 2 ungraded toggles
- Required final proof: test output, typecheck output, build output, release asset list, and the smoke-test result
