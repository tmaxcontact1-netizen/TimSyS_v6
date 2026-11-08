const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{fixture}=require('./observation.test.cjs'),api=require('./index');
function full(){const f=fixture();f.db.exec(fs.readFileSync(__dirname+'/migrations/002_full_studio.sql','utf8'));let serial=0;f.rpc=(path,body,user='admin')=>api.fullRpc({user:{id:user},query:{},body:{path,...(body!==undefined?{body,command_id:'full-command-'+(++serial)}:{})}},f.ctx);return f;}
const op=(fields)=>({actor:'synthetic-actor',name:'Synthetic observer',...fields});
test('full TBO forms, shared/personal timers, reflection, lifecycle and export',async()=>{
 const f=full();let r=await f.rpc('visits',{teacherId:'T',protocol:'tbo',subject:'Science'});assert.equal(r.ok,true,JSON.stringify(r));const id=r.data.id;
 await f.rpc('assign',{id,baseRevision:0,observer_ids:['O']});
 r=await f.rpc('visits/'+id,op({op:'form',recordType:'targetEvidence',recordId:'target-1',field:'details',value:'Students explain the learning target.',base:''}),'observer');assert.equal(r.ok,true,JSON.stringify(r));
 r=await f.rpc('visits/'+id,op({op:'timer',action:'start',mode:'lecture',baseVersion:0}),'observer');assert.equal(r.data.timer.running,true);
 r=await f.rpc('visits/'+id,op({op:'timer',action:'switch',mode:'doing',baseVersion:1}),'observer');assert.equal(r.data.timer.segments.length,1);
 r=await f.rpc('visits/'+id,op({op:'timer',action:'stop',mode:'doing',baseVersion:2}),'observer');assert.equal(r.data.timer.running,false);
 r=await f.rpc('visits/'+id,op({op:'reflectionTimer',action:'start',mode:'unknown',baseVersion:0}),'observer');assert.equal(r.data.reflectionTimers.O.running,true);
 r=await f.rpc('visits/'+id,op({op:'reflectionTimer',action:'stop',mode:'unknown',baseVersion:1}),'observer');assert.equal(r.data.reflectionTimers.O.running,false);
 r=await f.rpc('visits/'+id,op({op:'evidenceReviewSave',baseRevision:r.data.revision,domain:'domain1',classification:'Secure Practice',rationale:'Evidence supports this.',refs:['form:target-1']}),'observer');assert.equal(r.data.evidenceReviews.domain1.classification,'Secure Practice');
 for(const stage of ['Ready For Reflection','Reflection Complete','Closed']){r=await f.rpc('visits/'+id,op({op:'workflowChange',stage,baseRevision:r.data.revision,confirmReflection:true}),'observer');assert.equal(r.ok,true,JSON.stringify(r));}
 assert.equal(r.data.workflow.stage,'Closed');r=await f.rpc('visits/'+id,op({op:'workflowChange',stage:'In Progress',baseRevision:r.data.revision,reason:'Observee requests discussion'}),'teacher');assert.equal(r.data.workflow.stage,'In Progress');
 const exported=await f.rpc('export-visit',{id},'teacher');assert.equal(exported.data.formRecords['target-1'].fields.details,'Students explain the learning target.');assert.equal(exported.data.timer.segments.length,2);assert.equal((await f.rpc('export-visit',{id},'other')).statusCode,403);f.db.close();
});
test('probation rubric snapshots, completion validation and acknowledgements',async()=>{
 const f=full(),templates=(await f.rpc('templates')).data.templates,sch=templates.probation.schema;
 const p=Object.fromEntries(['startDate','observer','reviewPurpose','strengths','growth','actionPlan','recommendation','extensionDuration','newReviewDate','summaryComments'].map(k=>[k,'']));p.status='Draft';p.domains=Object.fromEntries(sch.domains.map(d=>[d.id,{rating:'',evidence:'',followUp:''}]));p.acknowledgements=sch.acknowledgements.map(()=>({name:'',signature:'',date:''}));
 let r=await f.rpc('visits',{teacherId:'T',teacher:'Teacher One',protocol:'probation',subject:'Science',probation:p});assert.equal(r.ok,true,JSON.stringify(r));const id=r.data.id;
 r=await f.rpc('visits/'+id,op({op:'probationSave',baseRevision:0,value:{...p,status:'Complete'},date:'2026-11-08',subject:'Science'}));assert.equal(r.statusCode,400);
 for(const k of ['observer','strengths','growth','actionPlan','summaryComments'])p[k]='Reviewed content';p.startDate='2026-09-01';p.reviewPurpose=sch.reviewPurposes[0];p.recommendation=sch.recommendations[0];p.status='Complete';for(const d of Object.values(p.domains))Object.assign(d,{rating:'Proficient',evidence:'Observed classroom practice',followUp:'No'});p.acknowledgements=p.acknowledgements.map(()=>({name:'Acknowledging person',signature:'Typed acknowledgement',date:'2026-11-08'}));
 r=await f.rpc('visits/'+id,op({op:'probationSave',baseRevision:0,value:p,date:'2026-11-08',subject:'Science'}));assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.data.probation.status,'Complete');assert.equal(r.data.probation.acknowledgements.length,3);assert.equal(r.data.template.schema.domains.length,9);f.db.close();
});
test('cycle recommendation preview is read-only and linked visit completes schedule atomically',async()=>{
 const f=full(),b={action:'recommend',teacherId:'T',protocol:'probation',start:'2026-08-01',observers:['O'],baseRevision:0};const before=f.db.prepare('SELECT count(*) n FROM observation_stores').get().n;let r=await f.rpc('scheduler',{...b,preview:true});assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.data.preview.length,3);assert.equal(f.db.prepare('SELECT count(*) n FROM observation_stores').get().n,before);
 r=await f.rpc('scheduler',b);assert.equal(r.data.entries.length,3);assert.equal((await f.rpc('scheduler',undefined,'other')).data.entries.length,0);f.db.close();
});
test('PD sessions, attendance, completion, removal and restoration; no seed operations',async()=>{
 const f=full(),value={title:'Questioning workshop',domain:'domain6',outcome:'More thinking time',deliverable:'Lesson plan',facilitator:'O',location:'Staff room',resources:'',date:'2026-11-04',time:'13:00',endTime:'14:00',reviewDate:'2026-12-01',status:'Delivered',participants:[{teacherId:'T',attendance:'Attended',minutes:60,deliverableStatus:'Complete',notes:'Applied in class'}]};let r=await f.rpc('professional-development',{action:'save',baseRevision:0,value});assert.equal(r.ok,true,JSON.stringify(r));const id=r.data.sessions[0].id;assert.equal(r.data.sessions[0].participants[0].minutes,60);assert.equal((await f.rpc('professional-development',undefined,'other')).data.sessions.length,0);
 r=await f.rpc('professional-development',{action:'remove',id,baseRevision:1});assert.equal(r.data.removedSessions.length,1);r=await f.rpc('professional-development',{action:'restore',id,baseRevision:2});assert.equal(r.data.sessions.length,1);assert.equal((await f.rpc('professional-development',{action:'seedDemo',baseRevision:3})).statusCode,404);f.db.close();
});

