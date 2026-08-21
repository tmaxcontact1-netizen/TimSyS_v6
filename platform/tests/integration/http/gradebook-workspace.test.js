'use strict';

const helper = require('../../helpers/test-server');

describe('gradebook operational workspace', () => {
  let context;
  let token;
  let gradebook;
  let subject;
  let year;
  let coursePeriod;

  beforeAll(async () => {
    context = await helper.createTestServer('gradebook_workspace');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    year = (await context.makeRequest('POST', '/academic-structure/years', {
      code: '2032', name: '2032', starts_on: '2032-01-01', ends_on: '2032-12-31'
    }, token)).data.year;
    subject = (await context.makeRequest('POST', '/academic-structure/subjects', {
      code: 'ART', name: 'Art'
    }, token)).data.subject;
    const group = (await context.makeRequest('POST', '/academic-structure/teaching-groups', {
      external_key: 'art-2032', academic_year_id: year.id, subject_id: subject.id,
      name: 'Art', kind: 'academic'
    }, token)).data.teaching_group;
    await context.makeRequest('POST', `/academic-structure/teaching-groups/${group.id}/students`, {
      student_id: 'S-01'
    }, token);
    const db = require('../../../shared/services/db');
    for (let number = 2; number <= 51; number += 1) {
      db.query('INSERT INTO teaching_group_enrolments(teaching_group_id,student_id) VALUES(?,?)', [
        group.id, `S-${String(number).padStart(2, '0')}`
      ]);
    }
    db.query("UPDATE teaching_group_enrolments SET status='withdrawn',withdrawn_at=datetime('now'),withdrawal_reason='Transferred' WHERE teaching_group_id=? AND student_id='S-51'", [group.id]);
    gradebook = (await context.makeRequest('GET', '/gradebooks', null, token)).data.gradebooks[0];

    await context.makeRequest('POST', '/academic-structure/reporting-periods', {
      academic_year_id: year.id, scope_type: 'school', scope_id: 'default',
      code: 'SCHOOL-YEAR', name: 'School year', starts_on: '2032-01-01', ends_on: '2032-12-31'
    }, token);
    coursePeriod = (await context.makeRequest('POST', '/academic-structure/reporting-periods', {
      academic_year_id: year.id, scope_type: 'course', scope_id: String(subject.id),
      code: 'ART-H1', name: 'Art first half', starts_on: '2032-01-01', ends_on: '2032-06-30'
    }, token)).data.reporting_period;

    let scale = (await context.makeRequest('POST', '/assessment-scales', {
      code: 'ART-PCT', name: 'Art percentage', scale_type: 'percentage', minimum_value: 0, maximum_value: 100
    }, token)).data.scale;
    scale = (await context.makeRequest('PUT', `/assessment-scales/${scale.id}/activate`, {}, token)).data.scale;
    const inside = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/assessments`, {
      title: 'Portfolio one', scale_id: scale.id, assessment_date: '2032-03-10', status: 'open'
    }, token)).data.assessment;
    await context.makeRequest('POST', `/gradebooks/${gradebook.id}/assessments`, {
      title: 'Portfolio two', scale_id: scale.id, assessment_date: '2032-09-10', status: 'open'
    }, token);
    await context.makeRequest('POST', `/assessments/${inside.id}/evidence`, {
      student_id: 'S-01', state: 'recorded', raw_numeric: 88
    }, token);

    let policy = (await context.makeRequest('POST', '/evaluation-policies', {
      code: 'ART-POLICY', name: 'Art policy', model: 'percentage', aggregation: 'mean'
    }, token)).data.policy;
    policy = (await context.makeRequest('PUT', `/evaluation-policies/${policy.id}/activate`, {}, token)).data.policy;
    await context.makeRequest('POST', `/evaluation-policies/${policy.id}/assign`, {
      scope_type: 'gradebook', scope_id: String(gradebook.id)
    }, token);
    await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/S-01/evaluate`, {
      reporting_period_id: coursePeriod.id
    }, token);
  });

  afterAll(async () => { if (context) await context.cleanup(); });

  test('resolves one complete period configuration by precedence', async () => {
    const response = await context.makeRequest('GET', `/gradebooks/${gradebook.id}/reporting-periods`, null, token);
    expect(response.status).toBe(200);
    expect(response.data.resolved_from).toEqual({ scope_type: 'course', scope_id: String(subject.id) });
    expect(response.data.periods.map(period => period.code)).toEqual(['ART-H1']);
  });

  test('returns a period-filtered, paginated matrix without hiding withdrawn enrolments', async () => {
    const first = (await context.makeRequest('GET', `/gradebooks/${gradebook.id}/workspace?reporting_period_id=${coursePeriod.id}`, null, token)).data.workspace;
    expect(first.assessments.map(item => item.title)).toEqual(['Portfolio one']);
    expect(first.students).toHaveLength(50);
    expect(first.pagination).toEqual({ page: 1, limit: 50, total: 51, pages: 2 });
    expect(first.students[0].evidence[0].evidence.raw_numeric).toBe(88);
    expect(first.students[0].result.numeric_result).toBe(88);
    const second = (await context.makeRequest('GET', `/gradebooks/${gradebook.id}/workspace?reporting_period_id=${coursePeriod.id}&page=2`, null, token)).data.workspace;
    expect(second.students).toHaveLength(1);
    expect(second.students[0]).toMatchObject({ student_id: 'S-51', status: 'withdrawn' });
  });

  test('rejects a period outside the resolved configuration', async () => {
    const school = (await context.makeRequest('GET', '/academic-structure/reporting-periods?scope_type=school', null, token)).data.reporting_periods[0];
    const response = await context.makeRequest('GET', `/gradebooks/${gradebook.id}/workspace?reporting_period_id=${school.id}`, null, token);
    expect(response.status).toBe(409);
    expect(response.data.error.code).toBe('REPORTING_PERIOD_NOT_RESOLVED');
  });

  test('keeps a multi-thousand-row roster query bounded and paginated', async () => {
    const db=require('../../../shared/services/db');
    const groupId=gradebook.teaching_group_id;
    db.transaction(tx=>{for(let n=52;n<=2051;n+=1)tx.query('INSERT INTO teaching_group_enrolments(teaching_group_id,student_id) VALUES(?,?)',[groupId,`LOAD-${n}`])});
    const started=Date.now();
    const view=(await context.makeRequest('GET',`/gradebooks/${gradebook.id}/workspace?reporting_period_id=${coursePeriod.id}&page=41`,null,token)).data.workspace;
    expect(Date.now()-started).toBeLessThan(2000);
    expect(view.students).toHaveLength(50);
    expect(view.pagination).toEqual({page:41,limit:50,total:2051,pages:42});
  });
});
