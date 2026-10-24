import {ValidationStages} from './validation-stages.js';
import {competencyEvidenceCounts} from '../domain/mcf-evidence.js';
import {createHash,randomUUID} from 'node:crypto';
import type {z} from 'zod';
import {McfRepository} from '../infrastructure/mcf-repository.js';
import {machineReport} from './mcf-report.js';
import {reviewAggregation} from '../domain/review-aggregation.js';
import {sampleValidation,validationPlan,validationJudgement} from '../domain/mcf-validation.js';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class McfValidation{
 constructor(readonly repo:McfRepository){}
 async candidate(sessionId:string,runId:string){
  const session=await this.repo.workspace(sessionId);if(session.blind||session.kind==='validation')throw Error('Choose a completed candidate coding run.');
  const saved=(await this.repo.db.query('SELECT payload FROM researched.mcf_report_snapshots WHERE session_id=$1',[sessionId])).rows[0]?.payload;
  const report=saved?.run.id===runId?saved:await machineReport(this.repo.db,sessionId,runId);
  if(report.run.legacyAuditOnly||report.run.status!=='completed'||report.coverage.semanticAssessed!==session.units.length||report.coverage.semanticPending||report.coverage.semanticFailed)throw Error('Candidate must have complete semantic coverage.');
  return{session,report};
 }
 async reviewReport(sessionId:string,runId:string){const {session,report}=await this.candidate(sessionId,runId);const findings=session.units.map((u:any)=>{const p=report.proposals.find((p:any)=>p.unit_id===u.id);return u.decision?{id:u.decision.id,unit_id:u.id,payload:{codes:u.decision.codes}}:p;}).filter(Boolean);return{contract:'researched.mcf-review-report.v1',runId,runHash:hash(report),basis:'Pinned machine findings plus saved human decisions in this session',evidenceLocationAnalysis:competencyEvidenceCounts(findings),aggregation:reviewAggregation(session.units,findings)};}

 async preview(sessionId:string,runId:string,plan:z.infer<typeof validationPlan>){const {report}=await this.candidate(sessionId,runId);return sampleValidation(report.proposals,plan);}
 async create(sessionId:string,runId:string,plan:z.infer<typeof validationPlan>){
  if(!plan.blind)throw Error('New validation samples begin with blind initial coding');
  const {session,report}=await this.candidate(sessionId,runId),sample=sampleValidation(report.proposals,plan),id=randomUUID();
  const contextUnits=session.contextUnits.map((u:any)=>({id:u.id,record_id:session.units.find((x:any)=>x.unit_set_id===u.unit_set_id)?.record_id,unit_set_id:u.unit_set_id,original_text:u.original_text,start_offset:u.start_offset,end_offset:u.end_offset}));
  if(contextUnits.some((u:any)=>!u.record_id)||sample.selectedUnitIds.some((id:string)=>!contextUnits.some((u:any)=>u.id===id)))throw Error('review_identity_missing');
  const reviewScope=session.records.map((r:any)=>({recordId:r.id,includedComponents:r.locator?.analysisComponents??[],excludedComponents:[...new Set((r.locator?.components??[]).map((x:any)=>x.component).filter((x:string)=>!(r.locator?.analysisComponents??[]).includes(x)))]}));
  await this.repo.transaction(async c=>{await this.repo.writable(session.dataset_id,c);await this.repo.active('sessions',sessionId,c);
   const configuration={...session.configuration,selectedUnitIds:sample.selectedUnitIds,populationUnitIds:session.units.map((u:any)=>u.id),validationVersion:2,candidateRunId:runId,candidateHash:hash(report),candidateSessionId:sessionId,thresholds:null};
   await c.query(`INSERT INTO researched.mcf_sessions(id,dataset_id,title,kind,blind,instrument_version,instrument_hash,engine_version,software_version,configuration,actor) SELECT $2,dataset_id,$3,'validation',$4,instrument_version,instrument_hash,engine_version,software_version,$5,$6 FROM researched.mcf_sessions WHERE id=$1`,[sessionId,id,plan.title,plan.blind,JSON.stringify(configuration),plan.actor]);
   for(const [i,unit]of sample.selectedUnitIds.entries())await c.query('INSERT INTO researched.mcf_session_units VALUES($1,$2,$3)',[id,unit,i+1]);
   await c.query('INSERT INTO researched.mcf_report_snapshots(session_id,payload) VALUES($1,$2)',[id,JSON.stringify({contract:'researched.validation-candidate.v2',report,plan,sample,contextUnits,reviewScope})]);
   await this.repo.audit(c,session.dataset_id,'validation_sample_created',id,plan.actor,{candidateRunId:runId,candidateHash:hash(report),selectedUnits:sample.selectedUnitIds.length});
  });return{id};
 }
 async list(sessionId:string){return{items:(await this.repo.db.query("SELECT id,title,blind,created_at FROM researched.mcf_sessions WHERE configuration->>'validationVersion' IN ('1','2') AND configuration->>'candidateSessionId'=$1 ORDER BY created_at DESC",[sessionId])).rows};}
 async view(id:string){const head=await this.repo.session(id);if(head.configuration.validationVersion===2)return new ValidationStages(this.repo).view(id);const s=await this.repo.workspace(id);if(s.configuration.validationVersion!==1)throw Error('validation_session_required');
  const history=(await this.repo.db.query("SELECT id,actor,occurred_at,after_value FROM researched.audit_events WHERE entity_id=$1 AND action='validation_judgement_appended' ORDER BY occurred_at,id",[id])).rows;
  const source=(await this.repo.db.query('SELECT payload FROM researched.mcf_report_snapshots WHERE session_id=$1',[id])).rows[0].payload;
  const revealed=(await this.repo.db.query("SELECT id,actor,occurred_at FROM researched.audit_events WHERE entity_id=$1 AND action='validation_candidate_revealed' ORDER BY occurred_at LIMIT 1",[id])).rows[0];
  const units=s.units.map((u:any)=>({id:u.id,record_id:u.record_id,unit_set_id:u.unit_set_id,original_text:u.original_text,start_offset:u.start_offset,end_offset:u.end_offset}));
  return{contract:'researched.validation-review.v1',id,title:s.title,blind:s.blind&&!revealed,reveal:revealed??null,candidateRunId:s.configuration.candidateRunId,candidateHash:s.configuration.candidateHash,units,contextUnits:source.contextUnits.map((u:any)=>({id:u.id,unit_set_id:u.unit_set_id,original_text:u.original_text,start_offset:u.start_offset,end_offset:u.end_offset})),history,...(!s.blind||revealed?{plan:source.plan,sample:source.sample,proposals:source.report.proposals.filter((p:any)=>units.some((u:any)=>u.id===p.unit_id))}:{}),notice:'Independent judgements; no reliability threshold or agreement score is imposed. Blind mode hides candidate findings and stratum membership in this workspace.'};
 }
 async judge(id:string,unitId:string,input:unknown){const head=await this.repo.session(id);if(head.configuration.validationVersion===2)return new ValidationStages(this.repo).save(id,unitId,input);const v=validationJudgement.parse(input);return this.repo.transaction(async c=>{
  const s=await this.repo.session(id,c);if(s.configuration.validationVersion!==1)throw Error('validation_session_required');await this.repo.writable(s.dataset_id,c);await this.repo.active('sessions',id,c);
  if(!(await c.query('SELECT unit_id FROM researched.mcf_session_units WHERE session_id=$1 AND unit_id=$2 FOR UPDATE',[id,unitId])).rowCount)throw Error('session_unit_not_found');
  const previous=(await c.query("SELECT id,after_value FROM researched.audit_events WHERE entity_id=$1 AND action='validation_judgement_appended' AND after_value->>'unitId'=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1",[id,unitId])).rows[0];
  if((previous?.id??null)!==v.previousId)throw Error('stale_validation_judgement');
  const revealed=(await c.query("SELECT id FROM researched.audit_events WHERE entity_id=$1 AND action='validation_candidate_revealed' LIMIT 1",[id])).rowCount;
  await this.repo.audit(c,s.dataset_id,'validation_judgement_appended',id,v.actor,{unitId,candidateVisible:!s.blind||!!revealed,revision:(previous?.after_value.revision??0)+1,...v});return{saved:true};
 });}
 async reveal(id:string,actor:string){const head=await this.repo.session(id);if(head.configuration.validationVersion===2)return new ValidationStages(this.repo).reveal(id,actor);return this.repo.transaction(async c=>{const s=await this.repo.session(id,c);if(s.configuration.validationVersion!==1)throw Error('validation_session_required');await this.repo.writable(s.dataset_id,c);await this.repo.active('sessions',id,c);await this.repo.audit(c,s.dataset_id,'validation_candidate_revealed',id,actor,{candidateRunId:s.configuration.candidateRunId,reason:'Researcher explicitly ended blind review; earlier judgements remain unchanged.'});return{revealed:true};});}
 async remove(id:string,actor:string){return this.repo.transaction(async c=>{const s=await this.repo.session(id,c);if(![1,2].includes(s.configuration.validationVersion))throw Error('validation_session_required');await this.repo.writable(s.dataset_id,c);await c.query('SELECT id FROM researched.mcf_sessions WHERE id=$1 FOR UPDATE',[id]);
  await c.query("SELECT set_config('researched.workbench_delete','yes',true)");
  await c.query('DELETE FROM researched.mcf_report_snapshots WHERE session_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_decisions WHERE session_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_representation_decisions WHERE session_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_session_units WHERE session_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_lifecycle_events WHERE target_id=$1',[id]);
  await c.query('DELETE FROM researched.audit_events WHERE entity_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_sessions WHERE id=$1',[id]);
  await this.repo.audit(c,s.dataset_id,'validation_sample_deleted',id,actor,{candidateRunId:s.configuration.candidateRunId,candidatePreserved:true});return{deleted:true};});}
}
