'use strict';
const helper=require('../../helpers/test-server');
describe('human-confirmed late entry attendance reconciliation',()=>{
 let server,token,db,entry;
 beforeAll(async()=>{
  server=await helper.createTestServer('late_reconcile_http');token=(await server.makeRequest('POST','/api/auth/dev-login',{})).data.token;db=require('../../../shared/services/db');
  await server.makeRequest('POST','/students',{student_id:'REC-001',first_name:'Jo',last_name:'Morgan',date_of_birth:'2012-01-01',sex:'Male',enrollment_date:'2026-08-01'},token);
  const year=db.query("INSERT INTO academic_years(app_id,code,name,starts_on,ends_on,status) VALUES('principal-ed','AY26','2026-27','2026-08-03','2027-07-31','active')").lastInsertRowid;
  const group=db.query("INSERT INTO teaching_groups(app_id,external_key,academic_year_id,name,kind,status) VALUES('principal-ed','TG-MATH',?,'Mathematics','academic','active')",[year]).lastInsertRowid;
  db.query("INSERT INTO teaching_group_enrolments(teaching_group_id,student_id,status) VALUES(?,'REC-001','active')",[group]);
  db.query("INSERT INTO gradebook_instances(app_id,teaching_group_id,identity_key,academic_year_id,name,mode,status) VALUES('principal-ed',?,'gb-math',?,'Mathematics','graded','active')",[group,year]);
  const setup=db.query("INSERT INTO scheduler_setups(app_id,academic_year_id,name,scope_mode,status) VALUES('principal-ed',?,'School schedule','school','active')",[year]).lastInsertRowid;
  const scope=db.query("INSERT INTO scheduler_scopes(app_id,scheduler_setup_id,external_key,scope_type,scope_ref,name,status) VALUES('principal-ed',?,'school','school','school','Whole school','active')",[setup]).lastInsertRowid;
  db.query("INSERT INTO scheduler_cycles(app_id,scheduler_setup_id,name,week_count,week_labels_json,status) VALUES('principal-ed',?,'Weekly',1,'[\"Week\"]','active')",[setup]);
  const day=db.query("INSERT INTO scheduler_day_patterns(app_id,scheduler_setup_id,scheduler_scope_id,cycle_week,day_index,name,is_operating_day,status) VALUES('principal-ed',?,?,1,1,'Monday',1,'active')",[setup,scope]).lastInsertRowid;
  db.query("INSERT INTO scheduler_periods(app_id,day_pattern_id,external_key,name,sequence,starts_at,ends_at,kind,counts_as_instruction) VALUES('principal-ed',?,'p1','Period 1',1,'08:00','09:00','instruction',1)",[day]);
  const version=db.query("INSERT INTO scheduler_versions(app_id,scheduler_setup_id,external_key,name,status,generation_strategy,feasible,score,stale) VALUES('principal-ed',?,'published-1','Published','published','test',1,100,0)",[setup]).lastInsertRowid;
  db.query("INSERT INTO scheduler_placements(app_id,schedule_version_id,external_key,requirement_external_key,teaching_group_external_key,scheduler_scope_id,week_index,day_index,start_time,end_time,status) VALUES('principal-ed',?,'math-p1','req-math','TG-MATH',?,1,1,'08:00','09:00','published')",[version,scope]);
  let r=await server.makeRequest('POST','/late-entries/config/policies',{effective_from:'2026-08-01',school_day_grace_minutes:5,class_grace_minutes:3,school_tardies_per_absence:3,class_tardies_per_absence:3},token);
  await server.makeRequest('POST',`/late-entries/config/policies/${r.data.policy.id}/activate`,{confirmed_by_human:true},token);
  r=await server.makeRequest('POST','/late-entries',{student_id:'REC-001',occurrence_type:'school_arrival',reason_code:'transport_delay',arrival_at:'2026-08-03T08:20:00.000Z',client_request_id:'reconcile-1'},token);
  expect(r.status).toBe(200);entry=r.data.entry;expect(entry.status).toBe('context_resolved');
 });
 afterAll(async()=>{if(server)await server.cleanup()});
 test('proposes without changing attendance',async()=>{const r=await server.makeRequest('POST',`/late-entries/${entry.id}/reconciliation-proposals`,{},token);expect(r.status).toBe(200);expect(r.data.human_confirmation_required).toBe(true);expect(r.data.run.proposal.changes.map(x=>x.authority)).toEqual(['attendance','classroom_attendance']);expect(db.query('SELECT COUNT(*) n FROM attendance_records').rows[0].n).toBe(0);expect(db.query('SELECT COUNT(*) n FROM class_attendance_marks').rows[0].n).toBe(0)});
 test('refuses unconfirmed application',async()=>{const run=db.query("SELECT id FROM late_entry_reconciliation_runs WHERE late_entry_id=? AND status='proposed'",[entry.id]).rows[0],r=await server.makeRequest('POST',`/late-entries/${entry.id}/reconciliation-proposals/${run.id}/apply`,{},token);expect(r.status).toBe(409);expect(r.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED')});
 test('applies both authorities atomically with provenance',async()=>{const run=db.query("SELECT id FROM late_entry_reconciliation_runs WHERE late_entry_id=? AND status='proposed'",[entry.id]).rows[0],r=await server.makeRequest('POST',`/late-entries/${entry.id}/reconciliation-proposals/${run.id}/apply`,{confirmed_by_human:true,reason:'Reception confirmed physical arrival'},token);expect(r.status).toBe(200);expect(r.data).toMatchObject({status:'reconciled',attendance_mutated:true,human_confirmed:true});expect(db.query("SELECT attendance_status FROM attendance_records WHERE party_id='REC-001'").rows[0].attendance_status).toBe('late');expect(db.query("SELECT attendance_status,source_component,source_record_id FROM class_attendance_marks WHERE student_id='REC-001' AND status='active'").rows[0]).toMatchObject({attendance_status:'late',source_component:'late_entries',source_record_id:String(entry.id)});expect(db.query('SELECT COUNT(*) n FROM late_entry_attendance_links WHERE late_entry_id=?',[entry.id]).rows[0].n).toBe(2)});
});
