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
