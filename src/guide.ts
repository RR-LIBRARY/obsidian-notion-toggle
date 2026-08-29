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
  {
    id: "smart-autoscroll",
    name: "Autoscroll (start / pause revision)",
    why: "Ek tap se autoscroll shuru ya pause — sabse zaroori.",
    priority: 1,
  },
  {
    id: "autoscroll-sheet",
    name: "Autoscroll: sheet (all controls)",
    why: "Saare controls — speed, pause, filter, mode — ek sheet me.",
    priority: 2,
  },
  {
    id: "autoscroll-reverse",
    name: "Autoscroll: reverse direction",
    why: "Fast revision ke liye neeche → upar scroll.",
    priority: 3,
  },
  {
    id: "autoscroll-filter",
    name: "Autoscroll: choose colour filter",
    why: "Sirf 🔴 / 🟡 / 🟢 toggles par rukna ho to.",
    priority: 4,
  },
  {
    id: "autoscroll-mode",
    name: "Autoscroll: pause at (odd / even / custom / route / shuffle)",
    why: "Kaunse toggles par rukna hai — odd/even/route/shuffle.",
    priority: 5,
  },
  {
    id: "autoscroll-dwell",
    name: "Autoscroll: pause for (hold time)",
    why: "Har toggle par kitni der ruke (5s … 1h).",
    priority: 6,
  },
  {
    id: "autoscroll-speed-presets",
    name: "Autoscroll: speed presets (0.02x … 20x)",
    why: "Reader wali speed chips — 0.02x se 20x tak.",
    priority: 7,
  },
  {
    id: "autoscroll-top",
    name: "Autoscroll: go to first toggle",
    why: "Wapas note ke shuruaat / aakhir par jump.",
    priority: 8,
  },
  {
    id: "scroll-stats",
    name: "Autoscroll: revision stats (weak toggles)",
    why: "Shuffle kis ko pehle laata hai aur kyun — FSRS stats.",
    priority: 9,
  },
  {
    id: "autoscroll-stop",
    name: "Autoscroll: stop",
    why: "Session poori tarah band kare (floating bar ka ✕ bhi yehi karta hai).",
    priority: 10,
  },
  {
    id: "smart-quiz",
    name: "Quiz (timed question run)",
    why: "Toolbar se ek tap me quiz mode — timer, auto reveal, auto next.",
    priority: 11,
  },
  {
    id: "quiz-pause",
    name: "Quiz: pause / resume",
    why: "Quiz ke beech me rukna ho to — wahi tap se resume.",
    priority: 12,
  },
];


/** Toolbar steps shown at the top of the guide. */
export const TOOLBAR_STEPS: string[] = [
  "Obsidian me Settings ⚙️ kholo.",
  "Mobile section me jao → Manage toolbar.",
  "Wahan + / Add command dabao aur neeche wali commands ek-ek karke add karo.",
  "Jo add ho gayi, us row par tap karke tick ✓ kar do — list yaad rehti hai.",
  "Ab koi note kholo aur toolbar se ▶ Autoscroll ya ❓ Quiz dabao — bas!",
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
 * Shown only when the user enabled it, a note is open, and the running
 * control bar (start/pause session) is not already visible.
 */
export function fabShouldShow(
  enabled: boolean,
  noteOpen: boolean,
  _controlBarVisible = false
): boolean {
  // v1.1.6 — the button now stays on screen during a running session too,
  // so pause / reverse are always one tap away (CSS offsets it above the bar).
  return enabled && noteOpen;
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
