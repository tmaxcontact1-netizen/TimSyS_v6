const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { UpdateManager, compareVersions } = require('./update-manager.cjs');

const hash = value => createHash('sha256').update(value).digest('hex');

test('version comparison handles different segment lengths', () => {
  assert.equal(compareVersions('1.2.0', '1.2'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('2.0', '2.0.1'), -1);
});

test('verified update becomes the active bundle and can roll back', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-update-'));
  const archive = Buffer.from('verified archive');
  const manifest = { schemaVersion: 1, releaseVersion: '2026.09.1', minimumLauncherVersion: '1.0.0', bundles: [
    { id: 'launcher-ui', version: 'abcdef0123456789', url: 'https://example.test/ui.zip', size: archive.length, sha256: hash(archive) },
  ] };
  const fetchImpl = async url => String(url).endsWith('.json')
    ? new Response(JSON.stringify(manifest), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(archive, { status: 200 });
  const manager = new UpdateManager({
    dataRoot: root, currentLauncherVersion: '1.0.9', manifestUrl: 'https://example.test/timsys-update.json', fetchImpl,
    extractArchive: async (_archive, destination) => fs.writeFile(path.join(destination, 'index.html'), 'updated'),
  });
  try {
    const check = await manager.check();
    assert.equal(check.updateAvailable, true);
    const installed = await manager.install();
    assert.deepEqual(installed.installed, [{ id: 'launcher-ui', version: 'abcdef0123456789' }]);
    assert.match(manager.activeRoots()['launcher-ui'], /abcdef0123456789$/);
    assert.equal(await manager.rollbackPending(), true);
    assert.equal(manager.activeRoots()['launcher-ui'], undefined);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('an altered download is rejected before activation', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-update-bad-'));
  const expected = Buffer.from('expected'), altered = Buffer.from('altered!');
  const manifest = { schemaVersion: 1, releaseVersion: '2', bundles: [
    { id: 'launcher-ui', version: 'abcdef0123456789', url: 'https://example.test/ui.zip', size: altered.length, sha256: hash(expected) },
  ] };
  const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.9', manifestUrl: 'https://example.test/latest.json',
    fetchImpl: async url => String(url).endsWith('.json') ? new Response(JSON.stringify(manifest)) : new Response(altered),
    extractArchive: async () => assert.fail('unverified archive must not be extracted'),
  });
  try {
    await assert.rejects(() => manager.install(), /security check/);
    assert.deepEqual(manager.activeRoots(), {});
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('a confirmed release retains one-bundle rollback information', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-update-rollback-'));
  const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.10', manifestUrl: 'https://example.test/latest.json', fetchImpl: async () => { throw new Error('unused'); } });
  try {
    const previous = path.join(root, 'updates', 'bundles', 'dressed', 'old');
    const current = path.join(root, 'updates', 'bundles', 'dressed', 'new');
    await fs.mkdir(previous, { recursive: true });
    await fs.mkdir(current, { recursive: true });
    manager.state = { schemaVersion: 1, bundles: { dressed: { version: 'bbbbbbbbbbbbbbbb', path: current } }, previousBundles: { dressed: { version: 'aaaaaaaaaaaaaaaa', path: previous } }, pendingRelease: 'release' };
    await manager.confirmPending();
    assert.equal(await manager.rollbackBundle('dressed'), true);
    assert.equal(manager.activeRoots().dressed, previous);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('the Windows archive path is extracted by the production implementation', { skip: process.platform !== 'win32' }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "timsys update apostrophe '-"));
  const source = path.join(root, 'source');
  const archivePath = path.join(root, 'launcher-ui.zip');
  await fs.mkdir(source, { recursive: true });
  await fs.writeFile(path.join(source, 'index.html'), 'working update');
  execFileSync('tar.exe', ['-a', '-cf', archivePath, '-C', source, '.']);
  const archive = await fs.readFile(archivePath);
  const manifest = { schemaVersion: 1, releaseVersion: 'test', bundles: [
    { id: 'launcher-ui', version: '1234567890abcdef', url: 'https://example.test/ui.zip', size: archive.length, sha256: hash(archive) },
  ] };
  const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.11', manifestUrl: 'https://example.test/latest.json',
    fetchImpl: async url => String(url).endsWith('.json') ? new Response(JSON.stringify(manifest)) : new Response(archive),
  });
  try {
    await manager.install();
    assert.equal(await fs.readFile(path.join(manager.activeRoots()['launcher-ui'], 'index.html'), 'utf8'), 'working update');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