test('full export/import preserves assignments, source snapshot and all observer timer maps',async()=>{
 const f=full(),g=full();const id=(await f.rpc('visits',{teacherId:'T',protocol:'tbo',subject:'Round trip'})).data.id;
 await f.rpc('assign',{id,baseRevision:0,observer_ids:['O']});
 await f.rpc('visits/'+id,op({op:'reflectionTimer',action:'start',mode:'unknown',baseVersion:0}),'observer');
 const exported=(await f.rpc('export-visit',{id})).data;
 const imported=await g.rpc('import-visit',{snapshot:exported});assert.equal(imported.ok,true,JSON.stringify(imported));
 const stored=JSON.parse(g.db.prepare('SELECT data_json FROM observation_records WHERE id=?').get(id).data_json);
 assert.deepEqual(stored.importOriginal,exported);assert.deepEqual(stored.observer_ids,['O']);assert.equal(stored.state.reflectionTimers.O.running,false);assert.equal(stored.state.reflectionTimers.O.segments.length,1);assert.equal((await g.rpc('visits/'+id,undefined,'observer')).data.nativePermissions.contribute,true);
 assert.equal((await g.rpc('import-visit',{snapshot:exported})).statusCode,409);f.db.close();g.db.close();
});
test('linked schedule completion, lesson-only edits and stale writes are checked atomically',async()=>{
 const f=full();let r=await f.rpc('scheduler',{action:'recommend',teacherId:'T',protocol:'tbo',start:'2026-01-01',end:'2026-06-30',observers:['O'],baseRevision:0});assert.equal(r.ok,true,JSON.stringify(r));let entry=r.data.entries[0];
 const id=(await f.rpc('visits',{teacherId:'T',protocol:'tbo',scheduleEntryId:entry.id,scheduleBaseRevision:r.data.revision})).data.id;
 let visit=(await f.rpc('visits/'+id)).data;assert.equal(visit.nativePermissions.contribute,true);
 visit=(await f.rpc('visits/'+id,op({op:'form',recordType:'targetEvidence',recordId:'scheduled-target',field:'details',value:'Synthetic scheduled evidence',base:''}),'observer')).data; r=await f.rpc('visits/'+id,op({op:'workflowChange',stage:'Ready For Reflection',baseRevision:visit.revision}),'observer');assert.equal(r.ok,true,JSON.stringify(r));
 const schedule=(await f.rpc('scheduler')).data;entry=schedule.entries.find(e=>e.id===entry.id);assert.equal(entry.status,'Complete');assert.equal(entry.visitId,id);
 r=await f.rpc('scheduler',{action:'save',...entry,lessonId:'nonexistent',baseRevision:schedule.revision});assert.equal(r.statusCode,400);assert.equal((await f.rpc('scheduler')).data.revision,schedule.revision);
 r=await f.rpc('visits/'+id,op({op:'workflowChange',stage:'Closed',baseRevision:0}));assert.equal(r.statusCode,409);f.db.close();
});
test('PD contribution review requires evidence and survives later attendance edits',async()=>{
 const f=full(),id=(await f.rpc('visits',{teacherId:'T',protocol:'tbo'})).data.id;
 const value={title:'Coaching',domain:'domain6',outcome:'More wait time',deliverable:'Lesson notes',facilitator:'O',location:'',resources:'',date:'2026-11-04',time:'13:00',endTime:'14:00',reviewDate:'2026-12-01',status:'Delivered',participants:[{teacherId:'T',attendance:'Attended',minutes:60,deliverableStatus:'Complete',notes:''}]};let r=await f.rpc('professional-development',{action:'save',baseRevision:0,value});const sid=r.data.sessions[0].id;
 const review={contribution:'supported_contribution',application:'Used a pause',observed_change:'More responses',other_influences:'Different lesson and group',rationale:'A cautious human judgment',evidence_ids:[]};assert.equal((await f.rpc('pd-reflection',{id:sid,teacherId:'T',baseRevision:1,value:review})).statusCode,400);
 review.evidence_ids=[id];r=await f.rpc('pd-reflection',{id:sid,teacherId:'T',baseRevision:1,value:review});assert.equal(r.data.review.causation_established,false);assert.equal((await f.rpc('pd-reflection',{id:sid,teacherId:'T',baseRevision:2,value:review},'teacher')).statusCode,403);
 r=await f.rpc('professional-development',{action:'save',id:sid,baseRevision:2,value});assert.deepEqual(r.data.sessions[0].participants[0].contributionReview.evidence_ids,[id]);f.db.close();
});

