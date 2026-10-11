// Supplemental public-data verification only. No subscriptions, orders or live DB writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {execFileSync}=require('node:child_process');
(async()=>{
 const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
 const base=path.resolve(__dirname,'../dist/src/infrastructure/providers/exchange');
 const {BinanceRestAdapter}=await import(pathToFileURL(path.join(base,'binance-rest.js')));
 const {ExchangeIngestionService}=await import(pathToFileURL(path.join(base,'ingestion.js')));
 const config={endpoint:'https://api.binance.com',dates:['2026-10-05T14:17:00Z','2026-10-06T18:03:00Z','2026-10-09T08:42:00Z'],symbols:['BTCUSDT','ETHUSDT'],interval:'1m',persistence:'isolated JSONL staging store'};
 const report={startedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),verifierSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),config,configHash:crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex'),calls:[],gaps:[]};
 const http=async url=>{const began=Date.now();const r=await fetch(url,{signal:AbortSignal.timeout(15000)});report.calls.push({url,status:r.status,latencyMs:Date.now()-began});return r;};
 const rest=new BinanceRestAdapter(config.endpoint,http);
 const candles=new Map();
 const store={async saveCandle(c,source){const key=`${c.venueSymbol}:${c.openTime.valueOf()}`;candles.set(key,{...c,source});fs.appendFileSync(path.join(out,'persisted-candles.ndjson'),JSON.stringify({...c,source})+'\n');},async saveBook(){throw Error('Unexpected book write');},async saveTicker(){throw Error('Unexpected ticker write');},async recordStreamEvent(state,detail,at){fs.appendFileSync(path.join(out,'stream-events.ndjson'),JSON.stringify({state,detail,at})+'\n');}};
 try{
 for(const date of config.dates)for(const symbol of config.symbols){
  const t=Date.parse(date),service=new ExchangeIngestionService(store,rest);
  const adjacent=await rest.candles(symbol,'1m',t-60000,t+60000);assert.equal(adjacent.length,3);
  const [before,expected,after]=adjacent;assert.equal(expected.openTime.valueOf(),t);
  await service.onCandle(before);await service.onCandle(after);assert.equal(service.backfillDepth,1);
  const began=Date.now(),count=await service.repairNext();assert.equal(count,1);assert.equal(service.backfillDepth,0);
  const repaired=candles.get(`${symbol}:${t}`);assert.equal(repaired.source,'rest_backfill');
  const series=[before,repaired,after];assert.equal(new Set(series.map(c=>c.openTime.valueOf())).size,3);
  for(let i=0;i<3;i++){const c=series[i];assert.equal(c.openTime.valueOf(),t+(i-1)*60000);assert.equal(c.closeTime.valueOf(),c.openTime.valueOf()+59999);assert.ok(c.closed);const o=Number(c.open),h=Number(c.high),l=Number(c.low),close=Number(c.close);assert.ok(l<=o&&l<=close&&h>=o&&h>=close&&h>=l);}
  for(const field of ['open','high','low','close','baseVolume','quoteVolume'])assert.equal(repaired[field],expected[field]);
  report.gaps.push({symbol,missingOpenTime:date,source:repaired.source,retrieved:count,repairLatencyMs:Date.now()-began,adjacencyVerified:true,duplicateOpenTimes:0,ohlcMatchesIndependentRange:true,candle:repaired});
 }
 report.passed=true;
 }catch(error){report.passed=false;report.error=error.stack;process.exitCode=1;}
 report.finishedAt=new Date().toISOString();report.limitations=['JSONL staging persistence uses the production ingestion store contract; this does not verify PostgreSQL persistence.','Production ingestion exposes queue depth but no repaired complete-state assertion; contiguous stored rows are verified independently here.','BTCUS in the instruction is interpreted as BTCUSDT, the instrument used in the archived soak.'];
 fs.writeFileSync(path.join(out,'gap-repair-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,gaps:report.gaps.length,artifact:path.join(out,'gap-repair-report.json'),error:report.error}));
})().catch(e=>{console.error(e);process.exitCode=1;});
