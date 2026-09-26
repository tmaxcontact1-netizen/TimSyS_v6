const test = require('node:test');
const assert = require('node:assert/strict');
const { AppWindowRegistry } = require('./app-window-registry.cjs');

const fakeWindow = name => ({ name, webContents: { name }, isDestroyed: () => false });

test('keeps simultaneous supervised-app windows independently addressable', () => {
  const registry = new AppWindowRegistry();
  const memecoined = fakeWindow('memecoined');
  const researched = fakeWindow('researched');
  registry.set('memecoined', memecoined);
  registry.set('researched', researched);
  assert.equal(registry.active('memecoined'), memecoined);
  assert.equal(registry.active('researched'), researched);
  assert.deepEqual(registry.forSender(researched.webContents), { appId: 'researched', window: researched });
});

test('closing one app does not remove another app window', () => {
  const registry = new AppWindowRegistry();
  const memecoined = fakeWindow('memecoined');
  const researched = fakeWindow('researched');
  registry.set('memecoined', memecoined);
  registry.set('researched', researched);
  registry.delete('researched', researched);
  assert.equal(registry.active('researched'), null);
  assert.equal(registry.active('memecoined'), memecoined);
});
