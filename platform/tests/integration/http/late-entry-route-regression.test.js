'use strict';
const {createTestServer} = require('../../helpers/test-server');
describe('late-entry static routes and saved-policy retrieval', () => {
  let server, token;
  beforeAll(async () => {
    server = await createTestServer('late_entry_route_regression');
    token = (await server.makeRequest('POST', '/api/auth/dev-login', {})).data.token;
  });
  afterAll(async () => { if (server) await server.cleanup(); });
  test('thresholds and insights reach their collection handlers', async () => {
    const cases = await server.makeRequest('GET', '/late-entries/threshold-cases?status=recommended', null, token);
    expect(cases.status).toBe(200);
    expect(cases.data.cases).toEqual([]);
    const insights = await server.makeRequest('GET', '/late-entries/insights', null, token);
    expect(insights.status).toBe(200);
    expect(insights.data.insights).toBeDefined();
  });
  test('draft policy remains draft and is retrievable alongside all dashboard requests', async () => {
    const saved = await server.makeRequest('POST', '/late-entries/config/policies', {effective_from:'2026-10-01',school_day_grace_minutes:5,class_grace_minutes:3,school_tardies_per_absence:3,class_tardies_per_absence:3}, token);
    expect(saved.status).toBe(200);
    const responses = await Promise.all(['/late-entries','/late-entries/dashboard','/late-entries/config/reasons','/late-entries/config/policies','/late-entries/threshold-cases?status=recommended'].map(route => server.makeRequest('GET',route,null,token)));
    responses.forEach(r => expect(r.status).toBe(200));
    expect(responses[3].data.policies).toContainEqual(expect.objectContaining({id:saved.data.policy.id,status:'draft'}));
  });
  test('record-ID paths still report genuinely missing records', async () => {
    const r = await server.makeRequest('GET', '/late-entries/999999', null, token);
    expect(r.status).toBe(404);
    expect(r.data.error.message).toBe('Late entry not found');
  });
});
