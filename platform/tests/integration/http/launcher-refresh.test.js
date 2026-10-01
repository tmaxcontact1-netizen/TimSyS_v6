'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createTestServer } = require('../../helpers/test-server');

describe('launcher page routing preserves API and asset boundaries', () => {
  let server, root, previous;
  beforeAll(async () => {
    previous = process.env.TIMSYS_LAUNCHER_DIST;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'timsys-launcher-routing-'));
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Launcher routing fixture</title>');
    process.env.TIMSYS_LAUNCHER_DIST = root;
    server = await createTestServer('launcher_refresh');
  });
  afterAll(async () => {
    if (server) await server.cleanup();
    if (previous === undefined) delete process.env.TIMSYS_LAUNCHER_DIST;
    else process.env.TIMSYS_LAUNCHER_DIST = previous;
    fs.unlinkSync(path.join(root, 'index.html'));
    fs.rmdirSync(root);
  });
  test.each(['/', '/app/principal-ed', '/app/principal-ed/', '/app/principal-ed?resume=1', '/app/principal-ed/modules', '/modules', '/login', '/login/principal-ed'])('GET %s returns the uncached launcher shell', async route => {
    const r = await server.makeRequest('GET', route);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/html');
    expect(r.headers['cache-control']).toBe('no-cache');
    expect(r.data).toContain('Launcher routing fixture');
  });
  test.each(['/api/not-an-endpoint', '/assets/missing.js', '/app/principal-ed/missing.js', '/unrecognised-page'])('GET %s retains a JSON 404', async route => {
    const r = await server.makeRequest('GET', route);
    expect(r.status).toBe(404);
    expect(r.data.error.code).toBe('NOT_FOUND');
  });
  test('page POST is not treated as a shell request', async () => {
    expect((await server.makeRequest('POST', '/app/principal-ed', {})).status).toBe(404);
  });
  test('protected API keeps its authentication boundary', async () => {
    const r = await server.makeRequest('GET', '/late-entries/insights');
    expect(r.status).toBe(401);
    expect(r.headers['content-type']).toContain('application/json');
  });
});
