import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import pg from 'pg';
const require=createRequire(import.meta.url),{LocalPostgresManager}=require('../../launcher/electron/local-postgres-manager.cjs');
const root=resolve(import.meta.dirname,'..'),temporary=await mkdtemp(join(tmpdir(),'researched-concurrency-'));
const load=p=>import(pathToFileURL(join(root,'dist',p)));
const {createResearchServer}=await load('src/entrypoints/api.js'),{McfRepository}=await load('src/infrastructure/mcf-repository.js'),{McfAiWorker}=await load('src/application/mcf-ai.js');
const manager=new LocalPostgresManager({binaryRoot:process.env.RESEARCHED_VERIFY_POSTGRES,dataRoot:temporary});let db,server;
const wait=async f=>{for(let i=0;i<300;i++){if(await f())return;await new Promise(r=>setTimeout(r,10));}throw Error('Fixture wait expired');};
try{
 const state=await manager.start();execFileSync(process.execPath,[join(root,'dist/scripts/migrate.js')],{cwd:root,env:{...process.env,RESEARCHED_APP_ROOT:root,RESEARCHED_DATABASE_URL:state.migrationUrl},windowsHide:true,stdio:'pipe'});await manager.grantSchemaPrivileges('researched');db=new pg.Pool({connectionString:state.runtimeUrl});
 server=createResearchServer({database:db,storageRoot:join(temporary,'sources'),publicDirectory:join(root,'dist/frontend'),backgroundQueue:false});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,actor='Synthetic concurrency audit';
 const call=async(path,value,status=200)=>{const response=await fetch(base+path,{method:value===undefined?'GET':'POST',...(value===undefined?{}:{headers:{'content-type':'application/json'},body:JSON.stringify(value)})}),body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
 const dataset=await call('/api/mcf/datasets',{title:'Disposable concurrency fixture',mode:'general',reviewCategory:'',actor},201);
 const response=await fetch(base+'/api/mcf/datasets/'+dataset.id+'/imports?filename=synthetic.txt&actor='+encodeURIComponent(actor),{method:'POST',body:Array.from({length:30},(_,i)=>`The manager allocates resources for team ${i+1}.`).join(' ')});assert.equal(response.status,201);const imported=await response.json();await call('/api/mcf/imports/'+imported.id+'/map',{actor},201);
 const session=await call('/api/mcf/datasets/'+dataset.id+'/sessions',{title:'Concurrent fixture',kind:'coding',reviewBoundariesConfirmed:true,actor},201);
 const units=(await call('/api/mcf/sessions/'+session.id)).units;assert.equal(units.length,30);
 const calls=[];let live=0,max=0;
 const provider={id:'synthetic',model:'fixture',configurationId:'fixture-connection',async analyse(request){live++;max=Math.max(max,live);let release,fail;const gate=new Promise((resolve,reject)=>{release=resolve;fail=reject;});const ids=JSON.parse(request.instructions.split('TARGET unit IDs: ')[1].split(' Frozen MCF')[0]);calls.push({request,ids,release,fail});try{await gate;return{value:{units:ids.map(unitId=>({unitId,codes:[],valence:null,notes:'Synthetic zero-code fixture',...(request.analysisType==='mcf-evidential-proposals.v3'?{ambiguity:{status:'none',reason:'Synthetic unambiguous fixture',evidence:[],alternatives:[]}}:{})}))},confidence:1,evidenceSegmentIds:ids,limitations:['Synthetic fixture']};}finally{live--;}}};
 const repo=new McfRepository(db,join(temporary,'sources')),workers=Array.from({length:5},()=>new McfAiWorker(repo,()=>provider)),worker=workers[0];
 const view=async id=>(await worker.overview(session.id)).runs.find(r=>r.id===id);
 const ready=async id=>db.query("UPDATE researched.mcf_semantic_tasks s SET next_attempt_at=now() FROM researched.mcf_ai_tasks t WHERE s.task_id=t.id AND t.run_id=$1",[id]);
 const run=await worker.enqueue(session.id,'classification',actor);
 const initial=workers.map(w=>w.semantic.process());await wait(()=>calls.length===2);await new Promise(r=>setTimeout(r,100));assert.equal(calls.length,2);assert.equal(live,2);assert.equal(new Set(calls.flatMap(c=>c.ids)).size,12);
 calls[0].fail(Error('ai_provider_http_502'));await wait(()=>live===1);await wait(async()=>(await db.query("SELECT count(*)::int AS n FROM researched.mcf_ai_tasks WHERE run_id=$1 AND status='running'",[run.id])).rows[0].n===1);
 await ready(run.id);const third=worker.semantic.process();await wait(()=>calls.length===3);assert.deepEqual(calls[2].ids,units.slice(12,18).map(u=>u.id));assert.equal(live,2);
 calls[2].release();await third;calls[1].release();await Promise.all(initial);
 const saved=(await db.query('SELECT * FROM researched.mcf_ai_outputs WHERE run_id=$1 ORDER BY id',[run.id])).rows;assert.equal(saved.length,2);
 for(let i=0;i<2;i++){const pending=worker.semantic.process();await wait(()=>calls.length===4+i);calls[3+i].release();await pending;}
 assert.equal((await view(run.id)).status,'running');
 for(let attempt=2;attempt<=3;attempt++){await ready(run.id);const pending=worker.semantic.process();await wait(()=>calls.length===4+attempt);const c=calls.at(-1);assert.deepEqual(c.ids,units.slice(0,6).map(u=>u.id));assert.equal(c.request.timeoutMs,attempt===2?180000:210000);c.fail(Error('ai_provider_http_502'));await pending;}
 assert.equal((await view(run.id)).status,'partial');assert.equal((await view(run.id)).coverage.semanticAssessed,24);assert.equal((await view(run.id)).attempts.length,7);
 await worker.resume(session.id,run.id,actor);const retry=worker.semantic.process();await wait(()=>calls.length===8);assert.deepEqual(calls.at(-1).ids,units.slice(0,6).map(u=>u.id));calls.at(-1).release();await retry;
 assert.equal((await view(run.id)).status,'completed');assert.equal((await view(run.id)).coverage.semanticAssessed,30);
 assert.deepEqual((await db.query('SELECT * FROM researched.mcf_ai_outputs WHERE id=ANY($1::uuid[]) ORDER BY id',[saved.map(o=>o.id)])).rows,saved);
 for(const c of calls){assert.equal(c.request.evidence.length,30);assert.deepEqual(c.request.evidence.map(e=>e.segmentId),units.map(u=>u.id));assert.equal(c.ids.length,6);assert.equal(c.request.analysisType,'mcf-evidential-proposals.v3');}
 assert.equal(max,2);console.log('PASS atomic two-slot claiming across five workers; untouched-first retries; finite independent budgets; unresolved-only resume; unchanged retained successes and same-review request context');
 // Legacy run policy remains serial until an explicit resume upgrades it.
 const legacy=await worker.enqueue(session.id,'classification',actor);await db.query("UPDATE researched.mcf_ai_runs SET configuration=jsonb_set(jsonb_set(configuration,'{semanticPolicy,concurrency}','1'),'{semanticPolicy,version}','7') WHERE id=$1",[legacy.id]);
 let n=calls.length;const serial=workers.map(w=>w.semantic.process());await wait(()=>calls.length===n+1);await new Promise(r=>setTimeout(r,100));assert.equal(live,1);assert.equal(calls.length,n+1);await worker.cancel(session.id,legacy.id);calls.at(-1).release();await Promise.all(serial);assert.equal((await view(legacy.id)).status,'cancelled');assert.equal((await view(legacy.id)).coverage.semanticAssessed,6);
 await worker.resume(session.id,legacy.id,actor);assert.equal((await view(legacy.id)).configuration.semanticPolicy.concurrency,2);
 n=calls.length;const resumed=workers.map(w=>w.semantic.process());await wait(()=>calls.length===n+2);await worker.cancel(session.id,legacy.id);calls[n].release();calls[n+1].release();await Promise.all(resumed);assert.equal((await view(legacy.id)).coverage.semanticAssessed,18);console.log('PASS legacy policy unchanged until explicit resume; cancellation preserves both in-flight successes and stops queued work');
 const paused=await worker.enqueue(session.id,'classification',actor);n=calls.length;const peers=workers.map(w=>w.semantic.process());await wait(()=>calls.length===n+2);calls[n].fail(Error('ai_provider_http_401'));await wait(async()=>(await view(paused.id)).status==='failed');calls[n+1].release();await Promise.all(peers);assert.equal((await view(paused.id)).status,'partial');assert.equal((await view(paused.id)).coverage.semanticAssessed,6);await worker.semantic.process();assert.equal(calls.length,n+2);console.log('PASS authentication pause with concurrent successful result is accurately partial and does not release queued work');
 console.log('All concurrency integration checks passed on disposable PostgreSQL; no live data or external AI accessed.');
}finally{if(server)await new Promise(r=>server.close(r));if(db)await db.end();await manager.stop();}
