const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { LocalPostgresManager, connectionUrl } = require('./local-postgres-manager.cjs');

test('database URLs encode credentials and bind to loopback', () => {
  const result = connectionUrl('runtime', 'unsafe:/ password', 54321);
  assert.equal(result, 'postgresql://runtime:unsafe%3A%2F%20password@127.0.0.1:54321/memecoined');
});

function stoppedFixture(t, execute) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timsys-pg-status-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const binaryRoot = path.join(root, 'runtime'), dataRoot = path.join(root, 'data');
  fs.mkdirSync(path.join(binaryRoot, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, 'postgres', 'data'), { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'postgres', 'data', 'PG_VERSION'), '17');
  fs.writeFileSync(path.join(binaryRoot, 'bin', `pg_ctl${process.platform === 'win32' ? '.exe' : ''}`), 'test');
  const manager = new LocalPostgresManager({ binaryRoot, dataRoot, execute });
  manager.state = Object.freeze({ port: 54321 });
  return manager;
}

test('missing PID and repeated stop succeed only after status confirms exit 3', async t => {
  const calls = [];
  const manager = stoppedFixture(t, async (_, args) => {
    calls.push(args);
    if (args.at(-1) === 'stop') throw new Error('pg_ctl: PID file "data/postmaster.pid" does not exist\nIs server running?');
    throw Object.assign(new Error('localised status message'), { exitCode: 3 });
  });
  await manager.stop();
  await manager.stop();
  assert.equal(manager.state, null);
  assert.deepEqual(calls.map(args => args.at(-1)), ['stop', 'status', 'stop', 'status']);
  assert.ok(calls.every(args => args[1] === manager.clusterRoot));
});

for (const [label, status] of [
  ['still running', async () => ({ stdout: 'server is running' })],
  ['inaccessible data directory', async () => { throw Object.assign(new Error('inaccessible'), { exitCode: 4 }); }],
  ['permission denied', async () => { throw Object.assign(new Error('denied'), { exitCode: 1 }); }],
  ['cannot execute status', async () => { throw Object.assign(new Error('spawn failed'), { code: 'EACCES' }); }],
]) {
  test(`stop preserves original failure and ownership when ${label}`, async t => {
    const original = new Error('server did not shut down');
    const manager = stoppedFixture(t, async (_, args) => {
      if (args.at(-1) === 'stop') throw original;
      return status();
    });
    const state = manager.state;
    await assert.rejects(manager.stop(), error => error === original);
    assert.equal(manager.state, state);
  });
}

test('production stop path invokes pg_ctl fast stop and releases manager ownership', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timsys-pg-stop-'));
  const binaryRoot = path.join(root, 'runtime');
  const dataRoot = path.join(root, 'data');
  fs.mkdirSync(path.join(binaryRoot, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(dataRoot, 'postgres', 'data'), { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'postgres', 'data', 'PG_VERSION'), '17');
  const executable = path.join(binaryRoot, 'bin', `pg_ctl${process.platform === 'win32' ? '.exe' : ''}`);
  fs.writeFileSync(executable, 'test');
  const calls = [];
  const manager = new LocalPostgresManager({
    binaryRoot,
    dataRoot,
    execute: async (command, args) => { calls.push({ command, args }); return { stdout: '', stderr: '' }; },
  });
  manager.state = Object.freeze({ port: 54321 });
  await manager.stop();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, executable);
  assert.deepEqual(calls[0].args, ['-D', path.join(dataRoot, 'postgres', 'data'), '-w', '-m', 'fast', 'stop']);
  assert.equal(manager.state, null);
  fs.rmSync(root, { recursive: true, force: true });
});
