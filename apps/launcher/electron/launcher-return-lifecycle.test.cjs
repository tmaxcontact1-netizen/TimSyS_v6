const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const source = readFileSync(join(__dirname, 'main.cjs'), 'utf8');

test('returning from a child window preserves its supervised runtime', () => {
  const start = source.indexOf("ipcMain.handle('launcher:return'");
  const end = source.indexOf("ipcMain.handle('supervised-app:stop'", start);
  const handler = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(handler, /returnAppWindowToLauncher\(owned\.appId, owned\.window\)/);
  assert.doesNotMatch(handler, /stopChild\(/);
});

test('application windows replace File Exit with Exit to Launcher', () => {
  assert.match(source, /function installAppWindowMenu/);
  assert.match(source, /label: 'Exit to Launcher'/);
  assert.match(source, /installAppWindowMenu\(appWindow, appId\)/);
});
