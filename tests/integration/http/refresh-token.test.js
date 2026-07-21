'use strict';
const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() {
  var instance = await createTestServer('refresh');
  server = instance;
  makeRequest = instance.makeRequest;
}, 30000);

afterAll(function() { return server.cleanup(); });

describe('Login returns refresh token', function() {
  test('login includes refreshToken', async function() {
    var r = await adminLogin(makeRequest);
    expect(r.status).toBe(200);
    expect(r.data.token).toBeDefined();
    expect(r.data.refreshToken).toBeDefined();
  });
});

describe('Refresh token endpoint', function() {
  var tok = null, refresh = null;
  beforeAll(async function() {
    var r = await adminLogin(makeRequest);
    tok = r.data.token;
    refresh = r.data.refreshToken;
  });

  test('rejects missing token', async function() {
    var r = await makeRequest('POST', '/api/auth/refresh', {});
    expect(r.status).toBe(400);
  });

  test('rejects invalid token', async function() {
    var r = await makeRequest('POST', '/api/auth/refresh', { refreshToken: 'invalid.token.here' });
    expect(r.status).toBe(401);
  });

  test('accepts valid refresh token', async function() {
    var r = await makeRequest('POST', '/api/auth/refresh', { refreshToken: refresh }, tok);
    expect(r.status).toBe(200);
    expect(r.data.accessToken).toBeDefined();
    expect(r.data.refreshToken).toBeDefined();
    expect(r.data.refreshToken).not.toBe(refresh);
  });
});

describe('Logout revokes refresh token', function() {
  var tok = null, refresh = null;
  beforeAll(async function() {
    var r = await adminLogin(makeRequest);
    tok = r.data.token;
    refresh = r.data.refreshToken;
  });

  test('logout with refresh token', async function() {
    var r = await makeRequest('POST', '/api/auth/logout', { refreshToken: refresh }, tok);
    expect(r.status).toBe(200);
  });

  test('revoked refresh rejected', async function() {
    var r = await makeRequest('POST', '/api/auth/refresh', { refreshToken: refresh }, tok);
    expect(r.status).toBe(401);
  });
});
