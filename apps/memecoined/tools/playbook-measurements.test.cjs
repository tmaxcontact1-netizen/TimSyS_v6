const {test}=require('node:test'),assert=require('node:assert/strict');
const m=require('./playbook-measurements.cjs');
const row=(i,o,h,l,c,step=60000)=>[i*step,i*step+step-1,String(o),String(h),String(l),String(c),'0','0',0,true,step];
test('nearest-rank arrival includes censoring and excludes reclaim as confirmation',()=>{
 assert.equal(m.arrivalQuantile([1,2,3,null],.9),'>20');assert.equal(m.arrivalQuantile([1,2,3,null],.5),2);
 const rows=Array.from({length:22},(_,i)=>row(i,2,3,1,1));rows[0]=row(0,1,3,1,2);rows[3]=row(3,1,3,1,2);
 assert.equal(m.arrival(rows,0).bars,3);rows[3]=row(3,2,3,1,1);assert.equal(m.arrival(rows,0).bars,null);
 rows[10][0]++;assert.equal(m.arrival(rows,0).excluded,'gap');assert.equal(m.arrival(rows,20).excluded,'boundary');
});
test('2L/2R pivot is strict and requires contiguous right-side evidence',()=>{
 const rows=[row(0,2,3,1,2),row(1,2,4,1,2),row(2,2,5,.5,2),row(3,2,4,1,2),row(4,2,3,1,2)];
 assert.deepEqual(m.pivotAt(rows,2),['high','low']);assert.deepEqual(m.pivotAt(rows,3),[]);
 rows[1][3]='5';assert.deepEqual(m.pivotAt(rows,2),['low']);rows[4][0]++;assert.deepEqual(m.pivotAt(rows,2),[]);
});
test('range and p40 use declared formulas without target fitting',()=>{
 assert.equal(m.quantile([10,20,30,40,50],.4),26);assert.equal(m.rangeBps([row(0,100,110,100,105)]),1000);
 assert.equal(m.ratio([0,1]),'infinity');assert.equal(m.ratio([0,0]),null);
});
