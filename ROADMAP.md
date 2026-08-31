# Notion Toggle — v1.5.1 founder roadmap

## Product principle

Autoscroll should remove friction from recall, not take control away from the reader. The highest-performance version is predictable, interruptible, measurable, and conservative with a user's note state.

## What v1.5.1 ships

- Reading View is enabled automatically when autoscroll starts (default on).
- The exact original view mode is restored when the run stops (default on).
- Already-open Reading View is left untouched.
- Filter pickers cover traffic-light grades and the supported Obsidian callout vocabulary, with grouped expandable rows and live count / percentage.
- Note-wide ordinals make odd/even/custom modes stable after filtering.
- Quiz runs one question at a time, force-open collapsed callouts, heal after a render, and restore the pre-run fold state.
- Smooth reveal avoids the old blink and respects reduced-motion preferences.
- Stats, deep links, shuffle/SRS, mobile controls, and debug telemetry remain available.

## Founder review: plus and minus

| Decision | Plus | Trade-off / guardrail |
|---|---|---|
| Auto Reading View | Stable rendered DOM; fewer skipped or half-rendered stops | Source-mode editing is temporarily unavailable; restore the original mode on stop |
| Auto-open / auto-close | Keeps the reader focused on one recall item | Can feel interruptive; allow quiet mode, manual stop, and per-setting opt-out |
| Granular callout filters | Precise revision decks for mixed notes | More picker density; use expandable groups and counts instead of a flat wall of options |
| Note-wide odd/even ordinals | Matches numbers the reader sees in the note | Missing or unnumbered legacy toggles still need a clear document-order fallback |
| Smooth reveal | Less visual friction and fewer accidental fold-state writes | Animation must stay short and be disabled for reduced motion |
| SRS / auto-grade | Turns a scroll session into a repeatable revision loop | Heuristics are not self-knowledge; keep manual grading and transparent controls |

## Performance target

1. Resolve the active Markdown leaf once per run.
2. Measure stops only when the container changes or the viewport needs re-anchoring.
3. Keep each animation frame to bounded DOM work: scroll, current-stop lookup, and one state transition.
4. Heal references after Obsidian re-renders instead of trusting stale elements.
5. Stop clearly when there is no measurable movement; never spin silently.
6. Preserve user's view mode, fold state, filter, and note bytes unless the user explicitly asks for a change.

## Next validation gates

- Real-device Obsidian mobile pass: source → autoscroll → stop, safe-area controls, and long filter picker.
- Long-note benchmark: 500+ toggles, mixed nesting, all callout types, and a re-render during a run.
- Accessibility pass: keyboard, screen reader labels, reduced motion, and touch targets.
- Release gate: full test suite, typecheck, build, release assets, and a clean GitHub tag.

## Explicit non-goals

- Do not edit note content merely to start autoscroll.
- Do not silently change a user's filter or quiz deck.
- Do not require a network connection for the core scroll loop.
- Do not treat a rating as proof without a named test or reproducible scenario.
