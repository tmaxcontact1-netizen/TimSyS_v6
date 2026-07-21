'use strict';
const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() {
  var instance = await createTestServer('staging');
  server = instance;
  makeRequest = instance.makeRequest;
}, 30000);

afterAll(function() { return server.cleanup(); });

describe('GET /staging/modules', function() {
  var tok = null;
  beforeAll(async function() { var r = await adminLogin(makeRequest); tok = r.data.token; });

  test('reject unauth', async function() {
    var r = await makeRequest('GET', '/staging/modules');
    expect(r.status).toBe(401);
  });

  test('returns module list', async function() {
    var r = await makeRequest('GET', '/staging/modules', null, tok);
    expect(r.status).toBe(200);
    expect(r.data.success).toBe(true);
    expect(Array.isArray(r.data.modules)).toBe(true);
    expect(r.data.total).toBeGreaterThan(0);
  });

  test('modules have required fields', async function() {
    var r = await makeRequest('GET', '/staging/modules', null, tok);
    var m = r.data.modules[0];
    expect(m.name).toBeDefined();
    expect(m.version).toBeDefined();
    expect(m.status).toBeDefined();
    expect(typeof m.booted).toBe('boolean');
  });
});

describe('POST /staging/modules', function() {
  var tok = null;
  beforeAll(async function() { var r = await adminLogin(makeRequest); tok = r.data.token; });

  test('reject unauth', async function() {
    var r = await makeRequest('POST', '/staging/modules', { name: 'test_mod' });
    expect(r.status).toBe(401);
  });

  test('reject missing name', async function() {
    var r = await makeRequest('POST', '/staging/modules', {}, tok);
    expect(r.status).toBe(400);
  });

  test('reject nonexistent module', async function() {
    var r = await makeRequest('POST', '/staging/modules', { name: 'does_not_exist' }, tok);
    expect(r.status).toBe(404);
  });
});

describe('DELETE /staging/modules/:id', function() {
  var tok = null;
  beforeAll(async function() { var r = await adminLogin(makeRequest); tok = r.data.token; });

  test('reject unauth', async function() {
    var r = await makeRequest('DELETE', '/staging/modules/system_health');
    expect(r.status).toBe(401);
  });

  test('reject nonexistent module', async function() {
    var r = await makeRequest('DELETE', '/staging/modules/does_not_exist', null, tok);
    expect(r.status).toBe(404);
  });

  test('returns warning for valid module', async function() {
    var r = await makeRequest('DELETE', '/staging/modules/system_health', null, tok);
    expect(r.status).toBe(200);
    expect(r.data.success).toBe(true);
    expect(r.data.warning).toBeDefined();
  });
});
