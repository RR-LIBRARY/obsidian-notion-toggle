/**
 * Command naming — keeps the mobile toolbar list short.
 * Four primary commands stay clean; everything else moves under "Advanced:".
 * Command IDs never change, so existing hotkeys and toolbar entries survive.
 */

/** IDs that stay top-level and readable. */
export const PRIMARY_IDS = [
  "smart-toggle",
  "smart-colour",
  "smart-recall",
  "smart-review",
  "smart-autoscroll",
  "smart-quiz",
  "scroll-stats",
] as const;

export type PrimaryId = (typeof PRIMARY_IDS)[number];

export const PRIMARY_NAMES: Record<PrimaryId, string> = {
  "smart-toggle": "Toggle (smart add)",
  "smart-colour": "Colour (red → yellow → green)",
  "smart-recall": "Recall (start / pause session)",
  "smart-review": "Review (spaced repetition)",
  "smart-autoscroll": "Autoscroll (start / pause revision)",
  "smart-quiz": "Quiz (timed question run)",
  "scroll-stats": "Autoscroll: revision stats (weak toggles)",
};


export function isPrimary(id: string): id is PrimaryId {
  return (PRIMARY_IDS as readonly string[]).includes(id);
}

/**
 * Display name for a command.
 * minimal = true  -> primary names as-is, everything else "Advanced: …"
 * minimal = false -> original legacy names (nothing renamed)
 */
export function commandName(id: string, legacyName: string, minimal: boolean): string {
  if (isPrimary(id)) return PRIMARY_NAMES[id];
  if (!minimal) return legacyName;
  if (legacyName.startsWith("Advanced: ")) return legacyName;
  return `Advanced: ${legacyName}`;
}
