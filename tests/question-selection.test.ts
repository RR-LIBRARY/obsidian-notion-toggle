import { describe, expect, it } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
if (!globalThis.document) GlobalRegistrator.register();
import { sourceQuestions, sourceQuestionFor, parseQuestionSelection, questionRoute } from "../src/question-selection";
import { sessionStops } from "../src/run-session";
const note = Array.from({ length: 50 }, (_, i) => `> [!question]- Q${i + 1}. Question\n> > [!answer]- Answer\n> > body\n`).join("\n");
describe("question start and sequence", () => {
  it("35 means labelled Q35 even when two earlier question numbers are absent", () => {
    const source = note.replace(/> \[!question\]- Q[12]\. Question\n> > \[!answer\]- Answer\n> > body\n/g, "");
    const el = document.createElement("div"); el.dataset.callout = "question";
    el.innerHTML = '<div class="callout-title-inner">Q35. Question<span class="ntt-think-badge">🤔3</span></div>';
    const hit = sourceQuestionFor(el, source);
    expect(hit?.question).toBe(35);
    expect(hit?.ordinal).toBe(65);
    expect(sessionStops(sourceQuestions(source).filter(q => q.root), { scrollStartNumber: 35, scrollMode: "all", scrollReverse: false })[0].question).toBe(35);
  });
  it("35,40,48 is parsed in the typed order and maps to source ordinals, not nested answers", () => {
    expect(parseQuestionSelection("35, 40, 48")).toEqual([35,40,48]);
    expect(questionRoute(note, [35,40,48])).toEqual([69,79,95]);
    expect(sessionStops(sourceQuestions(note).filter(q => q.root), { scrollStartNumber: 35, scrollStartSequence: [35,40,48], scrollMode: "all", scrollReverse: false }).map(q => q.question)).toEqual([35,40,48]);
  });
  it("ranges expand and invalid input does not silently change the selection", () => {
    expect(parseQuestionSelection("35-37,40,48")).toEqual([35,36,37,40,48]);
    expect(parseQuestionSelection("35,")).toBeNull(); expect(parseQuestionSelection("0")).toBeNull();
  });
  it("plain callouts and fenced examples do not shift the numbered question", () => {
    expect(sourceQuestions('> [!note] intro\n```md\n> [!question]- example\n```\n' + note).find(q => q.question === 35)?.ordinal).toBe(69);
  });
  it("Odd uses actual question numbers from 35: 35,37,39,41", () => {
    expect(sessionStops(sourceQuestions(note).filter(q => q.root), { scrollStartNumber: 35, scrollMode: "odd", scrollReverse: false }).slice(0,4).map(q => q.question)).toEqual([35,37,39,41]);
  });
  it("Even uses actual question numbers from 35: 36,38,40,42", () => {
    expect(sessionStops(sourceQuestions(note).filter(q => q.root), { scrollStartNumber: 35, scrollMode: "even", scrollReverse: false }).slice(0,4).map(q => q.question)).toEqual([36,38,40,42]);
  });
  it("Odd and Even also intersect a typed list", () => {
    const s = { scrollStartNumber:35, scrollStartSequence:[35,40,48], scrollReverse:false };
    expect(sessionStops(sourceQuestions(note).filter(q => q.root), {...s,scrollMode:"odd"}).map(q => q.question)).toEqual([35]);
    expect(sessionStops(sourceQuestions(note).filter(q => q.root), {...s,scrollMode:"even"}).map(q => q.question)).toEqual([40,48]);
  });
});