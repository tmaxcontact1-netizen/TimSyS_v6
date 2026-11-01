const test = require('node:test');
const assert = require('node:assert/strict');
const { claimTradeedRuntime, stopLauncherOwnedRuntime } = require('./tradeed-runtime-ownership.cjs');

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
