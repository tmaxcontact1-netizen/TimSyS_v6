'use strict';
const helper=require('../../helpers/test-server');

describe('academic structure',function(){
  let context,token;
  beforeAll(async()=>{context=await helper.createTestServer('academic_structure');token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;});
  afterAll(async()=>{if(context)await context.cleanup();});

  test('creates customised academic context and universally gradebook-eligible groups',async()=>{
    const year=(await context.makeRequest('POST','/academic-structure/years',{code:'2026-27',name:'2026–27',starts_on:'2026-08-01',ends_on:'2027-07-31'},token)).data.year;
    const programme=(await context.makeRequest('POST','/academic-structure/programmes',{code:'SECONDARY',name:'Secondary'},token)).data.programme;
    const subject=(await context.makeRequest('POST','/academic-structure/subjects',{code:'ART',name:'Visual Art',programme_id:programme.id},token)).data.subject;
    const common=await context.makeRequest('POST','/academic-structure/reporting-periods',{academic_year_id:year.id,code:'Q1',name:'Quarter 1',starts_on:'2026-08-01',ends_on:'2026-10-15'},token);
    const art=await context.makeRequest('POST','/academic-structure/reporting-periods',{academic_year_id:year.id,scope_type:'course',scope_id:String(subject.id),code:'S1',name:'Art Semester',starts_on:'2026-08-01',ends_on:'2026-12-20',credit_fraction:0.5},token);
    expect(common.status).toBe(200);expect(art.data.reporting_period.scope_type).toBe('course');
    const group=(await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'scheduler:art-9a',academic_year_id:year.id,subject_id:subject.id,programme_id:programme.id,name:'Grade 9 Art',kind:'academic'},token)).data.teaching_group;
    expect(group.default_gradebook_mode).toBe('graded');
    const homeroom=(await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'scheduler:hr-9a',academic_year_id:year.id,name:'Homeroom 9A',kind:'homeroom',default_gradebook_mode:'dormant'},token)).data.teaching_group;
    expect(homeroom.kind).toBe('homeroom');expect(homeroom.default_gradebook_mode).toBe('dormant');
  });

  test('gives multiple teachers equal assignments and preserves withdrawn enrolment history',async()=>{
    const years=(await context.makeRequest('GET','/academic-structure/years',null,token)).data.years;
    const group=(await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'manual:club',academic_year_id:years[0].id,name:'Robotics Club',kind:'club',default_gradebook_mode:'evidence_only'},token)).data.teaching_group;
    await context.makeRequest('POST','/academic-structure/teaching-groups/'+group.id+'/teachers',{staff_id:'STAFF-1'},token);
    const assigned=await context.makeRequest('POST','/academic-structure/teaching-groups/'+group.id+'/teachers',{staff_id:'STAFF-2'},token);
    expect(assigned.data.teaching_group.teachers.filter(x=>x.status==='active')).toHaveLength(2);
    await context.makeRequest('POST','/academic-structure/teaching-groups/'+group.id+'/students',{student_id:'STUDENT-1'},token);
    const withdrawn=await context.makeRequest('PUT','/academic-structure/teaching-groups/'+group.id+'/students/STUDENT-1/withdraw',{reason:'Transferred'},token);
    expect(withdrawn.data.enrolment.status).toBe('withdrawn');expect(withdrawn.data.enrolment.withdrawal_reason).toBe('Transferred');
  });

  test('rejects periods outside the academic year and duplicate provider keys',async()=>{
    const year=(await context.makeRequest('GET','/academic-structure/years',null,token)).data.years[0];
    expect((await context.makeRequest('POST','/academic-structure/reporting-periods',{academic_year_id:year.id,code:'BAD',name:'Bad',starts_on:'2025-01-01',ends_on:'2025-02-01'},token)).status).toBe(400);
    const first=await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'manual:duplicate',academic_year_id:year.id,name:'First',kind:'support'},token);
    expect(first.status).toBe(200);
    expect((await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'manual:duplicate',academic_year_id:year.id,name:'Second',kind:'support'},token)).status).toBe(409);
  });
});
