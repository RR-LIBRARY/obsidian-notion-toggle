// Push the plugin working copy (uncommitted edits) to the GitHub `wip` branch.
// Layer 3 of the durability routine — never touches `main` or tags.
// Usage: bun plugin/tools/push-wip.ts "message"
// Needs LOVABLE_API_KEY + GITHUB_API_KEY (GitHub connector linked to the project).
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = "/dev-server/plugin";
const REPO = "RR-LIBRARY/obsidian-notion-toggle";
const BRANCH = process.env["WIP_BRANCH"] ?? "wip";
const GW = "https://connector-gateway.lovable.dev/github";

const lovableKey = process.env["LOVABLE_API_KEY"];
const ghKey = process.env["GITHUB_API_KEY"];
if (!lovableKey || !ghKey) throw new Error("LOVABLE_API_KEY / GITHUB_API_KEY missing — link the GitHub connector");

const git = (...args: string[]) =>
  execFileSync("bash", [join(PLUGIN, "tools/durable.sh"), "git", ...args], { encoding: "utf8" });

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${GW}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": ghKey!,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok && !(method === "GET" && res.status === 404)) {
    throw new Error(`GitHub ${method} ${path} failed [${res.status}]: ${text}`);
  }
  return (res.status === 404 ? null : JSON.parse(text)) as T;
}

const message = process.argv[2] ?? `wip: ${new Date().toISOString()}`;
const base = git("rev-parse", "HEAD").trim();
const changes = git("status", "--porcelain", "--untracked-files=all")
  .split("\n")
  .filter(Boolean)
  .map((l) => ({ code: l.slice(0, 2), path: l.slice(3).replace(/^"|"$/g, "") }))
  .filter((c) => !c.path.startsWith("node_modules/") && !c.path.startsWith("e2e/out/"));

if (changes.length === 0) {
  console.log("nothing to push — working copy matches", base.slice(0, 7));
  process.exit(0);
}

const baseCommit = await gh<{ tree: { sha: string } }>("GET", `/repos/${REPO}/git/commits/${base}`);
const tree: Array<{ path: string; mode: string; type: string; sha: string | null }> = [];
for (const c of changes) {
  const abs = join(PLUGIN, c.path);
  if (!existsSync(abs)) {
    tree.push({ path: c.path, mode: "100644", type: "blob", sha: null });
    continue;
  }
  const blob = await gh<{ sha: string }>("POST", `/repos/${REPO}/git/blobs`, {
    content: readFileSync(abs).toString("base64"),
    encoding: "base64",
  });
  tree.push({ path: c.path, mode: "100644", type: "blob", sha: blob.sha });
}
const newTree = await gh<{ sha: string }>("POST", `/repos/${REPO}/git/trees`, {
  base_tree: baseCommit.tree.sha,
  tree,
});
const commit = await gh<{ sha: string }>("POST", `/repos/${REPO}/git/commits`, {
  message,
  tree: newTree.sha,
  parents: [base],
});
const existing = await gh<unknown>("GET", `/repos/${REPO}/git/ref/heads/${BRANCH}`);
if (existing) {
  await gh("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
} else {
  await gh("POST", `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
}
console.log(`pushed ${changes.length} files to ${BRANCH} as ${commit.sha.slice(0, 7)} (base ${base.slice(0, 7)})`);
for (const c of changes) console.log(`  ${c.code} ${c.path}`);
