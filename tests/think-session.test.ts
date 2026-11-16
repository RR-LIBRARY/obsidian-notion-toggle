import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { describe, expect, test } from "bun:test";
if (!globalThis.document) GlobalRegistrator.register();
import Plugin from "../main";
import { ThinkGate } from "../src/think-gate";
import { toggleIdentity, isToggleOpen } from "../src/toggle-dom";
import { DEFAULT_AUTOSCROLL } from "../src/autoscroll";
import { sessionStops, nextRouteIndex } from "../src/run-session";
function fixture(mode = "all") {
 document.body.innerHTML = '<div class="markdown-preview-view" id="note">'+[1,2,3,4].map(n=>`<div class="callout is-collapsible" data-callout="recall-${n%2 ? 'red':'green'}" id="q${n}"><div class="callout-title"><div class="callout-title-inner">Q${n}</div><div class="callout-fold"></div></div><div class="callout-content">one two three</div></div>`).join('')+'</div>';
 const note = document.getElementById('note'); if (!note) throw Error('note');
 Object.defineProperty(note,'scrollHeight',{value:4000}); Object.defineProperty(note,'clientHeight',{value:800});
 const source=[1,2,3,4].map(n=>`> [!recall-${n%2?'red':'green'}]- Q${n}\n> one two three\n`).join('\n');
 const file={path:'test.md'};const view={file,data:source,editor:{getValue:()=>source},getMode:()=> 'preview',contentEl:note,previewMode:{containerEl:note}};
 const plugin=new Plugin({workspace:{getActiveFile:()=>file,getActiveViewOfType:()=>view}} as never,{} as never);
 plugin.settings={...plugin.settings,...DEFAULT_AUTOSCROLL,scrollMode:mode as 'all',scrollFocusChrome:false,scrollFab:false,scrollQuiet:true,scrollBarClassic:false,scrollThinkSeconds:1,scrollHold:2,scrollChunkTall:false};
 const run=plugin as any;run.scheduleScrollFrame=()=>{};run.findScrollContainer=()=>note;run.findViewContainer=()=>note;run.beginFullRender=()=>false;run.renderScrollBar=()=>{};run.syncScrollFab=()=>{};run.syncHoldPause=()=>{};run.saveSettings=async()=>{};
 const el=document.getElementById('q1');if (!el) throw Error('question');
 return {plugin,run,note,el};
}
describe('Think sessions 1.9.31',()=>{
 test('filtered routes skip absent waypoints and terminate when no matches remain',()=>{ expect(nextRouteIndex([1,2,3,4],0,[2,4],false)).toBe(1); expect(nextRouteIndex([1,2],0,[3],true)).toBeNull(); expect(nextRouteIndex([1,2],2,[2],false)).toBeNull(); });
 test('default sequence and chosen source number survive red filtering',()=>{
  const items=[1,3,5,7].map(ordinal=>({ordinal}));
  expect(sessionStops(items,DEFAULT_AUTOSCROLL).map(t=>t.ordinal)).toEqual([1,3,5,7]);
  expect(sessionStops(items,{...DEFAULT_AUTOSCROLL,scrollStartNumber:4}).map(t=>t.ordinal)).toEqual([5,7]);
 });
 test('timer really closes an already open arrow and opens at zero',()=>{
  const {el}=fixture();const gate=new ThinkGate();gate.begin(el,{scrollThinkEnabled:true,scrollThinkSeconds:3},100);
  expect(isToggleOpen(el)).toBe(false);expect(gate.tick(3099)).toBe(false);expect(gate.tick(3100)).toBe(true);expect(isToggleOpen(el)).toBe(true);gate.clear();
 });
 test('tap reveals physically without native click closing it again',()=>{
  const {el}=fixture();const row=el.querySelector('.callout-title') as HTMLElement;row.addEventListener('click',()=>el.classList.toggle('is-collapsed'));
  const gate=new ThinkGate();gate.begin(el,{scrollThinkEnabled:true,scrollThinkSeconds:3},100);row.click();expect(isToggleOpen(el)).toBe(true);expect(gate.thinking).toBe(false);
 });
 test('badge does not change details or fallback callout identity',()=>{
  const {el}=fixture();el.querySelector('.callout-title-inner')?.classList.remove('callout-title-inner');const before=toggleIdentity(el);const gate=new ThinkGate();gate.begin(el,{scrollThinkEnabled:true,scrollThinkSeconds:3},100);expect(toggleIdentity(el)).toBe(before);gate.clear();
 });
 test('late frame reveals and preserves full answer dwell',()=>{
  const {run,plugin,el,note}=fixture();run.scrollContainer=note;plugin.scrollRunning=true;run.scrollElByOrdinal=new Map([[1,el]]);run.scrollElByIdentity=new Map();run.parkOnToggle(1,100);run.scrollDwellUntil=3100;run.autoScrollFrame(10000);expect(isToggleOpen(el)).toBe(true);expect(run.scrollDwellUntil).toBe(12000);plugin.stopAutoScroll(false);
 });
 test('hold pause shifts Think deadline as well as dwell',()=>{
  const {run,plugin,el}=fixture();run.thinkGate.begin(el,{scrollThinkEnabled:true,scrollThinkSeconds:3},100);run.scrollDwellUntil=5100;run.scrollHoldPaused=true;run.scrollHoldAt=performance.now()-5000;const before=run.thinkGate.revealAt;plugin.holdPauseEnd();expect(run.thinkGate.revealAt-before).toBeGreaterThanOrEqual(4999);expect(run.scrollDwellUntil).toBeGreaterThanOrEqual(10099);run.thinkGate.clear();
 });
 test('live red-to-green change clears old countdown and only measures green',async()=>{
  const {run,plugin,el,note}=fixture();run.scrollContainer=note;run.scrollPlan=[{}];run.scrollElByOrdinal=new Map([[1,el]]);run.scrollElByIdentity=new Map();run.parkOnToggle(1,100);await plugin.setScrollFilter(['green']);expect(run.thinkGate.thinking).toBe(false);expect(isToggleOpen(el)).toBe(false);expect(el.querySelector('.ntt-think-badge')).toBeNull();run.measureScrollBoxes(note);expect(run.scrollBoxes.map((b:any)=>b.page)).toEqual([2,4]);
 });
 test('last route question keeps running until reveal plus read dwell ends',()=>{
  const {run,plugin,el,note}=fixture('route');plugin.settings.scrollRoute=[1];run.scrollContainer=note;plugin.scrollRunning=true;run.scrollRouteIdx=1;run.scrollElByOrdinal=new Map([[1,el]]);run.scrollElByIdentity=new Map();run.parkOnToggle(1,100);run.scrollDwellUntil=3100;run.autoScrollFrame(1100);expect(isToggleOpen(el)).toBe(true);expect(plugin.scrollRunning).toBe(true);run.autoScrollFrame(3100);expect(plugin.scrollRunning).toBe(false);
 });
 test('browse filter is suspended before selecting scroller and throughout pause',()=>{
  const {run,plugin,note}=fixture();run.findScrollContainer=()=>{expect(document.body.classList.contains('ntt-review-session')).toBe(true);return note;};plugin.startAutoScroll();plugin.toggleAutoScroll();expect(document.body.classList.contains('ntt-review-session')).toBe(true);plugin.stopAutoScroll(false);expect(document.body.classList.contains('ntt-review-session')).toBe(false);
 });
});
