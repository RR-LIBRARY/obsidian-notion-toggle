# Notion Toggle — Obsidian Plugin

Notion-style collapsible toggles for Obsidian, without typing any `<details>`, `<summary>`, or `>` brackets.

## What it does

- **Enter = next toggle (auto-continue)** — inside a toggle, `Enter` keeps you in the answer (`> ` added automatically). Press `Enter` again on the empty `> ` line and the **next toggle header is created instantly** — same flow as a numbered list. Third case: normal text, so you can always escape.
- **New toggle below** — one command (one tap on mobile) = fresh empty toggle with the cursor inside the question.
- **Insert toggle** — inserts an empty foldable callout at the cursor; just type the question.
- **Wrap selection as toggle** — select your question + answer text, run the command → becomes a collapsed toggle.
- **Convert `<details>` to callouts** — turns all HTML `<details>` blocks in the current file into native Obsidian foldable callouts (one command, e.g. all 179 Q&A blocks at once).
- **Convert callouts to `<details>`** — reverse, if you ever want HTML back.
- **Quick Q&A toggle (prompt)** — a small dialog to type a question + answer; inserts a toggle on submit.
- **Settings** — default callout type (`question` / `info` / `note` / …), collapsed-by-default on/off, auto-bold the question, auto-continue on Enter on/off, and toggle format (native callout or HTML `<details>`).
- **CSS** — Notion-like arrow rotation + hover styling for toggle callouts.

## Mobile: add the button above the keyboard

Obsidian mobile ka toolbar (keyboard ke upar wali strip) commands se banti hai:

1. Obsidian mobile → **Settings → Toolbar** (Mobile → "Manage toolbar options").
2. Available list me search karo **"New toggle below"** → `+` dabao.
3. Optional: **"Wrap selection as toggle"** aur **"Quick Q&A toggle"** bhi add kar lo.
4. Drag karke unko left side pe le aao, taki ek tap me mil jayein.

Ab note me: toolbar icon tap → toggle ban gaya → question type karo → `Enter` → answer type karo → `Enter` `Enter` → agla toggle apne aap. Bilkul Notion jaisa.

Desktop ke liye: **Settings → Hotkeys** → "New toggle below" ko `Ctrl/Cmd + Shift + T` de do.

## Install (your vault)

1. In your Obsidian vault, create the folder:
   `.obsidian/plugins/notion-toggle/`
2. Copy these three files into it:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Obsidian → **Settings → Community plugins** → toggle off "Safe mode" (if needed) → find **"Notion Toggle"** → enable it.
4. (Optional) **Settings → Hotkeys** → search "Notion Toggle" → assign hotkeys to the commands you use.

## How to use

### Mobile (keyboard ke upar wala toolbar) — recommended

**Settings → Toolbar (Mobile) → "Add a command..."** se ye commands add karo. Jo daily use karte ho unko `≡` handle se list me sabse upar drag kar do; jo nahi chahiye unko `X` se hata do.

| Command | Icon | Kab use karo |
|---|---|---|
| **New toggle below** | `+` | Sabse zyada use hoga — ek tap = naya toggle, cursor seedha question par |
| **Quick Q&A toggle (prompt)** | `?` | Popup me question + answer ek saath likh ke insert |
| **Wrap selection as toggle** | list | Pehle se likhe Q&A ko select karke toggle bana do |
| **Convert `<details>` blocks to callouts** | tree | Poori purani file ko foldable callouts me badlo |
| **Convert callouts to `<details>`** | `<>` | Ulta convert (HTML format chahiye to) |
| **Insert toggle (empty)** | chevrons | Khali toggle skeleton |

**Daily flow:** toolbar me `New toggle below` tap → question likho → `Enter` → answer likho → `Enter` `Enter` → agla toggle apne aap ban jata hai.

### Enter behaviour (Notion parity)

| Cursor kahan hai | `Enter` dabane par |
|---|---|
| Toggle header (`> [!question]- Question`) ke end me | cursor toggle ke **andar** (`> ` answer line) |
| Answer line jisme text hai | nayi answer line usi toggle ke andar |
| Khali `> ` answer line | toggle band, **agla toggle header** ban jata hai, cursor question par |
| Khali toggle header (bina question) | toggle hatt jata hai → normal plain text (double-Enter escape) |

Normal text me Enter bilkul normal rehta hai. Settings → Notion Toggle me **Auto-continue on Enter** off bhi kar sakte ho, aur format `callout` / `details` choose kar sakte ho.

### Other workflows

| Workflow | Steps |
|---|---|
| **Fastest** | Type the question on one line and the answer below it → select both → run **"Wrap selection as toggle"** (assign a hotkey like `Ctrl/Cmd+T`). |
| **Insert empty** | Run **"Insert toggle (empty)"** → type the question on the title line, press `Enter`, type the answer inside the callout. |
| **Prompt box** | Run **"Quick Q&A toggle (prompt)"** → type Q & A in the dialog → it inserts a toggle. |
| **Migrate old notes** | Open any file that has `<details>` blocks → run **"Convert `<details>` blocks to callouts"**. |

