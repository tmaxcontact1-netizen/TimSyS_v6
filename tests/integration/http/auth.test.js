'use strict';
const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() {
  var instance = await createTestServer('auth');
  server = instance;
  makeRequest = instance.makeRequest;
}, 30000);

afterAll(function() { return server.cleanup(); });

describe('Login flow', function() {
  test('reject no credentials', async function() {
    var r = await makeRequest('POST', '/api/auth/login', {});
    expect(r.status).toBe(401);
  });
  test('reject wrong password', async function() {
    var r = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
    expect(r.status).toBe(401);
  });
  test('accept valid', async function() {
    var r = await adminLogin(makeRequest);
    expect(r.status).toBe(200);
    expect(r.data.token).toBeDefined();
  });
});

describe('Protected routes', function() {
  var tok = null;
  beforeAll(async function() { var r = await adminLogin(makeRequest); tok = r.data.token; });
  test('reject unauth', async function() { var r = await makeRequest('GET', '/api/users'); expect(r.status).toBe(401); });
  test('accept auth', async function() { var r = await makeRequest('GET', '/api/users', null, tok); expect(r.status).toBe(200); });
  test('auth/me', async function() { var r = await makeRequest('GET', '/api/auth/me', null, tok); expect(r.status).toBe(200); });
  test('create user', async function() { var r = await makeRequest('POST', '/api/users', { username: 'u' + Date.now(), email: 'e@test.com', password: 'TestPass123!', permissions: ['user:read'] }, tok); expect(r.status).toBe(200); });
  test('dup username', async function() { var r = await makeRequest('POST', '/api/users', { username: 'admin', email: 'd@test.com', password: 'TestPass123!', permissions: [] }, tok); expect(r.status).toBe(409); });
});

describe('CSRF', function() {
  test('no token/XHR', async function() {
    var http = require('http');
    var url = require('url');
    var r = await new Promise(function(res, rej) {
      var par = url.parse(server.baseUrl + '/api/auth/login');
      var req = http.request({
        hostname: par.hostname,
        port: par.port,
        path: par.path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, function(ress) {
        var d = '';
        ress.on('data', function(c) { d += c; });
        ress.on('end', function() {
          try { res({ status: ress.statusCode, data: JSON.parse(d) }); }
          catch(e) { res({ status: ress.statusCode, data: d }); }
        });
      });
      req.on('error', rej);
      req.write(JSON.stringify({ username: 'admin', password: 'changeme123' }));
      req.end();
    });
    expect(r.status).toBe(403);
  });
});

describe('Rate limiting', function() {
  test('has headers', async function() { var r = await makeRequest('GET', '/health'); expect(r.status).toBe(200); expect(r.headers['x-ratelimit-limit']).toBeDefined(); });
});

describe('Token revocation', function() {
  var tok = null;
  beforeAll(async function() { var r = await adminLogin(makeRequest); tok = r.data.token; });
  test('logout', async function() { var r = await makeRequest('POST', '/api/auth/logout', null, tok); expect(r.status).toBe(200); });
  test('revoked rejected', async function() { var r = await makeRequest('GET', '/api/auth/me', null, tok); expect(r.status).toBe(401); });
});

describe('Password change', function() {
  var tok = null, id = null, np = 'newSecurePass123!';
  beforeAll(async function() {
    var r = await adminLogin(makeRequest);
    expect(r.status).toBe(200);
    expect(r.data.token).toBeDefined();
    tok = r.data.token;
    id = r.data.user.id;
  });
  test('short pwd', async function() { if (!tok) return; var r = await makeRequest('POST', '/api/users/' + id + '/change-password', { newPassword: 's' }, tok); expect(r.status).toBe(400); });
  test('change pwd', async function() { if (!tok) return; var r = await makeRequest('POST', '/api/users/' + id + '/change-password', { newPassword: np }, tok); expect(r.status).toBe(200); });
  test('old token rejected', async function() { if (!tok) return; var r = await makeRequest('GET', '/api/auth/me', null, tok); expect(r.status).toBe(401); });
  test('new login', async function() { var r = await makeRequest('POST', '/api/auth/login', { username: 'admin', password: np }); expect(r.status).toBe(200); });
});
