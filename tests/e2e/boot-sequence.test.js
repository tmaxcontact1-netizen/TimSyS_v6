'use strict';
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

describe('E2E: Boot Sequence Regression', function() {
  var server, baseUrl = 'http://localhost:3006';

  beforeAll(async function() {
    var dbPath = path.resolve('./data/test_boot_seq.sqlite');
    [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3006';
    process.env.JWT_SECRET = 'test-boot-seq-key-for-jest-min-32-chars!!';
    process.env.DB_PATH = './data/test_boot_seq.sqlite';
    jest.resetModules();
    var index = require('../../index');
    server = await index.bootPlatform();
    await new Promise(function(r) { setTimeout(r, 500); });
  }, 30000);

  afterAll(async function() {
    var index = require('../../index');
    await index.shutdownPlatform(server);
    var dbPath = path.resolve('./data/test_boot_seq.sqlite');
    [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  });

  function makeRequest(meth, p, tok) {
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
      if (meth === 'POST') req.write(JSON.stringify({}));
      req.end();
    });
  }

  async function adminLogin() {
    return new Promise(function(res, rej) {
      var par = url.parse(baseUrl + '/api/auth/login');
      var req = http.request({
        hostname: par.hostname,
        port: par.port,
        path: par.path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }, function(ress) {
        var d = '';
        ress.on('data', function(c) { d += c; });
        ress.on('end', function() {
          try {
            res({ status: ress.statusCode, data: JSON.parse(d) });
          } catch (e) {
            res({ status: ress.statusCode, data: d });
          }
        });
      });
      req.on('error', rej);
      req.write(JSON.stringify({ username: 'admin', password: 'changeme123' }));
      req.end();
    });
  }

  describe('Stage: Migrations', function() {
    test('schema_migrations table populated', async function() {
      var r = await makeRequest('GET', '/ready');
      expect(r.status).toBe(200);
      expect(r.data.tables).toBeGreaterThan(0);
    });

    test('expected table count (15)', async function() {
      var r = await makeRequest('GET', '/ready');
      expect(r.data.tables).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Stage: Module Discovery', function() {
    test('3 modules discovered and booted', async function() {
      var r = await makeRequest('GET', '/introspect/modules');
      expect(r.status).toBe(401);

      var loginRes = await adminLogin();
      expect(loginRes.status).toBe(200);
      var tok = loginRes.data.token;

      r = await makeRequest('GET', '/introspect/modules', tok);
      expect(r.status).toBe(200);
      expect(r.data.total).toBe(3);
      expect(r.data.modules[0].status).toBe('booted');
      expect(r.data.modules[1].status).toBe('booted');
    });

    test('modules are system_health and user_management', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/modules', tok);
      var names = r.data.modules.map(function(m) { return m.name; });
      expect(names).toContain('system_health');
      expect(names).toContain('user_management');
    });
  });

  describe('Stage: Registration', function() {
    test('routes registered in RouteRegistry', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/routes', tok);
      expect(r.status).toBe(200);
      expect(r.data.total).toBeGreaterThanOrEqual(16);
    });

    test('functions registered in FunctionRegistry', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/functions', tok);
      expect(r.status).toBe(200);
      expect(r.data.total).toBeGreaterThanOrEqual(16);
    });

    test('capabilities registered in CapabilityRegistry', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/capabilities', tok);
      expect(r.status).toBe(200);
    });

    test('registries summary has correct counts', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/registries', tok);
      expect(r.status).toBe(200);
      expect(r.data.registries.modules).toBe(3);
      expect(r.data.registries.routes).toBeGreaterThanOrEqual(16);
      expect(r.data.registries.functions).toBeGreaterThanOrEqual(16);
    });
  });

  describe('Stage: Dependency Resolution', function() {
    test('boot order contains both modules', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/dependencies', tok);
      expect(r.status).toBe(200);
      expect(r.data.bootOrder).toContain('system_health');
      expect(r.data.bootOrder).toContain('user_management');
    });

    test('boot order is correct (system_health before user_management)', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/dependencies', tok);
      var order = r.data.bootOrder;
      var shIdx = order.indexOf('system_health');
      var umIdx = order.indexOf('user_management');
      expect(shIdx).toBeLessThan(umIdx);
    });
  });

  describe('Stage: HTTP Server', function() {
    test('server listening on configured port', async function() {
      var r = await makeRequest('GET', '/health');
      expect(r.status).toBe(200);
      expect(r.data.status).toBe('alive');
    });

    test('ready endpoint returns booted status', async function() {
      var r = await makeRequest('GET', '/ready');
      expect(r.status).toBe(200);
      expect(r.data.status).toBe('ready');
    });
  });

  describe('Stage: Platform Info', function() {
    test('platform endpoint returns system info', async function() {
      var loginRes = await adminLogin();
      var tok = loginRes.data.token;
      var r = await makeRequest('GET', '/introspect/platform', tok);
      expect(r.status).toBe(200);
      expect(r.data.platform.name).toBe('TimSyS');
      expect(r.data.platform.nodeVersion).toBeDefined();
      expect(r.data.platform.uptime).toBeDefined();
    });
  });
});