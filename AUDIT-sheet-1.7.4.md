# Audit sheet — v1.7.4 (top padding diagnostic)

| Check | Result |
|---|---|
| New command `diagnose-top-padding` registered from `src/padding-diagnose-view.ts` | PASS (present in `main.js`) |
| Pure logic `src/padding-diagnose.ts` has no Obsidian / DOM imports | PASS (architecture test) |
| View shell declared in `OBSIDIAN_SHELLS` | PASS |
| Obsidian inset on `body.is-mobile` counted as expected, not extra | PASS |
| Body padding that does not equal the inset → flagged | PASS |
| Snippet rule → owner "Theme / snippet", snippet file named in "Try this" | PASS |
| Theme with unexplained gap → theme named | PASS |
| Leftover `ntt-` rule → reported as plugin bug | PASS |
| `px()` / declaration parsing (`padding-bottom` ignored) | PASS |
| Full suite | 1110 pass / 0 fail |
| Typecheck (`tsc --noEmit`) | PASS |
| Build (`main.js` == `dist/main.js`) | PASS |
| main.ts lines | 3495 (< 3500) |
| Real device (Android / iOS) | Pending — user runs `FEATURE-CHECK-1.7.4.md` phone script |
