'use strict';
const helper=require('../helpers/test-server');

describe('E2E: composed Gradebook workflow',()=>{
 let context,token,gradebook,student='S-FINAL',period,result,commentary,report,indicator,behaviourLevels;
 beforeAll(async()=>{
  context=await helper.createTestServer('gradebook_module');
  token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
  const year=(await context.makeRequest('POST','/academic-structure/years',{code:'2034',name:'2034',starts_on:'2034-01-01',ends_on:'2034-12-31'},token)).data.year;
  period=(await context.makeRequest('POST','/academic-structure/reporting-periods',{academic_year_id:year.id,code:'P1',name:'Period 1',starts_on:'2034-01-01',ends_on:'2034-06-30'},token)).data.reporting_period;
  const subject=(await context.makeRequest('POST','/academic-structure/subjects',{code:'ENG',name:'English'},token)).data.subject;
  const group=(await context.makeRequest('POST','/academic-structure/teaching-groups',{external_key:'english-final',academic_year_id:year.id,subject_id:subject.id,name:'English',kind:'academic'},token)).data.teaching_group;
  await context.makeRequest('POST',`/academic-structure/teaching-groups/${group.id}/students`,{student_id:student},token);
  gradebook=(await context.makeRequest('GET','/gradebooks',null,token)).data.gradebooks[0];
  let pct=(await context.makeRequest('POST','/assessment-scales',{code:'FINAL-PCT',name:'Percentage',scale_type:'percentage',minimum_value:0,maximum_value:100},token)).data.scale;
  pct=(await context.makeRequest('PUT',`/assessment-scales/${pct.id}/activate`,{},token)).data.scale;
  const assessment=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/assessments`,{title:'Essay',scale_id:pct.id,assessment_date:'2034-03-01',status:'open'},token)).data.assessment;
  await context.makeRequest('POST',`/assessments/${assessment.id}/evidence`,{student_id:student,state:'recorded',raw_numeric:84},token);
  let policy=(await context.makeRequest('POST','/evaluation-policies',{code:'FINAL-POLICY',name:'Final policy',model:'percentage',aggregation:'mean'},token)).data.policy;
  policy=(await context.makeRequest('PUT',`/evaluation-policies/${policy.id}/activate`,{},token)).data.policy;
  await context.makeRequest('POST',`/evaluation-policies/${policy.id}/assign`,{scope_type:'gradebook',scope_id:String(gradebook.id)},token);
  result=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/students/${student}/evaluate`,{reporting_period_id:period.id},token)).data.result;
  let scale=(await context.makeRequest('POST','/assessment-scales',{code:'FINAL-BEH',name:'Behaviour',scale_type:'proficiency'},token)).data.scale;
  for(const level of [{code:'DEV',label:'Developing',ordinal:1,numeric_value:1},{code:'SEC',label:'Secure',ordinal:2,numeric_value:2}])await context.makeRequest('POST',`/assessment-scales/${scale.id}/levels`,level,token);
  scale=(await context.makeRequest('PUT',`/assessment-scales/${scale.id}/activate`,{},token)).data.scale;behaviourLevels=scale.levels;
  let framework=(await context.makeRequest('POST','/behaviour-frameworks',{code:'FINAL-LEARNER',name:'Learner'},token)).data.framework;
  indicator=(await context.makeRequest('POST',`/behaviour-frameworks/${framework.id}/indicators`,{code:'PART',name:'Participation',domain:'Engagement'},token)).data.indicator;
  framework=(await context.makeRequest('PUT',`/behaviour-frameworks/${framework.id}/activate`,{},token)).data.framework;
  await context.makeRequest('PUT',`/gradebooks/${gradebook.id}/behaviour-framework`,{framework_id:framework.id,scale_id:scale.id},token);
  await context.makeRequest('POST',`/gradebooks/${gradebook.id}/students/${student}/behaviour-observations`,{indicator_id:indicator.id,scale_level_id:behaviourLevels[1].id,observed_at:'2034-03-02'},token);
  const session=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/attendance-sessions`,{session_date:'2034-03-03',title:'Lesson'},token)).data.session;
  await context.makeRequest('POST',`/class-attendance-sessions/${session.id}/students/${student}`,{attendance_status:'present'},token);
 });
 afterAll(async()=>{if(context)await context.cleanup()});

 test('keeps classroom attendance independent from the academic result',async()=>{
  const attendance=(await context.makeRequest('GET',`/gradebooks/${gradebook.id}/students/${student}/attendance-summary?reporting_period_id=${period.id}`,null,token)).data.summary;
  expect(attendance).toMatchObject({total_sessions:1,attendance_rate:100});
  const recalculated=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/students/${student}/evaluate`,{reporting_period_id:period.id},token)).data.result;
  expect(recalculated.numeric_result).toBe(84);
  expect(JSON.parse(recalculated.source_evidence_json)).toHaveLength(1);
  result=recalculated;
 });

 test('creates an advisory draft and preserves teacher editorial control',async()=>{
  commentary=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/students/${student}/commentary/generate`,{grade_result_id:result.id},token)).data.draft;
  expect(commentary.generated).toBe(1);expect(commentary.content).toContain('84');
  commentary=(await context.makeRequest('PUT',`/commentary-drafts/${commentary.id}`,{content:'The student has demonstrated secure progress in English.'},token)).data.draft;
  expect(commentary.generated).toBe(0);expect(commentary.version).toBe(2);
  commentary=(await context.makeRequest('PUT',`/commentary-drafts/${commentary.id}/ready`,{},token)).data.draft;
  expect(commentary.status).toBe('ready');
 });

 test('captures, moderates and publishes an immutable report snapshot',async()=>{
  report=(await context.makeRequest('POST',`/gradebooks/${gradebook.id}/students/${student}/reports`,{reporting_period_id:period.id,grade_result_id:result.id,commentary_draft_id:commentary.id},token)).data.report;
  const originalHash=report.content_hash,originalJson=report.snapshot_json;
  expect((await context.makeRequest('POST',`/grade-reports/${report.id}/publish`,{},token)).status).toBe(409);
  report=(await context.makeRequest('POST',`/grade-reports/${report.id}/submit`,{},token)).data.report;
  expect(report.status).toBe('submitted');
  expect((await context.makeRequest('POST',`/grade-reports/${report.id}/decision`,{decision:'reject'},token)).status).toBe(400);
  report=(await context.makeRequest('POST',`/grade-reports/${report.id}/decision`,{decision:'approve',reason:'Moderated'},token)).data.report;
  report=(await context.makeRequest('POST',`/grade-reports/${report.id}/publish`,{},token)).data.report;
  expect(report.status).toBe('published');expect(report.content_hash).toBe(originalHash);expect(report.snapshot_json).toBe(originalJson);
  const snapshot=(await context.makeRequest('GET',`/grade-reports/${report.id}`,null,token)).data.report.snapshot;
  expect(snapshot).toMatchObject({student_id:student,reporting_period_id:period.id});
  expect(snapshot.grade_result.numeric_result).toBe(84);
  expect(snapshot.commentary.content).toBe('The student has demonstrated secure progress in English.');
  expect(snapshot.learning_behaviours).toHaveLength(1);expect(snapshot.classroom_attendance).toHaveLength(1);
 });

 test('certifies composition and exposes evidence-linked operational insights',async()=>{
  const manifest=(await context.makeRequest('GET','/gradebook/manifest',null,token)).data.module;
  expect(manifest.status).toBe('operational');expect(manifest.components).toEqual(expect.arrayContaining(['grade_evaluation','learning_behaviours','classroom_attendance','academic_commentary','grade_reporting']));
  expect(manifest.counts.reports).toBe(1);
  const insightResponse=(await context.makeRequest('GET','/gradebook/insights',null,token)).data;
  expect(insightResponse.insights.every(x=>x.advisory&&x.evidence)).toBe(true);
 });
});
