import { readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const REPO = "RR-LIBRARY/obsidian-notion-toggle";
const TOKEN = process.env.GITHUB_API_KEY;
const H = {
  Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
  "X-Connection-Api-Key": TOKEN,
  Accept: "application/vnd.github+json",
  "User-Agent": "ntt-release",
};

async function gh(path, init = {}, base = "https://connector-gateway.lovable.dev/github") {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...H, ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

const files = execSync("git status --porcelain", { cwd: "/tmp/ghrel" })
  .toString()
  .trim()
  .split("\n")
  .map((l) => l.slice(3).trim())
  .filter((f) => f && statSync(`/tmp/ghrel/${f}`, { throwIfNoEntry: false }));

console.log("files:", files.length);

const ref = await gh(`/repos/${REPO}/git/ref/heads/main`);
const baseSha = ref.object.sha;
const baseCommit = await gh(`/repos/${REPO}/git/commits/${baseSha}`);

const tree = [];
for (const f of files) {
  const blob = await gh(`/repos/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: readFileSync(`/tmp/ghrel/${f}`).toString("base64"), encoding: "base64" }),
  });
  tree.push({ path: f, mode: "100644", type: "blob", sha: blob.sha });
  console.log("blob", f);
}

const newTree = await gh(`/repos/${REPO}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
});

const message =
  "v1.6.1 — filter hard guard (red/yellow/green), think-time preview slider, per-note think override, reduced motion, timing debug overlay";
const commit = await gh(`/repos/${REPO}/git/commits`, {
  method: "POST",
  body: JSON.stringify({ message, tree: newTree.sha, parents: [baseSha] }),
});
await gh(`/repos/${REPO}/git/refs/heads/main`, {
  method: "PATCH",
  body: JSON.stringify({ sha: commit.sha }),
});
console.log("commit", commit.sha);

const body = `## Filter fix (the main one)

- **Hard colour guard at the moment of opening.** A stop resolves by stable identity first, ordinal only as a fallback, and in *both* cases the toggle's own live colour is re-read and must pass the active filter. A red run can no longer open a yellow/green answer after Obsidian replaces a lazily rendered section.
- **Stray answers get closed.** Anything already open that does not match the filter (hand-opened before the run, or left over from a healed plan) is closed, so the screen matches the filter exactly.
- **No repeat visits.** A finished toggle's continuation chunks are only eligible while that toggle is the active target, so the run stops jumping back to Q5 after Q7.
- Verified on real DOM: every single-colour filter admits only its own colour, before and after an ordinal-shifting re-render.

## Think time

- Settings slider for the default think window (1s–60s) with a **live countdown preview** before saving.
- **Per-note override** via frontmatter: \`think: 20s\` / \`think: off\`, plus \`think-icon:\`. Precedence: toggle title marker > note frontmatter > global.
- Custom countdown face: any emoji/text, or a png / gif / svg / webp path or URL.
- **Distraction-free mode** is its own on/off switch (status bar, view header, mobile toolbar), with top/bottom safe-area padding so nothing sits under the system status bar.
- **Reduced motion** option: reveal and countdown become instant, no blink. OS \`prefers-reduced-motion\` is honoured too.

## Timing debug overlay

Optional overlay logging exact timestamps and deltas for toggle open → countdown start → answer release, toggled from settings.

911 tests pass, typecheck and build clean. Mobile install: \`main.js\`, \`manifest.json\`, \`styles.css\`.`;

let release;
try {
  release = await gh(`/repos/${REPO}/releases`, {
    method: "POST",
    body: JSON.stringify({ tag_name: "1.6.1", target_commitish: commit.sha, name: "1.6.1", body }),
  });
} catch (e) {
  console.log("create failed, trying update:", e.message.slice(0, 200));
  const existing = await gh(`/repos/${REPO}/releases/tags/1.6.1`);
  release = await gh(`/repos/${REPO}/releases/${existing.id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "1.6.1", body }),
  });
}
console.log("release", release.html_url);

for (const asset of release.assets || []) {
  await gh(`/repos/${REPO}/releases/assets/${asset.id}`, { method: "DELETE" });
}
for (const name of ["main.js", "manifest.json", "styles.css"]) {
  const res = await fetch(
    `https://connector-gateway.lovable.dev/github/repos/${REPO}/releases/${release.id}/assets?name=${name}`,
    {
      method: "POST",
      headers: { ...H, "Content-Type": "application/octet-stream" },
      body: readFileSync(`/tmp/ghrel/${name}`),
    }
  );
  console.log("asset", name, res.status);
}
