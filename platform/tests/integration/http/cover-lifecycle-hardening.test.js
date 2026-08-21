'use strict';
const helper=require('../../helpers/test-server');
let context,token;

beforeAll(async()=>{
  context=await helper.createTestServer('cover_lifecycle_hardening');
  token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
  for(const s of [
    {staff_id:'T-LIFE-A',first_name:'Ari',last_name:'Able',job_title:'Teacher'},
    {staff_id:'T-LIFE-B',first_name:'Bea',last_name:'Baker',job_title:'Teacher'}
  ]) await context.makeRequest('POST','/staff',{...s,hire_date:'2020-08-01'},token);
});

afterAll(async()=>{if(context)await context.cleanup();});

async function createDemand(title,starts_at,ends_at){
  return (await context.makeRequest('POST','/cover/demands',{title,starts_at,ends_at},token)).data.demand;
}

test('overlapping active cover is excluded from new recommendations and rejected on stale confirmation',async()=>{
  const first=await createDemand('First overlap','2045-09-01T08:00:00.000Z','2045-09-01T09:00:00.000Z');
  const second=await createDemand('Second overlap','2045-09-01T08:30:00.000Z','2045-09-01T09:30:00.000Z');
  const stale=(await context.makeRequest('POST',`/cover/demands/${second.id}/recommendations/generate`,{},token)).data.recommendation_run;
  const firstRun=(await context.makeRequest('POST',`/cover/demands/${first.id}/recommendations/generate`,{},token)).data.recommendation_run;
  const chosen=firstRun.recommendations.find(x=>x.eligible);
  expect((await context.makeRequest('POST',`/cover/demands/${first.id}/assignments`,{recommendation_id:chosen.id},token)).status).toBe(200);
  const staleCandidate=stale.recommendations.find(x=>x.candidate_ref===chosen.candidate_ref);
  const blocked=await context.makeRequest('POST',`/cover/demands/${second.id}/assignments`,{recommendation_id:staleCandidate.id,reason:'Test stale evidence'},token);
  expect(blocked.status).toBe(409);
  expect(blocked.data.error.code).toBe('ELIGIBILITY_CHANGED');
  const refreshed=(await context.makeRequest('POST',`/cover/demands/${second.id}/recommendations/generate`,{},token)).data.recommendation_run;
  const excluded=refreshed.recommendations.find(x=>x.candidate_ref===chosen.candidate_ref);
  expect(excluded.eligible).toBe(false);
  expect(excluded.evidence.evaluation.hard_gates).toEqual(expect.arrayContaining([expect.objectContaining({code:'ALREADY_COMMITTED'})]));
});

test('elapsed assignment completion closes the lifecycle and closed demand is immutable',async()=>{
  const d=await createDemand('Past cover','2020-01-01T08:00:00.000Z','2020-01-01T09:00:00.000Z');
  const run=(await context.makeRequest('POST',`/cover/demands/${d.id}/recommendations/generate`,{},token)).data.recommendation_run;
  const rec=run.recommendations.find(x=>x.eligible);
  const assigned=(await context.makeRequest('POST',`/cover/demands/${d.id}/assignments`,{recommendation_id:rec.id},token)).data.assignment;
  const completed=await context.makeRequest('POST',`/cover/assignments/${assigned.id}/complete`,{expected_revision:assigned.revision},token);
  expect(completed.status).toBe(200);
  expect(completed.data.assignment.status).toBe('completed');
  expect(completed.data.demand.status).toBe('closed');
  const cancel=await context.makeRequest('PUT',`/cover/demands/${d.id}/cancel`,{expected_revision:completed.data.demand.revision,reason:'Invalid reversal'},token);
  expect(cancel.status).toBe(409);
  const history=await context.makeRequest('GET',`/cover/demands/${d.id}/assignments`,null,token);
  expect(history.data.decisions[0].action).toBe('completed');
});
