import {randomUUID} from 'node:crypto';
import {unlink} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import type {PoolClient} from 'pg';
import type {McfRepository} from './mcf-repository.js';
export const lifecycleTables={datasets:'mcf_datasets',imports:'mcf_imports',sessions:'mcf_sessions',mappings:'mcf_import_mappings','unit-sets':'mcf_unit_sets'} as const;
export type LifecycleKind=keyof typeof lifecycleTables;
type Query=Pick<PoolClient,'query'>;
export class McfLifecycle {
 constructor(readonly repo:McfRepository){}
 async target(kind:LifecycleKind,id:string,c:Query=this.repo.db){
  const sql=kind==='datasets'?`SELECT d.id,d.id AS dataset_id,s.title AS label FROM researched.mcf_datasets d JOIN researched.studies s ON s.id=d.id WHERE d.id=$1`:
   kind==='imports'?`SELECT id,dataset_id,filename AS label FROM researched.mcf_imports WHERE id=$1`:
   kind==='sessions'?`SELECT id,dataset_id,title AS label FROM researched.mcf_sessions WHERE id=$1`:
   kind==='mappings'?`SELECT m.id,i.dataset_id,'Prepared source '||m.version AS label FROM researched.mcf_import_mappings m JOIN researched.mcf_imports i ON i.id=m.import_id WHERE m.id=$1`:
   `SELECT u.id,r.dataset_id,'Text sections '||u.version AS label FROM researched.mcf_unit_sets u JOIN researched.mcf_records r ON r.id=u.record_id WHERE u.id=$1`;
  const t=(await c.query(sql,[id])).rows[0];if(!t)throw Error('research_item_not_found');
  const meta=(await c.query('SELECT researched.mcf_archived($1,$2) AS archived,researched.mcf_label($1,$2,$3) AS label',[kind,id,t.label])).rows[0];return{...t,...meta,kind};
 }
 async scope(kind:LifecycleKind,id:string,c:Query){
  const t=await this.target(kind,id,c);
  const imports=(await c.query(`SELECT i.id,i.snapshot_id,x.source_id,x.storage_path FROM researched.mcf_imports i JOIN researched.source_snapshots x ON x.id=i.snapshot_id WHERE ${kind==='datasets'?'i.dataset_id=$1':kind==='imports'?'i.id=$1':'false'}`,kind==='datasets'||kind==='imports'?[id]:[])).rows;
  const mappings=(await c.query('SELECT id FROM researched.mcf_import_mappings WHERE import_id=ANY($1::uuid[]) OR id=$2',[imports.map(i=>i.id),kind==='mappings'?id:null])).rows;
  const records=(await c.query('SELECT id FROM researched.mcf_records WHERE mapping_id=ANY($1::uuid[])',[mappings.map(m=>m.id)])).rows;
  const sets=(await c.query('SELECT id FROM researched.mcf_unit_sets WHERE record_id=ANY($1::uuid[]) OR id=$2',[records.map(r=>r.id),kind==='unit-sets'?id:null])).rows;
  const sessions=(await c.query(`SELECT id FROM researched.mcf_sessions WHERE ${kind==='datasets'?'dataset_id=$1':kind==='sessions'?'id=$1':'false'}`,kind==='datasets'||kind==='sessions'?[id]:[])).rows;
  const decisions=Number((await c.query('SELECT (SELECT count(*) FROM researched.mcf_decisions WHERE session_id=ANY($1::uuid[]))+(SELECT count(*) FROM researched.mcf_representation_decisions WHERE session_id=ANY($1::uuid[])) AS n',[sessions.map(s=>s.id)])).rows[0].n);
  const references=Number((await c.query(`SELECT count(DISTINCT s.id) AS n FROM researched.mcf_sessions s,jsonb_array_elements(s.configuration->'unitSets') v WHERE v->>'id'=ANY($1::text[]) AND NOT(s.id=ANY($2::uuid[]))`,[sets.map(s=>s.id),sessions.map(s=>s.id)])).rows[0].n);
  const children=kind==='mappings'?Number((await c.query('SELECT count(*) AS n FROM researched.mcf_import_mappings WHERE previous_id=$1',[id])).rows[0].n):kind==='unit-sets'?Number((await c.query('SELECT count(*) AS n FROM researched.mcf_unit_sets WHERE parent_id=$1',[id])).rows[0].n):0;
  const soleSet=kind==='unit-sets'&&Number((await c.query('SELECT count(*) AS n FROM researched.mcf_unit_sets WHERE record_id=(SELECT record_id FROM researched.mcf_unit_sets WHERE id=$1)',[id])).rows[0].n)===1;
  return{target:t,imports,mappings,records,sets,sessions,decisions,references,children,soleSet};
 }
 async policy(kind:LifecycleKind,id:string,c:Query=this.repo.db){const s=await this.scope(kind,id,c);const canDelete=!s.decisions&&!s.references&&!s.children&&!s.soleSet;
  return{...s.target,canDelete,counts:{sources:s.imports.length,sessions:s.sessions.length,decisions:s.decisions,references:s.references},explanation:canDelete?'This item has no protected coding or dependent research history. Deleting it permanently removes its unused records and any uploaded files. This cannot be undone.':s.decisions?'Saved coding decisions are attached. Archive this work to remove it from active lists while keeping the source, evidence and decision history.':s.references?'A coding session uses this prepared text. Archive it to keep that session and its evidence intact.':s.soleSet?'This is the only prepared text version for this record. Remove the unused source instead, or archive this version.':'Later text preparation depends on this version. Archive it to preserve that history.',allowedAction:canDelete?'delete':'archive'};
 }
 async change(kind:LifecycleKind,id:string,action:'rename'|'archive'|'restore'|'delete',actor:string,label?:string){
  const result=await this.repo.transaction(async c=>{
   const t=await this.target(kind,id,c);await c.query('SELECT id FROM researched.mcf_datasets WHERE id=$1 FOR UPDATE',[t.dataset_id]);
   const policy=await this.policy(kind,id,c);let removedIds:string[]=[];
   if(action==='delete'){
    if(!policy.canDelete)throw Error('protected_research_history');
    const s=await this.scope(kind,id,c),ids=[id,...s.imports.map(x=>x.id),...s.mappings.map(x=>x.id),...s.records.map(x=>x.id),...s.sets.map(x=>x.id),...s.sessions.map(x=>x.id)];
    removedIds=ids;
    await c.query("SELECT set_config('researched.mcf_unused_delete','yes',true)");
    await c.query('DELETE FROM researched.mcf_session_units WHERE session_id=ANY($1::uuid[])',[s.sessions.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_sessions WHERE id=ANY($1::uuid[])',[s.sessions.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_units WHERE unit_set_id=ANY($1::uuid[])',[s.sets.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_unit_sets WHERE id=ANY($1::uuid[])',[s.sets.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_records WHERE id=ANY($1::uuid[])',[s.records.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_import_mappings WHERE id=ANY($1::uuid[])',[s.mappings.map(x=>x.id)]);
    await c.query('DELETE FROM researched.mcf_imports WHERE id=ANY($1::uuid[])',[s.imports.map(x=>x.id)]);
    for(const f of s.imports)await c.query('INSERT INTO researched.mcf_file_cleanup(path) VALUES($1) ON CONFLICT DO NOTHING',[f.storage_path]);
    await c.query('DELETE FROM researched.source_snapshots WHERE id=ANY($1::uuid[])',[s.imports.map(x=>x.snapshot_id)]);
    await c.query('DELETE FROM researched.sources WHERE id=ANY($1::uuid[])',[s.imports.map(x=>x.source_id)]);
    await c.query(`DELETE FROM researched.audit_events WHERE ${kind==='datasets'?'study_id=$1':'entity_id=ANY($1::uuid[])'}`,[kind==='datasets'?id:ids]);
    await c.query(`DELETE FROM researched.mcf_lifecycle_events WHERE ${kind==='datasets'?'dataset_id=$1':'target_id=ANY($1::uuid[])'}`,[kind==='datasets'?id:ids]);
    if(kind==='datasets'){await c.query('DELETE FROM researched.mcf_datasets WHERE id=$1',[id]);await c.query('DELETE FROM researched.studies WHERE id=$1',[id]);}
    await c.query("SELECT set_config('researched.mcf_unused_delete','no',true)");
   }
   await c.query('INSERT INTO researched.mcf_lifecycle_events(id,kind,target_id,dataset_id,action,label,actor) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),kind,id,t.dataset_id,action,action==='rename'?label:null,actor]);
   return{action,id,removedIds};
  });
  const pendingFiles=action==='delete'?await this.cleanupFiles():0;return{...result,pendingFiles};
 }
 async cleanupFiles(){const files=(await this.repo.db.query('SELECT path FROM researched.mcf_file_cleanup')).rows;for(const f of files){const root=resolve(this.repo.storageRoot),target=resolve(root,f.path),route=relative(root,target);if(!route||isAbsolute(route)||route.startsWith('..'))continue;try{await unlink(target);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')continue;}await this.repo.db.query('DELETE FROM researched.mcf_file_cleanup WHERE path=$1',[f.path]);}return Number((await this.repo.db.query('SELECT count(*) AS n FROM researched.mcf_file_cleanup')).rows[0].n);}
 async history(kind:LifecycleKind,id:string){await this.target(kind,id);return(await this.repo.db.query('SELECT action,label,actor,created_at FROM researched.mcf_lifecycle_events WHERE kind=$1 AND target_id=$2 ORDER BY created_at DESC',[kind,id])).rows;}
}
