const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { UpdateManager, compareVersions } = require('./update-manager.cjs');

const hash = value => createHash('sha256').update(value).digest('hex');
test('ResearchEd updates must retain the installed shared evidence contract', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-research-contract-'));
  try {
    const current = path.join(root, 'current'), candidate = path.join(root, 'candidate');
    await fs.mkdir(current); await fs.mkdir(candidate);
    await fs.writeFile(path.join(candidate, 'timsys.app.json'), JSON.stringify({kind:'frontend',backend:{owner:'timsys',version:'1.0.0'}}));
    await fs.mkdir(path.join(candidate, 'dist')); 
    const contract = JSON.stringify({ contract: 'researched.assistant.v1', version: 1 });
    await fs.writeFile(path.join(current, 'ai-assistant-contract.json'), contract);
    const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.20', manifestUrl: 'https://example.test/latest.json' });
    manager.state.bundles.researched = { path: current };
    await assert.rejects(manager.validateBundle('researched', candidate), error => error.code === 'AI_UPDATE_INCOMPATIBLE');
    await fs.writeFile(path.join(candidate, 'ai-assistant-contract.json'), contract);
    await manager.validateBundle('researched', candidate);
    await fs.writeFile(path.join(candidate, 'ai-assistant-contract.json'), JSON.stringify({ contract: 'researched.assistant.v1', version: 0 }));
    await assert.rejects(manager.validateBundle('researched', candidate), error => error.code === 'AI_UPDATE_INCOMPATIBLE');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('incompatible AI bundle is held back while independent updates install, including after restart', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-update-isolation-'));
  try {
    const current = path.join(root, 'current'); await fs.mkdir(current); await fs.writeFile(path.join(current, 'assistant.html'), 'AI');
    const manifest = { schemaVersion: 1, releaseVersion: 'new', bundles: ['launcher-ui', 'researched'].map((id, i) => ({ id, version: String(i + 1).repeat(16), sha256: hash('archive'), size: 7, url: `https://example.test/${id}.zip` })) };
    const options = { dataRoot: root, currentLauncherVersion: '1.0.20', manifestUrl: 'https://example.test/manifest.json', fetchImpl: async url => String(url).endsWith('.json') ? Response.json(manifest) : new Response('archive'), extractArchive: async (_, dest) => {
      if (path.basename(dest) === 'launcher-ui') await fs.writeFile(path.join(dest, 'index.html'), 'old UI');
      else { await fs.writeFile(path.join(dest, 'timsys.app.json'), JSON.stringify({kind:'frontend',backend:{owner:'timsys',version:'1.0.0'}})); await fs.mkdir(path.join(dest, 'dist'));  }
    } };
    const manager = new UpdateManager(options); manager.state.bundles['launcher-ui'] = { path: current, version: 'a'.repeat(16) };
    const result = await manager.install();
    assert.deepEqual(result.installed.map(b => b.id), ['researched']); assert.equal(result.restartRequired, true);
    assert.equal(manager.state.bundles['launcher-ui'].path, current);
    const restarted = new UpdateManager(options), status = await restarted.check();
    assert.equal(status.updateAvailable, false); assert.deepEqual(status.deferred.map(b => b.id), ['launcher-ui']);
    manifest.bundles[0].version = 'b'.repeat(16);
    assert.equal((await restarted.check()).updateAvailable, true, 'a new candidate must be reconsidered');
    const heldOnly = await restarted.install(); assert.equal(heldOnly.restartRequired, false); assert.deepEqual(heldOnly.installed, []);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
test('newer bundle cannot remove an installed assistant entry point', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-ai-retain-'));
  try {
    const current = path.join(root, 'current'), candidate = path.join(root, 'candidate');
    await fs.mkdir(current); await fs.mkdir(candidate);
    await fs.writeFile(path.join(current, 'assistant.html'), 'assistant');
    await fs.writeFile(path.join(candidate, 'index.html'), 'launcher');
    const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.20', manifestUrl: 'https://example.test/latest.json' });
    manager.state.bundles['launcher-ui'] = { path: current };
    await assert.rejects(manager.validateBundle('launcher-ui', candidate), /omits the installed TimSyS AI/);
    await fs.writeFile(path.join(candidate, 'assistant.html'), 'new assistant');
    await manager.validateBundle('launcher-ui', candidate);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('older published releases cannot replace newer installed bundles during check or install', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-update-order-'));
  const manifest = { schemaVersion: 1, releaseVersion: 'older', publishedAt: '2026-10-10T07:38:00Z', bundles: [
    { id: 'launcher-ui', version: 'aaaaaaaaaaaaaaaa', url: 'https://example.test/ui.zip', size: 1, sha256: hash('x') },
  ] };
  const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.0.20', manifestUrl: 'https://example.test/latest.json',
    fetchImpl: async url => { assert.ok(String(url).endsWith('.json'), 'must not download an older bundle'); return Response.json(manifest); } });
  try {
    manager.state.bundles['launcher-ui'] = { version: 'bbbbbbbbbbbbbbbb', publishedAt: '2026-10-10T07:55:00Z' };
    assert.equal((await manager.check()).updateAvailable, false);
    assert.deepEqual(await manager.install(), { installed: [], restartRequired: false });
    delete manifest.publishedAt;
    assert.equal((await manager.check()).updateAvailable, false);
    manifest.publishedAt = '2026-10-10T08:00:00Z';
    assert.equal((await manager.check()).updateAvailable, true);
    manifest.publishedAt = '2026-10-10T07:55:00Z';
    assert.equal((await manager.check()).updateAvailable, false);
    manifest.bundles.push({ id: 'researched', version: 'cccccccccccccccc', url: 'https://example.test/app.zip', size: 1, sha256: hash('x') });
    assert.deepEqual((await manager.check()).available.map(b => b.id), ['researched']);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

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
    const progress = [];
    const installed = await manager.install(event => progress.push(event));
    assert.deepEqual(installed.installed, [{ id: 'launcher-ui', version: 'abcdef0123456789' }]);
    assert.equal(progress[0].phase, 'preparing');
    assert.equal(progress.at(-1).phase, 'complete');
    assert.equal(progress.at(-1).percent, 100);
    assert.equal(progress.find(event => event.phase === 'downloading').downloadedBytes, 0);
    assert.equal(progress.filter(event => event.phase === 'downloading').at(-1).downloadedBytes, archive.length);
    assert.match(manager.activeRoots()['launcher-ui'], /abcdef0123456789$/);
    assert.equal(await manager.rollbackPending('platform_start_failed: test'), true);
    assert.equal(manager.activeRoots()['launcher-ui'], undefined);
    assert.equal(manager.state.rollbackReason, 'platform_start_failed: test');
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
