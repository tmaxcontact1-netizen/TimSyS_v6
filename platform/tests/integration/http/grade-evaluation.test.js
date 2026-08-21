'use strict';

const helper = require('../../helpers/test-server');

describe('explainable grade evaluation models', () => {
  let context;
  let token;
  let gradebook;
  let assessment;
  let standard;
  const student = 'S-1';

  beforeAll(async () => {
    context = await helper.createTestServer('grade_evaluation');
    token = (await context.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
    const year = (await context.makeRequest('POST', '/academic-structure/years', {
      code: '2031', name: '2031', starts_on: '2031-01-01', ends_on: '2031-12-31'
    }, token)).data.year;
    const subject = (await context.makeRequest('POST', '/academic-structure/subjects', {
      code: 'MATH', name: 'Math'
    }, token)).data.subject;
    const group = (await context.makeRequest('POST', '/academic-structure/teaching-groups', {
      external_key: 'math', academic_year_id: year.id, subject_id: subject.id,
      name: 'Math', kind: 'academic'
    }, token)).data.teaching_group;
    await context.makeRequest('POST', `/academic-structure/teaching-groups/${group.id}/students`, {
      student_id: student
    }, token);
    gradebook = (await context.makeRequest('GET', '/gradebooks', null, token)).data.gradebooks[0];

    let percentage = (await context.makeRequest('POST', '/assessment-scales', {
      code: 'P', name: 'Percent', scale_type: 'percentage', minimum_value: 0, maximum_value: 100
    }, token)).data.scale;
    percentage = (await context.makeRequest('PUT', `/assessment-scales/${percentage.id}/activate`, {}, token)).data.scale;
    assessment = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/assessments`, {
      title: 'Test', scale_id: percentage.id, maximum_points: 100, status: 'open'
    }, token)).data.assessment;
    await context.makeRequest('POST', `/assessments/${assessment.id}/evidence`, {
      student_id: student, state: 'recorded', raw_numeric: 82
    }, token);

    let framework = (await context.makeRequest('POST', '/standards/frameworks', {
      code: 'MATH-OUTCOMES', name: 'Math outcomes', subject_id: subject.id
    }, token)).data.framework;
    standard = (await context.makeRequest('POST', `/standards/frameworks/${framework.id}/standards`, {
      code: 'NUM-1', title: 'Number fluency'
    }, token)).data.standard;
    framework = (await context.makeRequest('PUT', `/standards/frameworks/${framework.id}/activate`, {}, token)).data.framework;
    await context.makeRequest('POST', `/gradebooks/${gradebook.id}/standards-frameworks`, {
      framework_id: framework.id
    }, token);
    await context.makeRequest('POST', `/assessments/${assessment.id}/standards`, {
      standard_id: standard.id
    }, token);
  });

  afterAll(async () => {
    if (context) await context.cleanup();
  });

  async function policy(code, model, extra = {}) {
    let configured = (await context.makeRequest('POST', '/evaluation-policies', {
      code, name: code, model, aggregation: 'mean', minimum_evidence: 1, ...extra
    }, token)).data.policy;
    configured = (await context.makeRequest('PUT', `/evaluation-policies/${configured.id}/activate`, {}, token)).data.policy;
    const assignment = await context.makeRequest('POST', `/evaluation-policies/${configured.id}/assign`, {
      scope_type: 'gradebook', scope_id: String(gradebook.id)
    }, token);
    expect(assignment.status).toBe(200);
    return configured;
  }

  test('calculates percentage with evidence and policy trace', async () => {
    const configured = await policy('PCT', 'percentage');
    const result = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {}, token)).data.result;
    expect(result.numeric_result).toBe(82);
    expect(result.policy_version).toBe(configured.version);
    expect(result.explanation.included).toBe(1);
    expect(JSON.parse(result.source_evidence_json)).toHaveLength(1);
  });

  test('converts the same evidence to a traditional grade', async () => {
    let letters = (await context.makeRequest('POST', '/assessment-scales', {
      code: 'LETTER', name: 'Letters', scale_type: 'letter'
    }, token)).data.scale;
    for (const level of [
      { code: 'F', label: 'F', ordinal: 1, lower_bound: 0, upper_bound: 59.99 },
      { code: 'B', label: 'B', ordinal: 2, lower_bound: 60, upper_bound: 89.99 },
      { code: 'A', label: 'A', ordinal: 3, lower_bound: 90, upper_bound: 100 }
    ]) await context.makeRequest('POST', `/assessment-scales/${letters.id}/levels`, level, token);
    letters = (await context.makeRequest('PUT', `/assessment-scales/${letters.id}/activate`, {}, token)).data.scale;
    await policy('TRAD', 'traditional', { output_scale_id: letters.id });
    const result = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {}, token)).data.result;
    expect(result.numeric_result).toBe(82);
    expect(result.text_result).toBe('B');
  });

  test('calculates standards mastery independently from the conventional total', async () => {
    await policy('SBG', 'standards');
    const result = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {}, token)).data.result;
    expect(result.numeric_result).toBe(82);
    expect(result.standard_mastery).toEqual(expect.arrayContaining([
      expect.objectContaining({ standard_id: standard.id, numeric_result: 82, evidence_count: 1 })
    ]));
  });

  test('hybrid evaluation preserves both overall attainment and standards mastery', async () => {
    await policy('HYBRID', 'hybrid');
    const result = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {}, token)).data.result;
    expect(result.numeric_result).toBe(82);
    expect(result.standard_mastery).toHaveLength(1);
    expect(result.standard_mastery[0].standard_id).toBe(standard.id);
  });

  test('keeps insufficient evidence visible and requires reasons for overrides', async () => {
    await policy('MIN', 'percentage', { minimum_evidence: 3 });
    let result = (await context.makeRequest('POST', `/gradebooks/${gradebook.id}/students/${student}/evaluate`, {}, token)).data.result;
    expect(result.numeric_result).toBeNull();
    expect(result.confidence).toBe('insufficient');
    expect((await context.makeRequest('POST', `/grade-results/${result.id}/override`, { value: '85' }, token)).status).toBe(400);
    result = (await context.makeRequest('POST', `/grade-results/${result.id}/override`, {
      value: '85', reason: 'Professional judgement'
    }, token)).data.result;
    expect(result.status).toBe('overridden');
    expect(result.override_reason).toBe('Professional judgement');
  });
});
