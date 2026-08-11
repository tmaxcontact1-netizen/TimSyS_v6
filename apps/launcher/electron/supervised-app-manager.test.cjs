const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
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
  assert.equal(spawns[0].options.cwd, '/platform/apps/memecoined');
  assert.equal(spawns[0].options.env.MEMECOINED_APP_ROOT, '/platform/apps/memecoined');
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

test('marks an unexpected child exit as degraded', async () => {
  const children = [];
  const manager = new SupervisedAppManager({
    readManifest: async () => manifest,
    spawnProcess: () => { const child = childProcess(); children.push(child); return child; },
    fetchHealth: async () => ({ status: 200 }),
  });
  await manager.start('/platform/apps/memecoined/timsys.app.json', { PAPER_DASHBOARD_PORT: '8080' });
  children[0].exitCode = 1;
  children[0].emit('exit', 1, null);
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
