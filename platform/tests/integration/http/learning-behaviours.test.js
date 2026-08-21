'use strict';

const helper = require('../../helpers/test-server');

describe('learning behaviours remain operationally separate from academic grades', () => {
  let context;
  let token;
  let gradebook;
  let indicator;
  let levels;
  let period;
  let academicBefore;
  const student = 'S-BEHAVIOUR';

  beforeAll(async () => {
    context = await helper.createTestServer('learning_behaviours');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    const year = (await context.makeRequest('POST', '/academic-structure/years', {
      code:'2033', name:'2033', starts_on:'2033-01-01', ends_on:'2033-12-31'
    }, token)).data.year;
    period = (await context.makeRequest('POST', '/academic-structure/reporting-periods', {
      academic_year_id:year.id, code:'P1', name:'Period 1', starts_on:'2033-01-01', ends_on:'2033-06-30'
    }, token)).data.reporting_period;
    const subject = (await context.makeRequest('POST', '/academic-structure/subjects', {
      code:'SCI', name:'Science'
    }, token)).data.subject;
    const group = (await context.makeRequest('POST', '/academic-structure/teaching-groups', {
      external_key:'science-2033', academic_year_id:year.id, subject_id:subject.id,
      name:'Science', kind:'academic'
    }, token)).data.teaching_group;
    await context.makeRequest('POST', `/academic-structure/teaching-groups/${group.id}/students`, { student_id:student }, token);
    gradebook = (await context.makeRequest('GET', '/gradebooks', null, token)).data.gradebooks[0];

    let percentage = (await context.makeRequest('POST', '/assessment-scales', {
      code:'SCI-PCT', name:'Science percentage', scale_type:'percentage', minimum_value:0, maximum_value:100
    }, token)).data.scale;
    percentage = (await context.makeRequest('PUT', `/assessment-scales/${percentage.id}/activate`, {}, token)).data.scale;
    const assessment = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/assessments`, {
      title:'Science assessment', scale_id:percentage.id, assessment_date:'2033-02-01', status:'open'
    }, token)).data.assessment;
    await context.makeRequest('POST', `/assessments/${assessment.id}/evidence`, {
      student_id:student, state:'recorded', raw_numeric:76
    }, token);
    let policy = (await context.makeRequest('POST', '/evaluation-policies', {
      code:'SCI-POLICY', name:'Science policy', model:'percentage', aggregation:'mean'
    }, token)).data.policy;
    policy = (await context.makeRequest('PUT', `/evaluation-policies/${policy.id}/activate`, {}, token)).data.policy;
    await context.makeRequest('POST', `/evaluation-policies/${policy.id}/assign`, {
      scope_type:'gradebook', scope_id:String(gradebook.id)
    }, token);
    academicBefore = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {
      reporting_period_id:period.id
    }, token)).data.result;

    let behaviourScale = (await context.makeRequest('POST', '/assessment-scales', {
      code:'BEHAVIOUR-4', name:'Behaviour four point', scale_type:'proficiency'
    }, token)).data.scale;
    for (const level of [
      { code:'EMERGING', label:'Emerging', ordinal:1, numeric_value:1 },
      { code:'DEVELOPING', label:'Developing', ordinal:2, numeric_value:2 },
      { code:'SECURE', label:'Secure', ordinal:3, numeric_value:3 },
      { code:'CONSISTENT', label:'Consistent', ordinal:4, numeric_value:4 }
    ]) await context.makeRequest('POST', `/assessment-scales/${behaviourScale.id}/levels`, level, token);
    behaviourScale = (await context.makeRequest('PUT', `/assessment-scales/${behaviourScale.id}/activate`, {}, token)).data.scale;
    levels = behaviourScale.levels;

    let framework = (await context.makeRequest('POST', '/behaviour-frameworks', {
      code:'LEARNER', name:'Learner behaviours'
    }, token)).data.framework;
    indicator = (await context.makeRequest('POST', `/behaviour-frameworks/${framework.id}/indicators`, {
      code:'PREPARED', name:'Arrives prepared', domain:'Self-management'
    }, token)).data.indicator;
    framework = (await context.makeRequest('PUT', `/behaviour-frameworks/${framework.id}/activate`, {}, token)).data.framework;
    await context.makeRequest('PUT', `/gradebooks/${gradebook.id}/behaviour-framework`, {
      framework_id:framework.id, scale_id:behaviourScale.id
    }, token);
  });

  afterAll(async () => { if (context) await context.cleanup(); });

  test('records governed observations and rejects unassigned scale levels or indicators', async () => {
    const response = await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/behaviour-observations`, {
      indicator_id:indicator.id, scale_level_id:levels.find(level => level.code === 'DEVELOPING').id,
      observed_at:'2033-03-01', notes:'Needed one reminder'
    }, token);
    expect(response.status).toBe(200);
    expect(response.data.observation).toMatchObject({ student_id:student, indicator_id:indicator.id });
    const rejected = await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/behaviour-observations`, {
      indicator_id:99999, scale_level_id:levels[0].id, observed_at:'2033-03-02'
    }, token);
    expect(rejected.status).toBe(409);
  });

  test('corrects immutably and summarizes by indicator and domain within a period', async () => {
    const current = (await context.makeRequest('GET', `/gradebooks/${gradebook.id}/students/${student}/behaviour-summary?reporting_period_id=${period.id}`, null, token)).data.summary;
    const old = current.indicators[0].latest;
    expect((await context.makeRequest('POST', `/behaviour-observations/${old.id}/correct`, {
      scale_level_id:levels.find(level => level.code === 'SECURE').id
    }, token)).status).toBe(400);
    const corrected = (await context.makeRequest('POST', `/behaviour-observations/${old.id}/correct`, {
      scale_level_id:levels.find(level => level.code === 'SECURE').id,
      reason:'Entry selected the wrong descriptor'
    }, token)).data;
    expect(corrected.superseded.superseded_by_id).toBe(corrected.observation.id);
    const summary = (await context.makeRequest('GET', `/gradebooks/${gradebook.id}/students/${student}/behaviour-summary?reporting_period_id=${period.id}`, null, token)).data.summary;
    expect(summary.observation_count).toBe(1);
    expect(summary.indicators[0]).toMatchObject({ average:3, observation_count:1 });
    expect(summary.domains[0]).toEqual({ domain:'Self-management', indicator_count:1, average:3 });
  });

  test('does not alter academic calculation inputs or results', async () => {
    const after = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {
      reporting_period_id:period.id
    }, token)).data.result;
    expect(after.numeric_result).toBe(academicBefore.numeric_result);
    expect(JSON.parse(after.source_evidence_json)).toEqual(JSON.parse(academicBefore.source_evidence_json));
    expect(after.explanation.total).toBe(academicBefore.explanation.total);
  });
});
