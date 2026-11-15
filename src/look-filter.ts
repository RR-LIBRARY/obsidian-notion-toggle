/**
 * Choose the rendered appearance of each foldable callout without changing its
 * Markdown. Notion is the default; selected callout types keep Obsidian's
 * native icon, tinted background and chevron.
 */
import { CALLOUT_TYPES, TOGGLE_COLORS } from "./toggle-colors";

export const NATIVE_CALLOUT_CLASS = "ntt-native-callout";

export interface CalloutLookSettings {
  notionLook: boolean;
  /** Types that must remain native Obsidian callouts while Notion look is on. */
  calloutLookTypes?: string[];
}

export const CALLOUT_LOOK_OPTIONS: { type: string; label: string }[] = [
  ...CALLOUT_TYPES.map((type) => ({ type, label: type[0].toUpperCase() + type.slice(1) })),
  ...TOGGLE_COLORS.filter((color) => color.callout).map((color) => ({ type: color.callout, label: color.label })),
];

export function normalizeCalloutTypes(types: readonly string[] | undefined): string[] {
  return Array.from(new Set((types ?? []).map((type) => type.trim().toLowerCase()).filter(Boolean)));
}

/** True when this type gets the plain Notion treatment. */
export function usesNotionLook(type: string, settings: CalloutLookSettings): boolean {
  if (!settings.notionLook) return false;
  return !normalizeCalloutTypes(settings.calloutLookTypes).includes(type.trim().toLowerCase());
}

/**
 * Tag rendered callouts for the stylesheet. Re-running after a settings change
 * removes stale classes, so one note can freely mix both appearances.
 */
export function paintCalloutLooks(root: ParentNode, settings: CalloutLookSettings): number {
  const found = Array.from(root.querySelectorAll<HTMLElement>(".callout.is-collapsible[data-callout]"));
  if (root instanceof HTMLElement && root.matches(".callout.is-collapsible[data-callout]")) found.unshift(root);
  let count = 0;
  for (const el of new Set(found)) {
    const native = !usesNotionLook(el.dataset.callout ?? "", settings);
    el.classList.toggle(NATIVE_CALLOUT_CLASS, native);
    count++;
  }
  return count;
}

export function calloutLookSummary(settings: CalloutLookSettings): string {
  if (!settings.notionLook) return "Every type: native callout";
  const count = normalizeCalloutTypes(settings.calloutLookTypes).length;
  if (!count) return "Every type: Notion toggle";
  return `${count} type${count === 1 ? "" : "s"}: native callout; others: Notion toggle`;
}
