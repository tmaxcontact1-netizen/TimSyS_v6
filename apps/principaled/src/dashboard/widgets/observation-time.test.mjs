import {test} from 'node:test';
import assert from 'node:assert/strict';
import {schoolTime,localTime} from './observation-time.mjs';
test('appointments use school timezone rather than browser timezone',()=>{
 assert.equal(schoolTime('2026-11-09T09:00','Asia/Riyadh'),'2026-11-09T06:00:00.000Z');
 assert.equal(localTime('2026-11-09T06:00:00.000Z','Asia/Riyadh'),'2026-11-09T09:00');
});
test('skipped and repeated local times cannot silently choose the wrong instant',()=>{
 assert.throws(()=>schoolTime('2026-03-08T02:30','America/New_York'));
 assert.throws(()=>schoolTime('2026-11-01T01:30','America/New_York'));
});
