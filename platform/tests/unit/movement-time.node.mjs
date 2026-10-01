import test from 'node:test';
import assert from 'node:assert/strict';
import {movementTimestamp,elapsedMovementMinutes} from '../../../apps/principaled/src/dashboard/components/movement-time.mjs';

test('UTC SQL timestamps agree with explicitly zoned instants in every host timezone', () => {
  const old=process.env.TZ;
  try {
    for (const zone of ['Asia/Riyadh','UTC','America/New_York']) {
      process.env.TZ=zone;
      const now=Date.parse('2026-10-01T12:00:00Z');
      assert.equal(elapsedMovementMinutes('2026-10-01 12:00:00',now),0);
      assert.equal(elapsedMovementMinutes('2026-10-01 11:55:00',now),5);
      assert.equal(movementTimestamp('2026-10-01T15:00:00+03:00'),now);
      assert.equal(movementTimestamp('2026-10-01T12:00:00.000'),now);
    }
  } finally { if(old===undefined)delete process.env.TZ;else process.env.TZ=old; }
});
test('unknown timestamps remain unknown and future times do not produce negative elapsed minutes', () => {
  assert.equal(elapsedMovementMinutes(null),null);
  assert.equal(elapsedMovementMinutes('bad'),null);
  assert.equal(elapsedMovementMinutes('2026-10-01 12:00:00',Date.parse('2026-10-01T11:00:00Z')),0);
});
