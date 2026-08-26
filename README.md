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
