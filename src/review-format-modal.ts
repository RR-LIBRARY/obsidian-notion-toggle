import { App, Modal, Notice, Setting } from 'obsidian';
import { parseLookNumbers, type ToggleLookRule } from './look-filter';
import type { ReviewGrade } from './toggle-review';
export class ToggleNumberFormatModal extends Modal {
  constructor(app:App,private rule:ToggleLookRule|undefined,private apply:(r:ToggleLookRule|undefined)=>Promise<void>|void){super(app);}
  onOpen():void {
    this.setTitle('Toggle numbers: appearance');this.contentEl.addClass('ntt-review-modal');
    let numbers=this.rule?.numbers??'',look=this.rule?.look??'callout';
    new Setting(this.contentEl).setName('Numbers / ranges').setDesc('Q6–Q11, 13. Printed numbers first; otherwise source order. One selection per note.')
      .addText(c=>c.setPlaceholder('6-11, 13').setValue(numbers).onChange(v=>{numbers=v;}));
    new Setting(this.contentEl).setName('Selected toggles').addDropdown(c=>c.addOption('callout','Native callouts').addOption('notion','Notion toggles').setValue(look).onChange(v=>{look=v==='notion'?'notion':'callout';}));
    new Setting(this.contentEl).setName('Apply to this note').addButton(c=>c.setButtonText('Apply').setCta().onClick(async()=>{
      if(!parseLookNumbers(numbers)?.length){new Notice('Enter valid ranges such as 6-11, 13.');return;}await this.apply({numbers:numbers.trim(),look});this.close();
    })).addButton(c=>c.setButtonText('Reset this note').onClick(async()=>{await this.apply(undefined);this.close();}));
  }
  onClose():void{this.contentEl.empty();}
}
export class ReviewColorModal extends Modal {
  constructor(app:App,private filter:string[],private setFilter:(c:string[])=>Promise<void>,private grade:(n:string,g:ReviewGrade)=>Promise<number>){super(app);}
  onOpen():void {
    this.setTitle('Review: red / yellow / green');this.contentEl.addClass('ntt-review-modal');
    let numbers='',grade:ReviewGrade='red';
    new Setting(this.contentEl).setName('Grade toggle numbers').setDesc('Ungraded cards appear under All. Choose numbers to grade them first.')
      .addText(c=>c.setPlaceholder('6-11, 13').onChange(v=>{numbers=v;}));
    new Setting(this.contentEl).setName('Grade').addDropdown(c=>c.addOption('red',"🔴 Red — didn’t know").addOption('yellow','🟡 Yellow — half known').addOption('green','🟢 Green — known').onChange(v=>{grade=v==='yellow'?'yellow':v==='green'?'green':'red';}))
      .addButton(c=>c.setButtonText('Grade selected').onClick(async()=>{
        if(!parseLookNumbers(numbers)?.length){new Notice('Enter valid ranges such as 6-11, 13.');return;}
        try{new Notice(`${await this.grade(numbers,grade)} toggle(s) graded ${grade}.`);}catch{new Notice('Could not grade this note. Nothing was discarded; try again.');}
      }));
    new Setting(this.contentEl).setName('Visible cards').setDesc('Browse-only filter for this note. Quiz/autoscroll use their own filters.')
      .addDropdown(c=>c.addOption('all','⚪ All').addOption('red','🔴 Red').addOption('yellow','🟡 Yellow').addOption('green','🟢 Green').addOption('weak','🔴🟡 Red + Yellow').addOption('graded','🔴🟡🟢 All graded')
        .setValue(this.filter.length===1?this.filter[0]:this.filter.length===2?'weak':this.filter.length===3?'graded':'all')
        .onChange(async v=>{await this.setFilter(v==='all'?[]:v==='weak'?['red','yellow']:v==='graded'?['red','yellow','green']:[v]);}));
  }
  onClose():void{this.contentEl.empty();}
}
