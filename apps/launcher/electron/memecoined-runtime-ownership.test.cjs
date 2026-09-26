const test = require('node:test');
const assert = require('node:assert/strict');
const { claimMemecoinedRuntime, stopLauncherOwnedRuntime } = require('./memecoined-runtime-ownership.cjs');

test('launcher refuses a duplicate external MemeCoinEd without touching its database', async () => {
  let databaseStarts = 0;
  await assert.rejects(claimMemecoinedRuntime({
    probeHealth: async () => ({ status: 200, json: async () => ({ application: 'memecoined' }) }),
    startDatabase: async () => { databaseStarts += 1; },
  }), /already owned outside launcher supervision/);
  assert.equal(databaseStarts, 0);
});

test('launcher-owned shutdown stops children before its database', async () => {
  const order = [];
  await stopLauncherOwnedRuntime({ stopApplications: async () => order.push('apps'), stopDatabase: async () => order.push('database') });
  assert.deepEqual(order, ['apps', 'database']);
});
