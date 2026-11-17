# Question selection verification — 1.9.34 candidate

- 1,585 Bun tests pass across 112 files, zero failures.
- TS-only check passes using tsgo with moduleResolution bundler and module esnext overrides (existing node10 resolver is removed in tsgo).
- esbuild plus distribution generation pass.
- Real Obsidian 1.13.7, actual plugin, isolated vault containing labelled Q3–Q60 and nested Answer toggles:
  - typed 35 starts Q35, followed by Q36.
  - typed 35,40,48 visits Q35, Q40, Q48 in that order, toggles and screens advance.
  - Odd from35 visits Q35,Q37; Even from35 visits Q36,Q38.
  - phone-sized 393x629 layout: actual input persists 35,40,48; Even selects Q40,Q48; invalid 35, marks input invalid without changing saved selection.
  - real closed arrow during countdown, Q35 opens after reveal; pause preserves closed state and resume completes reveal; no captured renderer page errors.
- Shared quote-aware source scanner excludes plain callouts and fenced examples. Explicit visible Q labels win over positional fallback; unknown/ambiguous source identities are not guessed from DOM window.
- The user's exact note and physical Android phone are unavailable: do not claim their exact 35→33 symptom was reproduced there.
- No release/tag published; candidate awaiting approval after CI.
