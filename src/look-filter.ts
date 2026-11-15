import { CALLOUT_TYPES, TOGGLE_COLORS } from './toggle-colors';
import { sourceToggleHeaders, titleNumber } from './toggle-review';
export const NATIVE_CALLOUT_CLASS = 'ntt-native-callout';
export interface ToggleLookRule { numbers: string; look: 'notion' | 'callout' }
export interface CalloutLookSettings { notionLook: boolean; calloutLookTypes?: string[]; toggleLookRules?: Record<string,ToggleLookRule>; reviewColorFilters?: Record<string,string[]> }
export { parseToggleNumbers as parseLookNumbers, titleNumber as titleToggleNumber } from './toggle-review';
import { parseToggleNumbers } from './toggle-review';
export const CALLOUT_LOOK_OPTIONS = [...CALLOUT_TYPES.map(type => ({type,label:type[0].toUpperCase()+type.slice(1)})), ...TOGGLE_COLORS.filter(c => c.callout).map(c => ({type:c.callout,label:c.label}))];
export function normalizeCalloutTypes(types: readonly string[] | undefined): string[] { return Array.from(new Set((types??[]).map(t=>t.trim().toLowerCase()).filter(Boolean))); }
export function usesNotionLook(type:string, settings:CalloutLookSettings):boolean { return settings.notionLook && !normalizeCalloutTypes(settings.calloutLookTypes).includes(type.trim().toLowerCase()); }
export function toggleUsesNotion(type:string,title:string,settings:CalloutLookSettings,path='',ordinal?:number):boolean {
  const rule=settings.toggleLookRules?.[path], n=titleNumber(title)??ordinal;
  if (rule && n !== undefined && parseToggleNumbers(rule.numbers)?.some(([a,b])=>n>=a&&n<=b)) return rule.look==='notion';
  return usesNotionLook(type,settings);
}
const SELECTOR='.callout.is-collapsible[data-callout], details';
function titleOf(el:HTMLElement):string { return el.querySelector(el.tagName.toLowerCase()==='details'?':scope > summary':':scope > .callout-title > .callout-title-inner')?.textContent?.trim()??''; }
function plainTitle(title:string):string { return title.replace(/\*\*|__|`/g,'').trim(); }
/** Exact source line when supplied; unique title otherwise, never guess from viewport order. */
export function assignSourceOrdinals(root:ParentNode,text:string,path:string,lineStart?:number):void {
  const headers=sourceToggleHeaders(text);
  const found=Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  if(root instanceof HTMLElement && root.matches(SELECTOR)) found.unshift(root);
  for(const el of found){
    el.dataset.nttLookPath=path;
    const dataLine=el.closest<HTMLElement>('[data-line]')?.dataset.line;
    const line=dataLine!==undefined?Number(dataLine):(el===root?lineStart:undefined);
    const matches=headers.filter(h=>plainTitle(h.title)===titleOf(el));
    const source=headers.find(h=>line!==undefined&&h.line===line&&plainTitle(h.title)===titleOf(el))??(matches.length===1?matches[0]:undefined);
    if(source) el.dataset.nttLookOrdinal=String(source.ordinal); else delete el.dataset.nttLookOrdinal;
  }
}
export function paintCalloutLooks(root:ParentNode,settings:CalloutLookSettings,path=''):number {
  const found=Array.from(root.querySelectorAll<HTMLElement>(SELECTOR));
  if(root instanceof HTMLElement && root.matches(SELECTOR)) found.unshift(root);
  for(const el of new Set(found)){
    const sourcePath=path||el.closest<HTMLElement>('[data-ntt-look-path]')?.dataset.nttLookPath||'';
    const native=!toggleUsesNotion(el.dataset.callout??'details',titleOf(el),settings,sourcePath,el.dataset.nttLookOrdinal?Number(el.dataset.nttLookOrdinal):undefined);
    el.classList.toggle(NATIVE_CALLOUT_CLASS,native);el.classList.toggle('ntt-notion-callout',!native);
    const filter=settings.reviewColorFilters?.[sourcePath]??[];
    const grade=(el.dataset.callout??el.className.split(/\s+/).find(c=>c.startsWith('recall-'))??'').replace(/^recall-/,'');
    const nested=Array.from(el.querySelectorAll<HTMLElement>(SELECTOR)).some(c=>filter.includes((c.dataset.callout??'').replace(/^recall-/,'')));
    el.classList.toggle('ntt-review-filtered-out',filter.length>0&&!filter.includes(grade)&&!nested);
  }
  return new Set(found).size;
}
export function watchCalloutLooks(root:HTMLElement,repaint:()=>void):()=>void {
  let frame=0,disposed=false;
  const observer=new MutationObserver(()=>{if(frame||disposed)return;frame=requestAnimationFrame(()=>{frame=0;if(!disposed)repaint();});});
  observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-callout','data-line']});repaint();
  return()=>{disposed=true;observer.disconnect();if(frame)cancelAnimationFrame(frame);};
}
/** Hide only in normal browsing; these existing run classes are set before any measurements. */
export function calloutLookSummary(s:CalloutLookSettings):string {
  if(!s.notionLook)return 'Every type: native callout';
  const count=normalizeCalloutTypes(s.calloutLookTypes).length;
  return count?`${count} type${count===1?'':'s'}: native callout; others: Notion toggle`:'Every type: Notion toggle';
}