test('configured cycle counts and appointment duration snapshots survive settings changes',async()=>{
 const f=full(),E=require('./engine'),settings={...E.defaults(),tboVisits:2,probationMonths:2,candidateTimes:['09:30'],durationMinutes:45};
 let r=await f.call('saveSettings',{command_id:'configured-cycle',expected_revision:0,settings});assert.equal(r.success,true,JSON.stringify(r));
 r=await f.rpc('scheduler',{action:'recommend',teacherId:'T',protocol:'tbo',start:'2026-01-01',end:'2026-06-30',observers:['O'],baseRevision:0});assert.equal(r.data.entries.length,2);assert.equal(r.data.entries[0].durationMinutes,45);assert.equal(r.data.entries[0].time,'09:30');
 r=await f.call('saveSettings',{command_id:'new-default-duration',expected_revision:1,settings:{...settings,revision:1,durationMinutes:90}});assert.equal(r.success,true);assert.equal((await f.rpc('scheduler')).data.entries[0].durationMinutes,45);f.db.close();
});
test('restoring a PD session rechecks new class conflicts and rolls back',async()=>{
 const f=full(),value={title:'Coaching',domain:'domain6',outcome:'Wait time',deliverable:'Lesson notes',facilitator:'O',location:'',resources:'',date:'2026-11-09',time:'09:00',endTime:'10:00',reviewDate:'2026-12-01',status:'Planned',participants:[{teacherId:'T',attendance:'Not Recorded',minutes:0,deliverableStatus:'Not Started',notes:''}]};let r=await f.rpc('professional-development',{action:'save',baseRevision:0,value});const id=r.data.sessions[0].id;await f.rpc('professional-development',{action:'remove',baseRevision:1,id});
 f.db.exec(`INSERT INTO calendar_entries VALUES(1,'principal-ed','Synthetic lesson','confirmed');INSERT INTO calendar_instances VALUES(7,1,'2026-11-09T06:00:00.000Z','2026-11-09T07:00:00.000Z','scheduled');INSERT INTO scheduler_publication_links VALUES(1,1);INSERT INTO scheduler_placements VALUES(1,'["O"]');`);
 r=await f.rpc('professional-development',{action:'restore',id,baseRevision:2});assert.equal(r.statusCode,400);assert.equal((await f.rpc('professional-development')).data.removedSessions.length,1);f.db.close();
});

