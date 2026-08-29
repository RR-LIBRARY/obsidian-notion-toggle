/**
 * Preview dev server for the Lovable editor (this repo is an Obsidian plugin,
 * not a web app — there is no web UI to run). It rebuilds main.js once, then
 * serves a small status page plus the repo files so the preview stays healthy.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { PAGE } from "./page.mjs";

const args = process.argv.slice(2);
const portIdx = args.findIndex((a) => a === "--port" || a === "-p");
const PORT = portIdx >= 0 ? Number(args[portIdx + 1]) : 8080;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/markdown",
};



createServer(async (req, res) => {
  const url = (req.url ?? "/").split("?")[0];
  if (url === "/" || url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(PAGE);
    return;
  }
  try {
    const path = normalize(join(process.cwd(), decodeURIComponent(url)));
    if (!path.startsWith(process.cwd())) throw new Error("forbidden");
    const body = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));
