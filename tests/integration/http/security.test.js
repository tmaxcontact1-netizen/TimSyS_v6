'use strict';
const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() {
  var instance = await createTestServer('security');
  server = instance;
  makeRequest = instance.makeRequest;
}, 30000);

afterAll(function() { return server.cleanup(); });

describe('Security regression', function() {
  test('reject missing credentials', async function() {
    var r = await makeRequest('POST', '/api/auth/login', {});
    expect(r.status).toBe(401);
  });
  
  test('reject invalid credentials', async function() {
    var r = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
    expect(r.status).toBe(401);
  });
  
  test('accept valid credentials', async function() {
    var r = await adminLogin(makeRequest);
    expect(r.status).toBe(200);
    expect(r.data.token).toBeDefined();
  });
  
  test('protected route requires auth', async function() {
    var r = await makeRequest('GET', '/api/users');
    expect(r.status).toBe(401);
  });
  
  test('authenticated access allowed', async function() {
    var r = await adminLogin(makeRequest);
    var tok = r.data.token;
    var r2 = await makeRequest('GET', '/api/users', null, tok);
    expect(r2.status).toBe(200);
  });
});
