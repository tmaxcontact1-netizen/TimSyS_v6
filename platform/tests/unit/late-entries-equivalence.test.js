'use strict';const fs=require('fs'),path=require('path'),root=path.join(__dirname,'../../modules/late_entries'),equivalence=require(path.join(root,'equivalence')),manifest=JSON.parse(fs.readFileSync(path.join(root,'module.json'),'utf8'));
describe('late entry equivalence ledger',()=>{
 test('calculates units without replacing tardies',()=>{expect(equivalence.compute([1,2,3,4,5,6,7],3)).toEqual({tardy_count:7,absence_equivalent_units:2,remainder_tardies:1})});
 test('keeps school and class scopes separate',()=>{const sql=fs.readFileSync(path.join(root,'migrations/004_late_entry_equivalence.sql'),'utf8');expect(sql).toMatch(/'school','class'/);expect(sql).toMatch(/occurrence_ids_json/);expect(sql).toMatch(/policy_version_id/)});
 test('requires separate calculate and human confirmation routes',()=>{expect(manifest.routes).toEqual(expect.arrayContaining([expect.objectContaining({path:'/late-entries/students/:studentId/equivalences',method:'POST'}),expect.objectContaining({path:'/late-entries/equivalences/:id/confirm',method:'POST'})]))});
});
