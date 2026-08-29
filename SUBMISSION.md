# Community Plugin Store Submission

Everything needed to submit **Notion Toggle** to the official Obsidian
community plugin directory.

## Metadata (manifest.json)

| Field | Value |
|---|---|
| id | `notion-toggle` |
| name | Notion Toggle |
| version | 1.4.0 |
| minAppVersion | 1.4.0 |
| description | Notion-style toggles with quiz mode, autoscroll revision, traffic-light grading and spaced repetition. |
| author | RR-LIBRARY |
| isDesktopOnly | false (mobile verified) |

## Submission checklist

1. Fork `obsidianmd/obsidian-releases`.
2. Add an entry to `community-plugins.json`:
   ```json
   {
     "id": "notion-toggle",
     "name": "Notion Toggle",
     "author": "RR-LIBRARY",
     "description": "Notion-style toggles with quiz mode, autoscroll revision, traffic-light grading and spaced repetition.",
     "repo": "RR-LIBRARY/obsidian-notion-toggle"
   }
   ```
   (append at the end of the array, keep JSON sorted rules from the PR template)
3. Ensure the GitHub release `1.4.0` has `main.js`, `manifest.json`,
   `styles.css` attached — handled automatically by
   `.github/workflows/release-assets.yml`.
4. Open the PR; the validation bot checks manifest, versions.json and release
   assets.

## Review-bot notes

- `versions.json` maps every released version to `minAppVersion` 1.4.0
  (guardrail: `tests/release-meta.test.ts`).
- No Node-only APIs at runtime: the bundle targets Obsidian's Electron/mobile
  engine, no `fs`/network calls beyond the Obsidian API.
- All timers/listeners are released in `onunload` (see QA-REPORT resource
  hygiene table).
- Clipboard write (`Performance report` command) is wrapped in try/catch with
  a Notice fallback.

## One-line pitch

Notion-style collapsible toggles for Obsidian with a built-in study engine:
quiz mode with per-question timers (1s–12h), hands-free autoscroll revision,
traffic-light grading and SM-2 spaced repetition — desktop and mobile.
