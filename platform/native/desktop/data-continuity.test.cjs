const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { resolveTradingDataRoot, normalizeTradingEnvironment } = require('./data-continuity.cjs');
const { LocalPostgresManager } = require('./local-postgres-manager.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timsys-continuity-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
test('legacy populated folder is adopted without moving files; competing roots stop startup', t => {
  const root = fixture(t);
  assert.equal(resolveTradingDataRoot(root), path.join(root, 'tradeed'));
  const legacy = path.join(root, 'memecoined'); fs.mkdirSync(legacy); fs.writeFileSync(path.join(legacy, 'record'), 'existing');
  assert.equal(resolveTradingDataRoot(root), legacy);
  fs.mkdirSync(path.join(root, 'tradeed')); assert.equal(resolveTradingDataRoot(root), legacy);
  fs.writeFileSync(path.join(root, 'tradeed', 'record'), 'other');
  assert.throws(() => resolveTradingDataRoot(root), /Multiple/);
  assert.equal(fs.readFileSync(path.join(legacy, 'record'), 'utf8'), 'existing');
});
test('persisted environment aliases are normalized without mutation and conflicts fail closed', () => {
  const original = { MEMECOINED_INSTANCE_ID: 'existing' };
  assert.equal(normalizeTradingEnvironment(original).TRADEED_INSTANCE_ID, 'existing');
  assert.deepEqual(original, { MEMECOINED_INSTANCE_ID: 'existing' });
  assert.throws(() => normalizeTradingEnvironment({ ...original, TRADEED_INSTANCE_ID: 'other' }), /Conflicting/);
});
for (const names of ['memecoined', 'tradeed', 'memecoined\ntradeed', '']) {
  test('existing cluster identity selection: ' + (names || 'missing'), async t => {
    const root = fixture(t), dataRoot = path.join(root, 'profile'), binaryRoot = path.join(root, 'runtime');
    fs.mkdirSync(path.join(dataRoot, 'postgres', 'data'), { recursive: true });
    fs.mkdirSync(path.join(binaryRoot, 'bin'), { recursive: true });
    fs.writeFileSync(path.join(dataRoot, 'postgres', 'data', 'PG_VERSION'), '17');
    const credentials = JSON.stringify({ administrator: 'memecoined_admin', administratorPassword: 'existing', runtime: 'memecoined_runtime', runtimePassword: 'existing' });
    const credentialFile = path.join(dataRoot, 'postgres', 'credentials.json'); fs.writeFileSync(credentialFile, credentials);
    for (const name of ['pg_ctl', 'psql', 'createdb', 'pg_dump']) fs.writeFileSync(path.join(binaryRoot, 'bin', name + (process.platform === 'win32' ? '.exe' : '')), 'fixture');
    const calls = [];
    const manager = new LocalPostgresManager({ dataRoot, binaryRoot, choosePort: async () => 54329, execute: async (command, args) => {
      calls.push({ command, args }); return { stdout: args.some(a => a.includes('pg_database')) ? names : '1', stderr: '' };
    } });
    if (!names || names.includes('\n')) await assert.rejects(manager.start(), /identity/);
    else {
      const state = await manager.start(); assert.equal(new URL(state.runtimeUrl).pathname, '/' + names);
      await manager.grantSchemaPrivileges('dressed'); await manager.backup(); await manager.stop();
      const grants = calls.find(c => c.args.some(a => a.includes('GRANT CONNECT'))); assert.equal(grants.args[grants.args.indexOf('-d') + 1], names);
      const dump = calls.find(c => path.basename(c.command).startsWith('pg_dump')); assert.equal(dump.args[dump.args.indexOf('-d') + 1], names);
    }
    assert.equal(fs.readFileSync(credentialFile, 'utf8'), credentials);
    assert.equal(calls.some(c => path.basename(c.command).startsWith('createdb')), false);
  });
}
