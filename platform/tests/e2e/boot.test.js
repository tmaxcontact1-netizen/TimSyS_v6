'use strict';
const { createTestServer } = require('../helpers/test-server.js');

describe('E2E: current platform boot', function() {
  var context;
  beforeAll(async function() { context = await createTestServer('e2e'); });
  afterAll(async function() { await context.cleanup(); });

  test('server listens on an assigned Windows-safe port', function() {
    expect(context.port).toBeGreaterThan(0);
  });

  test('health endpoint reports healthy', async function() {
    var response = await context.makeRequest('GET', '/health');
    expect(response.status).toBe(200);
    expect(response.data.status).toBe('healthy');
  });
});
