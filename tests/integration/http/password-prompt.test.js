'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

describe('Password Change Prompt (New Users)', function() {
  var server, baseUrl = 'http://localhost:3004';

  beforeAll(async function() {
    var dbPath = path.resolve('./data/test_pwd_prompt.sqlite');
    [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3004';
    process.env.JWT_SECRET = 'test-secret-key-for-jest-minimum-32-characters';
    process.env.DB_PATH = './data/test_pwd_prompt.sqlite';
    jest.resetModules();
    var index = require('../../../index');
    server = await index.bootPlatform();
    await new Promise(function(r) { setTimeout(r, 500); });
  }, 30000);

  afterAll(function() {
    return new Promise(function(r) {
      if (server) {
        server.close(function() {
          var dbPath = path.resolve('./data/test_pwd_prompt.sqlite');
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

  describe('New user with must_change_password', function() {
    var adminTok = null;
    var newUserId = null;
    var newUserTok = null;
    var username = 'newteacher_' + Date.now();
    var password = 'TempPass123!';
    var newPassword = 'NewSecurePass456!';

    beforeAll(async function() {
      var r = await adminLogin();
      adminTok = r.data.token;

      var createRes = await makeRequest('POST', '/api/users', {
        username: username,
        email: username + '@school.edu',
        password: password,
        permissions: ['admin:users:read'],
      }, adminTok);
      newUserId = createRes.data.user.id;
    });

    test('login returns mustChangePassword flag', async function() {
      var r = await makeRequest('POST', '/api/auth/login', { username: username, password: password });
      expect(r.status).toBe(200);
      expect(r.data.token).toBeDefined();
      expect(r.data.mustChangePassword).toBe(true);
      newUserTok = r.data.token;
    });

    test('protected route blocked with PASSWORD_CHANGE_REQUIRED', async function() {
      var r = await makeRequest('GET', '/api/users', null, newUserTok);
      expect(r.status).toBe(403);
      expect(r.data.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    test('/api/auth/me allowed while pending', async function() {
      var r = await makeRequest('GET', '/api/auth/me', null, newUserTok);
      expect(r.status).toBe(200);
    });

    test('logout allowed while pending', async function() {
      var r = await makeRequest('POST', '/api/auth/logout', null, newUserTok);
      expect(r.status).toBe(200);
    });

    test('re-login still has mustChangePassword', async function() {
      var r = await makeRequest('POST', '/api/auth/login', { username: username, password: password });
      expect(r.status).toBe(200);
      expect(r.data.mustChangePassword).toBe(true);
      newUserTok = r.data.token;
    });

    test('change password succeeds (whitelisted)', async function() {
      var r = await makeRequest('POST', '/api/users/' + newUserId + '/change-password', { newPassword: newPassword }, newUserTok);
      expect(r.status).toBe(200);
    });

    test('old token revoked after password change', async function() {
      var r = await makeRequest('GET', '/api/auth/me', null, newUserTok);
      expect(r.status).toBe(401);
    });

    test('login with new password has no mustChangePassword', async function() {
      var r = await makeRequest('POST', '/api/auth/login', { username: username, password: newPassword });
      expect(r.status).toBe(200);
      expect(r.data.mustChangePassword).toBe(false);
      newUserTok = r.data.token;
    });

    test('protected route accessible after password change', async function() {
      var r = await makeRequest('GET', '/api/users', null, newUserTok);
      expect(r.status).toBe(200);
    });

    test('old password rejected after change', async function() {
      var r = await makeRequest('POST', '/api/auth/login', { username: username, password: password });
      expect(r.status).toBe(401);
    });
  });

  describe('Admin user unaffected', function() {
    test('admin login has no mustChangePassword', async function() {
      var r = await adminLogin();
      expect(r.status).toBe(200);
      expect(r.data.mustChangePassword).toBe(false);
    });

    test('admin can access protected routes immediately', async function() {
      var r = await adminLogin();
      var tok = r.data.token;
      var usersRes = await makeRequest('GET', '/api/users', null, tok);
      expect(usersRes.status).toBe(200);
    });
  });
});