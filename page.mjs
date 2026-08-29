/** Shared status page markup for the preview server and dist build. */
export const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Notion Toggle — Obsidian Plugin</title>
  <meta name="description" content="Notion-style collapsible toggles for Obsidian with recall timer, SM-2 spaced repetition, auto-scroll revision and quiz mode." />
  <style>
    body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; line-height: 1.6; }
    code { background: #f0f0f0; padding: 0 .3em; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Notion Toggle — Obsidian Plugin</h1>
  <p>This repository builds an Obsidian plugin (<code>main.js</code>), not a web app, so there is no interactive preview.</p>
  <ul>
    <li><a href="/README.md">README</a> — install &amp; feature guide</li>
    <li><a href="/MANUAL.md">MANUAL</a> — every setting explained</li>
    <li><a href="/main.js">main.js</a> — built plugin bundle</li>
  </ul>
  <p>Install in Obsidian via BRAT: <code>RR-LIBRARY/obsidian-notion-toggle</code></p>
</body>
</html>`;
