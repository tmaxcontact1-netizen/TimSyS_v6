import {ambiguityReport} from '../domain/mcf-ambiguity.js';
import {McfRepository} from '../infrastructure/mcf-repository.js';
import {latestStage,stageProgress,stagedJudgement,retainHumanContext} from '../domain/validation-stages.js';
const action='validation_stage_appended';
export class ValidationStages{
 constructor(readonly repo:McfRepository){}
 async state(id:string,c:any=this.repo.db){
  const s=await this.repo.session(id,c);if(s.configuration.validationVersion!==2)throw Error('staged_validation_required');
  const source=(await c.query('SELECT payload FROM researched.mcf_report_snapshots WHERE session_id=$1',[id])).rows[0]?.payload;if(!source)throw Error('validation_snapshot_not_found');
  const history=(await c.query("SELECT id,actor,occurred_at,after_value FROM researched.audit_events WHERE entity_id=$1 AND action=$2 ORDER BY occurred_at,id",[id,action])).rows;
  const reveal=(await c.query("SELECT id,actor,occurred_at,after_value FROM researched.audit_events WHERE entity_id=$1 AND action='validation_candidate_revealed' ORDER BY occurred_at,id LIMIT 1",[id])).rows[0]??null;
  const units=source.contextUnits.filter((u:any)=>s.configuration.selectedUnitIds.includes(u.id));
  return{s,source,history,reveal,units};
 }
 async view(id:string){const {s,source,history,reveal,units}=await this.state(id);
  return{contract:'researched.validation-review.v2',version:2,id,title:s.title,blind:!reveal,reveal,units,ambiguityReports:{initial:ambiguityReport(units,history,'initial'),...(reveal?{final:ambiguityReport(units,history,'final')}:{})},contextUnits:source.contextUnits,reviewScope:source.reviewScope,history,progress:stageProgress(units,history),candidateRunId:s.configuration.candidateRunId,candidateHash:s.configuration.candidateHash,
   ...(reveal?{proposals:source.report.proposals.filter((p:any)=>units.some((u:any)=>u.id===p.unit_id)),plan:source.plan}:{}),
   notice:'Single-researcher validation. Initial coding, recorded AI advice and final decisions are separate. No analysis is rerun. Completed initial coding affirms that all 21 competencies were considered; unselected competencies are not supported.'};
 }
 async save(id:string,unitId:string,input:unknown){const v=stagedJudgement.parse(input);return this.repo.transaction(async c=>{
  // Session lock serialises saving, revealing and deletion across tabs.
  await c.query('SELECT id FROM researched.mcf_sessions WHERE id=$1 FOR UPDATE',[id]);
  const {s,source,history,reveal,units}=await this.state(id,c);await this.repo.writable(s.dataset_id,c);await this.repo.active('sessions',id,c);
  const target=units.find((u:any)=>u.id===unitId);if(!target)throw Error('session_unit_not_found');
  if(v.phase==='initial'&&reveal)throw Error('Initial coding is locked after reveal; record changes as a final decision');
  if(v.phase!=='initial'&&!reveal)throw Error('Complete initial coding and reveal the candidate first');
  const previous=latestStage(history,unitId,v.phase);if((previous?.id??null)!==v.previousId)throw Error('stale_validation_judgement');
  const value=retainHumanContext(v,target,source.contextUnits);
  await this.repo.audit(c,s.dataset_id,action,id,v.actor,{...value,unitId,candidateVisible:!!reveal,revision:(previous?.after_value.revision??0)+1,candidateRunId:s.configuration.candidateRunId,candidateHash:s.configuration.candidateHash,
   initialDecisionId:v.phase==='initial'?null:latestStage(history,unitId,'initial')?.id,
   assistanceDecisionId:v.phase==='final'?latestStage(history,unitId,'assistance')?.id??null:null});
  return{saved:true};
 });}
 async reveal(id:string,actor:string){return this.repo.transaction(async c=>{
  await c.query('SELECT id FROM researched.mcf_sessions WHERE id=$1 FOR UPDATE',[id]);
  const {s,history,reveal,units}=await this.state(id,c);await this.repo.writable(s.dataset_id,c);await this.repo.active('sessions',id,c);
  if(reveal)return{revealed:true};
  const progress=stageProgress(units,history);if(!progress.total||progress.initialComplete!==progress.total)throw Error('Save complete initial coding for every sampled passage before revealing AI findings');
  await this.repo.audit(c,s.dataset_id,'validation_candidate_revealed',id,actor,{candidateRunId:s.configuration.candidateRunId,initialDecisionIds:units.map((u:any)=>latestStage(history,u.id,'initial').id),reason:'Researcher completed and locked initial coding for the whole sample before revealing the candidate'});
  return{revealed:true};
 });}
}
