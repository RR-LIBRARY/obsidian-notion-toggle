import esbuild from "esbuild";
import { mkdir, writeFile, copyFile } from "node:fs/promises";

await mkdir("e2e/out", { recursive: true });
await esbuild.build({ entryPoints: ["e2e/workbench.ts"], bundle: true, format: "iife", outfile: "e2e/out/workbench.js", logLevel: "warning" });
await copyFile("styles.css", "e2e/out/styles.css");
await writeFile(
  "e2e/out/index.html",
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="styles.css">
<style>body{margin:0;font:16px/1.5 system-ui;--text-muted:#888;--text-normal:#222;--background-modifier-border:#ddd;--background-modifier-hover:#eee}
.cm-editor{padding:8px}.cm-content{white-space:pre-wrap}</style></head>
<body class="ntt-notion-look"><div class="markdown-source-view mod-cm6"><div id="editor"></div></div>
<script src="workbench.js"></script></body></html>`
);
console.log("workbench built: e2e/out/index.html");
