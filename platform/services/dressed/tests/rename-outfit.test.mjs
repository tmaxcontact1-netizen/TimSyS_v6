import {test} from 'node:test';
import assert from 'node:assert/strict';
import {InsightsRepository} from '../dist/src/infrastructure/database/insights-repository.js';
test('rename updates existing outfit identity without replacing garments or planner history',async()=>{
 const calls=[];const repo=new InsightsRepository({query:async(sql,values)=>{calls.push({sql,values});return {rows:[{id:'outfit-1',name:values[7]}]};}});
 assert.deepEqual(await repo.updateOutfit('outfit-1',{name:'Monday work'},'now'),{id:'outfit-1',name:'Monday work'});
 assert.equal(calls.length,1);assert.equal(calls[0].values[0],'outfit-1');assert.equal(calls[0].values[7],'Monday work');
 assert.match(calls[0].sql,/name=COALESCE\(\$8,name\)/);assert.match(calls[0].sql,/retired_at IS NULL/);
 assert.doesNotMatch(calls[0].sql,/INSERT|DELETE|UPDATE dressed\.(planned|wear|garments)/);
 assert.deepEqual(calls[0].values.slice(1,6),[false,null,null,false,null]);
});
test('missing or retired outfits cannot report a successful rename',async()=>{const repo=new InsightsRepository({query:async()=>({rows:[]})});assert.equal(await repo.updateOutfit('missing',{name:'New'},'now'),null);});