A toggle looks like this in the markdown (no manual typing needed — the plugin writes it):

```markdown
> [!question]- **Q6. Bt crop ke liye cry gene ka selection kis par depend karta hai?**
> **Answer:** Target pest pe depend karta hai — kaunsa insect, uska gut receptor.
```

The `-` makes it start collapsed (answer hidden) — click to expand. Perfect for active recall.

## Files

- `main.ts` — plugin source (TypeScript)
- `main.js` — compiled bundle (drop into your vault)
- `manifest.json` — plugin metadata
- `styles.css` — Notion-like toggle styling

## Build from source

```bash
cd obsidian-toggle-plugin
bun install
node esbuild.config.mjs
```

This regenerates `main.js`.

## v1.0.2 — Notion parity update

**Enter**
- Question line end → cursor inside the toggle (`> `)
- Answer line with text → next `> ` answer line
- Empty `> ` line → closes the toggle and starts the **next** toggle
- Empty toggle header → toggle removed (escape to plain text)
- **Mid-line Enter** → block is not split; the remaining text moves to a fresh `> ` answer line

**Backspace (new)**
- Empty `> ` answer line → prefix removed, plain empty line
- Caret at the very start of the question text → toggle marker removed, question text kept
- Empty toggle header → line removed
- Caret right after `> ` on an answer line → that line unwrapped, text kept
- Anywhere else → default Backspace

Both keys respect the **Auto-continue on Enter** setting and work in `<details>` mode too.
Toolbar/command icon is now the Notion-style ▶ triangle.


## v1.0.3

- **Auto-numbering**: new toggles get `1.`, `2.`, `3.` automatically (setting *Auto-numbering*, command *Insert numbered toggle*, plus *Renumber toggles in note* to fix gaps). Numbering continues automatically in notes that are already numbered.
- **Colour palette**: traffic-light `recall-red` / `recall-yellow` / `recall-green` plus blue, purple, orange, gray and a plain black Notion look. Choose in settings, change per-toggle with *Set toggle colour*, or grade fast with *Cycle toggle colour (red → yellow → green)*.
- Colours are styled in `styles.css` via Obsidian's native `--callout-color` hook, so they follow light/dark themes.

## v1.0.4 — MCQ & Match the following (new, nothing else changed)

New commands:

- **Insert MCQ toggle (checkbox options)** — question toggle + `- [ ]` options + `**Answer:**` line
- **Add MCQ option** — one more checkbox inside the current toggle
- **Insert Match the following toggle** — two-column table skeleton inside a toggle
- **Insert answer key line** — adds `**Answer:** ` to the toggle at the cursor

New settings: **MCQ options** (2–6), **Match the following rows** (2–8), **Auto-add Answer line**.

Enter inside an MCQ: option line → next `- [ ]`; empty option → `**Answer:** ` line. Numbering, colours and the existing Enter/Backspace flow are untouched.

## v1.0.5 — Floating recall timer (Pomodoro) 🆕

A draggable floating ⌛ timer for timed active-recall sessions. Nothing from earlier versions changed.

**Commands**

- **Toggle recall timer (show / hide)** — also on the ribbon (⌛)
- **Recall timer: start / pause**
- **Recall timer: reset phase**
- **Recall timer: skip phase**
- **Start recall session on this note (collapse all answers)** — collapses every toggle in the note, then starts the timer

**Widget** — big countdown, phase label (Focus / Short break / Long break), session counter `2/4`, buttons ▶/⏸ · ↺ · ⏭ · ◑ compact · ✕ hide, drag handle. Position and compact mode persist in `data.json`.

**Settings → Recall timer (Pomodoro)** — preset (Classic 25/5, Deep 50/10, Quick recall 15/3, Custom), focus / short / long minutes, sessions before long break (1–8), auto-start next phase, notice on phase end, vibrate on phase end, show on startup, compact by default, reset position.

**Recall intelligence** — phase-end notices and break hints show 🔴/🟡/🟢 toggle counts for the active note, with a **🔴 Jump** button to the first red toggle; the status bar keeps `⌛ N sessions · Nm`.

**Tests** — `bun test` runs 63 pure tests covering Enter/Backspace, numbering, colours, MCQ, Match the following, the Pomodoro state machine and the recall scan. Botany round-trip verified: 179 callouts ↔ 179 `<details>` ↔ 179 callouts.

### v1.0.5 also adds

- **Toggle option checkbox** — tick/untick the `- [ ]` option at the cursor (works in callout and `<details>` bodies).
- MCQ/Match Enter + Backspace edge cases: mid-line Enter keeps the checkbox, empty option/Answer/blank row collapse to a plain body line, filled table rows chain to the next numbered row, `<details>` parity.
- Test suite: `bun test` → **89 pass / 0 fail**; Botany round-trip 179 ↔ 179 ↔ 179.
