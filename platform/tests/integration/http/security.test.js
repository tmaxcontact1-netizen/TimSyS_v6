'use strict';
const { createTestServer } = require('../../helpers/test-server.js');

describe('Current HTTP security boundary', function() {
  var context;
  beforeAll(async function() { context = await createTestServer('security'); });
  afterAll(async function() { await context.cleanup(); });

  test('health is available locally', async function() {
    var response = await context.makeRequest('GET', '/health');
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
  });

  test('auth/me rejects missing and invalid tokens', async function() {
    expect((await context.makeRequest('GET', '/api/auth/me')).status).toBe(401);
    expect((await context.makeRequest('GET', '/api/auth/me', null, 'invalid')).status).toBe(401);
  });

  test('desktop session rejects callers without the process-private token', async function() {
    expect((await context.makeRequest('POST', '/api/auth/desktop-session')).status).toBe(401);
  });

  test('unknown routes fail closed', async function() {
    var response = await context.makeRequest('GET', '/api/does-not-exist');
    expect(response.status).toBe(404);
    expect(response.data.success).toBe(false);
  });
});
