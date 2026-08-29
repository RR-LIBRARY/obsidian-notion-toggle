/** Emits a static dist/ site for the Lovable preview (this repo is an Obsidian plugin). */
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import { PAGE } from "./page.mjs";

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", PAGE);
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(f, `dist/${f}`).catch(() => {});
}
console.log("dist/ written");
