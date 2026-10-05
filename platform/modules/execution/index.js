'use strict';

const crypto = require('crypto');
const engine = require('./engine');
const scope = require('../../shared/services/appScope');
const perm = (req, ctx, name) => ctx.auth.checkPerm(req.user, `admin:${name}`);
const wrap = fn => async (req, ctx) => { try { scope.fromRequest(req); return fn(req, ctx); } catch (e) { if (String(e.code).startsWith('SQLITE_BUSY')) return {success:false,statusCode:409,error:{code:'CONCURRENT_WRITE',message:'Another writer is changing work. Refresh before retrying.'}}; if (!e.status && e.code !== 'INVALID_APP_SCOPE') throw e; return { success:false,statusCode:e.status || 400,error:{code:e.code || 'EXECUTION_ERROR',message:e.message} }; } };
function directory(ctx) {
  return ctx.db.query('SELECT s.staff_id,s.user_id,s.first_name,s.last_name,s.employment_status,u.external_id,u.status AS account_status FROM staff s LEFT JOIN users u ON u.id=s.user_id ORDER BY s.first_name,s.last_name').rows.map(p=>({id:p.staff_id,user_id:p.user_id,actor_id:p.external_id||p.user_id,name:`${p.first_name} ${p.last_name}`,active:['active','contract'].includes(p.employment_status)&&p.account_status!=='disabled'}));
}
function academicYear(value,req,ctx){if(value==null||value==='')return null;const id=Number(value);if(!Number.isInteger(id)||id<1||!ctx.db.query("SELECT id FROM academic_years WHERE id=? AND app_id=? AND status!='withdrawn'",[id,scope.fromRequest(req)]).rows.length)engine.fail('Choose a recognised academic year or leave it unspecified');return id;}
function identity(req,ctx,people) {
  const matches=people.filter(p=>p.actor_id != null && String(p.actor_id)===String(req.user.id));
  return {staffId:matches.length===1&&matches[0].active?matches[0].id:null,ambiguous:matches.length>1,manager:perm(req,ctx,'execution:manage')};
}
function canRead(s,who) { return who.manager || (who.staffId && (s.lead_staff_id===who.staffId || s.tasks.some(t=>t.assignee_staff_id===who.staffId))); }
function load(req,ctx,id,who) {
  const row=ctx.db.query('SELECT data_json FROM execution_instances WHERE id=? AND app_id=?',[id,scope.fromRequest(req)]).rows[0];
  const s=row&&JSON.parse(row.data_json);if(!s||!canRead(s,who))engine.fail('Work Instance not found',404);return s;
}
function redact(s,req,ctx) {
  const output=structuredClone(s);
  output.links=output.links.map(l=>{
    if(l.kind==='responsibility'&&(!perm(req,ctx,'nervous_breakdown:read')||(l.review_status!=='reviewed'||l.status!=='active')&&!perm(req,ctx,'nervous_breakdown:govern')))return {id:l.id,task_id:l.task_id,kind:l.kind,restricted:true};
    if(l.kind==='evidence'&&l.document_id&&!perm(req,ctx,'documents:read'))return {id:l.id,task_id:l.task_id,kind:l.kind,restricted:true};
    return l;
  });return output;
}
function view(s,req,ctx,people,who) {
  const result=redact(engine.project(s,people),req,ctx),lead=who.manager||s.lead_staff_id===who.staffId;
  const write=perm(req,ctx,'execution:write');
  result.can_plan=lead&&write&&!['completed','cancelled'].includes(s.lifecycle);result.can_manage=lead&&write;
  const ready=new Map();
  for(const row of ctx.db.query("SELECT detail_json,created_at FROM execution_activity WHERE instance_id=? AND type='task.ready' ORDER BY id DESC",[s.id]).rows){const d=JSON.parse(row.detail_json);if(!ready.has(d.task_id))ready.set(d.task_id,{...d,at:row.created_at});}
  result.tasks=result.tasks.map(t=>({...t,ready_context:t.state==='ready'?ready.get(t.id)||null:null,can_act:write&&(lead||t.assignee_staff_id===who.staffId)&&!['completed','cancelled'].includes(s.lifecycle)}));
  return result;
}
function commandMeta(req) {
  const b=req.body||{};
  if(typeof b.command_id!=='string'||!b.command_id.trim()||b.command_id.length>120)engine.fail('A stable command_id is required',400);
  return {id:b.command_id,hash:crypto.createHash('sha256').update(JSON.stringify({instance:req.params?.id||null,...b})).digest('hex'),actor:String(req.user.id),app:scope.fromRequest(req)};
}
function receipt(ctx,m) {
  const r=ctx.db.query('SELECT * FROM execution_receipts WHERE app_id=? AND command_id=?',[m.app,m.id]).rows[0];
  if(r&&(r.actor_id!==m.actor||r.payload_hash!==m.hash))engine.fail('Command ID already used for a different request',409);
  return r;
}
function storeReceipt(ctx,m,s,result) {ctx.db.query('INSERT INTO execution_receipts(app_id,command_id,actor_id,payload_hash,instance_id,result_revision,result_json) VALUES(?,?,?,?,?,?,?)',[m.app,m.id,m.actor,m.hash,s.id,s.revision,JSON.stringify(result)]);}
function activity(ctx,s,m,type,detail) {ctx.db.query('INSERT INTO execution_activity(instance_id,revision,actor_id,command_id,type,detail_json) VALUES(?,?,?,?,?,?)',[s.id,s.revision,m.actor,m.id,type,JSON.stringify(detail)]);}
function validatedLink(req,ctx) {
  const b=req.body.data||{};
  if(b.kind==='evidence') {
    if(b.note&&!b.document_version_id)return {kind:'evidence',note:engine.text(b.note,'Evidence note',true)};
    if(!perm(req,ctx,'documents:read'))engine.fail('Document read permission required',403);
    const v=ctx.db.query('SELECT v.id,v.document_id,v.version_number,v.sha256,d.title FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE v.id=? AND d.app_id=?',[b.document_version_id,scope.fromRequest(req)]).rows[0];
    if(!v)engine.fail('Document version not found');return {kind:'evidence',document_version_id:v.id,document_id:v.document_id,version_number:v.version_number,sha256:v.sha256,title:v.title};
  }
  if(b.kind!=='responsibility'||!perm(req,ctx,'nervous_breakdown:read'))engine.fail('Responsibility read permission required',403);
  const row=ctx.db.query("SELECT h.snapshot_json FROM nb_revisions h JOIN nb_records r ON r.id=h.record_id WHERE r.id=? AND r.app_id=? AND r.kind='responsibility' AND h.revision=?",[b.responsibility_id,scope.fromRequest(req),b.revision]).rows[0];
  if(!row)engine.fail('Exact Layer 1 responsibility revision not found');
  const r=JSON.parse(row.snapshot_json),d=r.data;
  if(d.is_fixture)engine.fail('Synthetic Layer 1 context cannot be attached to operational work');
  if((d.status!=='active'||d.review_status!=='reviewed')&&!perm(req,ctx,'nervous_breakdown:govern'))engine.fail('Draft Layer 1 context requires governance permission',403);
  return {kind:'responsibility',responsibility_id:r.id,revision:r.revision,title:d.name,wording:d.normalized_statement,evidence:d.evidence,review_status:d.review_status,status:d.status};
}
const workspace=wrap((req,ctx)=>{
  const people=directory(ctx),who=identity(req,ctx,people),q=String(req.query?.q||'').toLowerCase();
  const accessible=ctx.db.query('SELECT data_json FROM execution_instances WHERE app_id=? ORDER BY updated_at DESC,id',[scope.fromRequest(req)]).rows.map(r=>JSON.parse(r.data_json)).filter(s=>canRead(s,who));
  const mine=accessible.flatMap(s=>view(s,req,ctx,people,who).tasks.filter(t=>who.staffId&&t.assignee_staff_id===who.staffId&&!engine.terminal(t)&&s.lifecycle==='active').map(t=>({...t,instance_id:s.id,instance_title:s.title,revision:s.revision})));
  return {success:true,identity:{staff_id:who.staffId,ambiguous:who.ambiguous,can_create:who.manager&&perm(req,ctx,'execution:write'),can_bind:who.manager&&perm(req,ctx,'staff:write')},
    people:people.filter(p=>p.active).map(({user_id,actor_id,...p})=>p),years:ctx.db.query("SELECT id,name FROM academic_years WHERE app_id=? AND status!='withdrawn' ORDER BY starts_on DESC",[scope.fromRequest(req)]).rows,
    instances:accessible.filter(s=>!q||`${s.title} ${s.description} ${s.retrospective}`.toLowerCase().includes(q)).map(s=>{const p=view(s,req,ctx,people,who);return {id:p.id,title:p.title,lifecycle:p.lifecycle,revision:p.revision,lead_name:people.find(x=>x.id===s.lead_staff_id)?.name||'Unassigned',target_on:p.target_on,attention:p.attention,completed_count:p.completed_count,task_count:p.tasks.length,timezone:p.timezone};}),my_work:mine};
});
const get=wrap((req,ctx)=>{const people=directory(ctx),who=identity(req,ctx,people);return {success:true,instance:view(load(req,ctx,req.params.id,who),req,ctx,people,who)};});
const create=wrap((req,ctx)=>{
  if(!perm(req,ctx,'execution:manage'))engine.fail('Execution manager permission required',403);
  const m=commandMeta(req),people=directory(ctx),who=identity(req,ctx,people);
  return ctx.db.transaction(()=>{
    const r=receipt(ctx,m);if(r){load(req,ctx,r.instance_id,who);return JSON.parse(r.result_json);}
    const s=engine.empty({...req.body,academic_year_id:academicYear(req.body.academic_year_id,req,ctx)},m.actor);if(s.lead_staff_id&&!people.some(p=>p.id===s.lead_staff_id&&p.active))engine.fail('Choose an active lead');
    ctx.db.query('INSERT INTO execution_instances(id,app_id,revision,data_json) VALUES(?,?,?,?)',[s.id,m.app,s.revision,JSON.stringify(s)]);
    activity(ctx,s,m,'instance.create',{after:s});const result={success:true,instance:view(s,req,ctx,people,who)};storeReceipt(ctx,m,s,result);return result;
  });
});
const command=wrap((req,ctx)=>{
  const m=commandMeta(req),people=directory(ctx),who=identity(req,ctx,people);
  if(typeof req.body.type!=='string'||(req.body.data!=null&&(typeof req.body.data!=='object'||Array.isArray(req.body.data))))engine.fail('Command type and an object data payload are required',400);
  return ctx.db.transaction(()=>{
    const old=load(req,ctx,req.params.id,who),r=receipt(ctx,m);if(r){const cached=JSON.parse(r.result_json);cached.instance=redact(cached.instance,req,ctx);return cached;}
    if(!Number.isInteger(req.body.expected_revision)||req.body.expected_revision!==old.revision)engine.fail('Work changed. Refresh and review before retrying.',409,'STALE_REVISION');
    const today=engine.localDate(old.timezone),before=engine.project(old,people,today);
    const commandInput={...req.body,data:{...(req.body.data||{})}};
    if(commandInput.type==='instance.update'&&'academic_year_id' in commandInput.data)commandInput.data.academic_year_id=academicYear(commandInput.data.academic_year_id,req,ctx);
    const next=engine.mutate(old,commandInput,{actor:m.actor,people,today,staffId:who.staffId,lead:who.manager||old.lead_staff_id===who.staffId,validatedLink:req.body.type==='link.add'?validatedLink(req,ctx):null});
    const result=ctx.db.query("UPDATE execution_instances SET revision=?,data_json=?,updated_at=datetime('now') WHERE id=? AND app_id=? AND revision=?",[next.revision,JSON.stringify(next),next.id,m.app,old.revision]);
    if(result.changes!==1)engine.fail('Concurrent update; refresh and review',409,'STALE_REVISION');
    activity(ctx,next,m,req.body.type,{data:req.body.data||{},before:old,after:next});
    const after=engine.project(next,people,today),newlyReady=after.tasks.filter(t=>t.state==='ready'&&before.tasks.some(o=>o.id===t.id&&o.state!=='ready'));
    const actors=people.filter(p=>p.actor_id!=null&&String(p.actor_id)===m.actor);
    for(const t of newlyReady)activity(ctx,next,m,'task.ready',{task_id:t.id,title:t.title,cause:req.body.type,cause_task_title:old.tasks.find(x=>x.id===req.body.data?.task_id)?.title||next.tasks.find(x=>x.id===req.body.data?.task_id)?.title||null,actor_name:actors.length===1?actors[0].name:who.manager?'Execution manager':'Authorised user',local_date:today});
    const response={success:true,instance:view(next,req,ctx,people,who),newly_ready:newlyReady.map(t=>({id:t.id,title:t.title}))};storeReceipt(ctx,m,next,response);return response;
  });
});
const preview=wrap((req,ctx)=>{const people=directory(ctx),who=identity(req,ctx,people),s=load(req,ctx,req.params.id,who);return {success:true,revision:s.revision,consequences:engine.consequences(s,req.query.task_id,people,engine.localDate(s.timezone))};});
const history=wrap((req,ctx)=>{
  const people=directory(ctx),who=identity(req,ctx,people),s=load(req,ctx,req.params.id,who),before=Number(req.query?.before)||Number.MAX_SAFE_INTEGER;
  const rows=ctx.db.query('SELECT * FROM execution_activity WHERE instance_id=? AND id<? ORDER BY id DESC LIMIT 50',[s.id,before]).rows;
  // Historical aggregate snapshots remain in audit storage. The read projection exposes
  // only action facts; it cannot bypass current document/Layer 1 disclosure policy.
  return {success:true,history:rows.map(r=>{const d=JSON.parse(r.detail_json),actors=people.filter(p=>p.actor_id!=null&&String(p.actor_id)===r.actor_id);return {id:r.id,type:r.type,actor_id:r.actor_id,actor_name:d.actor_name||(actors.length===1?actors[0].name:'Authorised user'),at:r.created_at,revision:r.revision,task_id:d.task_id||d.data?.task_id||null,title:d.title||d.after?.tasks?.find(t=>t.id===d.data?.task_id)?.title||d.before?.tasks?.find(t=>t.id===d.data?.task_id)?.title||null,reason:r.type==='link.add'?null:d.data?.reason||null};}),next_before:rows.length===50?rows[rows.length-1].id:null};
});
const references=wrap((req,ctx)=>{
  const docs=perm(req,ctx,'documents:read')?ctx.db.query('SELECT v.id,v.document_id,v.version_number,d.title FROM document_versions v JOIN documents d ON d.id=v.document_id WHERE d.app_id=? ORDER BY d.title,v.version_number DESC',[scope.fromRequest(req)]).rows:[];
  const responsibilities=perm(req,ctx,'nervous_breakdown:read')?ctx.db.query("SELECT id,revision,data_json FROM nb_records WHERE app_id=? AND kind='responsibility'",[scope.fromRequest(req)]).rows.map(r=>({...r,data:JSON.parse(r.data_json)})).filter(r=>!r.data.is_fixture&&((r.data.status==='active'&&r.data.review_status==='reviewed')||perm(req,ctx,'nervous_breakdown:govern'))).map(r=>({id:r.id,revision:r.revision,title:r.data.name,review_status:r.data.review_status,evidence:r.data.evidence})):[];
  return {success:true,documents:docs,responsibilities};
});
const availability=wrap((req,ctx)=>({success:true,enabled:!!ctx.db.query("SELECT 1 FROM app_module_assignments WHERE app_id=? AND module_name='execution'",[scope.fromRequest(req)]).rows.length}));
const context=wrap((req,ctx)=>{
 const people=directory(ctx),who=identity(req,ctx,people),s=load(req,ctx,req.params.id,who),l=redact(s,req,ctx).links.find(l=>l.id===req.query.link_id);
 if(!l||l.restricted||l.kind!=='responsibility')engine.fail('Responsibility context is unavailable',404);
 const read=(id,revision)=>{const r=revision?ctx.db.query('SELECT snapshot_json FROM nb_revisions WHERE record_id=? AND revision=?',[id,revision]).rows[0]:null;return r?JSON.parse(r.snapshot_json):null;};
 const record=read(l.responsibility_id,l.revision);if(!record)engine.fail('Pinned responsibility revision unavailable',404);
 let statement=read(record.data.statement_id,record.data.statement_revision);
 if(statement&&(statement.data.status!=='active'||statement.data.review_status!=='reviewed')&&!perm(req,ctx,'nervous_breakdown:govern'))statement=null;
 const sourceRow=statement?ctx.db.query("SELECT id,revision,data_json FROM nb_records WHERE id=? AND app_id=? AND kind='source'",[statement.data.source_id,scope.fromRequest(req)]).rows[0]:null;
 const source=sourceRow&&perm(req,ctx,'documents:read')?{id:sourceRow.id,revision:sourceRow.revision,data:JSON.parse(sourceRow.data_json)}:null;
 return {success:true,record,statement,source};
});
const bindIdentity=wrap((req,ctx)=>{
 if(!perm(req,ctx,'execution:manage')||!perm(req,ctx,'staff:write'))engine.fail('Execution management and staff write permission are required',403);
 const reason=engine.text(req.body.reason,'Binding reason',true),external=String(req.user.id);
 return ctx.db.transaction(()=>{
  const staff=ctx.db.query("SELECT * FROM staff WHERE staff_id=? AND employment_status IN ('active','contract')",[req.body.staff_id]).rows[0];if(!staff)engine.fail('Choose an active staff record');
  let anchor=ctx.db.query('SELECT * FROM users WHERE external_id=?',[external]).rows[0];
  if(!anchor&&/^\d+$/.test(external))anchor=ctx.db.query('SELECT * FROM users WHERE id=? AND external_id IS NULL',[Number(external)]).rows[0];
  if(anchor&&anchor.status!=='active')engine.fail('The linked local account is disabled',403);
  if(staff.user_id!=null&&(!anchor||staff.user_id!==anchor.id))engine.fail('This staff record is linked to another account. Resolve it in staff administration first.',409);
  if(anchor&&ctx.db.query('SELECT staff_id FROM staff WHERE user_id=? AND staff_id!=?',[anchor.id,staff.staff_id]).rows.length)engine.fail('This account already has a different staff binding. Resolve it in staff administration first.',409);
  if(!anchor){const r=ctx.db.query("INSERT INTO users(external_id,display_name,status) VALUES(?,?,'active')",[external,`${staff.first_name} ${staff.last_name}`]);anchor={id:r.lastInsertRowid};}
  if(staff.user_id===anchor.id)return {success:true,staff_id:staff.staff_id};
  ctx.db.query("UPDATE staff SET user_id=?,updated_at=datetime('now') WHERE staff_id=?",[anchor.id,staff.staff_id]);
  ctx.db.query('INSERT INTO audit_log(timestamp,user_id,action,entity_type,entity_id,old_value,new_value,ip_address) VALUES(?,?,?,?,?,?,?,?)',[Date.now(),external,'execution.identity.bind','staff',staff.staff_id,JSON.stringify({user_id:staff.user_id}),JSON.stringify({user_id:anchor.id,reason}),null]);
  return {success:true,staff_id:staff.staff_id};
 });
});
module.exports={boot(ctx){ctx.log.info('Execution ready',{module:'execution'});},teardown(){},workspace,get,create,command,preview,history,references,availability,context,bindIdentity};
