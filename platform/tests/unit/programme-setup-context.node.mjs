import test from 'node:test';
import assert from 'node:assert/strict';
import {loadProgrammeTiming,programmeSetupForm} from '../../../apps/principaled/src/dashboard/components/programme-setup-context.mjs';
test('resolves programme academic year before requesting published windows, including later pages',async()=>{
  const calls=[];
  const result=await loadProgrammeTiming({getSchedulerSetup:async year=>{assert.equal(year,42);return{data:{setup:{id:99}}}},listProgrammeManagerSchedulerWindows:async params=>{calls.push(params);return{data:{windows:[{id:params.page}],total:2}}}},{academic_year_id:42});
  assert.deepEqual(calls,[{scheduler_setup_id:99,page:1,limit:50},{scheduler_setup_id:99,page:2,limit:50}]);
  assert.deepEqual(result.windows,[{id:1,scheduler_setup_id:99},{id:2,scheduler_setup_id:99}]);
});
test('missing setup and unpublished windows are actionable empty states',async()=>{
  const absent=await loadProgrammeTiming({getSchedulerSetup:async()=>({data:{setup:null}})},{academic_year_id:1});assert.equal(absent.windows.length,0);assert.match(absent.notice,/No Scheduler setup/);
  const empty=await loadProgrammeTiming({getSchedulerSetup:async()=>({data:{setup:{id:2}}}),listProgrammeManagerSchedulerWindows:async()=>({data:{windows:[],total:0}})},{academic_year_id:1});assert.match(empty.notice,/No published programme windows/);
});
test('resumed form preserves saved answers and all selected window IDs',()=>{
  const form=programmeSetupForm({purpose:{summary:'Clubs',intended_outcome:'Participation',programme_categories:['sport','arts']},timing:{scheduler_setup_id:9,scheduler_window_ids:['11','12']},participation:{scope:'cross_grade'},governance:{submitter_roles:['parent']}});
  assert.equal(form.summary,'Clubs');assert.equal(form.scheduler_setup_id,9);assert.equal(form.scheduler_window_ids,'11, 12');assert.equal(form.scope,'cross_grade');assert.equal(form.submitter_roles,'parent');
});
