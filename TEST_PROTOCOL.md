# TimSyS Test Protocol v1.0

## Purpose

This document defines the mandatory standards for constructing, maintaining, and extending the TimSyS test suite. Non-compliance will result in flaky tests, port collisions, database corruption, and unreliable CI/CD pipelines.

---

## Core Principles

### 1. Isolation
Every test suite must be fully isolated from all others. No shared state, no shared databases, no shared ports.

### 2. Determinism
Tests must produce identical results across different machines, different times, and different execution orders.

### 3. Self-Contained
Each test file must manage its own lifecycle: boot server, run tests, teardown. No reliance on global state or external services.

### 4. Fast Feedback
Individual test files must complete within 30 seconds. Full suite must complete within 2 minutes.

---

## Architecture

### Directory Structure

Required:

tests/ helpers/ test-server.js Shared test infrastructure unit/ ... Unit tests (no HTTP servers) integration/ http/ *.test.js Integration tests (one file per feature) e2e/ ... End-to-end tests

### Infrastructure Pattern

All integration tests MUST use platform/tests/helpers/test-server.js. Do not write your own server setup code.

javascript 'use strict'; const { createTestServer, adminLogin } = require('../../helpers/test-server');

var server, makeRequest;

beforeAll(async function() { var instance = await createTestServer('feature_name'); server = instance; makeRequest = instance.makeRequest; }, 30000);

afterAll(function() { return server.cleanup(); });

The createTestServer() helper:
1. Assigns a dynamic port (OS chooses via PORT=0)
2. Creates an isolated SQLite database (data/test_<suffix>.sqlite)
3. Boots the platform with clean registries
4. Returns a makeRequest function bound to the correct URL

### Dynamic Port Allocation

Never use hardcoded ports (3000, 3001, etc.). The OS assigns available ports when you pass 0 to server.listen(). This eliminates all port collisions.

If you must inspect the port:

javascript var addr = server.address(); var port = typeof addr === 'string' ? addr : addr.port;

### Database Isolation

Each test file gets its own SQLite database with a unique suffix:
- test_auth.sqlite
- test_staging.sqlite
- test_feature_x.sqlite

The database is created in beforeAll and deleted in afterAll. No data persists between test runs.

---

## Test Construction Rules

### Rule 1: No Global State

Forbidden:

javascript var tok = null; describe('Feature', function() { test('something', async function() { /* uses tok / }); }); describe('Another Feature', function() { test('another', async function() { / uses tok - race condition */ }); });

Required:

javascript describe('Feature', function() { var tok = null; beforeAll(async function() { tok = await getToken(); }); test('something', async function() { /* uses tok */ }); });

### Rule 2: Single Server Per File

One createTestServer() call per test file. Place it in the top-level beforeAll, not inside describe blocks.

Forbidden:

javascript describe('Suite A', function() { beforeAll(async function() { server = await createTestServer('a'); }); }); describe('Suite B', function() { beforeAll(async function() { server = await createTestServer('b'); }); });

Required:

javascript var server, makeRequest; beforeAll(async function() { var instance = await createTestServer('my_feature'); server = instance; makeRequest = instance.makeRequest; }); describe('Feature A', function() { /* uses makeRequest / }); describe('Feature B', function() { / uses makeRequest */ });

### Rule 3: Clean Up Everything

Always call server.cleanup() in afterAll. The helper handles:
- Closing the HTTP server
- Deleting the SQLite database file and WAL/SHM journals
- Clearing Jest module cache (automatic via jest.resetModules())

### Rule 4: Use adminLogin() Helper

Do not repeat login boilerplate:

javascript var tok = (await adminLogin(makeRequest)).data.token;

### Rule 5: Test Names Must Be Descriptive

Forbidden: test('works', ...), test('fails correctly', ...)
Required: test('login returns refreshToken in response', ...), test('refresh endpoint rejects invalid tokens with 401', ...)

