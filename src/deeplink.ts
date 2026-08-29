/**
 * v1.3.0 — `obsidian://notion-toggle?...` deep links (pure parser).
 *
 * Examples:
 *   obsidian://notion-toggle?action=quiz&file=Bio/Alleles.md&filter=red&seconds=30
 *   obsidian://notion-toggle?action=autoscroll&filter=red,yellow&speed=80
 *   obsidian://notion-toggle?action=stop
 */

import { normalizeFilter, type RecallColor } from "./autoscroll";
import { clampQuizSeconds } from "./quiz";

export type DeepLinkAction = "quiz" | "autoscroll" | "stop";

export interface DeepLink {
  action: DeepLinkAction;
  file?: string;
  filter?: RecallColor[];
  seconds?: number;
  speed?: number;
}

const COLORS: RecallColor[] = ["red", "yellow", "green", "other"];

/** `red,yellow` / `all` / `graded` → a canonical filter, or undefined. */
export function parseFilterParam(raw: string | undefined): RecallColor[] | undefined {
  if (raw == null) return undefined;
  const text = raw.trim().toLowerCase();
  if (!text || text === "all" || text === "default" || text === "any") return [];
  if (text === "graded") return normalizeFilter(["red", "yellow", "green"]);
  const picked = text
    .split(/[,+ ]+/)
    .map((p) => p.trim())
    .filter((p): p is RecallColor => (COLORS as string[]).includes(p));
  return picked.length ? normalizeFilter(picked) : undefined;
}

/** Parse the params Obsidian hands to a protocol handler. */
export function parseDeepLink(
  params: Record<string, string | undefined>
): DeepLink | null {
  const action = (params["action"] ?? "").trim().toLowerCase();
  if (action !== "quiz" && action !== "autoscroll" && action !== "stop") return null;

  const link: DeepLink = { action };
  const file = params["file"]?.trim();
  if (file) link.file = file;

  const filter = parseFilterParam(params["filter"]);
  if (filter) link.filter = filter;

  const seconds = Number(params["seconds"]);
  if (Number.isFinite(seconds) && seconds > 0) link.seconds = clampQuizSeconds(seconds);

  const speed = Number(params["speed"]);
  if (Number.isFinite(speed) && speed > 0) link.speed = Math.min(600, Math.round(speed));

  return link;
}
