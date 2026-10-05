'use strict';
const Database=require('better-sqlite3');
const fs=require('fs'),path=require('path'),{randomUUID}=require('crypto');
const mod=require('../../modules/execution'),engine=require('../../modules/execution/engine');
const auth=require('../../shared/services/auth');
let db,ctx,instance;
const manager={id:1,permissions:['admin:*']},staff={id:2,permissions:['admin:execution:read','admin:execution:write']},outsider={id:3,permissions:['admin:execution:read','admin:execution:write']};
function req(body={},user=manager){return{user,body,params:{id:instance?.id},query:{}};}
async function command(type,data={},user=manager,extra={}){const r=await mod.command(req({type,data,expected_revision:instance.revision,command_id:randomUUID(),...extra},user),ctx);if(r.success)instance=r.instance;return r;}
async function ok(type,data={},user=manager){const r=await command(type,data,user);expect(r.success).toBe(true);return r;}
async function add(title,extra={}){await ok('task.add',{title,assignee_staff_id:'S2',...extra});return instance.tasks.at(-1).id;}
beforeEach(async()=>{
 db=new Database(':memory:');db.pragma('foreign_keys=ON');
 db.exec(fs.readFileSync(path.join(__dirname,'../../modules/execution/migrations/001_execution.sql'),'utf8'));
 db.exec('CREATE TABLE academic_years(id INTEGER,app_id TEXT,name TEXT,status TEXT,starts_on TEXT)');
 db.exec("CREATE TABLE users(id INTEGER PRIMARY KEY,external_id TEXT UNIQUE,display_name TEXT,status TEXT DEFAULT 'active'); INSERT INTO users(id) VALUES(1),(2),(3); CREATE TABLE audit_log(timestamp INTEGER,user_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,old_value TEXT,new_value TEXT,ip_address TEXT)");
 db.exec(`CREATE TABLE staff(staff_id TEXT,user_id INTEGER,first_name TEXT,last_name TEXT,employment_status TEXT); INSERT INTO staff VALUES('S1',1,'Lead','One','active'),('S2',2,'Teacher','Two','active'),('S3',3,'Other','Three','active'); CREATE TABLE documents(id INTEGER,app_id TEXT,title TEXT);CREATE TABLE document_versions(id INTEGER,document_id INTEGER,version_number INTEGER,sha256 TEXT);CREATE TABLE nb_records(id TEXT,app_id TEXT,kind TEXT,data_json TEXT);CREATE TABLE nb_revisions(record_id TEXT,revision INTEGER,snapshot_json TEXT);`);
 ctx={auth,db:{query(sql,params=[]){const s=db.prepare(sql);return s.reader?{rows:s.all(params)}:{rows:[],...s.run(params)};},transaction(fn){return db.transaction(fn)();}}};
 db.exec('ALTER TABLE staff ADD COLUMN updated_at TEXT');
 const r=await mod.create(req({command_id:randomUUID(),title:'Synthetic Career Week',timezone:'Asia/Riyadh',lead_staff_id:'S1'}),ctx);expect(r.success).toBe(true);instance=r.instance;
});
afterEach(()=>db.close());
test('planning, dates, blockers, branching consequences and personal work use one projection',async()=>{
 const a=await add('A'),other=await add('Translation'),ready=await add('Materials'),waiting=await add('Message'),future=await add('Briefing',{available_on:'2099-02-14'}),blocked=await add('Printing');
 for(const id of [ready,waiting,future,blocked])await ok('dependency.add',{from_id:a,to_id:id});await ok('dependency.add',{from_id:other,to_id:waiting});await ok('blocker.add',{task_id:blocked,reason:'Quote needed'});
 expect(instance.tasks.every(t=>t.state==='planning')).toBe(true);await ok('instance.activate');
 const p=await mod.preview({...req(),query:{task_id:a}},ctx);expect(p.consequences.map(c=>c.after)).toEqual(['ready','waiting','upcoming','blocked']);
 const result=await ok('task.complete',{task_id:a},staff);expect(result.newly_ready.map(t=>t.id)).toEqual([ready]);
 const mine=await mod.workspace(req({},staff),ctx);expect(mine.my_work.find(t=>t.id===ready).state).toBe('ready');expect(mine.my_work.find(t=>t.id===waiting).state).toBe('waiting');
 const count=db.prepare('SELECT COUNT(*) n FROM execution_activity').get().n;await mod.get(req(),ctx);await mod.get(req(),ctx);expect(db.prepare('SELECT COUNT(*) n FROM execution_activity').get().n).toBe(count);
});
test('immutable decision cycles, explicit return targets and no reverse graph edge',async()=>{
 const a=await add('Draft'),d=await add('Decision',{kind:'decision'}),s=await add('Deliver');await ok('dependency.add',{from_id:a,to_id:d});await ok('dependency.add',{from_id:d,to_id:s});await ok('instance.activate');await ok('task.complete',{task_id:a});
 expect((await command('task.complete',{task_id:d})).success).toBe(false);
 await ok('decision.return',{task_id:d,reason:'Revise wording',revision_task_ids:[a]},staff);
 expect(instance.tasks.find(t=>t.id===a).lifecycle).toBe('open');expect(instance.dependencies).toHaveLength(2);expect(instance.outcomes[0].outcome).toBe('return_for_revision');
 await ok('task.complete',{task_id:a},staff);await ok('decision.approve',{task_id:d},staff);expect(instance.tasks.find(t=>t.id===s).state).toBe('ready');expect(instance.outcomes).toHaveLength(2);
});
test('reopening preserves downstream progress, exceptions resolve explicitly and cancellation never satisfies',async()=>{
 const a=await add('A'),b=await add('B'),c=await add('C');for(const id of [b,c])await ok('dependency.add',{from_id:a,to_id:id});await ok('instance.activate');await ok('task.complete',{task_id:a});await ok('task.start',{task_id:b});await ok('task.complete',{task_id:c});
 await ok('task.reopen',{task_id:a,reason:'Source changed'});expect(instance.tasks.find(t=>t.id===b).lifecycle).toBe('in_progress');expect(instance.tasks.find(t=>t.id===c).lifecycle).toBe('completed');expect(instance.exceptions.filter(e=>e.state==='open')).toHaveLength(2);expect((await command('task.complete',{task_id:b})).success).toBe(false);
 await ok('task.cancel',{task_id:a,reason:'No longer possible'});expect(instance.exceptions.filter(e=>e.state==='open')).toHaveLength(2);
 for(const e of instance.dependencies)await ok('dependency.waive',{dependency_id:e.id,reason:'Alternative verified'});await ok('task.complete',{task_id:b});await ok('instance.close');
});
test('idempotent command receipts and stale revisions do not double-write',async()=>{
 const t=await add('A');await ok('instance.activate');const body={type:'task.complete',data:{task_id:t},expected_revision:instance.revision,command_id:randomUUID()};const first=await mod.command(req(body),ctx),count=db.prepare('SELECT COUNT(*) n FROM execution_activity').get().n;
 const again=await mod.command(req(body),ctx);expect(again).toEqual(first);expect(db.prepare('SELECT COUNT(*) n FROM execution_activity').get().n).toBe(count);
 expect((await mod.command(req({...body,command_id:randomUUID()}),ctx)).statusCode).toBe(409);
 expect((await mod.command(req({...body,data:{task_id:t,reason:'changed'}}),ctx)).statusCode).toBe(409);
});
test('cycles, duplicates, cross-instance references and invalid dates fail without mutation',async()=>{
 const a=await add('A'),b=await add('B');await ok('dependency.add',{from_id:a,to_id:b});const revision=instance.revision;
 for(const data of [{from_id:b,to_id:a},{from_id:a,to_id:b},{from_id:a,to_id:a},{from_id:'other-instance-task',to_id:a}])expect((await command('dependency.add',data)).success).toBe(false);
 expect((await command('task.add',{title:'Bad date',available_on:'2027-02-30'})).success).toBe(false);
 expect((await command('task.add',{title:'Backwards',available_on:'2027-02-12',due_on:'2027-02-01'})).success).toBe(false);
 expect((await mod.get(req(),ctx)).instance.revision).toBe(revision);
});
test('record-level access, unique identity binding and inactive staff fail closed',async()=>{
 const a=await add('A');await ok('instance.activate');expect((await mod.get(req({},outsider),ctx)).statusCode).toBe(404);expect((await command('task.add',{title:'Not lead'},staff)).statusCode).toBe(403);
 db.prepare("INSERT INTO staff(staff_id,user_id,first_name,last_name,employment_status) VALUES('duplicate',2,'Duplicate','Binding','active')").run();expect((await mod.workspace(req({},staff),ctx)).identity).toMatchObject({staff_id:null,ambiguous:true});expect((await command('task.complete',{task_id:a},staff)).statusCode).toBe(404);
 db.prepare("DELETE FROM staff WHERE staff_id='duplicate'").run();db.prepare("UPDATE staff SET employment_status='terminated' WHERE staff_id='S2'").run();expect((await command('task.complete',{task_id:a})).statusCode).toBe(409);
});
test('required evidence and pinned provisional Layer 1 remain independent and permission-filtered',async()=>{
 const a=await add('A',{required_evidence:true});await ok('instance.activate');expect((await command('task.complete',{task_id:a})).success).toBe(false);
 await ok('link.add',{task_id:a,kind:'evidence',note:'Verified with coordinator'},staff);await ok('task.complete',{task_id:a},staff);
 const record={id:'R1',revision:1,data:{name:'Draft responsibility',normalized_statement:'Exact wording',status:'draft',review_status:'draft',evidence:'inferred',is_fixture:false}};
 db.prepare('INSERT INTO nb_records VALUES(?,?,?,?)').run('R1','principal-ed','responsibility',JSON.stringify(record.data));db.prepare('INSERT INTO nb_revisions VALUES(?,?,?)').run('R1',1,JSON.stringify(record));
 const before=db.prepare('SELECT snapshot_json FROM nb_revisions').get().snapshot_json;
 await ok('link.add',{task_id:a,kind:'responsibility',responsibility_id:'R1',revision:1});const other=await mod.get(req({},staff),ctx);expect(other.instance.links.find(l=>l.kind==='responsibility')).toMatchObject({restricted:true});expect(db.prepare('SELECT snapshot_json FROM nb_revisions').get().snapshot_json).toBe(before);
 const link=instance.links.find(l=>l.kind==='responsibility');expect((await mod.context({...req(),query:{link_id:link.id}},ctx)).record.data).toMatchObject({review_status:'draft',evidence:'inferred'});expect((await mod.context({...req({},staff),query:{link_id:link.id}},ctx)).statusCode).toBe(404);
});
test('milestones, cancellation and closure retain history',async()=>{
 const a=await add('A');await ok('milestone.add',{title:'Opening',task_ids:[a],target_on:'2027-02-16'});const m=instance.milestones[0].id;await ok('instance.activate');expect((await command('milestone.achieve',{milestone_id:m})).success).toBe(false);await ok('task.complete',{task_id:a});await ok('milestone.achieve',{milestone_id:m});await ok('task.reopen',{task_id:a,reason:'Correction'});expect(instance.milestones[0].status).toBe('pending');await ok('instance.cancel',{reason:'Event cancelled'});expect(instance.exceptions.filter(e=>e.state==='open')).toHaveLength(0);expect((await command('task.reinstate',{task_id:a,reason:'No'})).success).toBe(false);
});
test('transaction failure rolls back state, activity and receipt',async()=>{
 const a=await add('A');await ok('instance.activate');const before=db.prepare('SELECT data_json FROM execution_instances').get().data_json;
 db.exec("CREATE TRIGGER reject_history BEFORE INSERT ON execution_activity BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 await expect(command('task.complete',{task_id:a})).rejects.toThrow('test failure');expect(db.prepare('SELECT data_json FROM execution_instances').get().data_json).toBe(before);
});
test('date readiness uses school-local day and never a scheduling job',()=>{
 expect(engine.localDate('Asia/Riyadh',new Date('2027-02-10T21:01:00Z'))).toBe('2027-02-11');expect(engine.localDate('America/New_York',new Date('2027-03-14T07:01:00Z'))).toBe('2027-03-14');
});
test('concurrent opposite edges cannot both commit at one revision',async()=>{
 const a=await add('A'),b=await add('B'),revision=instance.revision;
 const results=await Promise.all([[a,b],[b,a]].map(([from_id,to_id])=>mod.command(req({command_id:randomUUID(),type:'dependency.add',expected_revision:revision,data:{from_id,to_id}}),ctx)));
 expect(results.filter(r=>r.success)).toHaveLength(1);expect(results.filter(r=>r.statusCode===409)).toHaveLength(1);
 const stored=JSON.parse(db.prepare('SELECT data_json FROM execution_instances').get().data_json);expect(stored.dependencies).toHaveLength(1);expect(()=>engine.validateGraph(stored)).not.toThrow();
});
test('in-progress editing, document versions and Ready attribution remain exact',async()=>{
 const a=await add('A'),b=await add('B');await ok('dependency.add',{from_id:a,to_id:b});await ok('instance.activate');await ok('task.start',{task_id:a},staff);await ok('task.update',{task_id:a,kind:'ordinary',title:'A revised'});
 db.prepare("INSERT INTO documents VALUES(1,'principal-ed','Evidence file')").run();db.prepare("INSERT INTO document_versions VALUES(7,1,2,'sha')").run();
 expect((await command('link.add',{task_id:a,kind:'evidence',document_version_id:8})).success).toBe(false);
 await ok('link.add',{task_id:a,kind:'evidence',document_version_id:7});await ok('task.complete',{task_id:a},staff);
 expect(instance.tasks.find(t=>t.id===b).ready_context).toMatchObject({actor_name:'Teacher Two',cause_task_title:'A revised',cause:'task.complete'});
 expect((await mod.get(req(),ctx)).instance.links[0]).toMatchObject({document_version_id:7,version_number:2,sha256:'sha'});
 const visible=(await mod.get(req({},staff),ctx)).instance;expect(visible.links[0].restricted).toBe(true);
});
test('external desktop identity uses the canonical numeric anchor, without stealing bindings',async()=>{
 const desktop={id:'local-desktop-owner',permissions:['admin:*']};
 expect((await mod.bindIdentity(req({staff_id:'S1',reason:'My identity'},desktop),ctx)).statusCode).toBe(409);
 db.prepare("UPDATE staff SET user_id=NULL WHERE staff_id='S1'").run();
 expect((await mod.bindIdentity(req({staff_id:'S1',reason:'My identity'},desktop),ctx)).success).toBe(true);
 const anchor=db.prepare('SELECT id FROM users WHERE external_id=?').get(desktop.id);expect(db.prepare("SELECT user_id FROM staff WHERE staff_id='S1'").get().user_id).toBe(anchor.id);
 expect((await mod.workspace(req({},desktop),ctx)).identity.staff_id).toBe('S1');
 const count=db.prepare('SELECT COUNT(*) n FROM audit_log').get().n;await mod.bindIdentity(req({staff_id:'S1',reason:'My identity'},desktop),ctx);expect(db.prepare('SELECT COUNT(*) n FROM audit_log').get().n).toBe(count);
 expect((await mod.bindIdentity(req({staff_id:'S3',reason:'Not permitted'},staff),ctx)).statusCode).toBe(403);
});
test('academic year references and malformed commands are validated without repair',async()=>{
 expect((await command('instance.update',{academic_year_id:'unknown'})).statusCode).toBe(422);
 db.prepare("INSERT INTO academic_years VALUES(1,'principal-ed','2026–27','active','2026-08-01')").run();await ok('instance.update',{academic_year_id:'1'});expect(instance.academic_year_id).toBe(1);
 expect((await command('task.add','not an object')).statusCode).toBe(400);
 expect((await command('task.add',{title:'Wrong date type',due_on:false})).statusCode).toBe(422);
});

test('deletion removes working references, preserves audit snapshots and never approves successors',async()=>{
 const a=await add('Disposable decision',{kind:'decision'}),b=await add('Successor');await ok('dependency.add',{from_id:a,to_id:b});await ok('milestone.add',{title:'Checkpoint',task_ids:[a]});await ok('instance.activate');await ok('blocker.add',{task_id:a,reason:'Test blocker'});await ok('link.add',{task_id:a,kind:'evidence',note:'Test evidence'});
 expect((await command('task.delete',{task_id:a,confirm_delete:true},staff)).statusCode).toBe(403);
 expect((await command('task.delete',{task_id:a})).success).toBe(false);
 const result=await ok('task.delete',{task_id:a,confirm_delete:true});expect(instance.tasks.map(t=>t.id)).toEqual([b]);expect(instance.tasks[0]).toMatchObject({state:'ready',lifecycle:'open'});expect(result.newly_ready.map(t=>t.id)).toEqual([b]);
 for(const field of ['dependencies','blockers','links','outcomes','exceptions'])expect(instance[field]).toHaveLength(0);expect(instance.milestones[0]).toMatchObject({status:'pending',contributions:[]});
 const audit=JSON.parse(db.prepare("SELECT detail_json FROM execution_activity WHERE type='task.delete'").get().detail_json);expect(audit.before.tasks.some(t=>t.id===a)).toBe(true);expect(audit.before.links).toHaveLength(1);
 expect((await mod.history(req(),ctx)).history.find(h=>h.type==='task.delete').title).toBe('Disposable decision');
 expect(()=>engine.project(instance,[])).not.toThrow();
});

test('completed and cancelled project tasks can be deleted without reopening or losing receipt protection',async()=>{
 const a=await add('Finished test');await ok('instance.activate');await ok('task.complete',{task_id:a});await ok('instance.close');const body={type:'task.delete',data:{task_id:a,confirm_delete:true},expected_revision:instance.revision,command_id:randomUUID()};const first=await mod.command(req(body),ctx);expect(first.success).toBe(true);expect(first.instance.lifecycle).toBe('completed');expect(first.instance.tasks).toHaveLength(0);expect(await mod.command(req(body),ctx)).toEqual(first);expect((await mod.command(req({...body,command_id:randomUUID()}),ctx)).statusCode).toBe(409);
 instance=first.instance;await ok('instance.reopen',{reason:'More testing'});const b=await add('Cancelled test');await ok('instance.cancel',{reason:'Test cleanup'});await ok('task.delete',{task_id:b,confirm_delete:true});expect(instance.lifecycle).toBe('cancelled');expect(instance.tasks).toHaveLength(0);
});
