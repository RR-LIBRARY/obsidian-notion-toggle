/**
 * Command naming — keeps the mobile toolbar list short.
 * Primary commands stay clean; everything else moves under "Advanced:".
 * Command IDs never change, so existing hotkeys and toolbar entries survive.
 */

/** IDs that stay top-level and readable. */
export const PRIMARY_IDS = [
  "toggle-list",
  "shove-into-toggle",
  "move-out-of-toggle",
  "tools-menu",
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
  "toggle-list": "Toggle list",
  // v1.8.23 — Notion's two nesting actions, as their own toolbar buttons. The
  // IDs are the v1.8.9 "shove / move out" commands, so hotkeys and toolbar
  // entries made before the rename keep working.
  "shove-into-toggle": "Indent (nest under the toggle above)",
  "move-out-of-toggle": "Outdent (move out one level)",
  "tools-menu": "Tools",
  "smart-toggle": "Toggle (smart add)",
  "smart-colour": "Colour (red → yellow → green)",
  "smart-recall": "Recall (start / pause session)",
  "smart-review": "Review (spaced repetition)",
  "smart-autoscroll": "Autoscroll (start / pause revision)",
  "smart-quiz": "Quiz (timed question run)",
  "scroll-stats": "Autoscroll: revision stats (weak toggles)",
};

/** Command IDs of the Indent / Outdent toolbar actions (Notion's nesting controls). */
export const INDENT_COMMAND_ID = "shove-into-toggle";
export const OUTDENT_COMMAND_ID = "move-out-of-toggle";


export function isPrimary(id: string): id is PrimaryId {
  return (PRIMARY_IDS as readonly string[]).includes(id);
}

/**
 * v1.7.0 — web-research commands form their own family ("Research: …"), so
 * they keep their names in minimal mode instead of becoming
 * "Advanced: Research: …".
 */
export const RESEARCH_PREFIX = "research-";

export function isResearchCommand(id: string): boolean {
  return id.startsWith(RESEARCH_PREFIX);
}

/**
 * Display name for a command.
 * minimal = true  -> primary names as-is, research names as-is, everything else "Advanced: …"
 * minimal = false -> original legacy names (nothing renamed)
 */
/**
 * v1.9.30 — plain names for commands readers kept tripping over in the phone's
 * command list ("Advanced: Review: grade and filter red / yellow / green").
 * Only the label changes; the ID (hotkeys, toolbar entries) stays.
 */
export const FRIENDLY_NAMES: Record<string, string> = {
  "review-color-filter": "Grade: mark & filter red / yellow / green",
  "callout-appearance-filter": "Look: choose which callout types look native",
  "toggle-appearance": "Look: Notion toggles ↔ native callouts",
  "quiz-perf-report": "Quiz: performance report",
  "toggle-number-appearance": "Look: toggle numbers (this note)",
  "answers-open-all": "Answers: open all",
  "answers-close-all": "Answers: close all",
  "autoscroll-sheet": "Autoscroll: quick controls",
  "feature-guide": "Feature guide (what this plugin can do)",
};

export function commandName(id: string, legacyName: string, minimal: boolean): string {
  if (isPrimary(id)) return PRIMARY_NAMES[id];
  if (minimal && FRIENDLY_NAMES[id]) return FRIENDLY_NAMES[id];
  if (!minimal) return legacyName;
  if (isResearchCommand(id)) return legacyName;
  if (legacyName.startsWith("Advanced: ")) return legacyName;
  return `Advanced: ${legacyName}`;
}
