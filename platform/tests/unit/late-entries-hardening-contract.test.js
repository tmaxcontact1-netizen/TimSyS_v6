'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'../../modules/late_entries');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'module.json'),'utf8'));
const sql=fs.readFileSync(path.join(root,'migrations/006_late_entry_hardening.sql'),'utf8');
const api=require(root);

describe('late entry hardening contract',()=>{
 test('registers corrections, action policy and immutable activated policy history',()=>{
  expect(manifest.version).toBe('1.0.0');
  expect(manifest.schema.tables).toEqual(expect.arrayContaining(['late_entry_corrections','late_entry_action_policy']));
  expect(manifest.schema.migrations).toContain('migrations/006_late_entry_hardening.sql');
  expect(sql).toMatch(/ADD COLUMN revision/);
  expect(sql).toMatch(/policy_immutable/);
  expect(sql).toMatch(/policy_no_delete/);
 });
 test('exposes explicit human correction, exception and access-policy operations',()=>{
  for(const fn of ['correct','resolveException','getActionPolicy','saveActionPolicy'])expect(typeof api[fn]).toBe('function');
  for(const handler of ['late_entries_correct','late_entries_resolveException','late_entries_getActionPolicy','late_entries_saveActionPolicy'])expect(manifest.routes.some(x=>x.handler===handler)).toBe(true);
 });
});
