/** Source-backed question selection; displayed numbers win over positional fallbacks. */
import { sourceToggleHeaders, titleNumber } from "./toggle-review";
import { toggleTitleOf, toggleTypeOf } from "./toggle-dom";
export interface SourceQuestion { ordinal: number; question: number; line: number; kind: string; title: string; root: boolean }
const plain = (s: string) => s.replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]*>/g, "").replace(/[*_`~=]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
let cache: { text: string; entries: SourceQuestion[] } | undefined;
export function sourceQuestions(text: string): SourceQuestion[] {
  if (cache?.text === text) return cache.entries;
  let count = 0, parent = 0, htmlDepth = 0;
  const lines = text.split("\n");
  const entries = sourceToggleHeaders(text).map(h => {
    const depth = (h.text.match(/^\s*((?:>\s*)*)/)?.[1].match(/>/g) ?? []).length;
    if (h.details) htmlDepth = lines.slice(0, h.line).join("\n").split(/<details\b/i).length - lines.slice(0, h.line).join("\n").split(/<\/details>/i).length;
    const root = h.details ? htmlDepth === 0 : depth === 1;
    if (root) { count++; parent = titleNumber(plain(h.title)) ?? count; }
    return { ordinal: h.ordinal, question: parent, line: h.line, kind: h.kind.toLowerCase(), title: plain(h.title), root };
  });
  cache = { text, entries }; return entries;
}
export function sourceQuestionFor(el: HTMLElement, text: string): SourceQuestion | undefined {
  const entries = sourceQuestions(text), title = plain(toggleTitleOf(el)), kind = toggleTypeOf(el).toLowerCase();
  const matches = entries.filter(q => q.kind === kind && q.title === title);
  const line = el.closest<HTMLElement>("[data-line]")?.dataset.line;
  if (line !== undefined) { const exact = matches.find(q => q.line === Number(line)); if (exact) return exact; }
  if (matches.length === 1) return matches[0];
  const n = titleNumber(title);
  const numbered = entries.filter(q => q.root && q.question === n && q.kind === kind);
  return numbered.length === 1 ? numbered[0] : undefined;
}
export function parseQuestionSelection(input: string): number[] | null {
  const values: number[] = [];
  for (const part of input.replace(/[–—]/g, "-").split(",")) {
    const m = part.trim().match(/^(?:Q\s*)?(\d+)(?:\s*-\s*(?:Q\s*)?(\d+))?$/i);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 1 || b < a || b - a + values.length > 10000) return null;
    for (let n = a; n <= b; n++) if (!values.includes(n)) values.push(n);
  }
  return values.length ? values : null;
}
export function questionRoute(text: string, numbers: number[]): number[] {
  const entries = sourceQuestions(text);
  return numbers.flatMap(n => { const matches = entries.filter(q => q.root && q.question === n); return matches.length === 1 ? [matches[0].ordinal] : []; });
}
export function matchesQuestionParity(n: number, mode: string): boolean {
  return mode === "odd" ? n % 2 === 1 : mode === "even" ? n % 2 === 0 : true;
}
/** Seek an exact source question in either direction; never skip a lazy route waypoint. */
export function seekExactQuestion(container: HTMLElement, seen: { top: number; question?: number }[], question: number): boolean {
  if (seen.some(q => q.question === question)) return false;
  const numbers = seen.flatMap(q => q.question ? [q.question] : []);
  const direction = numbers.length && Math.min(...numbers) > question ? -1 : 1;
  const max = Math.max(0, container.scrollHeight - container.clientHeight);
  const next = Math.max(0, Math.min(max, container.scrollTop + direction * container.clientHeight * 0.7));
  if (Math.abs(next - container.scrollTop) < 1) return false;
  container.scrollTop = next; return true;
}