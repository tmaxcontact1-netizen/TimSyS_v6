'use strict';
// Isolated paper observer. Public collection requires separately sealed authority.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),readline=require('node:readline');
const {isMainThread,Worker,parentPort,workerData}=require('node:worker_threads');
const core=require('./q35-prospective-core.cjs'),stats=require('./q35-prospective-statistics.cjs');
const {durable,sealed}=require('./research-artifacts.cjs'),{appendFileSync}=fs;
const {startTelemetry}=require('./process-telemetry.cjs');
function verify(cfg){for(const x of cfg.frozenFiles??[]){if(core.sha(fs.readFileSync(path.join(__dirname,x.file)))!==x.sha256)throw Error('RUNTIME_SEAL_STOP:'+x.file);}for(const x of cfg.inputHashes??[])if(core.sha(fs.readFileSync(x.file))!==x.sha256)throw Error('INPUT_SEAL_STOP:'+x.file);}
async function workload(cfg,root,progress=()=>{}){
 if(cfg.mode==='public_paper_collection')require('./q35-prospective-adapter.cjs').authorize(cfg);
 verify(cfg);
 if(cfg.mode==='public_paper_collection')return require('./q35-prospective-adapter.cjs').collect(cfg,root,progress);
 if(cfg.mode==='synthetic_adapter_preflight'&&cfg.collectionAuthorized===false)return require('./q35-prospective-adapter-fixture.cjs').run(cfg,root,progress);
 if(cfg.mode!=='synthetic_preflight'||cfg.collectionAuthorized!==false)throw Error('COLLECTION_NOT_AUTHORIZED_STOP');
 const input=fs.createReadStream(cfg.events),lines=readline.createInterface({input,crlfDelay:Infinity});const model=core.loadModels(cfg.models),meta=core.metadata(fs.readFileSync(cfg.metadata,'utf8'),cfg.metadataEndpoint,cfg.metadataReceivedAt);
 const configHash=core.sha(JSON.stringify(cfg));const engine=new core.Engine({root,models:model,meta,t0:cfg.syntheticT0,configHash});let at=0,count=0,invalidBooks=0;
 // Synthetic input is idempotently replayed from its beginning on recovery. Immutable
 // decisions/entries/outcomes are authoritative; only native IO and virtual clock differ.
 for await(const line of lines){if(!line.trim())continue;const e=JSON.parse(line);if(!Number.isSafeInteger(e.at)||e.at<at)throw Error('EVENT_ORDER_STOP');at=e.at;
  if(e.type==='candle')engine.ingestCandle(e.raw,e.at);
  else if(e.type==='decision')engine.decision(e.t,e.at);
  else if(e.type==='book'){if(!engine.ingestBook(e.raw,e.at,e.now??e.at))invalidBooks++;}
  else if(e.type==='tick'){if(e.at>=engine.lastAt)engine.tick(e.at);}
  else if(e.type==='interruption'){if(!engine.interruptions.some(x=>x.start===e.start&&x.end===e.end&&x.cause===e.cause))engine.interruption(e.start,e.end,e.cause);}
  else throw Error('EVENT_TYPE_STOP');
  count++;if(count%100===0){progress({stage:'ingress',events:count});await new Promise(r=>setImmediate(r));}
  if(cfg.syntheticPauseAfterEvents===count){progress({stage:'fixture_pause',events:count});await new Promise(r=>setTimeout(r,cfg.syntheticPauseMs));}
 }
 const rows=engine.reportRows();sealed(path.join(root,'analysis-input.json'),{synthetic:true,configHash,rows});let uncertainty=null,result=null;
 if(cfg.statistics){uncertainty=await stats.bootstrap(rows,engine.t0,engine.t1,b=>progress({stage:'bootstrap',completed:b}));result=stats.results(rows,[...engine.records.values()],engine.t0,uncertainty);}
 const report={synthetic:true,notProspectiveEvidence:true,events:count,invalidBooks,configHash,modelHashes:core.HASHES,rows,decisions:[...engine.records.values()],result,collectionStarted:false,networkRequests:0};
 sealed(path.join(root,'report.json'),report);return report;
}
async function host(cfgFile){const cfg=JSON.parse(fs.readFileSync(cfgFile)),root=process.env.CRYPTOED_SOAK_OUTPUT;if(!root)throw Error('ISOLATED_OUTPUT_REQUIRED_STOP');fs.mkdirSync(root,{recursive:true});let status={pid:process.pid,stage:'starting',done:false,error:null};const server=http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(status));});await new Promise((res,rej)=>{server.once('error',rej);server.listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),'127.0.0.1',res);});
 const telemetry=startTelemetry(process.env.CRYPTOED_DURABILITY_LOG?path.dirname(process.env.CRYPTOED_DURABILITY_LOG):root);
 try{await telemetry.ready;}catch(error){await new Promise(resolve=>server.close(resolve));throw error;}
 const recordFinish=async(m,file)=>{await telemetry.stop();durable(path.join(root,file),status);appendFileSync(path.join(root,'events.ndjson'),JSON.stringify({kind:'finished',error:m.error??null,at:new Date().toISOString()})+'\n');};
 const finishError=error=>{status={...status,stage:'failed',done:true,error:error.stack};console.error('RESOURCE_TELEMETRY_FINALIZE_FAILED',error);};
 const w=new Worker(__filename,{workerData:{cfg,root}});w.on('message',m=>{status={...status,...m};if(m.done||m.error)void recordFinish(m,'worker-result.json').catch(finishError);});w.on('error',e=>{status={...status,stage:'failed',error:e.stack,done:true};void recordFinish(status,'failure.json').catch(finishError);});
 process.once('SIGTERM',()=>{void w.terminate().then(()=>server.close(()=>process.exit(0)));});
}
module.exports={verify,workload,host};
if(require.main===module){if(isMainThread){host(process.argv[2]).catch(e=>{console.error(e.stack);process.exitCode=1;});}else{workload(workerData.cfg,workerData.root,m=>parentPort.postMessage(m)).then(()=>parentPort.postMessage({stage:'finished',done:true})).catch(e=>{const file=path.join(workerData.root,'failure.json'),prior=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};durable(file,{...prior,error:e.stack,clockEvidence:e.clockEvidence??prior.clockEvidence??null,workerObservedAt:Date.now(),monotonicNs:process.hrtime.bigint().toString()});parentPort.postMessage({stage:'failed',done:true,error:e.stack});});}}
