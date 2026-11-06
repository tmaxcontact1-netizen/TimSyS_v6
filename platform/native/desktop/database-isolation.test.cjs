'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appDatabase, grantAppSchemaPrivileges } = require('./app-database-gateway.cjs');
const { assertTradeedSandboxBundle } = require('./tradeed-sandbox-update-gate.cjs');
const shared = { migrationUrl: 'postgresql://admin:fixture@127.0.0.1:55432/postgres', runtimeUrl: 'postgresql://runtime:fixture@127.0.0.1:55432/postgres' };
const binding = { schemaVersion: 1, appId: 'researched', database: 'researched_isolated_20261101', runtime: 'researched_runtime_20261101', runtimePassword: 'a'.repeat(64) };

test('app database resolution uses only an exact scoped binding and never legacy discovery', () => {
  const read = () => JSON.stringify(binding);
  const db = appDatabase('researched', shared, 'C:/fixture', { read });
  assert.equal(db.database, binding.database);
  assert.equal(new URL(db.runtimeUrl).username, binding.runtime);
  assert.equal(new URL(db.runtimeUrl).pathname, '/' + binding.database);
  assert.throws(() => appDatabase('tradeed', shared, 'C:/fixture', { read }), /SCOPE_DENIED/);
  assert.throws(() => appDatabase('researched', shared, 'C:/fixture', { read: () => { throw Error('missing'); } }), /BINDING_REQUIRED/);
  for (const change of [{ database: 'memecoined' }, { appId: 'dressed' }, { extra: true }]) {
    assert.throws(() => appDatabase('researched', shared, 'C:/fixture', { read: () => JSON.stringify({ ...binding, ...change }) }), /BINDING_DENIED/);
  }
  assert.throws(() => appDatabase('researched', { ...shared, runtimeUrl: shared.runtimeUrl.replace('127.0.0.1', 'example.invalid') }, 'C:/fixture', { read }), /HOST_DENIED/);
});

test('schema grants stay within the bound app and rollback a failed grant', async () => {
  const db = appDatabase('researched', shared, 'C:/fixture', { read: () => JSON.stringify(binding) });
  const queries = []; let ended = false;
  class Client {
    async connect() {}
    async query(sql) { queries.push(sql); if (sql.startsWith('GRANT SELECT')) throw Error('fixture failure'); }
    async end() { ended = true; }
  }
  await assert.rejects(grantAppSchemaPrivileges('researched', db, { Client }), /fixture failure/);
  assert.equal(queries[0], 'BEGIN');
  assert.equal(queries.at(-1), 'ROLLBACK');
  assert.ok(queries.filter(q => q.startsWith('GRANT')).every(q => q.includes('"researched"') && q.includes('"researched_runtime_20261101"')));
  assert.equal(ended, true);
  await assert.rejects(grantAppSchemaPrivileges('dressed', db, { Client }), /GRANT_SCOPE_DENIED/);
});

test('inspection-only bundles allow the separate Q35 host while rejecting the legacy engine', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'timsys-isolation-'));
  t.after(() => { assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(root, { recursive: true }); });
  const native = path.join(root, 'native/desktop'); fs.mkdirSync(native, { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'tradeed-sandbox-contract.json'), path.join(native, 'tradeed-sandbox-contract.json'));
  for (const file of ['inspection-host-gateway.cjs', 'tradeed-sandbox-update-gate.cjs']) fs.writeFileSync(path.join(native, file), 'fixture');
  fs.writeFileSync(path.join(native, 'main.cjs'), 'new InspectionBroker(\ninspectionBroker.start(\ninfrastructureOnly: true');
  fs.mkdirSync(path.join(root, 'services/tradeed-q35'), { recursive: true });
  assert.equal(assertTradeedSandboxBundle(root), true);
  fs.mkdirSync(path.join(root, 'services/tradeed'));
  assert.throws(() => assertTradeedSandboxBundle(root), /BACKEND_REINTRODUCTION_DENIED/);
});
