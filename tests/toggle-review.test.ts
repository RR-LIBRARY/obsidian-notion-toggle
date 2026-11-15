import { describe,expect,test } from 'bun:test';
import {sourceToggleHeaders,parseToggleNumbers,gradeNumberEdits,applyGradeEdits} from '../src/toggle-review';
import {assignSourceOrdinals,paintCalloutLooks,toggleUsesNotion,watchCalloutLooks} from '../src/look-filter';
import {installObsidianDom} from './research-dom';
installObsidianDom();
describe('numbered review rules',()=>{
 test('Q6–Q11 and 13 apply exactly the chosen printed numbers',()=>{
  expect(parseToggleNumbers('Q6–Q11, 13')).toEqual([[6,11],[13,13]]);
  const settings={notionLook:true,toggleLookRules:{'A.md':{numbers:'6-11,13',look:'callout' as const}}};
  for(const n of [6,7,8,9,10,11,13])expect(toggleUsesNotion('custom',`Q${n}. Test`,settings,'A.md')).toBe(false);
  for(const n of [5,12,14])expect(toggleUsesNotion('question',`Q${n}. Test`,settings,'A.md')).toBe(true);
  expect(toggleUsesNotion('question','Q6. Test',settings,'B.md')).toBe(true);
 });
 test('invalid ranges never partially apply',()=>{for(const s of ['11-6','6,cat','0','6,','1.5'])expect(parseToggleNumbers(s)).toBeNull();});
 test('quoted code fences and shorter fake closing fences never become grade targets',()=>{
  const text='> ````md\n> > [!question]- Q6. Example\n> ```\n> > [!question]- Q7. Still code\n> ````\n> [!question]- Q8. Real\n> Answer';
  expect(sourceToggleHeaders(text).map(h=>h.number)).toEqual([8]);
  expect(gradeNumberEdits(text,'6-8','red')).toEqual([{line:5,text:'> [!recall-red]- Q8. Real'}]);
 });
 test('red yellow green change only headers preserving answers, fold state, nested and details',()=>{
  const text='> [!question]- Q6. Title\n> Answer\n> > [!note]+ Q7. Nested\n> > Answer\n<details open>\n<summary>Q11. Old</summary>\nAnswer\n</details>\n> [!question]- Q12. Other';
  for(const grade of ['red','yellow','green'] as const){const edits=gradeNumberEdits(text,'6-11',grade);expect(edits.length).toBe(3);expect(edits[0].text).toBe(`> [!recall-${grade}]- Q6. Title`);expect(edits[1].text).toBe(`> > [!recall-${grade}]+ Q7. Nested`);expect(edits[2].text).toBe(`<details open data-callout="recall-${grade}">`);}
 });
 test('grade edits form one native transaction, not whole-document replacement',()=>{
  const transactions:unknown[]=[];applyGradeEdits({getLine:()=>'> [!question]- Q6',transaction:tx=>transactions.push(tx)},[{line:6,text:'> [!recall-red]- Q6'}]);
  expect(transactions).toEqual([{changes:[{from:{line:6,ch:0},to:{line:6,ch:17},text:'> [!recall-red]- Q6'}]}]);
 });
 test('late unique unnumbered titles map to source order, duplicates never guess viewport position',()=>{
  const root=document.createElement('div');root.innerHTML='<details><summary>Late</summary></details><details><summary>Same</summary></details>';
  const text='> [!question]- Earlier\n> Body\n> [!question]- Same\n> [!question]- Late\n> [!question]- Same';
  assignSourceOrdinals(root,text,'A.md');expect((root.firstElementChild as HTMLElement).dataset.nttLookOrdinal).toBe('3');expect((root.lastElementChild as HTMLElement).dataset.nttLookOrdinal).toBeUndefined();
 });
 test('red filter preserves matching nested children and resets when view changes note',()=>{
  const root=document.createElement('div');root.innerHTML='<details><summary>Parent</summary><details data-callout="recall-red"><summary>Child</summary></details></details><details data-callout="recall-green"><summary>Other</summary></details>';
  const settings={notionLook:false,reviewColorFilters:{'A.md':['red']}};
  paintCalloutLooks(root,settings,'A.md');expect(root.querySelectorAll('.ntt-review-filtered-out').length).toBe(1);expect(root.firstElementChild?.classList.contains('ntt-review-filtered-out')).toBe(false);
  paintCalloutLooks(root,settings,'B.md');expect(root.querySelectorAll('.ntt-review-filtered-out').length).toBe(0);
 });
 test('late rendering watcher applies same rule and stops after disposal',async()=>{
  const root=document.createElement('div');const stop=watchCalloutLooks(root,()=>paintCalloutLooks(root,{notionLook:false}));
  root.innerHTML='<details><summary>Late</summary></details>';await new Promise(r=>setTimeout(r,60));expect(root.querySelector('.ntt-native-callout')).toBeTruthy();stop();
  root.innerHTML='<details><summary>After disposal</summary></details>';await new Promise(r=>setTimeout(r,60));expect(root.querySelector('.ntt-native-callout')).toBeNull();
 });
});
