import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewBank,adjacentStudent,scanBank,scanNeighbours,bankTotal} from './comment-builder-bank.mjs';
import {findContradictions} from './comment-builder-utils.mjs';
const bank=()=>[
 {id:'one',name:'One',options:[{id:'a',text:'{heCap} always explains answers.'},{id:'b',text:'{heCap} can explain answers.'}]},
 {id:'two',name:'Two',options:[{id:'c',text:'{he} never explains answers.'}]},
 ...['three','four','five'].map(id=>({id,name:id,options:[]}))
];
test('lowercase pronouns split contradictory sentences for every supported form',()=>{
 for(const pronoun of ['she','he','they'])assert.ok(findContradictions([{text:`${pronoun} always explains answers. ${pronoun} never explains answers.`}],{name:'Student',pronoun}).length);
});
test('preview reflects unsaved edits, additions and removals across categories',()=>{
 const categories=bank(),student={name:'Synthetic learner',pronoun:'she',selections:['b','c']};
 assert.equal(previewBank(categories,1,0,student),'She can explain answers. she never explains answers.');
 categories[0].options[1].text='{name} uses updated wording.';
 assert.equal(previewBank(categories,1,0,student),'Synthetic learner uses updated wording. she never explains answers.');
 categories[0].options=[];assert.equal(previewBank(categories,1,0,student),'she never explains answers.');
 assert.equal(previewBank(categories,0,0,null),'they never explains answers.');
});
test('navigation handles first, middle, last and missing students',()=>{
 const roster=[{id:'a'},{id:'b'},{id:'c'}];
 assert.equal(adjacentStudent(roster,'a',-1),null);assert.equal(adjacentStudent(roster,'b',-1).id,'a');
 assert.equal(adjacentStudent(roster,'b',1).id,'c');assert.equal(adjacentStudent(roster,'c',1),null);assert.equal(adjacentStudent(roster,'missing',1),null);
});
test('grammar failure still checks every combination and reports deterministic findings',async()=>{
 let calls=0;const result=await scanBank(bank(),{checkGrammar:async()=>{calls++;throw Error('offline');}});
 assert.equal(bankTotal(bank()),6);assert.equal(result.checked,6);assert.equal(calls,1);assert.equal(result.grammarAvailable,false);
 assert.ok(result.groups.some(g=>g.message==='Possible contradiction'));assert.equal(result.cancelled,false);
});
test('neighbour checking works without grammar and never mutates bank data',async()=>{
 const categories=bank(),before=JSON.stringify(categories);
 const result=await scanNeighbours(categories,1,0,{checkGrammar:async()=>{throw Error('unavailable');}});
 assert.equal(result.checked,9);assert.ok(result.groups.length);assert.equal(JSON.stringify(categories),before);
});
test('distinct grammar messages on the same excerpt remain separate',async()=>{
 const result=await scanBank(bank(),{checkGrammar:async()=>[
  {key:'kind:First message:same',message:'First message',excerpt:'same'},
  {key:'kind:Second message:same',message:'Second message',excerpt:'same'}
 ]});
 assert.equal(result.groups.find(g=>g.message==='First message').count,6);
 assert.equal(result.groups.find(g=>g.message==='Second message').count,6);
});
test('cancellation stops a large bank and stale results are marked cancelled',async()=>{
 const categories=bank();categories[0].options=Array.from({length:20},(_,i)=>({text:'Option '+i}));
 let stop=false,calls=0;const result=await scanBank(categories,{cancelled:()=>stop,checkGrammar:async()=>{calls++;return [];},onProgress:()=>{stop=true;}});
 assert.equal(result.checked,12);assert.equal(calls,12);assert.equal(result.cancelled,true);
 const during=await scanBank(bank(),{cancelled:()=>stop,checkGrammar:async()=>{throw Error('Should not run');}});assert.equal(during.checked,0);
});
test('empty bank has no invented comment combinations',async()=>{
 const result=await scanBank(bank().map(c=>({...c,options:[]})),{checkGrammar:async()=>{throw Error('Should not run');}});
 assert.equal(result.total,0);assert.equal(result.checked,0);
});
