import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveOutfitConfirmed} from '../frontend/src/save-outfit.js';
test('save confirms persistence by returned ID and suppresses premature generic success',async()=>{
 const calls=[];const outfit={id:'saved-1',name:'Work outfit'};
 const api=async(url,options)=>{calls.push({url,options});return options?outfit:{items:[outfit]};};
 assert.deepEqual(await saveOutfitConfirmed(api,{name:outfit.name}),{saved:outfit,items:[outfit]});
 assert.equal(calls[0].options.actionFeedback,false);assert.equal(calls[1].options,undefined);
});
test('an accepted action without an outfit is not success',async()=>{await assert.rejects(saveOutfitConfirmed(async()=>({accepted:true}),{}),/no save has been confirmed/);});
test('missing read-back rejects success even if another outfit has the same name',async()=>{
 await assert.rejects(saveOutfitConfirmed(async(url,options)=>options?{id:'new',name:'Work'}:{items:[{id:'old',name:'Work'}]},{}),/missing from Saved outfits/);
});
test('read-back failure warns about possible persistence and does not retry the save',async()=>{
 let writes=0;await assert.rejects(saveOutfitConfirmed(async(url,options)=>{if(options){writes++;return {id:'new',name:'Work'};}throw Error('offline');},{}),/avoid a duplicate/);assert.equal(writes,1);
});
