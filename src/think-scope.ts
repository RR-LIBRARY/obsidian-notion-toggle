/**
 * v1.6.1 — per-note think-time overrides.
 *
 * A note can set its own think window (and countdown face) in frontmatter, so
 * a heavy formula note gets 30s of thinking while a vocabulary note stays at
 * 3s — without touching the global setting:
 *
 *   ---
 *   think: 20s        # 20, 20s, 2m, 1h — or 0 / off to disable here
 *   think-icon: 💭    # any emoji/text, or a png/gif/svg path
 *   ---
 *
 * Precedence (highest first):
 *   1. the per-toggle marker in the question title ("🤔20s", "?30s")
 *   2. this note's frontmatter
 *   3. the global setting
 *
 * Pure module: string in, numbers out. No Obsidian, no DOM.
 */
import { THINK_SECONDS_MAX, clampThinkSeconds, type ThinkSettings } from "./think-gate";

export interface NoteThinkScope {
  /** Seconds from frontmatter, or null when the note says nothing. */
  seconds: number | null;
  /** `false` when the note disables think time (think: off / 0). */
  enabled: boolean | null;
  /** Countdown face from frontmatter, when set. */
  icon: string | null;
}

export const EMPTY_THINK_SCOPE: NoteThinkScope = { seconds: null, enabled: null, icon: null };

/** The frontmatter block of a note, or "" when there is none. */
export function frontmatterBlock(source: string): string {
  const text = source ?? "";
  if (!/^\uFEFF?---\r?\n/.test(text)) return "";
  const rest = text.replace(/^\uFEFF/, "").slice(4);
  const end = rest.search(/\r?\n---\s*(\r?\n|$)/);
  if (end < 0) return "";
  return rest.slice(0, end);
}

function unitSeconds(value: number, unit: string | undefined): number {
  const u = (unit ?? "s").toLowerCase();
  return u === "h" ? value * 3600 : u === "m" ? value * 60 : value;
}

/** "20", "20s", "2m", "1h", "off", "false", "0" → seconds, or null. */
export function parseThinkValue(raw: string | null | undefined): number | null {
  const v = (raw ?? "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (!v) return null;
  if (v === "off" || v === "false" || v === "no" || v === "none") return 0;
  if (v === "on" || v === "true" || v === "yes") return null;
  const m = v.match(/^(\d{1,5})\s*([smh])?$/);
  if (!m) return null;
  const secs = unitSeconds(Number(m[1]), m[2]);
  return Math.min(THINK_SECONDS_MAX, Math.max(0, Math.round(secs)));
}

function fieldOf(block: string, keys: string[]): string | null {
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = (m[1] ?? "").toLowerCase();
    if (keys.includes(key)) return (m[2] ?? "").trim();
  }
  return null;
}

/** Read the think-time override out of a note's source text. */
export function noteThinkScope(source: string): NoteThinkScope {
  const block = frontmatterBlock(source);
  if (!block) return EMPTY_THINK_SCOPE;
  const rawThink = fieldOf(block, ["think", "think-time", "think_time", "thinktime"]);
  const rawIcon = fieldOf(block, ["think-icon", "think_icon", "thinkicon"]);
  const seconds = parseThinkValue(rawThink);
  const icon = (rawIcon ?? "").replace(/^["']|["']$/g, "").trim() || null;
  let enabled: boolean | null = null;
  if (rawThink !== null) {
    const flag = rawThink.trim().toLowerCase();
    if (flag === "off" || flag === "false" || flag === "no" || flag === "none") enabled = false;
    else if (seconds === 0) enabled = false;
    else if (seconds !== null || flag === "on" || flag === "true" || flag === "yes") enabled = true;
  }
  return { seconds, enabled, icon };
}

/**
 * Global settings merged with this note's frontmatter. The result is what the
 * think gate should be handed for this run; per-toggle title markers still win
 * afterwards inside `thinkMsFor`.
 */
export function effectiveThinkSettings<T extends ThinkSettings>(
  settings: T,
  scope: NoteThinkScope
): ThinkSettings {
  const enabled = scope.enabled === null ? settings.scrollThinkEnabled : scope.enabled;
  const seconds =
    scope.seconds === null ? settings.scrollThinkSeconds : clampThinkSeconds(scope.seconds);
  return {
    scrollThinkEnabled: enabled && seconds > 0,
    scrollThinkSeconds: seconds,
    scrollThinkIcon: scope.icon ?? settings.scrollThinkIcon,
  };
}
