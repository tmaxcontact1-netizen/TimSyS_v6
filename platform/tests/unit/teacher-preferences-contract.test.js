'use strict';
const contract=require('../../contracts/teacherPreferences');
const base={external_key:'preference:staff-1:subject:math',staff_id:'staff-1',domain:'subject',stance:'prefer',target_key:'math',target_label:'Mathematics',rank:1,confidence:'high',status:'active'};
describe('Teacher Preferences contract',()=>{
 test('keeps preferences advisory and ranks rather than decides',()=>{expect(contract.advisoryWeight(base)).toBe(100);expect(contract.advisoryWeight({...base,external_key:'x',stance:'avoid',rank:2})).toBe(-50);expect(contract.providerRecord(base,3)).toMatchObject({provider_version:'3',status:'active',payload:{advisory_weight:100,stance:'prefer'}});});
 test('keeps restriction declarations weightless through independent review',()=>{expect(contract.providerRecord({...base,stance:'declared_restriction',review_state:'pending'},1).payload).toMatchObject({advisory_weight:0,review_state:'pending'});expect(contract.providerRecord({...base,stance:'declared_restriction',review_state:'confirmed'},2).payload).toMatchObject({advisory_weight:0,review_state:'confirmed'});});
 test('validates effective periods and governed domains',()=>{expect(()=>contract.validateEntry({...base,domain:'qualification'})).toThrow('unsupported');expect(()=>contract.validateEntry({...base,valid_from:'2035-09-01',valid_to:'2035-08-01'})).toThrow('must not follow');});
});
