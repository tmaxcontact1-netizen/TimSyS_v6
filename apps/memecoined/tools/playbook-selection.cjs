// Frozen 1b v2 measurement primitives; no order, fill, outcome or P&L machinery.
const M=require('./playbook-measurements.cjs');
function pivots(rows,timeframe){const out=[];for(let i=2;i+2<rows.length;i++)for(const side of M.pivotAt(rows,i))out.push({id:`${timeframe}:${side}:${rows[i][0]}`,index:i,side,timeframe,centerOpen:rows[i][0],availableAt:rows[i+2][1]+1,value:Number(rows[i][side==='low'?4:3])});return out;}
function lastClosed(rows,instant){let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>1;if(rows[mid][1]+1<=instant)lo=mid+1;else hi=mid;}return lo-1;}
function select(rows,pool,event,lookback,tick,timeframe){
 const k=lastClosed(rows,event.sweepAvailableAt),need=lookback+4,step=rows[0]?.[10];
 if(k+1<need||rows[k][0]-rows[k-need+1][0]!==step*(need-1))return {discarded:true,reason:'warmup'};
 const candidates=pool.filter(p=>p.side==='low'&&p.index>=k-lookback+1&&p.index<=k-2&&p.availableAt<=event.sweepAvailableAt&&event.sweepLow<p.value*.999&&event.referencePrice>p.value)
  .map(p=>({...p,distanceBps:(event.referencePrice-p.value)/event.referencePrice*10000}));
 candidates.sort((a,b)=>a.distanceBps-b.distanceBps||b.availableAt-a.availableAt||a.timeframe.localeCompare(b.timeframe));
 const selected=candidates[0]||null;
 return {discarded:false,timeframe,lookback,candidates:candidates.length,selected,distanceBps:selected?.distanceBps??null,stopProxy:event.sweepLow-tick,rBps:(event.referencePrice-(event.sweepLow-tick))/event.referencePrice*10000};
}
function monthly(pool,start,end){const result={},seen=new Set();for(const p of pool){if(p.availableAt<start||p.availableAt>=end)continue;if(seen.has(p.id))throw Error('Duplicate pivot identity');seen.add(p.id);const key=new Date(p.availableAt).toISOString().slice(0,7);result[key]??={high:0,low:0,total:0};result[key][p.side]++;result[key].total++;}return result;}
function exposure(month,start,end){const a=Date.parse(month+'-01T00:00:00Z'),b=new Date(a);b.setUTCMonth(b.getUTCMonth()+1);return Math.max(0,(Math.min(end,b.valueOf())-Math.max(start,a))/M.DAY);}
module.exports={pivots,lastClosed,select,monthly,exposure};
