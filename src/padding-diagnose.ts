/**
 * v1.7.4 — top-padding diagnostic (pure; no Obsidian, no DOM globals).
 *
 * The shell (`padding-diagnose-view.ts`) walks from the note's scroller up to
 * `<html>`, reads each element's computed top padding / margin / border and
 * the CSS rules that set them, and hands the plain numbers to `analyzeTopGap`.
 * Every pixel between the top of the screen and the first line of the note is
 * then attributed to one owner: Obsidian (its own safe-area inset / header),
 * this plugin, or the active theme / a CSS snippet.
 */

export type GapOwner = "obsidian" | "plugin" | "theme-or-snippet" | "unknown";

export interface ChainEntry {
  /** Short CSS-ish label, e.g. `body.is-mobile` or `div.view-content`. */
  label: string;
  paddingTop: number;
  marginTop: number;
  borderTop: number;
  /** Rules (selector + declaration) from stylesheets that set a top gap here. */
  rules?: RuleHit[];
}

export interface RuleHit {
  selector: string;
  declaration: string;
  /** Where the sheet came from: "app", "plugin", "theme", "snippet" or "inline". */
  source: "app" | "plugin" | "theme" | "snippet" | "inline" | "unknown";
}

export interface GapInput {
  chain: ChainEntry[];
  /** Value of Obsidian's `--safe-area-inset-top`, in px (0 when unset). */
  safeAreaTop: number;
  /** Distance from viewport top to the scroller's first pixel. */
  contentTop: number;
  isMobile: boolean;
  focusRun: boolean;
  theme: string;
  snippets: string[];
}

export interface GapFinding {
  label: string;
  px: number;
  kind: "padding-top" | "margin-top" | "border-top";
  owner: GapOwner;
  note: string;
}

export interface GapReport {
  findings: GapFinding[];
  expectedPx: number;
  extraPx: number;
  verdict: "ok" | "extra-gap";
  suspects: string[];
}

/** Parse a CSS length like "24px" / "0" / "" into px. Non-px values give 0. */
export function px(v: string | null | undefined): number {
  if (!v) return 0;
  const m = /^\s*(-?\d*\.?\d+)(px)?\s*$/.exec(v);
  return m ? Math.round(parseFloat(m[1]) * 100) / 100 : 0;
}

const TOP_GAP_RE = /(^|[;\s{])(padding-top|margin-top|padding|margin|border-top(-width)?)\s*:/i;

/** Does a declaration block set any top gap? */
export function declaresTopGap(cssText: string): boolean {
  return TOP_GAP_RE.test(cssText);
}

/** Pull the top-gap declarations out of a rule body (one per line in the report). */
export function topGapDeclarations(body: string): string[] {
  return body
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && TOP_GAP_RE.test(" " + d));
}

function ownerOf(entry: ChainEntry, kind: GapFinding["kind"], input: GapInput, px: number): [GapOwner, string] {
  const rules = entry.rules ?? [];
  const bySource = (s: RuleHit["source"]) => rules.some((r) => r.source === s);
  if (bySource("theme") || bySource("snippet")) {
    const names = rules.filter((r) => r.source === "theme" || r.source === "snippet").map((r) => r.selector);
    return ["theme-or-snippet", `set by ${names.join(", ")}`];
  }
  if (bySource("plugin") && /ntt-/.test(rules.map((r) => r.selector).join(" "))) {
    return ["plugin", "Notion Toggle rule — should not exist since 1.7.3, please report"];
  }
  const isBody = /^body\b/.test(entry.label);
  if (isBody && kind === "padding-top" && input.isMobile && Math.abs(px - input.safeAreaTop) <= 1) {
    return ["obsidian", "Obsidian's own status-bar inset (expected)"];
  }
  if (/view-header|titlebar|mobile-toolbar/.test(entry.label)) {
    return ["obsidian", "Obsidian chrome"];
  }
  if (bySource("app")) return ["obsidian", "Obsidian default style"];
  if (bySource("inline")) return ["unknown", "inline style (set by script)"];
  if (bySource("plugin")) return ["unknown", "another plugin's stylesheet"];
  return input.theme || input.snippets.length
    ? ["theme-or-snippet", "no Obsidian rule explains it — likely theme / snippet"]
    : ["unknown", "source not found"];
}

export function analyzeTopGap(input: GapInput): GapReport {
  const findings: GapFinding[] = [];
  for (const e of input.chain) {
    const parts: [GapFinding["kind"], number][] = [
      ["padding-top", e.paddingTop],
      ["margin-top", e.marginTop],
      ["border-top", e.borderTop],
    ];
    for (const [kind, v] of parts) {
      if (v <= 0.5) continue;
      const [owner, note] = ownerOf(e, kind, input, v);
      findings.push({ label: e.label, px: v, kind, owner, note });
    }
  }
  const expectedPx = findings.filter((f) => f.owner === "obsidian").reduce((s, f) => s + f.px, 0);
  const extraPx = findings.filter((f) => f.owner !== "obsidian").reduce((s, f) => s + f.px, 0);
  const suspects: string[] = [];
  if (findings.some((f) => f.owner === "theme-or-snippet")) {
    if (input.theme) suspects.push(`Theme: ${input.theme}`);
    for (const s of input.snippets) suspects.push(`Snippet: ${s}.css`);
  }
  return { findings, expectedPx, extraPx, verdict: extraPx > 0.5 ? "extra-gap" : "ok", suspects };
}

const OWNER_LABEL: Record<GapOwner, string> = {
  obsidian: "Obsidian",
  plugin: "Notion Toggle",
  "theme-or-snippet": "Theme / snippet",
  unknown: "Unknown",
};

/** Markdown report (shown in the modal, copied to clipboard). */
export function formatGapReport(input: GapInput, r: GapReport): string {
  const out: string[] = [];
  out.push("# Top padding diagnostic");
  out.push("");
  out.push(
    r.verdict === "ok"
      ? "**Result: OK** — no extra top gap. Only Obsidian's own inset/header is above the note."
      : `**Result: ${r.extraPx}px extra top gap** not added by Obsidian.`
  );
  out.push("");
  out.push(`- Device: ${input.isMobile ? "mobile" : "desktop"}; autoscroll focus run: ${input.focusRun ? "on" : "off"}`);
  out.push(`- Obsidian safe-area inset: ${input.safeAreaTop}px; note starts at ${input.contentTop}px from the top`);
  out.push(`- Theme: ${input.theme || "default"}; snippets: ${input.snippets.length ? input.snippets.join(", ") : "none"}`);
  out.push("");
  if (!r.findings.length) out.push("No element above the note has top padding, margin or border.");
  else {
    out.push("| Element | Gap | Owner | Why |");
    out.push("|---|---|---|---|");
    for (const f of r.findings) out.push(`| \`${f.label}\` | ${f.kind} ${f.px}px | ${OWNER_LABEL[f.owner]} | ${f.note} |`);
  }
  const rules = input.chain.flatMap((e) => (e.rules ?? []).map((h) => ({ e, h })));
  if (rules.length) {
    out.push("");
    out.push("## Matching CSS rules");
    for (const { e, h } of rules) out.push(`- \`${e.label}\` ← [${h.source}] \`${h.selector}\` { ${h.declaration} }`);
  }
  if (r.suspects.length) {
    out.push("");
    out.push("## Try this");
    out.push("Disable these one at a time (Settings → Appearance) and run the diagnostic again:");
    for (const s of r.suspects) out.push(`- ${s}`);
  }
  return out.join("\n");
}
