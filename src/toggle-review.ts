/** Source positions shared by presentation numbering and grade edits. */
export interface ToggleHeader { line: number; ordinal: number; number: number; title: string; kind: string; text: string; details: boolean }
export function parseToggleNumbers(input: string): [number, number][] | null {
  if (!input.trim()) return [];
  const ranges: [number, number][] = [];
  for (const part of input.replace(/[–—]/g, '-').split(',')) {
    const m = part.trim().match(/^(?:Q\s*)?(\d+)(?:\s*-\s*(?:Q\s*)?(\d+))?$/i);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || a < 1 || b < a) return null;
    ranges.push([a,b]);
  }
  return ranges;
}
export function titleNumber(title: string): number | undefined {
  const m = title.trim().replace(/^\*\*|\*\*$/g, '').match(/^(?:Q(?:uestion)?\s*#?\s*)?(\d+)(?:[.)、:：\s]|$)/i);
  return m ? Number(m[1]) : undefined;
}
export function sourceToggleHeaders(text: string): ToggleHeader[] {
  const lines = text.split('\n'), headers: ToggleHeader[] = [];
  let fence: { char: string; length: number; depth: number } | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prefix = line.match(/^\s*((?:>\s*)*)/);
    const depth = (prefix?.[1].match(/>/g) ?? []).length;
    if (fence && depth < fence.depth) fence = undefined;
    const plain = line.slice(prefix?.[0].length ?? 0);
    const marker = plain.match(/^(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim() && depth === fence.depth) fence = undefined;
      continue;
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length, depth }; continue; }
    // Indented code is not a live card.
    if (depth === 0 && /^(?: {4}|\t)/.test(line)) continue;
    const callout = line.match(/^\s*(?:>\s*)+\[!([^\]]+)\]([+-])(.*)$/);
    const details = line.match(/<details\b[^>]*>/i);
    if (!callout && !details) continue;
    const title = callout?.[3]?.trim() ?? lines.slice(i).join('\n').match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1]?.replace(/<[^>]+>/g,'').trim() ?? '';
    const ordinal = headers.length + 1;
    headers.push({ line:i, ordinal, number:titleNumber(title) ?? ordinal, title, kind:callout?.[1] ?? details?.[0].match(/data-callout=["']([^"']+)["']/i)?.[1] ?? 'details', text:line, details:!!details });
  }
  return headers;
}
export type ReviewGrade = 'red' | 'yellow' | 'green';
export function gradeNumberEdits(text: string, numbers: string, grade: ReviewGrade): {line: number; text: string}[] {
  const ranges = parseToggleNumbers(numbers);
  if (!ranges?.length) return [];
  return sourceToggleHeaders(text).filter(h => ranges.some(([a,b]) => h.number >= a && h.number <= b)).map(h => ({line:h.line, text:h.details
    ? h.text.replace(/<details\b[^>]*>/i, tag => tag.replace(/\sdata-callout=(?:"[^"]*"|'[^']*')/gi,'').replace(/>$/,` data-callout="recall-${grade}">`))
    : h.text.replace(/\[![^\]]+\]/, `[!recall-${grade}]`)
  })).filter(edit => text.split('\n')[edit.line] !== edit.text);
}
/** One undoable transaction; avoids whole-document setters and keeps cursor mapping native. */
export function applyGradeEdits(editor: {getLine(line:number):string; transaction(tx:{changes:{from:{line:number;ch:number};to:{line:number;ch:number};text:string}[]}):void}, edits: {line:number;text:string}[]): void {
  if (!edits.length) return;
  editor.transaction({changes:edits.map(e => ({from:{line:e.line,ch:0},to:{line:e.line,ch:editor.getLine(e.line).length},text:e.text}))});
}
