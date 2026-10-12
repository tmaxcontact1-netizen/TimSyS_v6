const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {pathToFileURL}=require('node:url');const {atomic}=require('./validation-watchdog.cjs');
const M=require('./playbook-measurements.cjs'),S=require('./playbook-selection.cjs');
const config=JSON.parse(fs.readFileSync(process.argv[2])),root=process.env.CRYPTOED_SOAK_OUTPUT;
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),yieldLoop=()=>new Promise(r=>setImmediate(r));
const stateFile=path.join(root,'checkpoint.json'),configHash=sha(config);fs.mkdirSync(root,{recursive:true});
const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile)):{origin:new Date().toISOString(),configHash,stage:'starting',pages:[],requests:0};if(state.configHash!==configHash)throw Error('Frozen configuration changed');
const save=()=>atomic(stateFile,state),write=(name,v)=>atomic(path.join(root,name+'.json'),{sourceCommit:config.sourceCommit,specCommit:config.specCommit,configHash,...v});
http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'application/json'});r.end(JSON.stringify({pid:process.pid,stage:state.stage,pages:state.pages.length,requests:state.requests}));}).listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),'127.0.0.1');
const step={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000};
const valid=(r,s)=>r[9]&&r[0]%s===0&&r[1]===r[0]+s-1&&[2,3,4,5].every(i=>Number.isFinite(Number(r[i]))&&Number(r[i])>0)&&Number(r[3])>=Math.max(Number(r[2]),Number(r[5]))&&Number(r[4])<=Math.min(Number(r[2]),Number(r[5]))&&Number(r[3])>=Number(r[4]);
async function main(){
 const original=config.originalDirectory,originalManifestFile=path.join(original,'dataset-manifest.json'),originalEventFile=path.join(original,'confirmation-events.ndjson');
 if(sha(fs.readFileSync(originalManifestFile))!==config.originalManifestHash||sha(fs.readFileSync(originalEventFile))!==config.originalEventHash)throw Error('Original frozen inputs changed');
 const originalManifest=JSON.parse(fs.readFileSync(originalManifestFile));
 for(const p of originalManifest.pages)if(sha(fs.readFileSync(path.join(original,'pages',p.filename)))!==p.sha256)throw Error('Original page changed '+p.filename);
 const {BinanceRestAdapter}=await import(pathToFileURL(path.join(__dirname,'dist/src/infrastructure/providers/exchange/binance-rest.js')));
 let lastStart=0,metadata=null;
 const client=async url=>{for(let attempt=0;attempt<=3;attempt++){
  await wait(Math.max(0,200-(Date.now()-lastStart)));lastStart=Date.now();state.requests++;let response,error;
  try{response=await fetch(url,{signal:AbortSignal.timeout(15000)});}catch(e){error=e;}
  fs.appendFileSync(path.join(root,'requests.ndjson'),JSON.stringify({at:new Date().toISOString(),url,status:response?.status??null,error:error?.message??null,attempt,latencyMs:Date.now()-lastStart})+'\n');
  if(response?.status===418)throw Error('HTTP 418 stop');
  if(!error&&response.status!==429&&response.status<500)return {ok:response.ok,status:response.status,headers:response.headers,json:async()=>{const data=await response.json();if(url.includes('exchangeInfo'))metadata=data;return data;}};
  if(attempt===3)throw error||Error('Retry limit HTTP '+response.status);
  const retry=response?.headers.get('retry-after');const delay=response?.status===429?(retry==null?60000:Number.isFinite(Number(retry))?Number(retry)*1000:Math.max(0,Date.parse(retry)-Date.now())):1000*2**attempt;
  await response?.body?.cancel();await wait(delay);
 }};
 const rest=new BinanceRestAdapter(config.endpoint,client),start=Date.parse(config.retrievalStart),end=Date.parse(config.retrievalEnd);
 state.stage='retrieving';save();fs.mkdirSync(path.join(root,'pages'),{recursive:true});
 await rest.catalogue(config.symbols);if(!metadata)throw Error('Missing metadata');atomic(path.join(root,'exchange-metadata.json'),{capturedAt:new Date().toISOString(),payload:metadata});
 const ticks=Object.fromEntries(config.symbols.map(symbol=>{const raw=metadata.symbols.find(s=>s.symbol===symbol),tick=Number(raw?.filters?.find(f=>f.filterType==='PRICE_FILTER')?.tickSize);if(!Number.isFinite(tick)||tick<=0)throw Error('Missing venue tick '+symbol);return [symbol,tick];}));
 for(const symbol of config.symbols)for(const interval of config.intervals){let cursor=start;
  while(cursor<end){const name=`${symbol}-${interval}-${cursor}.json`,file=path.join(root,'pages',name),prior=state.pages.find(p=>p.filename===name);let rows;
   if(prior){const text=fs.readFileSync(file);if(sha(text)!==prior.sha256)throw Error('Extension page changed');rows=JSON.parse(text);}
   else{rows=(await rest.candles(symbol,interval,cursor,end-1)).map(c=>[c.openTime.valueOf(),c.closeTime.valueOf(),c.open,c.high,c.low,c.close,c.baseVolume,c.quoteVolume,c.trades,c.closed,step[interval]]);
    if(rows.some(r=>r[0]<cursor||r[0]>=end)||rows.some((r,i)=>i&&r[0]<=rows[i-1][0]))throw Error('Unordered or out-of-range response');
    atomic(file,rows);state.pages.push({filename:name,symbol,interval,count:rows.length,sha256:sha(fs.readFileSync(file))});save();}
   if(!rows.length)break;cursor=rows.at(-1)[0]+step[interval];
  }
 }
 atomic(path.join(root,'extension-manifest.json'),{config,pages:state.pages});const manifestHash=sha(fs.readFileSync(path.join(root,'extension-manifest.json')));
 state.stage='integrity';save();const counts=[],issues=[],overlapIssues=[],series={};
 const load=(directory,pages,symbol,interval)=>pages.filter(p=>p.symbol===symbol&&p.interval===interval).flatMap(p=>JSON.parse(fs.readFileSync(path.join(directory,'pages',p.filename))));
 for(const symbol of config.symbols){series[symbol]={};for(const interval of config.intervals){
  const rows=load(root,state.pages,symbol,interval);let i=0,missing=0,invalid=0,duplicate=0;
  for(let t=start;t<end;t+=step[interval]){while(i<rows.length&&rows[i][0]<t){invalid++;i++;}if(i>=rows.length||rows[i][0]!==t){missing++;continue;}if(!valid(rows[i],step[interval]))invalid++;i++;while(i<rows.length&&rows[i][0]===t){duplicate++;i++;}}
  counts.push({symbol,interval,rows:rows.length,expected:(end-start)/step[interval],missing,invalid,duplicate});if(missing||invalid||duplicate)issues.push(counts.at(-1));
  const overlapStart=Date.parse('2026-04-11T00:00:00Z'),newOverlap=rows.filter(r=>r[0]>=overlapStart),oldRows=load(original,originalManifest.pages,symbol,interval),oldOverlap=oldRows.filter(r=>r[0]<end);
  if(JSON.stringify(newOverlap)!==JSON.stringify(oldOverlap))overlapIssues.push({symbol,interval,oldRows:oldOverlap.length,newRows:newOverlap.length});
  // Held-out candles undergo grid/integrity checks only. Do not even run the
  // pivot detector on the evaluated holdout during calibration.
  if(['15m','1h'].includes(interval))series[symbol][interval]=[...rows.filter(r=>r[0]>=Date.parse(config.periods.strip.start)&&r[0]<Date.parse('2026-04-11T00:00:00Z')),...oldRows];
  await yieldLoop();
 }}
 write('extension-integrity',{manifestHash,originalManifestHash:config.originalManifestHash,periods:config.periods,counts,overlapIssues,issues,verified:issues.length===0&&overlapIssues.length===0,holdoutStatisticsComputed:false});
 if(issues.length||overlapIssues.length){write('summary',{status:'STOP',cause:'extension integrity',profileImplementation:false});return;}
 state.stage='selection';save();const events=fs.readFileSync(originalEventFile,'utf8').trim().split('\n').map(JSON.parse),needed={};
 for(const symbol of config.symbols){needed[symbol]=new Set(events.filter(e=>e.symbol===symbol).flatMap(e=>[Date.parse(e.sweepOpen),Date.parse(e.sweepOpen)+60000]));}
 const context={};for(const symbol of config.symbols){context[symbol]=new Map();for(const p of originalManifest.pages.filter(p=>p.symbol===symbol&&p.interval==='1m')){const rows=JSON.parse(fs.readFileSync(path.join(original,'pages',p.filename)));for(const r of rows)if(needed[symbol].has(r[0]))context[symbol].set(r[0],r);}}
 const cells=[],pairs=[],monthly=[];const eventOut=path.join(root,'selection-events.ndjson');if(fs.existsSync(eventOut))throw Error('Selection already run: refuse silent rerun');
 for(const symbol of config.symbols)for(const timeframe of ['15m','1h']){
  const rows=series[symbol][timeframe],pool=S.pivots(rows,timeframe),looks=timeframe==='15m'?[12,24,32,36,48]:[12,24,36],results=[];
  const monthCounts=S.monthly(pool,Date.parse(config.periods.inSample.start),Date.parse(config.periods.inSample.end));
  for(const [month,c]of Object.entries(monthCounts))monthly.push({symbol,timeframe,month,...c,exposureDays:S.exposure(month,Date.parse(config.periods.inSample.start),Date.parse(config.periods.inSample.end))});
  for(const [index,e]of events.filter(e=>e.symbol===symbol).entries()){
   if(index%100===0)await yieldLoop();const t=Date.parse(e.sweepOpen),sweep=context[symbol].get(t),reclaim=context[symbol].get(t+60000);
   if(!sweep||!reclaim||reclaim[1]+1!==Date.parse(e.reclaimClose))throw Error('Frozen event context mismatch');
   const event={sweepAvailableAt:sweep[1]+1,sweepLow:Number(sweep[4]),referencePrice:Number(reclaim[5])};
   const selections=Object.fromEntries(looks.map(l=>[l,S.select(rows,pool,event,l,ticks[symbol],timeframe)]));
   const record={eventIdentity:{symbol,levelFamily:e.levelFamily,levelVersion:e.levelVersion,sweepOpen:e.sweepOpen},timeframe,event,selections};results.push(record);fs.appendFileSync(eventOut,JSON.stringify(record)+'\n');
  }
  const pairRows=[];
  for(let a=0;a<looks.length;a++)for(let b=a+1;b<looks.length;b++){
   const short=looks[a],long=looks[b],eligible=results.filter(r=>!r.selections[short].discarded&&!r.selections[long].discarded);let differing=0,bothSelected=0,sameSelected=0,nearer=0,farther=0,equal=0,rInvariant=0,materialR=0;
   for(const r of eligible){const x=r.selections[short],y=r.selections[long];if((x.selected?.id??null)!==(y.selected?.id??null))differing++;
    if(x.selected&&y.selected){bothSelected++;if(x.selected.id===y.selected.id)sameSelected++;else if(x.distanceBps<y.distanceBps)nearer++;else if(x.distanceBps>y.distanceBps)farther++;else equal++;
     if(x.rBps===y.rBps)rInvariant++;if(x.rBps<=0)throw Error('Nonpositive reference R');if(Math.abs(x.rBps-y.rBps)/x.rBps>.1)materialR++;}}
   const p={symbol,timeframe,short,long,denominator:eligible.length,differing,differenceRate:eligible.length?differing/eligible.length:null,bothSelected,sameSelected,differentLevelDirection:{shorterNearer:nearer,shorterFarther:farther,equalDistance:equal},rInvariantBothSelected:rInvariant,materialRChanges:materialR};pairs.push(p);pairRows.push(p);
  }
  const discards=looks.map(l=>results.filter(r=>r.selections[l].discarded).length);if(new Set(discards).size!==1)throw Error('Unequal warmup discard counts: STOP');
  for(const l of looks){const eligible=results.filter(r=>!r.selections[l].discarded),selected=eligible.filter(r=>r.selections[l].selected),values=selected.map(r=>r.selections[l].distanceBps),none=eligible.length-selected.length,rate=eligible.length?none/eligible.length:null;
   const applicable=pairRows.filter(p=>p.short===l||p.long===l),robust=rate!==null&&rate<.01&&applicable.every(p=>p.differenceRate!==null&&p.differenceRate<=.1);
   cells.push({symbol,timeframe,lookback:l,events:results.length,warmupDiscard:results.length-eligible.length,denominator:eligible.length,selected:selected.length,noEligible:none,noEligibleRate:rate,distanceBps:{min:values.length?Math.min(...values):null,p25:M.quantile(values,.25),p50:M.quantile(values,.5),p75:M.quantile(values,.75),p90:M.quantile(values,.9),p95:M.quantile(values,.95),max:values.length?Math.max(...values):null},maxPairDifference:Math.max(...applicable.map(p=>p.differenceRate??Infinity)),status:robust?'ROBUST':'BRITTLE'});
  }
 }
 const brittle=cells.filter(c=>c.status==='BRITTLE');
 write('01b-v2-report',{detector:'level-selection-v2',originalEventHash:config.originalEventHash,extensionManifestHash:manifestHash,cells,pairs,monthlyAvailabilityCounts:monthly,tickMetadata:ticks,tickCaveat:'Current public venue metadata; not historical execution evidence. R invariance does not depend on choosing a historical tick.',candidateMappings:{'15m':32,'1h':24},pivotLookbackInstalled:false,escalation:brittle.length?{status:'STOP',brittleCells:brittle.length,reason:'Frozen selection robustness criteria failed'}:null});
 write('summary',{status:brittle.length?'STOP_FOR_REVIEW':'AWAITING_RATIFICATION',cause:brittle.length?'1b robustness failure':null,pivotLookbackInstalled:false,profileImplementation:false,holdoutStatisticsComputed:false});
}
main().then(()=>{state.stage='finished';save();fs.appendFileSync(path.join(root,'events.ndjson'),JSON.stringify({kind:'finished',at:new Date().toISOString(),detail:'extension/selection complete; review required'})+'\n');}).catch(error=>{state.stage='failed';state.error=error.stack;save();write('failure',{error:error.stack});fs.appendFileSync(path.join(root,'events.ndjson'),JSON.stringify({kind:'finished',at:new Date().toISOString(),detail:'measurement failure; STOP'})+'\n');console.error(error);});
