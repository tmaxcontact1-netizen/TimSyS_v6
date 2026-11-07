const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, 'main.cjs'), 'utf8');

test('returning from a child window preserves its supervised runtime', () => {
  const start = source.indexOf("ipcMain.handle('launcher:return'");
  const end = source.indexOf("ipcMain.handle('supervised-app:stop'", start);
  const handler = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(handler, /returnAppWindowToLauncher\(owned\.appId, owned\.window\)/);
  assert.doesNotMatch(handler, /stopChild\(/);
});

test('application windows use the common menu and launcher return preserves the window', () => {
  assert.match(source, /function installAppWindowMenu/);
  assert.match(source, /workspaceMenu\(/);
  assert.match(source, /installAppWindowMenu\(appWindow, appId\)/);
  const start=source.indexOf('async function returnAppWindowToLauncher');
  const end=source.indexOf('function installAppWindowMenu',start);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(source.slice(start,end),/\.(?:close|destroy)\(|stopChild\(/);
});

test('a pop-out can restore a closed launcher, but quitting never recreates windows', () => {
  const start=source.indexOf('function focusLauncher()'),end=source.indexOf('async function stopChild',start);
  assert.ok(start>=0&&end>start);
  const calls=[],window={isDestroyed:()=>false,isMinimized:()=>true,restore:()=>calls.push('restore'),show:()=>calls.push('show'),focus:()=>calls.push('focus')};
  const context=vm.createContext({quitting:false,app:{isReady:()=>true},platformUrl:'http://127.0.0.1:3000',mainWindow:null,createWindow:()=>{calls.push('create');context.mainWindow=window;}});
  vm.runInContext(source.slice(start,end),context);vm.runInContext('focusLauncher()',context);
  assert.deepEqual(calls,['create','restore','show','focus']);
  calls.length=0;context.quitting=true;context.mainWindow=null;vm.runInContext('focusLauncher()',context);assert.deepEqual(calls,[]);
  context.quitting=false;context.app.isReady=()=>false;vm.runInContext('focusLauncher()',context);assert.deepEqual(calls,[]);
});
