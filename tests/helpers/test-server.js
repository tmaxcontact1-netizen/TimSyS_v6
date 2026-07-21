'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');

function makeRequest(baseUrl, meth, p, body, tok) {
  return new Promise(function(resolve, reject) {
    var parsed = url.parse(baseUrl + p);
    var opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: meth,
      headers: { 'Content-Type': 'application/json' }
    };
    if (tok) {
      opts.headers['Authorization'] = 'Bearer ' + tok;
    } else {
      opts.headers['X-Requested-With'] = 'XMLHttpRequest';
    }
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
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

async function createTestServer(dbSuffix) {
  var dbPath = path.resolve('./data/test_' + dbSuffix + '.sqlite');
  [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-jest-minimum-32-characters';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-jest-minimum-32';
  process.env.DB_PATH = './data/test_' + dbSuffix + '.sqlite';
  process.env.PORT = '0';

  jest.resetModules();
  var index = require('../../index');
  var server = await index.bootPlatform();
  await new Promise(function(r) { setTimeout(r, 500); });

  var addr = server.address();
  var port = typeof addr === 'string' ? addr : addr.port;
  var baseUrl = 'http://localhost:' + port;

  return {
    server: server,
    baseUrl: baseUrl,
    port: port,
    dbPath: dbPath,
    makeRequest: function(meth, p, body, tok) {
      return makeRequest(baseUrl, meth, p, body, tok);
    },
    cleanup: function() {
      return new Promise(function(resolve) {
        if (server) {
          server.close(function() {
            [dbPath, dbPath + '-wal', dbPath + '-shm'].forEach(function(p) {
              if (fs.existsSync(p)) fs.unlinkSync(p);
            });
            resolve();
          });
        } else {
          resolve();
        }
      });
    }
  };
}

async function adminLogin(makeReq) {
  var r = await makeReq('POST', '/api/auth/login', { username: 'admin', password: 'changeme123' });
  if (r.status !== 200) {
    r = await makeReq('POST', '/api/auth/login', { username: 'admin', password: 'newSecurePass123!' });
  }
  return r;
}

module.exports = {
  createTestServer: createTestServer,
  adminLogin: adminLogin
};
