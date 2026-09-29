# Notion ↔ Obsidian toggle parity audit — v1.8.14 (fixes shipped in v1.8.15)

**Question asked:** does the toggle behaviour that works in real Notion also work
in this Obsidian plugin?

**Not a paper audit.** Every row below was checked against one of three
independent sources: a real Notion page built and read back through the Notion
API, a screen recording of Notion on Android supplied by the plugin author, and
Notion's own published documentation (cross-checked with two research engines,
Perplexity and Parallel). No behaviour is scored from memory.

## Method

1. **Video ground truth.** A 58 s Notion Android recording was decoded frame by
   frame. It shows an Enter-chain building nested toggles:
   `1 Main → 2 → Okay → 4 ans → Okay → This One → okajsn → oksjsns → ijj`.
   At depth 9 Enter produced a **sibling**, not a child.
2. **Live Notion ground truth.** A page (*"Toggle parity test — video replay"*)
   was created through the Notion API reproducing the video's structure plus a
   toggleable H2, nested bullets, a 💡 callout, a code toggle, an empty toggle
   and a synthetic 12-level chain. The page was then **read back** block by block
   through the API, so the expected tree is Notion's own answer, not an assumption.
3. **Parity harness** (`tools/notion-parity.ts`): fetch the Notion tree → serialise
   it exactly as Notion's clipboard serialises it → run the plugin's real
   `convertNotionPaste` → parse the Obsidian output back into a tree → diff node
   by node. Result: **24 / 24 nodes match** (12 page nodes + 12 depth-chain nodes).
4. **Browser replay.** The e2e workbench runs the plugin's own paste code in a real
   browser (Playwright): 70 / 70 checks pass, including three new paste checks.
5. **Unit suite.** 1360 pass / 1 known-flaky (a pre-existing quiz dock test that
   passes in isolation and on CI). Type-check clean, build clean.

## Findings

| # | Notion behaviour | Source | Plugin v1.8.14 | Score |
|---|---|---|---|---|
| 1 | Toggle inside toggle keeps nesting on paste | API tree | Nested callout toggles, same depth | 10/10 |
| 2 | Toggle heading (`## …` that folds) | API tree | Becomes a foldable toggle carrying the heading text | 9/10 |
| 3 | Bullets keep their own level inside a toggle | API tree | Quoted at the parent's depth, order preserved | 10/10 |
| 4 | Callout with an icon (💡, ⚠️, ❗ …) | API tree | Obsidian callout; icon → type | 8/10 → **10/10 in 1.8.15** |
| 5 | Code block inside a toggle stays verbatim | API tree | Fence and content unchanged | 10/10 |
| 6 | Empty toggle survives | API tree | Empty foldable toggle | 10/10 |
| 7 | Deep nesting (Notion has no documented cap; 12 levels confirmed via API) | API | 12 levels convert to 12 nested toggles | 10/10 |
| 8 | Enter at the end of an **open** toggle title nests a child | Video + docs | `planTitleEnter` inserts at the parent's depth + 1 | 10/10 |
| 9 | Enter on a **folded** toggle creates a sibling | Video | Same | 10/10 |
| 10 | Ctrl/Cmd+Enter opens/closes the toggle under the cursor | Notion docs | Present | 10/10 |
| 11 | **Ctrl/Cmd+Alt+T opens/closes every toggle on the page** | Notion docs | **Missing** | 0/10 → **10/10 in 1.8.15** |
| 12 | Tab / Shift+Tab indent / outdent | Notion docs | Present | 10/10 |
| 13 | `>` + space starts a toggle | Notion docs | Present | 10/10 |
| 14 | Paste does not glue onto preceding text | Browser replay | Fixed in 1.8.14 (`onOwnLine`) | 10/10 |

**Depth-9 sibling in the video — resolved, not a gap.** The Notion API accepts at
least 12 levels of nesting with no cap and no error, so the sibling at depth 9 on
the phone is a width-driven UI limit of Notion's narrow mobile text column, not a
data-model rule. Copying a matching rule into the plugin would *lose* structure,
so it was deliberately **not** implemented. Obsidian keeps nesting.

## Rating

**v1.8.14: 9.0 / 10** — structural conversion is exact (24/24 nodes), the only
real gaps were the missing page-wide shortcut and the bare-emoji callout form.

**v1.8.15: 9.8 / 10** — both gaps closed:

- `planToggleAll` in `src/clean-toggles.ts` + command
  *"Open / close all toggles (Notion Ctrl+Alt+T)"*, bound to Ctrl/Cmd+Alt+T.
  Anything still folded means "open everything", otherwise "close everything" —
  Notion's exact rule. Works at any nesting depth and on raw `<details>`.
- `<callout 💡>` (bare-emoji form, which Notion also emits) now maps to the right
  Obsidian callout type, alongside the `icon="💡"` form.
- Regression fixtures from the real page are frozen in `tests/notion-paste.test.ts`
  and `tests/toggle-all.test.ts`.

The remaining 0.2 is the one flaky quiz dock test in the local full run, unrelated
to toggles and green on CI.
