const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const test = require('node:test');
const { SupervisedAppManager, interpolateEnvironment } = require('./supervised-app-manager.cjs');

function childProcess() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.exitCode = null;
  child.signalCode = null;
  child.kill = (signal) => {
    child.signalCode = signal;
    queueMicrotask(() => child.emit('exit', null, signal));
    return true;
  };
  return child;
}

const manifest = JSON.stringify({
  schemaVersion: 1,
  id: 'memecoined',
  name: 'Memecoined',
  kind: 'supervised-child',
  applicationRootEnvironment: 'MEMECOINED_APP_ROOT',
  workingDirectory: '.',
  environmentDefaults: { PAPER_DASHBOARD_PORT: '8080' },
  processes: {
    worker: { command: 'node', arguments: ['worker.js'] },
    dashboard: {
      command: 'node', arguments: ['dashboard.js'],
      health: { url: 'http://127.0.0.1:${PAPER_DASHBOARD_PORT}/api/health', expectedStatus: 200 },
    },
  },
  shutdown: { signal: 'SIGTERM', timeoutMilliseconds: 100 },
});

test('interpolates declared environment values and rejects missing values', () => {
  assert.equal(interpolateEnvironment('http://localhost:${PORT}', { PORT: '8080' }), 'http://localhost:8080');
  assert.throws(() => interpolateEnvironment('${MISSING}', {}), /Missing environment variable/);
});

test('starts each child once and becomes running only after health succeeds', async () => {
  const children = [];
  const spawns = [];
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: (command, args, options) => {
      const child = childProcess(); children.push(child); spawns.push({ command, args, options }); return child;
    },
    fetchHealth: async () => ({ status: 200 }),
    healthIntervalMilliseconds: 1,
  });
  const status = await manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' });
  assert.equal(status.state, 'running');
  assert.deepEqual(status.processes, ['worker', 'dashboard']);
  assert.equal(spawns.length, 2);
  const expectedRoot = path.resolve('/platform/apps/memecoined');
  assert.equal(spawns[0].options.cwd, expectedRoot);
  assert.equal(spawns[0].options.env.MEMECOINED_APP_ROOT, expectedRoot);
  await manager.stop('memecoined');
  assert.deepEqual(children.map((child) => child.signalCode), ['SIGTERM', 'SIGTERM']);
  assert.equal(manager.status('memecoined').state, 'stopped');
});

test('prevents duplicate managed instances', async () => {
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => childProcess(),
    fetchHealth: async () => ({ status: 200 }),
  });
  await manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' });
  await assert.rejects(
    manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' }),
    /already managed/,
  );
  await manager.stopAll();
});

test('fails the application and stops sibling processes after an unexpected child exit', async () => {
  const children = [];
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => { const child = childProcess(); children.push(child); return child; },
    fetchHealth: async () => ({ status: 200 }),
  });
  await manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' });
  children[0].exitCode = 1;
  children[0].emit('exit', 1, null);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.status('memecoined').state, 'failed');
  assert.equal(children[1].signalCode, 'SIGTERM');
});

test('uses manifest environment defaults for readiness and the dashboard URL', async () => {
  let healthUrl;
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => childProcess(),
    fetchHealth: async (url) => { healthUrl = url; return { status: 200 }; },
    runtimeHealthIntervalMilliseconds: 0,
  });
  await manager.start('/platform/apps/memecoined/timsys.app.json');
  assert.equal(healthUrl, 'http://127.0.0.1:8080/api/health');
  assert.equal(manager.dashboardUrl('memecoined'), 'http://127.0.0.1:8080/');
  await manager.stopAll();
});

test('marks a running application degraded after three consecutive health failures', async () => {
  let healthy = true;
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => childProcess(),
    fetchHealth: async () => ({ status: healthy ? 200 : 503 }),
    runtimeHealthIntervalMilliseconds: 2,
  });
  await manager.start('/platform/apps/memecoined/timsys.app.json');
  healthy = false;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('degraded status was not emitted')), 250);
    manager.on('status', (next) => {
      if (next.state === 'degraded') { clearTimeout(timeout); resolve(); }
    });
  });
  assert.equal(manager.status('memecoined').state, 'degraded');
  await manager.stopAll();
});

test('fails startup and terminates children when readiness times out', async () => {
  const children = [];
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => { const child = childProcess(); children.push(child); return child; },
    fetchHealth: async () => ({ status: 503 }),
    healthIntervalMilliseconds: 1,
    startTimeoutMilliseconds: 5,
  });
  await assert.rejects(
    manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' }),
    /Timed out starting memecoined/,
  );
  assert.equal(manager.status('memecoined').state, 'failed');
  assert.deepEqual(children.map((child) => child.signalCode), ['SIGTERM', 'SIGTERM']);
});
