const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRuntimeLayout } = require('./runtime-layout.cjs');

test('development resources come from the repository and data remains external', () => {
  const layout = createRuntimeLayout({ packaged: false, resourcesPath: 'R:/resources', userDataPath: 'D:/data', sourceRoot: 'S:/source' });
  assert.equal(layout.memecoinedRoot, path.join('S:/source', 'apps', 'memecoined'));
  assert.equal(layout.memecoinedData, path.join('D:/data', 'memecoined'));
  assert.equal(layout.dressedRoot, path.join('S:/source', 'apps', 'dressed'));
  assert.equal(layout.dressedData, path.join('D:/data', 'dressed'));
  assert.equal(layout.researchedRoot, path.join('S:/source', 'apps', 'researched'));
  assert.equal(layout.researchedData, path.join('D:/data', 'researched'));
});

test('packaged resources come from process.resourcesPath', () => {
  const layout = createRuntimeLayout({ packaged: true, resourcesPath: 'R:/resources', userDataPath: 'D:/data', sourceRoot: 'S:/source' });
  assert.equal(layout.platformRoot, path.join('R:/resources', 'platform'));
  assert.equal(layout.postgresRoot, path.join('R:/resources', 'runtime', 'postgres'));
  assert.equal(layout.dressedRoot, path.join('R:/resources', 'apps', 'dressed'));
  assert.equal(layout.researchedRoot, path.join('R:/resources', 'apps', 'researched'));
});

test('verified writable bundles override packaged resources independently', () => {
  const layout = createRuntimeLayout({
    packaged: true, resourcesPath: 'R:/resources', userDataPath: 'D:/data', sourceRoot: 'S:/source',
    bundleRoots: { platform: 'D:/updates/platform/2', dressed: 'D:/updates/dressed/3', 'launcher-ui': 'D:/updates/ui/4' },
  });
  assert.equal(layout.platformRoot, 'D:/updates/platform/2');
  assert.equal(layout.dressedRoot, 'D:/updates/dressed/3');
  assert.equal(layout.launcherUi, 'D:/updates/ui/4');
  assert.equal(layout.researchedRoot, path.join('R:/resources', 'apps', 'researched'));
  assert.equal(layout.postgresRoot, path.join('R:/resources', 'runtime', 'postgres'));
});
