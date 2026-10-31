import {CLASSIFICATION_RULES_V9,resumedOperationalPolicy} from '../domain/mcf-semantic-policy.js';
import {snapshotIsrRatings,isrMetadataForRequest} from '../domain/isr-rating-metadata.js';
import {providerIdentity as identity,checkResumeProvider} from './provider-identity.js';
import {ambiguityResponse,retainAiAmbiguity} from '../domain/ai-ambiguity.js';
import {semanticFailureCategory,safeFailureDiagnostics} from '../domain/semantic-failure.js';
import {evidentialResponse,confirmedReview,retainContext,normalizeMachineContext} from '../domain/mcf-evidence.js';
import {decisionInput,validateDecision} from '../domain/mcf.js';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {MCF,MCF_HASH} from '../domain/mcf.js';
import config from '../../analysis-config/mcf-classification/1.1.json' with {type:'json'};
import {McfRepository} from '../infrastructure/mcf-repository.js';
import {runGroundedAiAnalysis,type AiAnalysisProvider} from './ai-analysis.js';
import {deterministicMcf,DETERMINISTIC_CONFIG,DETERMINISTIC_HASH} from './mcf-deterministic.js';
import {proposalResponse,validateProposals} from './mcf-ai.js';

export const SEMANTIC_POLICY=Object.freeze({version:9,scheduling:"untouched-first-retry-rounds",firstBatchGate:false,maximumBatchUnits:6,maximumBatchCharacters:10000,timeoutMs:120000,attemptTimeoutsMs:[120000,180000,210000],maximumAttempts:3,retryDelaysMs:[30000,120000],concurrency:2});
export function semanticAttemptTimeout(policy:{timeoutMs:number;attemptTimeoutsMs?:readonly number[]},attempt:number){return policy.attemptTimeoutsMs?.[attempt-1]??policy.timeoutMs;}
export function transientSemanticError(error:string){return /abort|timeout|timed out|429|(?:^|[_\s])5\d\d(?:$|\b)|fetch failed|network|econn|socket/i.test(error);}
export class SemanticWorker{
 stopped=false;
 constructor(readonly repo:McfRepository,readonly provider:()=>AiAnalysisProvider|null){}
 async start(){
  // Only protocol-v2 work is recoverable here. Never rewrite historical pilot runs.
  await this.repo.transaction(async c=>{
   await c.query("UPDATE researched.mcf_semantic_attempts SET finished_at=now(),outcome='semantic_interrupted',error='Application restarted; explicit resume required.' WHERE outcome='running'");
   await c.query("UPDATE researched.mcf_ai_tasks t SET status='failed',error='Semantic request interrupted by restart; resume required.' FROM researched.mcf_semantic_tasks s WHERE s.task_id=t.id AND t.status='running'");
   await c.query("UPDATE researched.mcf_ai_runs r SET status=CASE WHEN EXISTS(SELECT 1 FROM researched.mcf_ai_outputs o WHERE o.run_id=r.id) THEN 'partial' ELSE 'failed' END,finished_at=now() WHERE r.configuration->>'semanticProtocol' IN ('2','3') AND r.status IN ('queued','running')");
  });
 }
 async enqueue(sessionId:string,actor:string,localOnly:boolean){
  const session=await this.repo.workspace(sessionId);if(session.instrument_hash!==MCF_HASH)throw Error('instrument_version_mismatch');if(session.blind||session.kind==='validation')throw Error('manual_validation_no_ai');
  if(session.records.some((r:any)=>!confirmedReview(r,session.configuration)))throw Error('Confirm individual-review boundaries before starting the new evidential protocol. A compiled document must be mapped into separate reviews.');
  const units=session.units.filter((u:any)=>u.original_text.trim());if(!units.length)throw Error('no_readable_evidence');
  const provider=localOnly?null:this.provider(),id=randomUUID(),batches:any[][]=[];
  let batch:any[]=[],size=0;for(const u of units){if(batch.length&&(batch[0].unit_set_id!==u.unit_set_id||batch.length>=SEMANTIC_POLICY.maximumBatchUnits||size+u.original_text.length>SEMANTIC_POLICY.maximumBatchCharacters)){batches.push(batch);batch=[];size=0;}batch.push(u);size+=u.original_text.length;}if(batch.length)batches.push(batch);
  await this.repo.transaction(async c=>{
   await this.repo.writable(session.dataset_id,c);await this.repo.active('sessions',sessionId,c);
   await c.query('INSERT INTO researched.mcf_ai_runs(id,session_id,kind,status,configuration,actor,finished_at) VALUES($1,$2,\'classification\',$3,$4,$5,$6)',[id,sessionId,provider?'queued':'partial',JSON.stringify({semanticProtocol:3,evidenceProtocol:2,ambiguityProtocol:2,ambiguitySourceMetadata:snapshotIsrRatings(session.records,session.contextUnits.map((u:any)=>({...u,record_id:session.configuration.unitSets.find((s:any)=>s.id===u.unit_set_id)?.record_id}))),contextPolicy:{boundary:'individual-review',scope:'all approved same-review units',maximumCharacters:200000},contextUnitIds:session.contextUnits.map((u:any)=>u.id),semanticPolicy:SEMANTIC_POLICY,provider:identity(provider),instrumentHash:MCF_HASH,classificationConfig:{...config,version:"3.1",promptVersion:"mcf-evidential-proposals.v3",rules:CLASSIFICATION_RULES_V9},unitSets:session.configuration.unitSets,deterministicConfig:DETERMINISTIC_CONFIG,deterministicHash:DETERMINISTIC_HASH,localOnly,notice:'Deterministic retrieval is support only; pending semantic work is not completed analysis.'}),actor,provider?null:new Date()]);
   for(const [i,group]of batches.entries()){const task=randomUUID();await c.query("INSERT INTO researched.mcf_ai_tasks(id,run_id,ordinal,unit_ids,status,error) VALUES($1,$2,$3,$4,'queued',$5)",[task,id,i+1,JSON.stringify(group.map(u=>u.id)),provider?null:'Semantic pending: provider unavailable or candidate-only preparation selected.']);await c.query('INSERT INTO researched.mcf_semantic_tasks(task_id) VALUES($1)',[task]);}
   for(const p of deterministicMcf(units,DETERMINISTIC_CONFIG.rules))await c.query('INSERT INTO researched.mcf_deterministic_candidates(run_id,unit_id,payload) VALUES($1,$2,$3)',[id,p.unitId,JSON.stringify(p)]);
   await this.repo.audit(c,session.dataset_id,'mcf_semantic_requested',id,actor,{sessionId,policy:SEMANTIC_POLICY,provider:identity(provider)});
  });return{id};
 }
 async resume(sessionId:string,id:string,actor:string,confirmLegacyProvider=false){
  const provider=this.provider();if(!provider)throw Error('Connect AI before resuming semantic analysis.');
  const workspace=await this.repo.workspace(sessionId);if(workspace.records.some((r:any)=>!confirmedReview(r,workspace.configuration)))throw Error('This historical population has unresolved review boundaries. Preserve this run and create a new structurally mapped population; it cannot be resumed.');
  await this.repo.transaction(async c=>{
   const session=await this.repo.session(sessionId,c);await this.repo.writable(session.dataset_id,c);await this.repo.active('sessions',sessionId,c);
   const run=(await c.query('SELECT * FROM researched.mcf_ai_runs WHERE id=$1 AND session_id=$2 FOR UPDATE',[id,sessionId])).rows[0];
   if(!run||![2,3].includes(run.configuration.semanticProtocol))throw Error('Historical pilot runs are audit-only and cannot be resumed.');
   if(['queued','running'].includes(run.status))throw Error('Analysis is already running.');
   if(run.status==='completed')throw Error('Semantic analysis is already complete.');
   checkResumeProvider(run.configuration.provider,identity(provider)!,confirmLegacyProvider);
   if((await c.query("SELECT 1 FROM researched.mcf_ai_tasks WHERE run_id=$1 AND status='running'",[id])).rowCount)throw Error('Wait for the interrupted request to settle before resuming.');
   await c.query("UPDATE researched.mcf_semantic_tasks s SET cycle=cycle+1,next_attempt_at=now() FROM researched.mcf_ai_tasks t WHERE t.id=s.task_id AND t.run_id=$1 AND t.status<>'completed'",[id]);
   await c.query("UPDATE researched.mcf_ai_tasks SET status='queued',error=NULL WHERE run_id=$1 AND status<>'completed'",[id]);
   // Upgrade execution limits only on explicit resume. Completed tasks and their outputs are immutable.
   const policy=resumedOperationalPolicy(run.configuration.semanticPolicy,SEMANTIC_POLICY);
   await c.query("UPDATE researched.mcf_ai_runs SET status='queued',finished_at=NULL,configuration=jsonb_set(jsonb_set(configuration,'{provider}',$2::jsonb),'{semanticPolicy}',$3::jsonb) WHERE id=$1",[id,JSON.stringify(identity(provider)),JSON.stringify(policy)]);
   await this.repo.audit(c,session.dataset_id,'mcf_semantic_resumed',id,actor,{previousPolicy:run.configuration.semanticPolicy,policy,previousProvider:run.configuration.provider,provider:identity(provider),legacyProviderConfirmed:confirmLegacyProvider,successfulResultsPreserved:true});
  });return{resumed:true,id};
 }
 async cancel(sessionId:string,id:string){
  await this.repo.transaction(async c=>{
   const run=(await c.query('SELECT * FROM researched.mcf_ai_runs WHERE id=$1 AND session_id=$2 FOR UPDATE',[id,sessionId])).rows[0];if(!run||![2,3].includes(run.configuration.semanticProtocol))throw Error('Historical pilot runs are audit-only.');
   await c.query("UPDATE researched.mcf_ai_runs SET status='cancelled',finished_at=now() WHERE id=$1 AND status IN ('queued','running')",[id]);
   // In-flight successful responses may still be retained. Resume waits until they settle.
   await c.query("UPDATE researched.mcf_ai_tasks SET error='Semantic pending: stopped by researcher.' WHERE run_id=$1 AND status='queued'",[id]);
  });return{cancelled:true};
 }
 async settle(){await this.repo.db.query("UPDATE researched.mcf_ai_runs r SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM researched.mcf_ai_tasks t WHERE t.run_id=r.id AND t.status<>'completed') THEN 'completed' WHEN EXISTS(SELECT 1 FROM researched.mcf_ai_tasks t WHERE t.run_id=r.id AND t.status='completed') THEN 'partial' ELSE 'failed' END,finished_at=now() WHERE r.configuration->>'semanticProtocol' IN ('2','3') AND r.status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM researched.mcf_ai_tasks t WHERE t.run_id=r.id AND t.status IN ('queued','running'))");}
 async process(){
  if(this.stopped)return;
  // Durable attempt counts put untouched batches first, then second/third attempts.
  // Readiness still respects backoff; completed tasks are never eligible.
  // Serialize only the short claim transaction, never provider requests. The second
  // statement sees claims committed while waiting for the advisory lock.
  const task=await this.repo.transaction(async c=>{
   await c.query("SELECT pg_advisory_xact_lock(hashtext('researched.mcf.semantic.claim'),0)");
  return (await c.query("WITH next AS(SELECT t.id FROM researched.mcf_ai_tasks t JOIN researched.mcf_semantic_tasks s ON s.task_id=t.id JOIN researched.mcf_ai_runs r ON r.id=t.run_id WHERE t.status='queued' AND r.status IN ('queued','running') AND s.next_attempt_at<=now() AND (r.configuration->'semanticPolicy'->>'firstBatchGate'='false' OR EXISTS(SELECT 1 FROM researched.mcf_ai_tasks ok WHERE ok.run_id=r.id AND ok.status='completed') OR t.ordinal=(SELECT min(first.ordinal) FROM researched.mcf_ai_tasks first WHERE first.run_id=r.id)) AND (SELECT count(*) FROM researched.mcf_ai_tasks busy JOIN researched.mcf_semantic_tasks bs ON bs.task_id=busy.id WHERE busy.status='running')<2 AND (SELECT count(*) FROM researched.mcf_ai_tasks busy WHERE busy.run_id=r.id AND busy.status='running')<LEAST(2,GREATEST(1,COALESCE((r.configuration->'semanticPolicy'->>'concurrency')::int,1))) ORDER BY r.created_at,(SELECT count(*) FROM researched.mcf_semantic_attempts a WHERE a.task_id=t.id AND a.cycle=s.cycle),t.ordinal FOR UPDATE OF t,r SKIP LOCKED LIMIT 1) UPDATE researched.mcf_ai_tasks t SET status='running',error=NULL FROM next WHERE t.id=next.id RETURNING t.*")).rows[0];
  });if(!task)return;
  const started=new Date(),attemptId=randomUUID();let attempt=0,cycle=0,responsePhase=false;let policy=SEMANTIC_POLICY;
  try{
   const run=(await this.repo.db.query('SELECT * FROM researched.mcf_ai_runs WHERE id=$1',[task.run_id])).rows[0],session=await this.repo.session(run.session_id);policy=run.configuration.semanticPolicy;
   await this.repo.transaction(async c=>{await this.repo.writable(session.dataset_id,c);await this.repo.active('sessions',session.id,c);});
   const state=(await this.repo.db.query('SELECT s.cycle,(SELECT count(*)::int FROM researched.mcf_semantic_attempts a WHERE a.task_id=s.task_id AND a.cycle=s.cycle) AS attempts FROM researched.mcf_semantic_tasks s WHERE task_id=$1',[task.id])).rows[0];cycle=state.cycle;attempt=state.attempts+1;
   if(attempt>policy.maximumAttempts)throw Error('Finite semantic retry limit exhausted.');
   await this.repo.db.query("INSERT INTO researched.mcf_semantic_attempts(id,task_id,cycle,attempt,started_at,outcome) VALUES($1,$2,$3,$4,$5,'running')",[attemptId,task.id,cycle,attempt,started]);
   if(session.instrument_hash!==MCF_HASH||run.configuration.instrumentHash!==MCF_HASH)throw Error('instrument_version_mismatch');
   const provider=this.provider(),wanted=run.configuration.provider;
   if(!provider||provider.id!==wanted?.id||provider.model!==wanted?.model||(provider.configurationId??null)!==wanted?.connectionId)throw Error('Semantic provider unavailable or changed; reconnect and resume.');
   const units=(await this.repo.db.query('SELECT * FROM researched.mcf_units WHERE id=ANY($1::uuid[]) ORDER BY array_position($1::uuid[],id)',[task.unit_ids])).rows;
   if(units.some(u=>u.original_text.length>policy.maximumBatchCharacters))throw Error('Passage exceeds semantic request limit; split it in a new segmentation version.');
   await this.repo.db.query("UPDATE researched.mcf_ai_runs SET status='running' WHERE id=$1 AND status='queued'",[run.id]);
   const modern=run.configuration.semanticProtocol===3,assessAmbiguity=modern&&[1,2].includes(run.configuration.ambiguityProtocol);
   const pool=modern?(await this.repo.db.query('SELECT u.*,us.record_id FROM researched.mcf_units u JOIN researched.mcf_unit_sets us ON us.id=u.unit_set_id WHERE u.unit_set_id=$1 AND u.id=ANY($2::uuid[]) ORDER BY u.ordinal',[units[0].unit_set_id,run.configuration.contextUnitIds])).rows:units;
   if(modern&&(units.some(u=>u.unit_set_id!==units[0].unit_set_id)||units.some(u=>!pool.some(x=>x.id===u.id))))throw Error('Invalid same-review context population.');
   if(modern&&pool.reduce((n,u)=>n+u.original_text.length,0)>run.configuration.contextPolicy.maximumCharacters)throw Error('Review exceeds the permitted context budget. No context was truncated; assessment remains unresolved.');
   const {metadata:ratingMetadata,instructions:scaleInstructions}=isrMetadataForRequest(run.configuration,units[0].unit_set_id);
   responsePhase=true;
   const answer=await runGroundedAiAnalysis(provider,{requestId:attemptId,timeoutMs:semanticAttemptTimeout(policy,attempt),analysisType:modern?(assessAmbiguity?'mcf-evidential-proposals.v3':'mcf-evidential-proposals.v2'):run.configuration.classificationConfig.promptVersion,instructions:`${run.configuration.classificationConfig.rules}${scaleInstructions}\nCitation formatting: do not repeat an identical unit ID and quotation within a competency. Distinct exact quotations from the same permitted contextual unit may be cited separately.\nMode: ${session.mode}. ${modern?'TARGET unit IDs: '+JSON.stringify(units.map(u=>u.id)):'Return exactly one entry per supplied section.'} Frozen MCF instrument: ${JSON.stringify(MCF)}`,evidence:pool.map(u=>({segmentId:u.id,sourceId:u.unit_set_id,content:u.original_text})),outputSchema:z.toJSONSchema(assessAmbiguity?ambiguityResponse:modern?evidentialResponse:proposalResponse)});
   let proposals:any[];
   if(modern){
    const parsed=(assessAmbiguity?ambiguityResponse:evidentialResponse).parse(answer.value);
    if(parsed.units.length!==units.length||new Set(parsed.units.map(u=>u.unitId)).size!==units.length||parsed.units.some(p=>!units.some(u=>u.id===p.unitId)))throw Error('incomplete_mcf_response');
    proposals=parsed.units.map(p=>{const target=pool.find(u=>u.id===p.unitId);const {codes,normalization}=normalizeMachineContext(p.codes.map(c=>({...c,evidenceProtocol:2 as const})));const decision=decisionInput.parse({previousId:null,codes,valence:p.valence,notes:p.notes,reviewedNoCode:!codes.length,actor:'Machine proposal'});validateDecision(decision,target.original_text,session.mode);
     if(codes.length&&!answer.evidenceSegmentIds.includes(target.id))throw Error('unsupported_mcf_citation');
     if(codes.flatMap(c=>c.context).some(r=>!answer.evidenceSegmentIds.includes(r.unitId)))throw Error('unsupported_context_citation');
     const ambiguity=assessAmbiguity?retainAiAmbiguity((p as any).ambiguity,codes,target,pool,answer.evidenceSegmentIds,{runId:run.id,attemptId,provider:identity(provider),protocolVersion:run.configuration.ambiguityProtocol,...(ratingMetadata?.ratings.length?{sourceMetadata:ratingMetadata}:{}),promptVersion:run.configuration.classificationConfig.promptVersion}):undefined;
     return{...(ambiguity?{ambiguity,unresolvedCompetencyIds:ambiguity.alternatives.map(a=>a.competencyId)}:{}),unitId:p.unitId,recordId:target.record_id,evidenceProtocol:2,codes:retainContext(codes,target,pool),noApplicationCompetencyIds:MCF.competencies.filter(c=>!codes.some(x=>x.competencyId===c.id)&&!ambiguity?.alternatives.some(a=>a.competencyId===c.id)).map(c=>c.id),valence:p.valence,notes:p.notes,reviewedNoCode:!codes.length,provenance:{runId:run.id,attemptId,provider:identity(provider),normalization,semanticPolicyVersion:policy.version,timeoutMs:semanticAttemptTimeout(policy,attempt)}};
    });
   }else proposals=validateProposals(answer.value,units,session.mode,answer.evidenceSegmentIds);
   proposals=proposals.map(p=>({...p,method:'ai',pathway:p.codes.length?'semantic_success':'semantic_zero_code'}));
   responsePhase=false;
   await this.repo.transaction(async c=>{
    await this.repo.writable(session.dataset_id,c);await this.repo.active('sessions',session.id,c);
    await c.query('SELECT id FROM researched.mcf_ai_runs WHERE id=$1 FOR UPDATE',[run.id]);
    const current=(await c.query('SELECT status FROM researched.mcf_ai_tasks WHERE id=$1 FOR UPDATE',[task.id])).rows[0];if(current?.status!=='running')throw Error('Semantic task interrupted before result retention.');
    const output=randomUUID();await c.query('INSERT INTO researched.mcf_ai_outputs(id,run_id,task_id,payload) VALUES($1,$2,$3,$4)',[output,run.id,task.id,JSON.stringify({method:'ai',proposals,limitations:answer.limitations,provider:identity(provider),instrumentHash:MCF_HASH,attemptId})]);
    for(const p of proposals)await c.query('INSERT INTO researched.mcf_ai_proposals(id,output_id,session_id,unit_id,payload) VALUES($1,$2,$3,$4,$5)',[randomUUID(),output,session.id,p.unitId,JSON.stringify(p)]);
    await c.query("UPDATE researched.mcf_ai_tasks SET status='completed',error=NULL WHERE id=$1",[task.id]);
    // A peer may have paused the run before this in-flight success was retained.
    // Reflect partial coverage without releasing queued work or undoing cancellation.
    await c.query("UPDATE researched.mcf_ai_runs SET status='partial' WHERE id=$1 AND status='failed'",[run.id]);
    await c.query("UPDATE researched.mcf_semantic_attempts SET finished_at=now(),duration_ms=$2,outcome='semantic_success' WHERE id=$1",[attemptId,Date.now()-started.getTime()]);
   });
  }catch(error){
   const message=error instanceof Error?error.message:String(error);
   await this.repo.transaction(async c=>{
    const run=(await c.query('SELECT * FROM researched.mcf_ai_runs WHERE id=$1 FOR UPDATE',[task.run_id])).rows[0];if(!run)return;
    const category=responsePhase?semanticFailureCategory(error):'integrity';
    await c.query("UPDATE researched.mcf_semantic_attempts SET finished_at=now(),duration_ms=$2,outcome='semantic_failed',error=$3,failure_category=$4,diagnostics=$5 WHERE id=$1 AND outcome='running'",[attemptId,Date.now()-started.getTime(),message,category,JSON.stringify(safeFailureDiagnostics(error))]);
    // Transient failures belong to a batch; they must not consume another batch's retry budget.
    const circuitOpen=category==='connection';
    const hasSuccess=(await c.query("SELECT 1 FROM researched.mcf_ai_tasks WHERE run_id=$1 AND status='completed' LIMIT 1",[task.run_id])).rowCount;

    const retry=!circuitOpen&&!this.stopped&&['queued','running'].includes(run.status)&&attempt>0&&attempt<policy.maximumAttempts&&(transientSemanticError(message)||(responsePhase&&!/401|403|429|provider.*unavailable|provider.*changed/i.test(message)));
    await c.query('UPDATE researched.mcf_ai_tasks SET status=$2,error=$3 WHERE id=$1 AND status=\'running\'',[task.id,retry?'queued':'failed',message]);
    if(retry)await c.query("UPDATE researched.mcf_semantic_tasks SET next_attempt_at=now()+$2*interval '1 millisecond' WHERE task_id=$1",[task.id,policy.retryDelaysMs[attempt-1]]);
    else if(circuitOpen||(!hasSuccess&&policy.firstBatchGate)||!responsePhase)await c.query("UPDATE researched.mcf_ai_runs SET status=CASE WHEN EXISTS(SELECT 1 FROM researched.mcf_ai_outputs WHERE run_id=$1) THEN 'partial' ELSE 'failed' END,finished_at=now() WHERE id=$1 AND status IN ('queued','running')",[task.run_id]);
    if(circuitOpen||(!hasSuccess&&policy.firstBatchGate&&!retry)||(!responsePhase&&!retry))await this.repo.audit(c,(await this.repo.session(run.session_id,c)).dataset_id,'mcf_semantic_gate_paused',task.run_id,'Semantic worker',{operationalPolicy:policy.version,reason:circuitOpen?'Authentication or provider configuration requires intervention before explicit resume.':!responsePhase?'Integrity or retention check failed; explicit review required.':'First-batch verification failed; remaining population was not released.',attemptId,successfulResultsPreserved:true});
   });
  }
  await this.settle();
 }
}
