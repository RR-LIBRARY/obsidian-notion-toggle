/**
 * v1.1.5 — Mobile toolbar guide data + floating-button visibility rules.
 * Pure module (no Obsidian / DOM imports) so it stays unit-testable.
 */

export interface ToolbarCommand {
  /** Command id exactly as registered in main.ts. */
  id: string;
  /** Name as it appears in Settings → Mobile → Manage toolbar. */
  name: string;
  /** One-line reason to add it. */
  why: string;
  /** Recommended order (1 = add first). */
  priority: number;
}

/** The exact commands worth pinning to the Obsidian mobile toolbar. */
export const TOOLBAR_COMMANDS: ToolbarCommand[] = [
  { id: "toggle-list", name: "Toggle list", why: "Cursor par toggle banao; selected text ko toggle me badlo.", priority: 1 },
  { id: "tools-menu", name: "Tools", why: "Saare purane actions ek jagah, bina toolbar bhare.", priority: 2 },
  // v1.8.23 — Notion's two nesting buttons. Enter hamesha same level par naya
  // toggle banata hai; andar/bahar sirf inhi se (ya Tab / Shift+Tab se) hota hai.
  { id: "shove-into-toggle", name: "Indent (nest under the toggle above)", why: "Toggle ko upar wale toggle ke andar le jao (Notion ka Indent / Tab).", priority: 3 },
  { id: "move-out-of-toggle", name: "Outdent (move out one level)", why: "Toggle ko ek level bahar nikaalo (Notion ka Outdent / Shift+Tab).", priority: 4 },
  { id: "smart-autoscroll", name: "Autoscroll (start / pause revision)", why: "Optional: revision ek tap se shuru ya pause.", priority: 5 },
  { id: "smart-recall", name: "Recall (start / pause session)", why: "Optional: recall session ek tap me.", priority: 6 },
  { id: "autoscroll-reverse", name: "Autoscroll: reverse direction", why: "Optional: reverse shortcut ke liye.", priority: 7 },
  { id: "autoscroll-sheet", name: "Autoscroll: sheet (all controls)", why: "Optional: speed aur mode control ke liye.", priority: 8 },
];

/** The phone toolbar itself is managed by Obsidian, not by this plugin. */
export const TOOLBAR_STEPS: string[] = [
  "Obsidian Settings ⚙️ → Mobile → Manage toolbar kholo.",
  "Toggle list aur Tools add karo; baaki purane buttons zaroorat na ho to hata do.",
  "Nesting ke liye Indent aur Outdent add karo (Obsidian ke apne Indent / Unindent buttons bhi toggle par yahi kaam karte hain).",
  "Recall aur Autoscroll ko sirf roz use karte ho to direct rakho.",
];

/** Toggle one checklist entry; returns a new array (sorted by priority). */
export function toggleGuideDone(done: string[], id: string): string[] {
  const set = new Set(done);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  return TOOLBAR_COMMANDS.filter((c) => set.has(c.id)).map((c) => c.id);
}

/** "3/10" style progress for the checklist. */
export function guideProgress(done: string[]): string {
  const known = new Set(TOOLBAR_COMMANDS.map((c) => c.id));
  const count = done.filter((id) => known.has(id)).length;
  return `${count}/${TOOLBAR_COMMANDS.length}`;
}

/**
 * Should the floating autoscroll button be on screen?
 * v1.2.4 — it must also be an actual markdown note view with no modal /
 * settings layer on top, so the button never floats over Settings, Search,
 * Graph, Canvas or any other non-note surface.
 */
export function fabShouldShow(
  enabled: boolean,
  noteOpen: boolean,
  _controlBarVisible = false,
  markdownViewActive = true,
  overlayOpen = false
): boolean {
  return enabled && noteOpen && markdownViewActive && !overlayOpen;
}


/* ---------- v1.1.6: shared messages + default hotkeys ---------- */

/** Shown when a running-session action is used while autoscroll is stopped. */
export const MSG_NOT_RUNNING =
  'Autoscroll band hai — pehle "Autoscroll (start / pause revision)" chalao (Ctrl/Cmd+Shift+S), ya floating ▶ dabao.';

/** Shown when the note has no toggles at all. */
export const MSG_NO_TOGGLES =
  "Is note me koi toggle nahi mila — callout (> [!note]- …) ya <details> banao, phir autoscroll chalao.";

/** v1.2.0 — no toggles at all: plain continuous scroll instead of an error. */
export const MSG_PLAIN_SCROLL =
  "Is note me koi toggle nahi mila — plain scroll chalu (koi stop nahi). Toggle chahiye to > [!note]- banao.";

export interface HotkeyHint {
  id: string;
  label: string;
}

/** Default hotkeys registered by the plugin (user can change in Settings → Hotkeys). */
export const HOTKEYS: HotkeyHint[] = [
  { id: "smart-autoscroll", label: "Ctrl/Cmd+Shift+S" },
  { id: "autoscroll-reverse", label: "Ctrl/Cmd+Shift+R" },
  { id: "autoscroll-sheet", label: "Ctrl/Cmd+Shift+A" },
];

/** Hotkey label for a command id, or "" when it has no default. */
export function hotkeyLabel(id: string): string {
  return HOTKEYS.find((h) => h.id === id)?.label ?? "";
}
