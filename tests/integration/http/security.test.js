'use strict';
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

describe('Security Regression Tests', function() {
  var server, baseUrl = 'http://localhost:3005';

  beforeAll(async function() {
    var dbPath = path.resolve('./data/test_security.sqlite');
    [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3005';
    process.env.JWT_SECRET = 'test-security-key-for-jest-minimum-32-characters!';
    process.env.DB_PATH = './data/test_security.sqlite';
    jest.resetModules();
    var index = require('../../../index');
    server = await index.bootPlatform();
    await new Promise(function(r) { setTimeout(r, 500); });
  }, 30000);

  afterAll(function() {
    return new Promise(function(r) {
      if (server) {
        server.close(function() {
          var dbPath = path.resolve('./data/test_security.sqlite');
          [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
            if (fs.existsSync(p)) fs.unlinkSync(p);
          });
          r();
        });
      } else {
        r();
      }
    });
  });

  function makeRequest(meth, p, body, tok) {
    return new Promise(function(res, rej) {
      var par = url.parse(baseUrl + p);
      var opt = {
        hostname: par.hostname,
        port: par.port,
        path: par.path,
        method: meth,
        headers: { 'Content-Type': 'application/json' },
      };
      if (tok) {
        opt.headers['Authorization'] = 'Bearer ' + tok;
      } else {
        opt.headers['X-Requested-With'] = 'XMLHttpRequest';
      }
      var req = http.request(opt, function(ress) {
        var data = '';
        ress.on('data', function(c) { data += c; });
        ress.on('end', function() {
          try {
            res({ status: ress.statusCode, data: JSON.parse(data), headers: ress.headers });
          } catch (e) {
            res({ status: ress.statusCode, data: data, headers: ress.headers });
          }
        });
      });
      req.on('error', rej);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async function adminLogin() {
    return await makeRequest('POST', '/api/auth/login', { username: 'admin', password: 'changeme123' });
  }

  describe('Token Revocation', function() {
    var adminTok = null;

    beforeEach(async function() {
      var r = await adminLogin();
      adminTok = r.data.token;
    });

    test('revoked token returns 401', async function() {
      var logoutRes = await makeRequest('POST', '/api/auth/logout', null, adminTok);
      expect(logoutRes.status).toBe(200);

      var meRes = await makeRequest('GET', '/api/auth/me', null, adminTok);
      expect(meRes.status).toBe(401);
    });

    test('new login issues fresh token after revocation', async function() {
      var logoutRes = await makeRequest('POST', '/api/auth/logout', null, adminTok);
      expect(logoutRes.status).toBe(200);

      var newLoginRes = await adminLogin();
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.data.token).toBeDefined();

      var meRes = await makeRequest('GET', '/api/auth/me', null, newLoginRes.data.token);
      expect(meRes.status).toBe(200);
    });
  });

  describe('Wildcard Revocation Isolation (Password Change)', function() {
    var adminTok = null;
    var testUser = null;
    var testUserToken = null;

    beforeAll(async function() {
      adminTok = (await adminLogin()).data.token;

      var createRes = await makeRequest('POST', '/api/users', {
        username: 'sec_test_' + Date.now(),
        email: 'sec@test.com',
        password: 'SecPass123!',
        permissions: ['user:read'],
      }, adminTok);
      testUser = createRes.data.user;

      var loginRes = await makeRequest('POST', '/api/auth/login', {
        username: testUser.username,
        password: 'SecPass123!',
      });
      testUserToken = loginRes.data.token;
      expect(testUserToken).toBeDefined();
    });

    test('password change does not block future tokens', async function() {
      var oldToken = testUserToken;

      var changeRes = await makeRequest('POST', '/api/users/' + testUser.id + '/change-password', {
        newPassword: 'NewSecurePass456!',
      }, oldToken);
      expect(changeRes.status).toBe(200);

      var oldMeRes = await makeRequest('GET', '/api/auth/me', null, oldToken);
      expect(oldMeRes.status).toBe(401);

      var newLoginRes = await makeRequest('POST', '/api/auth/login', {
        username: testUser.username,
        password: 'NewSecurePass456!',
      });
      expect(newLoginRes.status).toBe(200);

      var newToken = newLoginRes.data.token;
      var newMeRes = await makeRequest('GET', '/api/auth/me', null, newToken);
      expect(newMeRes.status).toBe(200);
    });
  });

  describe('Permission Denied', function() {
    var adminTok = null;
    var nonAdminTok = null;

    beforeAll(async function() {
      adminTok = (await adminLogin()).data.token;

      var createRes = await makeRequest('POST', '/api/users', {
        username: 'non_admin_' + Date.now(),
        email: 'na@test.com',
        password: 'NADemo123!',
        permissions: ['user:read'],
      }, adminTok);

      var loginRes = await makeRequest('POST', '/api/auth/login', {
        username: createRes.data.user.username,
        password: 'NADemo123!',
      });
      nonAdminTok = loginRes.data.token;
    });

    test('non-admin cannot access admin-only endpoint', async function() {
      var res = await makeRequest('GET', '/api/users', null, nonAdminTok);
      expect(res.status).toBe(403);
    });

    test('admin CAN access admin-only endpoint', async function() {
      var res = await makeRequest('GET', '/api/users', null, adminTok);
      expect(res.status).toBe(200);
    });
  });

    describe('Authorization Middleware', function() {
    var adminTok = null;
    var readOnlyTok = null;
    var readOnlyUser = null;

    beforeAll(async function() {
      adminTok = (await adminLogin()).data.token;

      var createRes = await makeRequest('POST', '/api/users', {
        username: 'readonly_' + Date.now(),
        email: 'ro@test.com',
        password: 'RODemo123!',
        permissions: ['admin:users:read'],
      }, adminTok);
      readOnlyUser = createRes.data.user;

      // Login, change password to clear must_change_password, then login again
      var firstLogin = await makeRequest('POST', '/api/auth/login', {
        username: readOnlyUser.username,
        password: 'RODemo123!',
      });

      await makeRequest('POST', '/api/users/' + readOnlyUser.id + '/change-password', {
        newPassword: 'ROPass456!',
      }, firstLogin.data.token);

      var loginRes = await makeRequest('POST', '/api/auth/login', {
        username: readOnlyUser.username,
        password: 'ROPass456!',
      });
      readOnlyTok = loginRes.data.token;
    });

    test('read-only user can GET users (has admin:users:read)', async function() {
      var res = await makeRequest('GET', '/api/users', null, readOnlyTok);
      expect(res.status).toBe(200);
    });

    test('read-only user cannot POST users (needs admin:users:write)', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'blocked_' + Date.now(),
        email: 'blocked@test.com',
        password: 'Blocked123!',
        permissions: [],
      }, readOnlyTok);
      expect(res.status).toBe(403);
    });

    test('read-only user cannot DELETE users (needs admin:users:write)', async function() {
      var res = await makeRequest('DELETE', '/api/users/' + readOnlyUser.id, null, readOnlyTok);
      expect(res.status).toBe(403);
    });

    test('read-only user cannot PUT users (needs admin:users:write)', async function() {
      var res = await makeRequest('PUT', '/api/users/' + readOnlyUser.id, {
        username: readOnlyUser.username + '_updated',
      }, readOnlyTok);
      expect(res.status).toBe(403);
    });

    test('admin wildcard (admin:*) passes all route permissions', async function() {
      var res = await makeRequest('GET', '/api/users', null, adminTok);
      expect(res.status).toBe(200);
    });

    test('route without permissions field passes through to handler', async function() {
      var res = await makeRequest('GET', '/api/auth/me', null, readOnlyTok);
      expect(res.status).toBe(200);
    });

    test('changePassword still enforces contextual check (self can change own password)', async function() {
      // Re-login with current password to get fresh token
      var freshLogin = await makeRequest('POST', '/api/auth/login', {
        username: readOnlyUser.username,
        password: 'ROPass456!',
      });
      var res = await makeRequest('POST', '/api/users/' + readOnlyUser.id + '/change-password', {
        newPassword: 'NewSelfPass123!',
      }, freshLogin.data.token);
      expect(res.status).toBe(200);
    });

    test('changePassword blocks non-admin from changing OTHER user password', async function() {
      // Re-login with the new password set in previous test
      var freshLogin = await makeRequest('POST', '/api/auth/login', {
        username: readOnlyUser.username,
        password: 'NewSelfPass123!',
      });

      var createRes = await makeRequest('POST', '/api/users', {
        username: 'target_' + Date.now(),
        email: 'target@test.com',
        password: 'Target123!',
        permissions: [],
      }, adminTok);
      var targetUser = createRes.data.user;

      var res = await makeRequest('POST', '/api/users/' + targetUser.id + '/change-password', {
        newPassword: 'Hijacked123!',
      }, freshLogin.data.token);
      expect(res.status).toBe(403);
    });
  });

  describe('CSRF Enforcement', function() {
    test('POST without Bearer token OR XHR header returns 403', async function() {
      return new Promise(function(res) {
        var par = url.parse(baseUrl + '/api/auth/login');
        var opt = {
          hostname: par.hostname,
          port: par.port,
          path: par.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        };
        var req = http.request(opt, function(ress) {
          var data = '';
          ress.on('data', function(c) { data += c; });
          ress.on('end', function() {
            expect(ress.statusCode).toBe(403);
            res();
          });
        });
        req.write(JSON.stringify({ username: 'admin', password: 'changeme123' }));
        req.end();
      });
    });

    test('POST with XHR header (no token) allowed for login', async function() {
      var loginRes = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('Rate Limiting', function() {
    test('rate limit headers present on auth endpoints', async function() {
      var res = await adminLogin();
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Password Policy', function() {
    var adminTok = null;

    beforeAll(async function() {
      adminTok = (await adminLogin()).data.token;
    });

    test('password too short returns 400', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'short_pass_' + Date.now(),
        email: 'sp@test.com',
        password: 'Short1!',
        permissions: ['user:read'],
      }, adminTok);
      expect(res.status).toBe(400);
    });

    test('password without special char returns 400', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'nospecial_' + Date.now(),
        email: 'ns@test.com',
        password: 'Nospecial1',
        permissions: ['user:read'],
      }, adminTok);
      expect(res.status).toBe(400);
    });

    test('valid password succeeds', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'good_pass_' + Date.now(),
        email: 'gp@test.com',
        password: 'GoodPass123!',
        permissions: ['user:read'],
      }, adminTok);
      expect(res.status).toBe(200);
    });
  });
});