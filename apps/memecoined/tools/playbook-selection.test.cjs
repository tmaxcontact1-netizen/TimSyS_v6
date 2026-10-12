const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('./playbook-selection.cjs');
const row=(i,step=900000)=>[i*step,(i+1)*step-1,'110','120','100','110','0','0',0,true,step];
test('month uses availability +1ms once; exposure never counts a warmup opening day',()=>{
 const end=Date.parse('2026-08-01T00:00:00Z'),p={id:'one',availableAt:end,side:'low'};
 assert.equal(S.monthly([p],Date.parse('2026-07-01T00:00:00Z'),Date.parse('2026-09-01T00:00:00Z'))['2026-08'].total,1);
 assert.equal(S.exposure('2026-04',Date.parse('2026-04-12T00:00:00Z'),Date.parse('2026-10-12T00:00:00Z')),19);
 assert.throws(()=>S.monthly([p,p],0,end+1));
});
test('selection respects pierce/reclaim, recency, warmup, and as-of confirmation',()=>{
 const rows=Array.from({length:60},(_,i)=>row(i)),event={sweepAvailableAt:60*900000,referencePrice:110,sweepLow:100};
 const make=(id,index,value,availableAt=55*900000)=>({id,index,value,side:'low',timeframe:'15m',availableAt});
 const pool=[make('far',50,103),make('near-old',51,108,54*900000),make('near-new',52,108,55*900000),make('future',53,109,61*900000),make('unswept',54,99),make('unreclaimed',54,111)];
 const a=S.select(rows,pool,event,12,.01,'15m');assert.equal(a.selected.id,'near-new');
 const b=S.select(rows,pool,event,48,.01,'15m');assert.equal(a.rBps,b.rBps);
 assert.equal(S.select(rows,[],event,12,.01,'15m').selected,null);
 assert.equal(S.select(rows.slice(0,10),pool,{...event,sweepAvailableAt:10*900000},12,.01,'15m').discarded,true);
});
test('bar at the event boundary is closed; one millisecond earlier cannot use it',()=>{
 const rows=[row(0)];assert.equal(S.lastClosed(rows,900000),0);assert.equal(S.lastClosed(rows,899999),-1);
});
