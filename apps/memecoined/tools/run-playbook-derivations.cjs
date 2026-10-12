const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {pathToFileURL}=require('node:url');
const {atomic}=require('./validation-watchdog.cjs');
const M=require('./playbook-measurements.cjs');
const root=process.env.CRYPTOED_SOAK_OUTPUT||path.resolve(process.argv[2]);
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const yieldLoop=()=>new Promise(r=>setImmediate(r));
const step={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000};
const stateFile=path.join(root,'checkpoint.json');fs.mkdirSync(root,{recursive:true});
const previous=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):null;
const configHash=hash(config);if(previous&&previous.configHash!==configHash)throw Error('Batch configuration changed');
const state=previous||{configHash,origin:new Date().toISOString(),stage:'starting',pages:[],requests:0};
const save=()=>atomic(stateFile,state);
const report=(name,value)=>atomic(path.join(root,name+'.json'),{specCommit:config.specCommit,sourceCommit:config.sourceCommit,configHash,datasetManifestSha256:state.manifestHash,...value});
const events=path.join(root,'events.ndjson');
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({pid:process.pid,stage:state.stage,pages:state.pages.length,requests:state.requests}));});
server.listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),'127.0.0.1');
function validRow(r,s){const [t,close,o,h,l,c]=r.map(Number);return r[9]&&t%s===0&&close===t+s-1&&[o,h,l,c].every(x=>Number.isFinite(x)&&x>0)&&h>=Math.max(o,c)&&l<=Math.min(o,c)&&h>=l;}
async function main(){
 const base=path.join(__dirname,'dist/src');
 const {BinanceRestAdapter}=await import(pathToFileURL(path.join(base,'infrastructure/providers/exchange/binance-rest.js')));
 const S=await import(pathToFileURL(path.join(base,'domain/exchange/session-engine.js')));
 let lastStart=0;
 const client=async url=>{let response,error;
  for(let attempt=0;attempt<=3;attempt++){
   response=undefined;
   await pause(Math.max(0,200-(Date.now()-lastStart)));lastStart=Date.now();state.requests++;
   try{response=await fetch(url,{signal:AbortSignal.timeout(15000)});error=null;}catch(e){error=e;}
   fs.appendFileSync(path.join(root,'requests.ndjson'),JSON.stringify({at:new Date().toISOString(),url,status:response?.status||null,error:error?.message||null,latencyMs:Date.now()-lastStart,attempt})+'\n');
   if(response?.status===418)throw Error('HTTP 418: stop');
   if(!error&&response.status!==429&&response.status<500)return response;
   if(attempt===3)throw error||Error('Retry limit HTTP '+response.status);
   const retry=response?.headers.get('retry-after');let ms=1000*2**attempt;
   if(response?.status===429)ms=retry===null?60000:(Number.isFinite(Number(retry))?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now()));
   await pause(ms);
  }
 };
 const rest=new BinanceRestAdapter(config.endpoint,client),start=Date.parse(config.retrievalStart),end=Date.parse(config.end),analysisStart=Date.parse(config.analysisStart);
 state.stage='retrieving';save();
 fs.mkdirSync(path.join(root,'pages'),{recursive:true});
 for(const symbol of config.symbols)for(const interval of config.intervals){
  let cursor=start;
  while(cursor<end){
   const filename=`${symbol}-${interval}-${cursor}.json`,file=path.join(root,'pages',filename),prior=state.pages.find(p=>p.filename===filename);let rows;
   if(prior){const text=fs.readFileSync(file,'utf8');if(hash(text)!==prior.sha256)throw Error('Page hash changed '+filename);rows=JSON.parse(text);}
   else{
    const candles=await rest.candles(symbol,interval,cursor,end-1);
    rows=candles.map(c=>[c.openTime.valueOf(),c.closeTime.valueOf(),c.open,c.high,c.low,c.close,c.baseVolume,c.quoteVolume,c.trades,c.closed,step[interval]]);
    if(rows.some(r=>r[0]<cursor||r[0]>=end)||rows.some((r,i)=>i&&r[0]<=rows[i-1][0]))throw Error('Non-monotonic/out-of-range response');
    atomic(file,rows);state.pages.push({filename,symbol,interval,count:rows.length,sha256:hash(fs.readFileSync(file,'utf8'))});save();
   }
   if(!rows.length)break;cursor=rows.at(-1)[0]+step[interval];
  }
 }
 const manifest={config,specHashes:config.specHashes,pages:state.pages};atomic(path.join(root,'dataset-manifest.json'),manifest);state.manifestHash=hash(fs.readFileSync(path.join(root,'dataset-manifest.json'),'utf8'));save();
 const series={},badDays=new Set(),excluded=[],counts=[];
 state.stage='auditing';save();
 for(const symbol of config.symbols){series[symbol]={};for(const interval of config.intervals){
  const rows=state.pages.filter(p=>p.symbol===symbol&&p.interval===interval).flatMap(p=>JSON.parse(fs.readFileSync(path.join(root,'pages',p.filename),'utf8')));series[symbol][interval]=rows;
  const expected=new Map();for(let d=start;d<end;d+=M.DAY)expected.set(d,{missing:0,invalid:0,duplicate:0});
  let pointer=0;
  for(let t=start;t<end;t+=step[interval]){
   const d=Math.floor(t/M.DAY)*M.DAY,check=expected.get(d);
   while(pointer<rows.length&&rows[pointer][0]<t){check.invalid++;pointer++;}
   if(pointer>=rows.length||rows[pointer][0]!==t)check.missing++;
   else{if(!validRow(rows[pointer],step[interval]))check.invalid++;pointer++;while(pointer<rows.length&&rows[pointer][0]===t){check.duplicate++;pointer++;}}
  }
  for(const [d,x]of expected)if(x.missing||x.invalid||x.duplicate){badDays.add(d);excluded.push({day:new Date(d).toISOString().slice(0,10),symbol,interval,...x});}
  counts.push({symbol,interval,rows:rows.length,expected:(end-start)/step[interval]});await yieldLoop();
 }}
 report('dataset-audit',{range:config,counts,excludedUtcDays:[...badDays].sort().map(d=>new Date(d).toISOString().slice(0,10)),issues:excluded});
 for(const symbol of config.symbols)for(const interval of config.intervals)series[symbol][interval]=series[symbol][interval].filter(r=>!badDays.has(Math.floor(r[0]/M.DAY)*M.DAY));
 const blocked=(a,b)=>{for(let d=Math.floor(a/M.DAY)*M.DAY;d<b;d+=M.DAY)if(badDays.has(d))return true;return false;};
 const bounds=new Map(),levels=new Map();
 const boundary=t=>{const date=S.newYorkCivilDate(new Date(t));if(!bounds.has(date))bounds.set(date,S.sessionBoundaries(date));return bounds.get(date);};
 for(const symbol of config.symbols){levels.set(symbol,new Map());for(let d=analysisStart-M.DAY;d<end;d+=M.DAY){const b=boundary(d+12*3600000);const h=series[symbol]['1h'].filter(r=>r[0]>=b.asianStart.valueOf()&&r[0]<b.asianEnd.valueOf());
   const expected=(b.asianEnd-b.asianStart)/3600000;if(h.length===expected&&!blocked(b.asianStart.valueOf(),b.asianEnd.valueOf()))levels.get(symbol).set(b.civilDate,{low:Math.min(...h.map(r=>Number(r[4]))),available:b.asianEnd.valueOf(),date:b.civilDate});
 }}
 state.stage='confirmation';save();const arrivals=[],aExcluded={boundary:0,gap:0,requiredHistory:0};
 const eventFile=path.join(root,'confirmation-events.ndjson');if(fs.existsSync(eventFile))throw Error('Measurement already executed; no silent rerun');
 for(const symbol of config.symbols){const rows=series[symbol]['1m'],four=series[symbol]['4h'];let f=-1;
  for(let i=0;i+1<rows.length;i++){
   if(i%5000===0)await yieldLoop();const r=rows[i],next=rows[i+1],t=r[0];if(t<analysisStart||t>=end)continue;
   while(f+1<four.length&&four[f+1][1]<t)f++;
   const b=boundary(t),asian=levels.get(symbol).get(b.civilDate),active=[];
   if(asian&&t>=asian.available)active.push({family:'asian_low',value:asian.low,version:asian.date});
   if(f>=0&&!blocked(four[f][0],t+M.MIN))active.push({family:'4h_low',value:Number(four[f][4]),version:four[f][0]});
   if(next[0]!==t+M.MIN)continue;
   for(const l of active)if(Number(r[4])<l.value*.999&&Number(next[5])>l.value){
    const a=M.arrival(rows,i+1);if(a.excluded){aExcluded[a.excluded]++;continue;}
    const close=next[1]+1,reportingBoundary=boundary(close),session=close<reportingBoundary.asianEnd?'Asian range':close<reportingBoundary.entryStart?'London marker':close<reportingBoundary.entryEnd?'NY window':'Off window';
    const e={symbol,levelFamily:l.family,level:l.value,levelVersion:l.version,sweepOpen:new Date(t).toISOString(),reclaimClose:new Date(close).toISOString(),session,arrivalBars:a.bars};
    fs.appendFileSync(eventFile,JSON.stringify(e)+'\n');arrivals.push(e);
   }
  }
 }
 const summarize=events=>{const a=events.map(e=>e.arrivalBars),hist=Object.fromEntries(Array.from({length:21},(_,i)=>[i,0]));hist['>20']=0;for(const x of a)hist[x===null?'>20':x]++;
  return {events:a.length,histogram:hist,percentiles:Object.fromEntries([.5,.75,.9,.95].map(p=>['p'+p*100,M.arrivalQuantile(a,p)])),beyond10:a.filter(x=>x===null||x>10).length,neverWithin20:a.filter(x=>x===null).length};};
 const pooled=summarize(arrivals),groups=[];for(const symbol of config.symbols)for(const session of ['Asian range','London marker','NY window','Off window'])groups.push({symbol,session,...summarize(arrivals.filter(e=>e.symbol===symbol&&e.session===session))});
 const expiry=pooled.percentiles.p90;const stopA=typeof expiry!=='number'||expiry>10;
 report('01-confirmation-report',{detector:'sweep-arrival-v1',pooled,groups,nyWindowDiagnostic:summarize(arrivals.filter(e=>e.session==='NY window')),levelFamilies:Object.fromEntries(['asian_low','4h_low'].map(k=>[k,arrivals.filter(e=>e.levelFamily===k).length])),excluded:aExcluded,derivedExpiryBars:expiry,escalation:stopA?'STOP: pooled p90 undefined/censored/>10':null});
 if(stopA){report('summary',{status:'STOP',cause:'1a confirmation gate',reports:['01-confirmation-report.json'],remainingTasks:'not executed',profileImplementation:false});return;}
 state.stage='pivots';save();const cells=[];
 for(const symbol of config.symbols)for(const interval of ['15m','1h']){
  const rows=series[symbol][interval],byMonth=new Map(),pivots=[];const looks=interval==='15m'?[12,24,32,36]:[12,24,36];
  for(let i=4;i<rows.length;i++){
   if(i%500===0)await yieldLoop();
   const t=rows[i][1]+1;if(t<analysisStart||t>=end)continue;const month=new Date(t-1).toISOString().slice(0,7);
   if(!byMonth.has(month))byMonth.set(month,{days:new Set(),unique:Object.fromEntries(looks.map(l=>[l,new Set()])),inventory:Object.fromEntries(looks.map(l=>[l,[]]))});
   const cell=byMonth.get(month);cell.days.add(Math.floor(rows[i][0]/M.DAY));
   for(const side of M.pivotAt(rows,i-2))pivots.push({index:i-2,id:`${rows[i-2][0]}:${side}`,confirmedAt:t});
   while(pivots.length&&pivots[0].index<i-35)pivots.shift();
   for(const look of looks){if(i+1<look||rows[i][0]-rows[i-look+1][0]!==step[interval]*(look-1))continue;
    const available=pivots.filter(p=>p.index>=i-look+1&&p.index<=i-2);cell.inventory[look].push(available.length);for(const p of available)if(p.confirmedAt>=Date.parse(month+'-01T00:00:00Z'))cell.unique[look].add(p.id);
   }
  }
  for(const [month,x]of byMonth){const counts=Object.fromEntries(looks.map(l=>[l,x.unique[l].size])),ratio=M.ratio([counts[12],counts[24],counts[36]]);
   cells.push({symbol,interval,month,completeUtcDays:x.days.size,pivots:counts,perObservedDay:Object.fromEntries(looks.map(l=>[l,counts[l]/x.days.size])),stabilityRatio:ratio,brittle:ratio==='infinity'||typeof ratio==='number'&&ratio>2,inventory:Object.fromEntries(looks.map(l=>[l,{decisions:x.inventory[l].length,mean:x.inventory[l].reduce((a,b)=>a+b,0)/(x.inventory[l].length||1),p25:M.quantile(x.inventory[l],.25),median:M.quantile(x.inventory[l],.5),p75:M.quantile(x.inventory[l],.75),zeroShare:x.inventory[l].filter(n=>n===0).length/(x.inventory[l].length||1)}]))});
  }await yieldLoop();
 }
 const stopB=cells.some(c=>c.brittle||c.stabilityRatio===null);
 report('02-pivot-report',{detector:'pivot-density-v1',cells,derivedLookback:{'15m':32,'1h':24},mapping:'32 native 15m bars = eight-hour session blocks; 24 native 1h bars = UTC daily cycle',limitation:'Unique pivot counts do not identify lookback stability for a fixed 2L/2R detector. Inventory is a separate diagnostic.',escalation:stopB?'STOP: brittle/undefined pivot count evidence':null});
 if(stopB){report('summary',{status:'STOP',cause:'1b stability gate',reports:['01-confirmation-report.json','02-pivot-report.json'],remainingTasks:'1c not executed',profileImplementation:false});return;}
 state.stage='volatility';save();const daily=[],vExcluded=[];
 for(const symbol of config.symbols){const rows=series[symbol]['1m'];let left=0,right=0;
  for(let d=analysisStart;d<end;d+=M.DAY){const civil=new Date(d).toISOString().slice(0,10),b=S.sessionBoundaries(civil),t=b.entryStart.valueOf(),a=t-M.DAY;
   while(left<rows.length&&rows[left][0]<a)left++;right=Math.max(right,left);while(right<rows.length&&rows[right][0]<t)right++;
   const slice=rows.slice(left,right);if(slice.length!==1440||slice[0]?.[0]!==a||slice.at(-1)?.[0]!==t-M.MIN||blocked(a,t)){vExcluded.push({symbol,civilDate:civil,reason:'incomplete rolling history'});continue;}
   daily.push({symbol,civilDate:civil,sampledAt:new Date(t).toISOString(),rangeBps:M.rangeBps(slice)});
  }
 }
 const dist=a=>{const values=a.map(x=>x.rangeBps),threshold=M.quantile(values,.4);return {n:a.length,min:a.length?Math.min(...values):null,max:a.length?Math.max(...values):null,percentiles:Object.fromEntries([.25,.4,.5,.75,.9,.95].map(p=>['p'+p*100,M.quantile(values,p)])),thresholdBps:threshold,included:a.filter(x=>x.rangeBps>=threshold).length,inclusionRate:a.length?a.filter(x=>x.rangeBps>=threshold).length/a.length:null,ties:a.filter(x=>x.rangeBps===threshold).length,inherited200BpsInclusion:a.length?a.filter(x=>x.rangeBps>=200).length/a.length:null};};
 const distributions=Object.fromEntries(config.symbols.map(s=>[s,dist(daily.filter(x=>x.symbol===s))])),pool=dist(daily),stopC=Object.values(distributions).some(d=>d.n===0);
 report('03-volatility-report',{detector:'daily-range-v1',selectedInclusionRate:.6,percentile:.4,policy:'per-instrument, for Tim review',distributions,pooledReference:{...pool,perSymbolRates:Object.fromEntries(config.symbols.map(s=>[s,daily.filter(x=>x.symbol===s&&x.rangeBps>=pool.thresholdBps).length/distributions[s].n]))},daily,excluded:vExcluded,escalation:stopC?'STOP: zero sample':null});
 report('summary',{status:stopC?'STOP':'AWAITING_REVIEW',reports:['01-confirmation-report.json','02-pivot-report.json','03-volatility-report.json'],annotations:['Pivot unique-count stability is non-identifying for lookback','15m aligned lookback is 32, not 24; no six-hour engine block','Per-symbol 60% policy and whole-period input calibration require review before backtest'],profileImplementation:false});
}
main().then(()=>{state.stage='finished';save();fs.appendFileSync(events,JSON.stringify({kind:'finished',at:new Date().toISOString(),detail:'outcome-blind derivations complete; review required'})+'\n');}).catch(error=>{state.stage='failed';state.error=error.stack;save();atomic(path.join(root,'failure.json'),{at:new Date().toISOString(),error:error.stack,configHash});fs.appendFileSync(events,JSON.stringify({kind:'finished',at:new Date().toISOString(),detail:'measurement failed; no retry by interpretation'})+'\n');console.error(error);});
