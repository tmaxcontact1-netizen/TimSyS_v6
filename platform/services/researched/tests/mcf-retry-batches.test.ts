import {it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {SemanticWorker,SEMANTIC_POLICY,retryGroups} from '../src/application/mcf-semantic.js';
import {MCF_HASH} from '../src/domain/mcf.js';
import {CLASSIFICATION_RULES_V10} from '../src/domain/mcf-semantic-policy.js';
import {GenericJsonAnalysisProvider} from '../src/application/ai-analysis.js';

it('partitions without duplication, omission, or reordering',()=>{
 expect(retryGroups([1,2,3,4,5,6],3)).toEqual([[1,2,3],[4,5,6]]);
 expect(retryGroups([1,2,3,4],3)).toEqual([[1,2,3],[4]]);
 expect(()=>retryGroups([1],0)).toThrow();
});

it('splits failed work, carries the budget, retains successful children, and keeps full review context',async()=>{
 const set=randomUUID(),runId=randomUUID();
 const units=Array.from({length:6},()=>({id:randomUUID(),unit_set_id:set,record_id:randomUUID(),original_text:'Evidence.',start_offset:0}));
 const tasks:any[]=[{id:randomUUID(),run_id:runId,unit_ids:units.map(u=>u.id),status:'queued',ordinal:1,cycle:1,inherited:0,attempts:0}];
 const attempts:any[]=[],outputs:any[]=[],requests:any[]=[];
 const configuration={semanticProtocol:3,evidenceProtocol:2,instrumentHash:MCF_HASH,semanticPolicy:SEMANTIC_POLICY,contextUnitIds:units.map(u=>u.id),contextPolicy:{maximumCharacters:200000},classificationConfig:{rules:CLASSIFICATION_RULES_V10},provider:{id:'fixture',model:'fixture',connectionId:null}};
 let selected:any;
 const query=async(sql:string,args:any[]=[])=>{
  let rows:any[]=[];
  if(sql.startsWith('WITH next')){selected=tasks.filter(t=>t.status==='queued').sort((a,b)=>a.inherited+a.attempts-b.inherited-b.attempts||a.ordinal-b.ordinal)[0];if(selected){selected.status='running';rows=[{...selected,unit_ids:[...selected.unit_ids]}];}}
  else if(sql.startsWith('SELECT * FROM researched.mcf_ai_runs'))rows=[{id:runId,session_id:'session',status:'running',configuration}];
  else if(sql.startsWith('SELECT s.cycle')){const t=tasks.find(t=>t.id===args[0]);rows=[{cycle:t.cycle,inherited_attempts:t.inherited,attempts:t.attempts}];}
  else if(sql.startsWith('INSERT INTO researched.mcf_semantic_attempts')){tasks.find(t=>t.id===args[1]).attempts++;attempts.push({id:args[0],number:args[3],units:JSON.parse(args[5])});}
  else if(sql.startsWith('SELECT * FROM researched.mcf_units'))rows=units.filter(u=>args[0].includes(u.id));
  else if(sql.startsWith('SELECT u.*'))rows=units;
  else if(sql.startsWith('SELECT status'))rows=[{status:'running'}];
  else if(sql.startsWith('SELECT max(ordinal)'))rows=[{ordinal:Math.max(...tasks.map(t=>t.ordinal))}];
  else if(sql.startsWith('UPDATE researched.mcf_ai_tasks SET unit_ids'))tasks.find(t=>t.id===args[0]).unit_ids=JSON.parse(args[1]);
  else if(sql.startsWith('UPDATE researched.mcf_ai_tasks SET status=$2'))tasks.find(t=>t.id===args[0]).status=args[1];
  else if(sql.startsWith("UPDATE researched.mcf_ai_tasks SET status='completed'"))tasks.find(t=>t.id===args[0]).status='completed';
  else if(sql.startsWith('INSERT INTO researched.mcf_ai_tasks'))tasks.push({id:args[0],run_id:args[1],ordinal:args[2],unit_ids:JSON.parse(args[3]),status:'queued',attempts:0});
  else if(sql.startsWith('INSERT INTO researched.mcf_semantic_tasks'))Object.assign(tasks.find(t=>t.id===args[0]),{cycle:args[1],inherited:args[2],parent:args[3]});
  else if(sql.startsWith('INSERT INTO researched.mcf_ai_outputs'))outputs.push(JSON.parse(args[3]));
  else if(sql.startsWith('SELECT 1 FROM researched.mcf_ai_tasks'))rows=tasks.filter(t=>t.status==='completed');
  return{rows,rowCount:rows.length};
 };
 const repo:any={db:{query},transaction:async(fn:any)=>fn({query}),session:async()=>({id:'session',dataset_id:'dataset',instrument_hash:MCF_HASH,mode:'general'}),writable:async()=>{},active:async()=>{},audit:async()=>{}};
 const provider:any={id:'fixture',model:'fixture',analyse:async(request:any)=>{
  requests.push(request);if(selected.ordinal===1&&selected.attempts===1||selected.ordinal===2)throw Error('ai_provider_local_timeout');
  return{value:{units:selected.unit_ids.map((id:string)=>({unitId:id,codes:[],valence:null,notes:'',}))},confidence:1,evidenceSegmentIds:units.map(u=>u.id),limitations:[]};
 }};
 const worker=new SemanticWorker(repo,()=>provider);
 await worker.process();expect(tasks.map(t=>t.unit_ids.length)).toEqual([3,3]);expect(tasks[1].inherited).toBe(1);expect(attempts[0].units).toHaveLength(6);
 await worker.process();const retained=JSON.stringify(outputs);expect(outputs).toHaveLength(1);
 await worker.process();await worker.process();await worker.process();
 expect(tasks.map(t=>t.status)).toEqual(['completed','failed']);expect(JSON.stringify(outputs)).toBe(retained);
 expect(attempts.map(a=>a.number)).toEqual([1,2,2,3]);
 expect(requests.map(r=>r.timeoutMs)).toEqual([150000,180000,180000,210000]);
 for(const request of requests){expect(request.evidence).toHaveLength(6);expect(request.instructions.startsWith(CLASSIFICATION_RULES_V10)).toBe(true);}
 expect(tasks[1].parent).toBe(attempts[0].id);
});

it('records local deadline separately from upstream HTTP failures without sensitive content',async()=>{
 let diagnostics:any;
 const request={requestId:'test',analysisType:'test',instructions:'SECRET CORPUS',evidence:[],timeoutMs:5,onDiagnostics:(d:any)=>diagnostics=d};
 const provider=new GenericJsonAnalysisProvider('test',{protocol:'generic-json',model:'test',baseUrl:'http://127.0.0.1/test',apiKey:'SECRET KEY',fetch:async(_url,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(Error('abort'))))});
 await expect(provider.analyse(request)).rejects.toThrow('ai_provider_local_timeout');
 expect(diagnostics).toMatchObject({failureOrigin:'researched-local-deadline',requestedTimeoutMs:5});expect(diagnostics.requestBytes).toBeGreaterThan(0);expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
 const upstream=new GenericJsonAnalysisProvider('test',{protocol:'generic-json',model:'test',baseUrl:'http://127.0.0.1/test',fetch:async()=>new Response('{"error":{"code":"upstream_timeout","message":"SECRET"}}',{status:502})});
 await expect(upstream.analyse({...request,timeoutMs:1000})).rejects.toThrow('ai_provider_http_502');
 expect(diagnostics).toMatchObject({failureOrigin:'provider-http-or-body',httpStatus:502,upstreamCode:'upstream_timeout'});expect(JSON.stringify(diagnostics)).not.toContain('SECRET');
});
