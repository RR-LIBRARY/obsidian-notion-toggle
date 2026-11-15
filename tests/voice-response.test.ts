import {test,expect} from 'bun:test';
import {transcribe,DEFAULT_VOICE_SETTINGS} from '../src/voice/client';
import {DictationSession} from '../src/voice/session';
const settings={...DEFAULT_VOICE_SETTINGS,voiceKey:'test-only'};
test('malformed success never silently drops recognized audio',async()=>{
 await expect(transcribe(async()=>({status:200,text:'<html>unavailable</html>'}),settings,new ArrayBuffer(4000))).rejects.toMatchObject({status:502});
});
test('empty transcript is rescued rather than treated as written',async()=>{
 let rescued=0,note='';
 const session=new DictationSession({transcribe:w=>transcribe(async()=>({status:200,text:'{"text":""}'}),settings,w),write:t=>{note+=t;},before:()=>note,rescue:async()=>{rescued++;return 'Voice recordings/retry.wav';},onPending:()=>{},onError:()=>{}});
 session.add(new ArrayBuffer(4000));await session.end();expect(rescued).toBe(1);expect(note).toContain('audio saved: Voice recordings/retry.wav');
});
test('valid sentence preserves time and count when inserted into note',async()=>{
 let note='Revision: ';
 const session=new DictationSession({transcribe:w=>transcribe(async()=>({status:200,text:'{"text":"Today I will revise biology at 7:30 and complete 12 questions."}'}),settings,w),write:t=>{note+=t;},before:()=>note,rescue:async()=>null,onPending:()=>{},onError:()=>{}});
 session.add(new ArrayBuffer(4000));await session.end();expect(note).toBe('Revision: Today I will revise biology at 7:30 and complete 12 questions.');
});
