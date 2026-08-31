/**
 * v1.5.0 — the callout playground note.
 *
 * A generated note with one live example per supported kind, each labelled with
 * its filter name, the words Obsidian accepts and the deep link that runs only
 * that kind. Running autoscroll or quiz on this note is the fastest way to see
 * that `!important`, `!todo`, `!bug` … really are filterable.
 *
 * Pure module — returns markdown, writes nothing.
 */

import { CALLOUT_KINDS, GRADED_COLORS, type RecallColor } from "./autoscroll";
import { kindWords, metaOf } from "./callout-catalog";

export const PLAYGROUND_BASENAME = "Callout playground";

function example(kind: RecallColor, n: number): string {
  const m = metaOf(kind);
  const word = GRADED_COLORS.includes(kind) ? `recall-${kind}` : kind;
  return [
    `> [!${word}]- **${n}. ${m.icon} ${m.name}**`,
    `> Filter name: **${m.name}**`,
    `> Types that match: ${kindWords(kind)}`,
    `> Deep link: \`obsidian://notion-toggle?action=autoscroll&filter=${m.param}\``,
    ">",
    `> Ye answer ${m.icon} ${m.name} filter chunne par hi khulega.`,
    "",
  ].join("\n");
}

/** The whole playground note. */
export function playgroundMarkdown(): string {
  const kinds: RecallColor[] = [...GRADED_COLORS, ...CALLOUT_KINDS];
  const body = kinds.map((k, i) => example(k, i + 1)).join("\n");
  return [
    "# Callout playground",
    "",
    "Har supported toggle type ka ek live example. Autoscroll ya Quiz kholo,",
    "filter picker me koi bhi type chuno, aur dekho ki sirf wahi toggles ruk rahe hain.",
    "",
    `Total examples: ${kinds.length} (3 traffic light + ${CALLOUT_KINDS.length} built-in callouts).`,
    "",
    "Numbers note ke asli toggle numbers hain — \"Odd toggles (1, 3, 5 …)\" inhi par chalta hai.",
    "",
    "---",
    "",
    body,
    "---",
    "",
    "## Counts",
    "",
    "Stats panel (Autoscroll revision stats) me **Callout breakdown** table har type ka",
    "count aur percentage dikhata hai, aur \"Copy callout breakdown\" command wahi table",
    "clipboard par de deta hai.",
    "",
  ].join("\n");
}

/** First free file name: "Callout playground.md", then " 2", " 3" … */
export function playgroundPath(exists: (path: string) => boolean, folder = ""): string {
  const dir = folder ? `${folder.replace(/\/+$/, "")}/` : "";
  let name = `${dir}${PLAYGROUND_BASENAME}.md`;
  let n = 2;
  while (exists(name)) {
    name = `${dir}${PLAYGROUND_BASENAME} ${n}.md`;
    n += 1;
  }
  return name;
}
