const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');const {pathToFileURL}=require('node:url');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
test('cold-start extension through production REST/parser, overlap audit, selection and immutable reports',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'selection-pipeline-')),runtime=path.join(root,'runtime'),data=path.join(root,'data'),original=path.join(root,'original');
 fs.mkdirSync(path.join(original,'pages'),{recursive:true});fs.mkdirSync(runtime,{recursive:true});fs.mkdirSync(data,{recursive:true});
 for(const n of ['run-selection-extension.cjs','playbook-selection.cjs','playbook-measurements.cjs','validation-watchdog.cjs'])fs.copyFileSync(path.join(__dirname,n),path.join(runtime,n));
 const built=path.resolve(__dirname,'../dist/src');
 for(const [dir,names]of [['infrastructure/providers/exchange',['binance-rest.js','binance.js','reliability.js']],['domain/exchange',['types.js']]]){
  fs.mkdirSync(path.join(runtime,'dist/src',dir),{recursive:true});for(const n of names)fs.copyFileSync(path.join(built,dir,n),path.join(runtime,'dist/src',dir,n));
 }fs.writeFileSync(path.join(runtime,'dist/package.json'),'{"type":"module"}');
 const steps={'1m':60000,'5m':300000,'15m':900000,'1h':3600000,'4h':14400000},symbols=['BTCUSDT','ETHUSDT'];
 const provider=(symbol,interval,t)=>{const k=Math.floor(t/steps[interval]),low=95+(k%7),high=110+(k%5);return [t,'105',String(high),String(low),'106','1',t+steps[interval]-1,'106',1,'0','0'];};
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');res.setHeader('Content-Type','application/json');
  if(url.pathname.includes('exchangeInfo')){res.end(JSON.stringify({symbols:symbols.map(symbol=>({symbol,status:'TRADING',baseAsset:symbol==='BTCUSDT'?'BTC':'ETH',quoteAsset:'USDT',filters:[{filterType:'PRICE_FILTER',tickSize:'0.01'}]}))}));return;}
  const s=url.searchParams.get('symbol'),int=url.searchParams.get('interval'),rows=[];for(let t=Number(url.searchParams.get('startTime'));t<=Number(url.searchParams.get('endTime'))&&rows.length<1000;t+=steps[int])rows.push(provider(s,int,t));res.end(JSON.stringify(rows));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const {BinanceRestAdapter}=await import(pathToFileURL(path.join(built,'infrastructure/providers/exchange/binance-rest.js')));
 const endpoint=`http://127.0.0.1:${server.address().port}`,rest=new BinanceRestAdapter(endpoint,url=>fetch(url));
 const start=Date.parse('2026-04-11T00:00:00Z'),end=Date.parse('2026-04-15T00:00:00Z'),pages=[];
 for(const symbol of symbols)for(const interval of Object.keys(steps)){
  const rows=[];for(let t=start;t<end;t+=steps[interval]){const r=provider(symbol,interval,t);rows.push([r[0],r[6],r[1],r[2],r[3],r[4],r[5],r[7],r[8],true,steps[interval]]);}
  const filename=symbol+'-'+interval+'.json',text=JSON.stringify(rows);fs.writeFileSync(path.join(original,'pages',filename),text);pages.push({filename,symbol,interval,count:rows.length,sha256:hash(text)});
 }
 const manifest=JSON.stringify({pages}),eventTime='2026-04-12T06:00:00Z',events=symbols.map(symbol=>({symbol,levelFamily:'asian_low',levelVersion:'fixture',sweepOpen:eventTime,reclaimClose:'2026-04-12T06:02:00Z'})).map(JSON.stringify).join('\n')+'\n';
 fs.writeFileSync(path.join(original,'dataset-manifest.json'),manifest);fs.writeFileSync(path.join(original,'confirmation-events.ndjson'),events);
 const cfg={sourceCommit:'fixture',specCommit:'fixture',endpoint,originalDirectory:original,originalManifestHash:hash(manifest),originalEventHash:hash(events),retrievalStart:'2026-04-10T00:00:00Z',retrievalEnd:'2026-04-12T00:00:00Z',symbols,intervals:Object.keys(steps),periods:{strip:{start:'2026-04-10T00:00:00Z',end:'2026-04-12T00:00:00Z'},inSample:{start:'2026-04-12T00:00:00Z',end:'2026-04-15T00:00:00Z'}}};
 const configFile=path.join(root,'job.json');fs.writeFileSync(configFile,JSON.stringify(cfg));
 const child=spawn(process.execPath,[path.join(runtime,'run-selection-extension.cjs'),configFile],{stdio:['ignore','pipe','pipe'],env:{...process.env,CRYPTOED_SOAK_OUTPUT:data,CRYPTOED_HEARTBEAT_PORT:'0'}});let stderr='';child.stderr.on('data',x=>stderr+=x);
 try{const deadline=Date.now()+60000;while(!fs.existsSync(path.join(data,'summary.json'))&&!fs.existsSync(path.join(data,'failure.json'))&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
  assert.ok(!fs.existsSync(path.join(data,'failure.json')),stderr);assert.ok(fs.existsSync(path.join(data,'summary.json')));
  const integrity=JSON.parse(fs.readFileSync(path.join(data,'extension-integrity.json'))),report=JSON.parse(fs.readFileSync(path.join(data,'01b-v2-report.json')));
  assert.equal(integrity.verified,true);assert.equal(integrity.holdoutStatisticsComputed,false);assert.equal(report.pivotLookbackInstalled,false);assert.equal(report.cells.length,16);assert.ok(report.cells.every(c=>c.warmupDiscard===0));assert.ok(report.pairs.every(p=>p.materialRChanges===0));
  assert.equal(hash(fs.readFileSync(path.join(original,'confirmation-events.ndjson'))),cfg.originalEventHash);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await new Promise(r=>server.close(r));}
});
