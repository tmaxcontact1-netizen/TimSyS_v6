import {draftChanges,applyDraftChanges} from '../domain/draft-history.js';
import {randomUUID} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {decisionInput,representationInput,validateDecision} from '../domain/mcf.js';
import {McfRepository} from '../infrastructure/mcf-repository.js';

const stateSchema=z.object({step:z.number().int().min(0).max(5)}).catchall(z.unknown());
const change=z.object({revision:z.number().int(),title:z.string().trim().min(1).max(200),state:stateSchema,label:z.string().min(1).max(200)}).strict();
async function body(q:IncomingMessage){let size=0;const chunks:Buffer[]=[];for await(const part of q){const b=Buffer.from(part);size+=b.length;if(size>12_000_000)throw Error('draft_too_large');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export function createWorkbenchApi(db:Pick<Pool,'query'|'connect'>,storageRoot:string){
 const repo=new McfRepository(db,storageRoot);
 async function get(id:string){const p=(await db.query('SELECT p.*,r.previous_id IS NOT NULL AS can_undo,jsonb_array_length(p.redo)>0 AS can_redo FROM researched.workbench_projects p JOIN researched.workbench_revisions r ON r.id=p.head WHERE p.id=$1',[id])).rows[0];if(!p)throw Error('project_not_found');return p;}
 async function save(c:PoolClient,p:any,state:unknown,title:string,label:string){const head=randomUUID();await c.query('INSERT INTO researched.workbench_revisions(id,project_id,previous_id,title,state,label) VALUES($1,$2,$3,$4,$5,$6)',[head,p.id,p.head,title,JSON.stringify(draftChanges(p.state,state as Record<string,unknown>)),label]);await c.query("UPDATE researched.workbench_projects SET state=$2,title=$3,head=$4,revision=revision+1,redo='[]',updated_at=now() WHERE id=$1",[p.id,JSON.stringify(state),title,head]);}
 const send=(r:ServerResponse,status:number,value:unknown)=>{r.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});r.end(JSON.stringify(value));};
 return async(q:IncomingMessage,r:ServerResponse)=>{
  const url=new URL(q.url??'/','http://localhost'),match=/^\/api\/workbench(?:\/([a-f0-9-]+)(?:\/(undo|redo|delete|restore|confirm|history))?)?$/.exec(url.pathname);if(!match)return false;
  try{
   if(q.method!=='GET'&&q.headers.origin&&q.headers.origin!==`http://${q.headers.host}`){send(r,403,{error:'origin_not_allowed'});return true;}
   const id=match[1],action=match[2];
   if(!id&&q.method==='GET'){send(r,200,{items:(await db.query('SELECT id,tool,title,state->>\'workflowId\' AS workflow_id,state->>\'datasetId\' AS dataset_id,state->>\'step\' AS step,deleted_at,updated_at FROM researched.workbench_projects WHERE ($1::boolean OR deleted_at IS NULL) ORDER BY updated_at DESC',[url.searchParams.get('deleted')==='true'])).rows});return true;}
   if(!id&&q.method==='POST'){const v=z.object({tool:z.enum(['content','mcf']),title:z.string().trim().min(1).max(200),state:stateSchema}).strict().parse(await body(q)),key=randomUUID(),head=randomUUID();await repo.transaction(async c=>{await c.query('INSERT INTO researched.workbench_projects(id,tool,title,state,head) VALUES($1,$2,$3,$4,$5)',[key,v.tool,v.title,JSON.stringify(v.state),head]);await c.query("INSERT INTO researched.workbench_revisions(id,project_id,title,state,label) VALUES($1,$2,$3,$4,'Created')",[head,key,v.title,JSON.stringify(v.state)]);});send(r,201,await get(key));return true;}
   if(!id)throw Error('project_not_found');
   if(q.method==='GET'){send(r,200,action==='history'?{items:(await db.query('SELECT id,label,created_at FROM researched.workbench_revisions WHERE project_id=$1 ORDER BY created_at DESC',[id])).rows}:await get(id));return true;}
   const input=await body(q);
   await repo.transaction(async c=>{
    const p=(await c.query('SELECT * FROM researched.workbench_projects WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!p)throw Error('project_not_found');if(input.revision!==p.revision)throw Error('draft_changed_reload');
    if(action==='delete'||action==='restore'){
     // Deletion is a recoverable move to Deleted items, never disguised permanent erasure.
     if(action==='delete'){
      const workflow=p.state.workflowId,session=[p.state.sessionId,p.state.finalSessionId].filter(Boolean);
      if(workflow){await c.query("UPDATE researched.content_tasks SET status='cancelled',updated_at=now() WHERE run_id IN(SELECT id FROM researched.content_runs WHERE workflow_id=$1 AND status='running') AND status IN('queued','running','retry')",[workflow]);await c.query("UPDATE researched.content_runs SET status='cancelled',completed_at=now() WHERE workflow_id=$1 AND status='running'",[workflow]);}
      if(session.length){await c.query("UPDATE researched.mcf_ai_tasks SET status='cancelled' WHERE run_id IN(SELECT id FROM researched.mcf_ai_runs WHERE session_id=ANY($1::uuid[])) AND status IN('queued','running')",[session]);await c.query("UPDATE researched.mcf_ai_runs SET status='cancelled',finished_at=now() WHERE session_id=$1 AND status IN('queued','running')",[session]);}
     }
     await c.query('UPDATE researched.workbench_projects SET deleted_at=CASE WHEN $2 THEN now() ELSE NULL END,revision=revision+1,updated_at=now() WHERE id=$1',[id,action==='delete']);return;
    }
    if(p.deleted_at)throw Error('restore_project_first');
    if(action==='undo'||action==='redo'){
     const current=(await c.query('SELECT * FROM researched.workbench_revisions WHERE id=$1',[p.head])).rows[0];const stack:string[]=p.redo;const target=action==='undo'?current.previous_id:stack.pop();if(!target)throw Error('nothing_to_'+action);if(action==='undo')stack.push(p.head);
     const old=(await c.query('SELECT * FROM researched.workbench_revisions WHERE id=$1 AND project_id=$2',[target,id])).rows[0];await c.query('UPDATE researched.workbench_projects SET state=$2,title=$3,head=$4,redo=$5,revision=revision+1,updated_at=now() WHERE id=$1',[id,JSON.stringify(applyDraftChanges(p.state,action==='undo'?current.state.undo:old.state.redo)),old.title,old.id,JSON.stringify(stack)]);return;
    }
    if(action==='confirm'){
     if(p.state.step!==4)throw Error('check_draft_before_confirming');
     const s={...p.state,step:5,confirmedAt:new Date().toISOString()};
     if(p.tool==='mcf'){
      const name=z.string().trim().min(1).max(200).parse(p.state.researcher),original=await repo.session(z.uuid().parse(p.state.sessionId),c);await repo.writable(original.dataset_id,c);await repo.active('sessions',original.id,c);
      if(original.blind||original.kind==='validation')throw Error('manual_validation_no_ai');
      const session=randomUUID();
      await c.query(`INSERT INTO researched.mcf_sessions(id,dataset_id,title,kind,blind,instrument_version,instrument_hash,engine_version,software_version,configuration,actor) SELECT $2,dataset_id,$3,'coding',false,instrument_version,instrument_hash,engine_version,software_version,configuration||$4::jsonb,$5 FROM researched.mcf_sessions WHERE id=$1`,[original.id,session,p.title+' — confirmed',JSON.stringify({draftSessionId:original.id,workbenchProjectId:p.id}),name]);
      await c.query('INSERT INTO researched.mcf_session_units SELECT $2,unit_id,ordinal FROM researched.mcf_session_units WHERE session_id=$1',[original.id,session]);
      for(const [unitId,value] of Object.entries(p.state.decisions??{})){
       const v=decisionInput.parse({...value as object,previousId:null,actor:name});const unit=(await c.query('SELECT u.* FROM researched.mcf_units u JOIN researched.mcf_session_units su ON su.unit_id=u.id WHERE su.session_id=$1 AND u.id=$2',[session,unitId])).rows[0];if(!unit)throw Error('session_unit_not_found');validateDecision(v,unit.original_text,original.mode);
       await c.query('INSERT INTO researched.mcf_decisions(id,session_id,unit_id,previous_id,revision,codes,valence,reviewed_no_code,notes,actor) VALUES($1,$2,$3,NULL,1,$4,$5,$6,$7,$8)',[randomUUID(),session,unitId,JSON.stringify(v.codes),v.valence,v.reviewedNoCode,v.notes,name]);
      }
      for(const value of p.state.observations??[]){const recordId=z.uuid().parse(value.recordId),v=representationInput.parse({...value.value,previousId:null,actor:name});if(!['documentary','general'].includes(original.mode))throw Error('documentary_session_required');const units=(await c.query('SELECT u.id,r.id AS record_id FROM researched.mcf_session_units su JOIN researched.mcf_units u ON u.id=su.unit_id JOIN researched.mcf_unit_sets us ON us.id=u.unit_set_id JOIN researched.mcf_records r ON r.id=us.record_id WHERE su.session_id=$1 AND u.id=ANY($2::uuid[])',[session,v.evidenceUnitIds])).rows;if(units.length!==v.evidenceUnitIds.length||units.some(u=>u.record_id!==recordId))throw Error('evidence_must_belong_to_session_document');if(v.state==='assessed'&&!(await c.query('SELECT original_text FROM researched.mcf_records WHERE id=$1',[recordId])).rows[0]?.original_text.trim())throw Error('source_has_no_readable_text_use_unavailable');if(!original.configuration.unitSets.some((x:any)=>x.record_id===recordId))throw Error('session_record_not_found');await c.query('INSERT INTO researched.mcf_representation_decisions(id,session_id,record_id,competency_id,previous_id,revision,state,score,evidence_unit_ids,notes,actor) VALUES($1,$2,$3,$4,NULL,1,$5,$6,$7,$8,$9)',[randomUUID(),session,recordId,v.competencyId,v.state,v.score,JSON.stringify(v.evidenceUnitIds),v.notes,name]);}
      if(!Object.keys(p.state.decisions??{}).length&&!(p.state.observations??[]).length)throw Error('review_at_least_one_passage');s.finalSessionId=session;await repo.audit(c,original.dataset_id,'guided_draft_confirmed',session,name,{projectId:id,draftSessionId:original.id});
     }else{const run=(await c.query('SELECT * FROM researched.content_runs WHERE id=$1 AND workflow_id=$2',[p.state.runId,p.state.workflowId])).rows[0];if(!run||run.status==='running')throw Error('wait_for_draft_to_finish');}
     await save(c,p,s,p.title,'Confirmed results');return;
    }
    const v=change.parse(input);if(v.state.step===5&&p.state.step!==5)throw Error('confirm_results_first');if(action||q.method!=='PATCH')throw Error('invalid_action');await save(c,p,v.state,v.title,v.label);
   });send(r,200,await get(id));
  }catch(e){const message=e instanceof Error?e.message:'request_failed';send(r,message==='project_not_found'?404:message==='draft_changed_reload'?409:400,{error:message});}return true;
 };
}
