import type {PoolClient} from 'pg';

// Include roots retained by Undo/Redo, not only the currently displayed draft.
export function workRoots(states:any[]){const ids=new Set<string>();const add=(v:unknown)=>{if(typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v))ids.add(v);};for(const s of states){add(s?.datasetId);add(s?.workflowId);for(const e of [...(s?.undo??[]),...(s?.redo??[])])if(e.path?.length===1&&['datasetId','workflowId'].includes(e.path[0]))add(e.value);}return [...ids];}
export async function deleteWorkbench(c:PoolClient,p:any){
 const history=(await c.query('SELECT state FROM researched.workbench_revisions WHERE project_id=$1',[p.id])).rows;
 const roots=workRoots([p.state,...history.map(r=>r.state)]);
 const others=(await c.query('SELECT state FROM researched.workbench_projects WHERE id<>$1 UNION ALL SELECT state FROM researched.workbench_revisions WHERE project_id<>$1',[p.id])).rows;
 const shared=new Set(workRoots(others.map(r=>r.state))),remove=roots.filter(id=>!shared.has(id));
 await c.query("SELECT set_config('researched.workbench_delete','yes',true)");
 for(const id of remove){
  await c.query('SELECT id FROM researched.studies WHERE id=$1 FOR UPDATE',[id]);
  await c.query('SELECT id FROM researched.mcf_datasets WHERE id=$1 FOR UPDATE',[id]);
  await c.query('SELECT id FROM researched.content_workflows WHERE id=$1 FOR UPDATE',[id]);
  const sessions=(await c.query('SELECT id FROM researched.mcf_sessions WHERE dataset_id=$1',[id])).rows.map(x=>x.id);
  const runs=(await c.query('SELECT id FROM researched.mcf_ai_runs WHERE session_id=ANY($1::uuid[])',[sessions])).rows.map(x=>x.id);
  await c.query('DELETE FROM researched.mcf_ai_reviews WHERE proposal_id IN(SELECT id FROM researched.mcf_ai_proposals WHERE session_id=ANY($1::uuid[]))',[sessions]);
  await c.query('DELETE FROM researched.mcf_ai_proposals WHERE session_id=ANY($1::uuid[])',[sessions]);
  await c.query('DELETE FROM researched.mcf_ai_outputs WHERE run_id=ANY($1::uuid[])',[runs]);
  await c.query('DELETE FROM researched.mcf_ai_tasks WHERE run_id=ANY($1::uuid[])',[runs]);
  await c.query('DELETE FROM researched.mcf_ai_runs WHERE id=ANY($1::uuid[])',[runs]);
  for(const table of ['mcf_representation_decisions','mcf_decisions','mcf_session_units'])await c.query(`DELETE FROM researched.${table} WHERE session_id=ANY($1::uuid[])`,[sessions]);
  await c.query('DELETE FROM researched.mcf_sessions WHERE dataset_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_units WHERE unit_set_id IN(SELECT u.id FROM researched.mcf_unit_sets u JOIN researched.mcf_records r ON r.id=u.record_id WHERE r.dataset_id=$1)',[id]);
  await c.query('DELETE FROM researched.mcf_unit_sets WHERE record_id IN(SELECT id FROM researched.mcf_records WHERE dataset_id=$1)',[id]);
  await c.query('DELETE FROM researched.mcf_records WHERE dataset_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_import_mappings WHERE import_id IN(SELECT id FROM researched.mcf_imports WHERE dataset_id=$1)',[id]);
  await c.query('DELETE FROM researched.mcf_imports WHERE dataset_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_lifecycle_events WHERE dataset_id=$1',[id]);
  await c.query('DELETE FROM researched.mcf_datasets WHERE id=$1',[id]);
  await c.query('DELETE FROM researched.content_tasks WHERE run_id IN(SELECT id FROM researched.content_runs WHERE workflow_id=$1)',[id]);
  await c.query('DELETE FROM researched.content_runs WHERE workflow_id=$1',[id]);
  await c.query('DELETE FROM researched.content_links WHERE workflow_id=$1',[id]);
  await c.query('DELETE FROM researched.content_workflows WHERE id=$1',[id]);
  // Only source copies belonging to this study are queued; user originals are untouched.
  await c.query('INSERT INTO researched.mcf_file_cleanup(path) SELECT storage_path FROM researched.source_snapshots WHERE source_id IN(SELECT id FROM researched.sources WHERE study_id=$1) ON CONFLICT DO NOTHING',[id]);
  await c.query('DELETE FROM researched.source_extractions WHERE snapshot_id IN(SELECT x.id FROM researched.source_snapshots x JOIN researched.sources s ON s.id=x.source_id WHERE s.study_id=$1)',[id]);
  await c.query('DELETE FROM researched.retrieval_attempts WHERE source_id IN(SELECT id FROM researched.sources WHERE study_id=$1)',[id]);
  await c.query('DELETE FROM researched.source_snapshots WHERE source_id IN(SELECT id FROM researched.sources WHERE study_id=$1)',[id]);
  await c.query('DELETE FROM researched.sources WHERE study_id=$1',[id]);
  await c.query('DELETE FROM researched.audit_events WHERE study_id=$1',[id]);
  await c.query('DELETE FROM researched.studies WHERE id=$1',[id]);
 }
 await c.query('DELETE FROM researched.workbench_revisions WHERE project_id=$1',[p.id]);
 await c.query('DELETE FROM researched.workbench_projects WHERE id=$1',[p.id]);
 await c.query("SELECT set_config('researched.workbench_delete','no',true)");
 return {deleted:true,sharedCollectionsRetained:roots.length-remove.length};
}
