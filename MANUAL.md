# Notion Toggle — User Manual (v1.1.3)

Complete guide for install, autoscroll revision, Quiz Mode, settings, and troubleshooting.

---

## 1. Install

### 1.1 BRAT (recommended, auto-updates)

1. Install the community plugin **BRAT** (Beta Reviewers Auto-update Tool).
2. BRAT → **Add a beta plugin** → paste:
   ```
   RR-LIBRARY/obsidian-notion-toggle
   ```
3. Keep *Enable after installing the plugin* checked → **Add plugin**.
4. Updates later: BRAT → **Check for updates**.

> **If BRAT says "A manifest.json file does not exist in the latest release"**
> The latest GitHub release must carry `manifest.json`, `main.js` and `styles.css`
> as *release assets* (not just repo files). Fixed in v1.1.3 — the release
> `v1.1.3` has all three attached. If you still see it: BRAT → remove the entry →
> add it again, then restart Obsidian.

### 1.2 Manual install

1. Download `main.js`, `manifest.json`, `styles.css` from the
   [latest release](https://github.com/RR-LIBRARY/obsidian-notion-toggle/releases/latest).
2. Copy into `<vault>/.obsidian/plugins/notion-toggle/` (create the folder).
3. Obsidian → **Settings → Community plugins → Reload** → enable **Notion Toggle**.

Mobile: same folder path works; use any file manager or sync the vault.

---

## 2. Where the settings live

`Settings (⚙) → Community plugins → Notion Toggle`

Two headings:

- **Toggles / recall** — toggle authoring, colour grading, Pomodoro, spaced repetition.
- **Auto-scroll revision** — everything in section 3 below.

Settings persist in `.obsidian/plugins/notion-toggle/data.json`.
Speed, direction and hold time are also remembered **per note**.

---

## 3. Autoscroll revision

Start: command palette → **Autoscroll: start / stop**. A floating bar appears
(44 px targets, safe-area aware on mobile).

### 3.1 Floating bar controls

| Control | Action |
|---|---|
| ▶ / ⏸ | Start / pause the scroll |
| − / + | Speed down / up (0.02x … 20x) |
| ↑ / ↓ | Reverse direction |
| 🔴🟡🟢 | Colour filter — scroll only through graded toggles |
| ⤒ | Jump to first toggle |
| ✕ | Stop and clean up |

### 3.2 Settings reference

| Setting | Meaning |
|---|---|
| **Scroll speed** | 0.02x–20x. Sub-pixel float positioning, so even 0.02x really creeps. |
| **Hold time** | Pause duration at each stop (1 s … 1 hour). |
| **Reverse direction** | Scroll upward instead of downward. |
| **Colour filter** | All / 🔴 only / 🟡 only / 🟢 only / 🔴+🟡 / all graded. |
| **Auto-open / auto-close** | Open the toggle on arrival, close it on leaving. |
| **Loop the note** | Restart from the top when the end is reached. |
| **Pause at** | Every toggle · Odd · Even · Custom list · Route · Shuffle. |
| **Tall toggle: screen-by-screen** | A long/A4 toggle is split into viewport-sized chunks — the next page shows only after the current one is fully read. |
| **Loop route** | Repeat the route (down → up → down …) per-leg direction. |
| **Auto-grade** | Dwell time on a toggle feeds the FSRS scheduler automatically. |
| **New-toggle mix** | How many never-revised toggles get interleaved into shuffle order. |
| **Shuffle range** | Limit shuffle to a toggle-number range. |
| **Weak toggles / priority → Show stats** | Opens the stats panel (section 5). |
| **Debug overlay** | Turns on the developer overlay (section 4). Default: off. |
| **Reset revision memory** | Clears FSRS cards / visit history for the note. |

### 3.3 Pause-at modes

- **Every / Odd / Even** — numeric selection over toggles.
- **Custom** — comma list, e.g. `1,4,7-12`.
- **Route** — an explicit ordered path; with *Loop route* it walks
  down → up → down with correct per-leg direction.
- **Shuffle** — FSRS-weighted order: due and weak toggles first,
  fresh toggles interleaved, deterministic within a session.

---

## 4. Debug overlay

Enable in settings, or leave off for normal use. It shows the live loop state:

```
pos 120.40 → top 120 / 2000   dir ↓  frac 0.40
route leg 2/5 → target #7     waypointReached ✓
dwellKey #7  pause 3.4s
event crossedTarget            grade good
progress 7/18
```

Use it to confirm `waypointReached`, `crossedTarget`, dwell countdown,
grade writes, and route progress while tuning speed.

---

## 5. Weak-toggle stats panel

Command: **Autoscroll: revision stats (weak toggles)** (or settings → *Show stats*).

Shows:

- Deck summary — total / due / new / learned counts.
- 7-day due forecast.
- One row per weak toggle:
  `#7 · 42% recall · D 7.4 · S 3.1d · 2 lapses`
- A plain-language reason: *"forgotten 2× — kept close"*,
  *"never revised — new toggles get mixed in first"*.

Priority comes from the FSRS scheduler (recall probability, difficulty,
stability, reps, lapses) — the same engine the Naveen Bharat reader uses.

---

## 6. Quiz Mode

Command: **Quiz: start / stop**. HUD: `00:14 · Q 3/12` with
pause / 👁 reveal now / ⏭ next / ✕ stop.

Flow: countdown per question → time up → answer auto-reveals →
after the reveal duration the toggle auto-closes → next question,
auto-scrolled into view.

- Defaults: 20 s per question, 5 s reveal.
- Change globally: **Quiz: set time per question** (10/15/20/30/45/60/90/custom)
  or in settings.
- Per-question override: put a marker in the toggle title —
  `⏱30`, `[30s]`, `(30s)` or `@20s`.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| BRAT: "no manifest.json in latest release" | Latest release now has assets; re-add the plugin in BRAT and restart. |
| Nothing scrolls | The note has no toggles, or the colour filter excludes all of them. Set filter to *All*. |
| Scroll too fast on mobile | Drop speed to 0.05x–0.2x; enable *Tall toggle: screen-by-screen*. |
| Toggles don't reopen | Enable *Auto-open*; check the toggle is a supported `<details>`/callout block. |
| Stats look wrong | Settings → *Reset revision memory* for that note. |
| Reduced-motion systems | Animation is skipped automatically; stepping still works. |

---

## 8. Release / dev notes

- Build: `bun install && bun run build` → `main.js`.
- Tests: `bun test` (197 tests), typecheck: `bun run typecheck`.
- Real-vault checklist: `SMOKE-TEST.md` (18 steps).
- Releases must attach `manifest.json`, `main.js`, `styles.css`; the
  `Package Obsidian plugin release` GitHub Action does this on tag push or
  manual dispatch, and resolves both `1.1.3` and `v1.1.3` style tags.
