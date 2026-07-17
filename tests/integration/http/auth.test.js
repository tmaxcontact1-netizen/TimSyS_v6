'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

describe('HTTP Auth Integration', function() {
  var server;
  var baseUrl = 'http://localhost:3001';

  beforeAll(function(done) {
    // Clean test database
    var dbPath = path.resolve('./data/test_http.sqlite');
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

    // Override env vars for test server
    process.env.PORT = '3001';
    process.env.JWT_SECRET = 'test-secret-key-for-jest-minimum-32-characters';
    process.env.DB_PATH = './data/test_http.sqlite';

    var index = require('../../../index');
    index.bootPlatform().then(function(srv) {
      server = srv;
      setTimeout(done, 500);
    }).catch(function(err) {
      done.fail(err);
    });
  }, 10000);

  afterAll(function(done) {
    if (server) {
      server.close(function() {
        var dbPath = path.resolve('./data/test_http.sqlite');
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        done();
      });
    } else {
      done();
    }
  });

  function makeRequest(method, pathStr, body, token) {
    return new Promise(function(resolve, reject) {
      var parsed = url.parse(baseUrl + pathStr);
      var options = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.path,
        method: method,
        headers: { 'Content-Type': 'application/json' },
      };

      if (token) {
        options.headers['Authorization'] = 'Bearer ' + token;
      }

      var req = http.request(options, function(res) {
        var data = '';
        res.on('data', function(chunk) { data += chunk; });
        res.on('end', function() {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
          } catch (e) {
            resolve({ status: res.statusCode, data: data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  describe('Login flow', function() {
    test('should reject login without credentials', async function() {
      var res = await makeRequest('POST', '/api/auth/login', {});
      expect(res.status).toBe(401);
    });

    test('should reject login with wrong password', async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
    });

    test('should accept valid credentials', async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      expect(res.status).toBe(200);
      expect(res.data.token).toBeDefined();
      expect(res.data.sessionId).toBeDefined();
      expect(res.data.user.username).toBe('admin');
    });
  });

  describe('Protected routes', function() {
    var token = null;

    beforeAll(async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      token = res.data.token;
    });

    test('should reject unauthenticated access to protected route', async function() {
      var res = await makeRequest('GET', '/api/users');
      expect(res.status).toBe(401);
    });

    test('should accept authenticated access to protected route', async function() {
      var res = await makeRequest('GET', '/api/users', null, token);
      expect(res.status).toBe(200);
      expect(res.data.users).toBeDefined();
    });

    test('should return correct user for /auth/me', async function() {
      var res = await makeRequest('GET', '/api/auth/me', null, token);
      expect(res.status).toBe(200);
      expect(res.data.user.username).toBe('admin');
    });

    test('should create user with proper permissions', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'testuser_' + Date.now(),
        email: 'test@example.com',
        password: 'testpass123',
        permissions: ['user:read'],
      }, token);
      expect(res.status).toBe(200);
      expect(res.data.user.username).toContain('testuser_');
    });

    test('should reject duplicate username', async function() {
      var res = await makeRequest('POST', '/api/users', {
        username: 'admin',
        email: 'duplicate@example.com',
        password: 'testpass123',
        permissions: ['user:read'],
      }, token);
      expect(res.status).toBe(409);
    });
  });

  describe('CSRF protection', function() {
    test('should reject POST without Bearer token or X-Requested-With', async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      expect(res.status).toBe(403);
      expect(res.data.error.code).toBe('CSRF_VALIDATION_FAILED');
    });
  });

  describe('Rate limiting', function() {
    test('should return rate limit headers', async function() {
      var res = await makeRequest('GET', '/health');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Introspection', function() {
    var token = null;

    beforeAll(async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      token = res.data.token;
    });

    test('should return registry counts', async function() {
      var res = await makeRequest('GET', '/introspect/registries', null, token);
      expect(res.status).toBe(200);
      expect(res.data.registries).toBeDefined();
      expect(res.data.registries.modules).toBeDefined();
      expect(res.data.registries.routes).toBeDefined();
      expect(res.data.registries.functions).toBeDefined();
    });
  });

  describe('Token revocation', function() {
    var token = null;

    beforeAll(async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      token = res.data.token;
    });

    test('should revoke token on logout', async function() {
      var res = await makeRequest('POST', '/api/auth/logout', null, token);
      expect(res.status).toBe(200);
    });

    test('should reject revoked token', async function() {
      var res = await makeRequest('GET', '/api/auth/me', null, token);
      expect(res.status).toBe(401);
    });
  });

  describe('Password change', function() {
    var token = null;
    var adminId = null;

    beforeAll(async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'changeme123',
      });
      token = res.data.token;
      adminId = res.data.user.id;
    });

    test('should reject short password', async function() {
      var res = await makeRequest('POST', '/api/users/' + adminId + '/change-password', {
        newPassword: 'short',
      }, token);
      expect(res.status).toBe(400);
    });

    test('should change password and force logout', async function() {
      var res = await makeRequest('POST', '/api/users/' + adminId + '/change-password', {
        newPassword: 'newSecurePass123',
      }, token);
      expect(res.status).toBe(200);
    });

    test('should reject old token after password change', async function() {
      var res = await makeRequest('GET', '/api/auth/me', null, token);
      expect(res.status).toBe(401);
    });

    test('should login with new password', async function() {
      var res = await makeRequest('POST', '/api/auth/login', {
        username: 'admin',
        password: 'newSecurePass123',
      });
      expect(res.status).toBe(200);
    });
  });
});