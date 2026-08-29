/**
 * v1.3.1 — the toggle colour palette, shared by main.ts and the modals.
 * Pure data + one lookup, no Obsidian imports.
 */
export const CALLOUT_TYPES = ["question", "info", "note", "abstract", "tip", "warning", "success"];
/** Notion-like colour palette. Each colour is its own callout type styled in styles.css. */
export const TOGGLE_COLORS: { id: string; label: string; callout: string }[] = [
  { id: "default", label: "Default (callout type below)", callout: "" },
  { id: "red", label: "🔴 Red — hard / stop", callout: "recall-red" },
  { id: "yellow", label: "🟡 Yellow — revise", callout: "recall-yellow" },
  { id: "green", label: "🟢 Green — mastered", callout: "recall-green" },
  { id: "blue", label: "🔵 Blue — concept", callout: "recall-blue" },
  { id: "purple", label: "🟣 Purple — theory", callout: "recall-purple" },
  { id: "orange", label: "🟠 Orange — formula", callout: "recall-orange" },
  { id: "gray", label: "⚪ Gray — extra", callout: "recall-gray" },
  { id: "plain", label: "⬛ Black / plain — clean Notion look", callout: "recall-plain" },
];

/** Resolve a colour id to its callout type, falling back to the plain type. */
export function calloutForColor(colorId: string, fallback: string): string {
  const found = TOGGLE_COLORS.find((c) => c.id === colorId);
  return found && found.callout ? found.callout : fallback;
}
