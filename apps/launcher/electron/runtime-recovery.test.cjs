const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { backupPlatformDatabase, restorePlatformDatabase, diagnostics } = require('./runtime-recovery.cjs');

test('platform backup and guarded restore preserve valid SQLite data', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-recovery-'));
  try {
    const database = path.join(root, 'platform', 'timsys.sqlite');
    await fs.mkdir(path.dirname(database), { recursive: true });
    await fs.writeFile(database, Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.from('original')]));
    const backup = await backupPlatformDatabase(root);
    await fs.writeFile(database, Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.from('changed')]));
    await restorePlatformDatabase(root, backup);
    assert.match((await fs.readFile(database)).toString(), /original/);
    await assert.rejects(() => restorePlatformDatabase(root, path.join(root, 'outside.sqlite')), /backup directory/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('diagnostics report state without credentials or environment values', () => {
  const report = diagnostics({ layout: { platformData: 'missing-platform', memecoinedData: 'missing-memecoined' }, statuses: [{ id: 'x', state: 'failed', detail: 'exit 1', processes: [] }] });
  assert.equal(report.apps[0].state, 'failed');
  assert.equal(JSON.stringify(report).includes('DATABASE_URL'), false);
});
