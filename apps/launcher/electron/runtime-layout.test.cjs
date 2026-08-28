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
});

test('packaged resources come from process.resourcesPath', () => {
  const layout = createRuntimeLayout({ packaged: true, resourcesPath: 'R:/resources', userDataPath: 'D:/data', sourceRoot: 'S:/source' });
  assert.equal(layout.platformRoot, path.join('R:/resources', 'platform'));
  assert.equal(layout.postgresRoot, path.join('R:/resources', 'runtime', 'postgres'));
  assert.equal(layout.dressedRoot, path.join('R:/resources', 'apps', 'dressed'));
});
