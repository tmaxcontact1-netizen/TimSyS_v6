const test = require('node:test');
const assert = require('node:assert/strict');
const { claimTradeedRuntime, stopLauncherOwnedRuntime, stopScopedApplication } = require('./tradeed-runtime-ownership.cjs');

test("launcher refuses a duplicate external Trade'Ed without touching its database", async () => {
  let databaseStarts = 0;
  await assert.rejects(claimTradeedRuntime({
    probeHealth: async () => ({ status: 200, json: async () => ({ application: 'tradeed' }) }),
    startDatabase: async () => { databaseStarts += 1; },
  }), /already owned outside launcher supervision/);
  assert.equal(databaseStarts, 0);
});

test('launcher-owned shutdown stops children before its database', async () => {
  const order = [];
  await stopLauncherOwnedRuntime({ stopApplications: async () => order.push('apps'), stopDatabase: async () => order.push('database') });
  assert.deepEqual(order, ['apps', 'database']);
});

test('individual app stop never stops shared infrastructure or sibling apps', async () => {
  for (const appId of ['tradeed','dressed','researched']) {
    const calls=[];
    const result=await stopScopedApplication({appId,stopApplication:async id=>{calls.push(id);return 'stopped';},stopDatabase:()=>{throw Error('must not stop database');}});
    assert.deepEqual(calls,[appId]);assert.equal(result,'stopped');
  }
});
test('unknown app stop fails before executing callbacks',async()=>{
  await assert.rejects(stopScopedApplication({appId:'unknown',stopApplication:()=>{throw Error('called');}}),/known application/);
});
test('app stop failure propagates without shared database fallback',async()=>{
  await assert.rejects(stopScopedApplication({appId:'tradeed',stopApplication:async()=>{throw Error('app stop failed');},stopDatabase:()=>{throw Error('database stop');}}),/app stop failed/);
});
test('source app-close, explicit-stop and startup-failure paths do not stop shared database',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'main.cjs'),'utf8');
  for(const [from,to] of [['async function startTradeed()', 'async function dressedEnvironment'],['async function stopChild(', 'function bindAppWindowLifecycle'],["ipcMain.handle('supervised-app:stop'", "ipcMain.handle('runtime:diagnostics'"]]) {
    const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);
    assert.doesNotMatch(source.slice(start,end),/postgres\.(?:stop|backup)\(/);
  }
});
