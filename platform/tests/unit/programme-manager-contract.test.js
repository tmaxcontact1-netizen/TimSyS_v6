'use strict';
const contract=require('../../contracts/programmeManager');

test('declares dynamic programme modes without granting allocation authority',()=>{
  expect(contract.PROGRAMME_STATUSES).toEqual(expect.arrayContaining(['draft','configured','active','closed','withdrawn','archived']));
  expect(contract.OPERATING_MODES).toEqual(expect.arrayContaining(['before_school','timetabled','off_timetable','after_school','mixed']));
  expect(contract.SOURCE_CHANNELS).toEqual(['native','public_link','google_forms','csv']);
  expect(contract.canRevise('active')).toBe(false);
});

test('validates only stable foundation fields and allows custom programme types',()=>{
  expect(()=>contract.validateProgramme({external_key:'term-1-enrichment',name:'Term 1 Enrichment',programme_type:'school-designed-model',academic_year_id:1,status:'draft'})).not.toThrow();
  expect(()=>contract.validateProgramme({external_key:'bad',name:'Bad',programme_type:'custom',academic_year_id:0})).toThrow(/academic_year_id/);
});
