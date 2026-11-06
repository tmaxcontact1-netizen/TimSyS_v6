const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { UpdateManager } = require('./update-manager.cjs');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'timsys-baseline-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const baselineFile = path.join(root, 'baseline.json');
  await fs.writeFile(baselineFile, JSON.stringify({ schemaVersion: 1, bundles: { researched: { version: '0.10.13', publishedAt: '2026-10-31T17:00:00Z' } } }));
  return { root, baselineFile };
}
test('installed full-build baseline supersedes older feed archives without claiming missing updates', async t => {
  const { root, baselineFile } = await fixture(t);
  const manifest = { schemaVersion: 1, releaseVersion: 'old', publishedAt: '2026-10-31T08:00:00Z', bundles: [{ id: 'researched', version: 'a'.repeat(16), sha256: 'b'.repeat(64), size: 1, url: 'https://example.test/research.zip' }] };
  const manager = new UpdateManager({ dataRoot: root, baselineFile, currentLauncherVersion: '1.1.0', manifestUrl: 'https://example.test/latest.json', fetchImpl: async () => Response.json(manifest) });
  manager.state.deferredUpdates = { researched: { version: manifest.bundles[0].version, sha256: manifest.bundles[0].sha256, reason: 'legacy backend' } };
  const result = await manager.check();
  assert.equal(result.updateAvailable, false); assert.deepEqual(result.deferred, []);
  manifest.bundles[0].version = 'c'.repeat(16); manifest.publishedAt = '2026-11-01T08:00:00Z';
  assert.equal((await manager.check()).updateAvailable, true, 'later releases remain discoverable');
});
test('central host prevents a version downgrade even when the feed date is newer', async t => {
  const { root, baselineFile } = await fixture(t), candidate = path.join(root, 'candidate');
  await fs.mkdir(path.join(candidate, 'dist'), { recursive: true });
  const manifest = { kind: 'frontend', backend: { owner: 'timsys', version: '1.0.0' }, version: '0.6.0' };
  const manager = new UpdateManager({ dataRoot: root, baselineFile, currentLauncherVersion: '1.1.0', manifestUrl: 'https://example.test/latest.json' });
  await fs.writeFile(path.join(candidate, 'timsys.app.json'), JSON.stringify(manifest));
  await assert.rejects(manager.validateBundle('researched', candidate), /older or unversioned/);
  manifest.version = '0.10.14'; await fs.writeFile(path.join(candidate, 'timsys.app.json'), JSON.stringify(manifest));
  await manager.validateBundle('researched', candidate);
});
test('legacy services and launcher interfaces cannot override a central host', async t => {
  const { root } = await fixture(t), candidate = path.join(root, 'candidate'); await fs.mkdir(candidate);
  const manager = new UpdateManager({ dataRoot: root, currentLauncherVersion: '1.1.0', manifestUrl: 'https://example.test/latest.json' });
  await fs.writeFile(path.join(candidate, 'index.html'), 'legacy UI');
  await assert.rejects(manager.validateBundle('launcher-ui', candidate), error => error.code === 'BACKEND_UPDATE_INCOMPATIBLE');
  await fs.writeFile(path.join(candidate, 'timsys.ui.json'), JSON.stringify({ owner: 'timsys', runtimeContract: '1.1.0' }));
  await manager.validateBundle('launcher-ui', candidate);
  await assert.rejects(manager.validateBundle('platform', candidate), error =>
    error.code === 'BACKEND_UPDATE_INCOMPATIBLE' || error.message === 'TRADEED_SANDBOX_UPDATE_INCOMPATIBLE');
});
