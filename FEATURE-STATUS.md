# Feature status — v1.7.0

**Verification rule:** Working means covered by a passing automated test, a deterministic source audit, or an explicitly named end-to-end fixture. Remaining means the capability is not broken; it still needs the validation gate listed below.

## Status summary

| Status | Count | Meaning |
|---|---:|---|
| Working | 50 | Implemented and verified in the current suite / audit |
| Remaining validation | 5 | Needs real-device, long-note, or accessibility proof |
| **Total tracked** | **55** | Full product surface |

## Working features

1. Source-truth filter counts in every picker (v1.5.5)
2. Smooth reveal *and* revert animation (v1.5.5)
3. Full-note render before a run (lazy-render fix, v1.5.4)
4. Mid-run plan healing for late-rendered toggles (v1.5.4)
5. Toggle create, wrap, convert, and native callout output
6. Auto-numbering and note-wide document-order ordinals
7. Auto-continue on Enter
8. Traffic-light grading: red / yellow / green
9. Granular filters for supported Obsidian callout types
10. Ungraded / other filter for non-colour toggles
11. Filter combinations and filter synchronisation
12. Expandable filter picker groups
13. Per-filter count and percentage breakdown
14. Odd / even / custom / route / shuffle pause modes
15. Stable scroll-container detection on desktop and mobile wrappers
16. Autoscroll speed, direction, hold, loop, and stop anchoring
17. Smooth toggle reveal and reduced-motion fallback
18. Automatic Reading View on autoscroll
19. Safe restoration of the user's original view mode
20. Auto-open / auto-close matched toggles
21. Hold-to-pause without consuming dwell time
22. Re-render healing during scroll and quiz
23. Quiz one-question-at-a-time flow
24. Per-question timers and reveal phase
25. Quiz force-open for natively collapsed callouts
26. Quiz filtering, deep links, and clean restoration
27. FSRS/SRS memory, shuffle deck, due forecast, and auto-grade
28. Mobile FAB, quick sheet, touch targets, and accessible labels
29. Debug overlay and performance telemetry
30. Callout breakdown stats and copy action
31. Playground note for supported callout types
32. Command palette / hotkey / settings integration
33. Release metadata and architecture guardrails
34. Screen-by-screen reading with viewport-aware stops and overlap
35. Tall-answer chunking and top anchoring on mobile and desktop
36. Think time before the answer: countdown badge, tap-to-reveal (v1.5.9)
37. Custom countdown face: emoji, png / gif / svg, or URL (v1.6.0)
38. Distraction-free run with safe-area padding and theme-overridable tokens (v1.6.2)
39. Per-note think-time override from frontmatter (v1.6.1)
40. Reduced-motion mode for countdown and reveal (v1.6.1)
41. Timing debug overlay: open / countdown / tick / reveal stamps (v1.6.1)
42. Colour-filter hard guard and refused-park skip, so a stop that vanished never freezes the run (v1.6.2)
43. Research side panel with composer, results history and background-run list (v1.7.0)
44. Ask the web: cited answers with numbered markers and a Sources list (v1.7.0)
45. Fact-check selection as a verdict-coloured callout with correction (v1.7.0)
46. Web search, quick search and read-link into source toggles (v1.7.0)
47. Recall toggles generated from a topic, link, pasted text or the whole note (v1.7.0)
48. Background deep research with polling backoff, insert notice and restart-safe run memory (v1.7.0)
49. Web research settings with URL normalisation, masked key and connection test (v1.7.0)
50. On-device research cache and research-folder architecture guardrails (v1.7.0)

## Remaining validation gates

| Gate | Why it remains | Pass condition |
|---|---|---|
| Obsidian mobile device run | Browser fixtures cannot prove every mobile wrapper and safe-area quirk | 20-minute run with filter picker, start/stop, and rotation |
| 500+ toggle benchmark | The normal fixture proves correctness, not large-note latency | No skipped stops, bounded frame work, no silent freeze |
| Accessibility review | Automated labels do not replace assistive-technology review | Keyboard + screen reader + reduced-motion pass |
| Published release smoke test | Source build is not the same as BRAT installation | Install v1.7.0 assets in a clean vault and run quiz + autoscroll |
| Live bridge end-to-end | Plugin tests use a scripted bridge; the published bridge, a real key and live providers are only proven by hand | Dashboard key → Settings → Test, then Ask / Fact-check / Deep research insert into a real note |

## Evidence baseline

- Full suite target: `bun test`
- Type safety: `bun run typecheck`
- Release bundle: `bun run build`
- Real-note fixture: `zoology_Recall_1.md` with 14 red, 37 yellow, 20 green, and 2 ungraded toggles
- Required final proof: test output, typecheck output, build output, release asset list, and the smoke-test result
