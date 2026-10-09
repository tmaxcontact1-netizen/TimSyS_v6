import {describe,it,expect} from 'vitest';
import {workRoots} from '../src/infrastructure/workbench-delete.js';
// @ts-ignore frontend JavaScript module
import {formatWorkTime} from '../frontend/src/workbench/time.js';
describe('work history roots and timestamps',()=>{
 it('includes removed roots from Undo/Redo without treating arbitrary nested IDs as collections',()=>{
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
 expect(workRoots([{datasetId:a},{undo:[{path:['workflowId'],value:b}],redo:[{path:['sources','datasetId'],value:'33333333-3333-4333-8333-333333333333'}]}])).toEqual([a,b]);
 });
 it('shows date, time and timezone; missing dates are never invented',()=>{expect(formatWorkTime('2026-10-09T12:34:56Z')).toContain('2026');expect(formatWorkTime('2026-10-09T12:34:56Z')).toMatch(/\d{2}:\d{2}:56/);expect(formatWorkTime(null)).toBe('Not recorded');expect(formatWorkTime('bad')).toBe('Not recorded');});
});