### Rule 6: Flatten Describe Blocks

Shallow structure preferred. Deep nesting makes test output harder to read. Maximum 2 levels of describe nesting.

---

## Special Cases

### CSRF Protection Tests

CSRF protection blocks requests without X-Requested-With header. To test this, use raw http.request() instead of makeRequest():

javascript test('rejects request without XHR header', async function() { var http = require('http'); var url = require('url'); var r = await new Promise(function(res, rej) { var par = url.parse(server.baseUrl + '/api/auth/login'); var req = http.request({ hostname: par.hostname, port: par.port, path: par.path, method: 'POST', headers: { 'Content-Type': 'application/json' } }, function(ress) { var d = ''; ress.on('data', function(c) { d += c; }); ress.on('end', function() { try { res({ status: ress.statusCode, data: JSON.parse(d) }); } catch(e) { res({ status: ress.statusCode, data: d }); } }); }); req.on('error', rej); req.write(JSON.stringify({ username: 'admin', password: 'test' })); req.end(); }); expect(r.status).toBe(403); });

### User Creation Tests

When testing new user flows, create users dynamically rather than depending on pre-seeded accounts:

javascript test('new user has mustChangePassword flag', async function() { var createR = await makeRequest('POST', '/api/users', { username: 'newuser_' + Date.now(), email: 'new@test.com', password: 'TestPass123!', permissions: ['user:read'] }, adminToken);

var loginR = await makeRequest('POST', '/api/auth/login', { username: createR.data.user.username, password: 'TestPass123!' });

expect(loginR.data.mustChangePassword).toBe(true); });

---

## Environment Variables

All test environments must set these variables in createTestServer() (handled by the helper):

javascript process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = 'test-secret-key-for-jest-minimum-32-characters'; process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-key-for-jest-minimum-32'; process.env.DB_PATH = './data/test_<suffix>.sqlite'; process.env.PORT = '0';

These override production values and ensure safe test execution. Never set these manually in individual test files.

---

## Running Tests

### Individual File

bash npx jest platform/tests/integration/http/feature_name.test.js --verbose

### All HTTP Tests

bash npx jest platform/tests/integration/http/ --verbose

### Full Suite

bash npx jest --verbose

### Debug Mode

bash npx jest platform/tests/integration/http/feature_name.test.js --no-cache --verbose 2>&1 | head -50

### Parallel Execution

By default, Jest runs test files in parallel. The dynamic port + isolated database pattern makes this safe. No additional configuration needed. If tests are slow or resource-heavy, limit workers:

bash npx jest --maxWorkers=4

---

## Forbidden Anti-Patterns

### Hardcoded Ports

javascript process.env.PORT = '3001';
Will collide with other test files running in parallel.

### Shared Database

javascript process.env.DB_PATH = './data/test.sqlite';
Multiple test files writing to the same database will corrupt data.

### Global Test Variables

javascript var authToken = null;
Variables declared outside describe blocks will leak between suites.

### Inline Server Setup

javascript beforeAll(async function() { var index = require('../../../index'); var server = await index.bootPlatform(); });
Must use createTestServer() instead. Inline setup skips port isolation and env management.

### Multiple Servers Per File
Two separate createTestServer() calls in one file will cause port conflicts and database collisions.

### Requiring index.js Directly

javascript var index = require('../../../index');
The path changes based on directory depth. The helper handles this correctly.

---

## Checklist For New Test Files

1. File location: platform/tests/integration/http/<feature>.test.js
2. Requires createTestServer and adminLogin from helpers
3. Single beforeAll with createTestServer using unique db suffix
4. Single afterAll with server.cleanup()
5. All describe blocks use makeRequest, not raw http
6. No hardcoded ports anywhere
7. No shared database files
8. Test names are descriptive
9. Tests pass when run individually: npx jest platform/tests/integration/http/<feature>.test.js
10. Tests pass when run as part of full suite: npx jest
11. No console.log debug statements left in committed code