test('fresh templates contain no school branding or documents and accept blank school text',async()=>{
 const f=full(),library=(await f.rpc('templates')).data.templates;assert.equal(library.probation.academicYear,'');assert.equal(library.tbo.academicYear,'');for(const key of ['year','subtitle','introduction','purpose','confidentiality'])assert.equal(library.probation.schema[key],'');assert.equal(library.probation.schema.originalTemplate,undefined);assert.doesNotMatch(JSON.stringify(library),/bahrain|bayan|\bbbs\b/i);
 const r=await f.rpc('templates',{protocol:'probation',baseRevision:1,value:library.probation});assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.data.templates.probation.academicYear,'');
 const html=fs.readFileSync(__dirname+'/../../../apps/principaled/public/observation-studio/index.html','utf8');assert.doesNotMatch(html,/bahrain|bayan|\bbbs\b|originalTemplate|data:image|data:application\/vnd.openxmlformats/i);f.db.close();
});

test('upgrade enrols existing installs without replacing choices or short-circuiting fresh defaults',()=>{const f=full(),sql=fs.readFileSync(__dirname+'/migrations/003_enable_existing_installs.sql','utf8');f.db.exec('CREATE UNIQUE INDEX assignment_identity ON app_module_assignments(app_id,module_name)');f.db.exec(sql);assert.equal(f.db.prepare('SELECT count(*) n FROM app_module_assignments').get().n,0);f.db.exec("INSERT INTO app_module_assignments VALUES('principal-ed','staff_registry')");f.db.exec(sql);f.db.exec(sql);assert.deepEqual(f.db.prepare('SELECT module_name FROM app_module_assignments ORDER BY module_name').all().map(r=>r.module_name),['observation_studio','staff_registry']);f.db.close();});
