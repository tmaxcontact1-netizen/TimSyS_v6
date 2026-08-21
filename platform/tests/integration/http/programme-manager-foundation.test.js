'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager foundation',()=>{
  let context,token,year;
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_foundation');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2035-36',name:'2035–36',starts_on:'2035-08-01',ends_on:'2036-07-31'},token)).data.year;
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('publishes ownership boundaries before operational behaviour exists',async()=>{
    const r=await context.makeRequest('GET','/programme-manager/contract',null,token);
    expect(r.status).toBe(200);
    expect(r.data.contract).toMatchObject({human_confirmation_required:true,max_page_size:50});
    expect(r.data.contract.authority).toMatchObject({time:'scheduler',availability:'scheduler',programme_configuration:'programme_manager',allocation_decision:'authorised_human'});
    expect(r.data.contract.source_channels).toEqual(['native','public_link','google_forms','csv']);
  });

  test('creates, revises, withdraws and reinstates an audited draft',async()=>{
    let r=await context.makeRequest('POST','/programme-manager/programmes',{external_key:'enrichment:t1',academic_year_id:year.id,name:'Term 1 Enrichment',programme_type:'enrichment',operating_mode:'timetabled',respondent_mode:'student',configuration:{note:'foundation only'}},token);
    expect(r.status).toBe(200);
    expect(r.data.programme).toMatchObject({status:'draft',revision:1,name:'Term 1 Enrichment'});
    const created=r.data.programme;
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${created.id}`,{name:'Term 1 Enrichment Programme',expected_revision:created.revision},token);
    expect(r.data.programme).toMatchObject({revision:2,name:'Term 1 Enrichment Programme'});
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${created.id}`,{name:'Stale edit',expected_revision:1},token);
    expect(r.status).toBe(409);
    const current=(await context.makeRequest('GET',`/programme-manager/programmes/${created.id}`,null,token)).data.programme;
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${created.id}/withdraw`,{reason:'Programme deferred',expected_revision:current.revision},token);
    expect(r.data.programme.status).toBe('withdrawn');
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${created.id}/reinstate`,{expected_revision:r.data.programme.revision},token);
    expect(r.data.programme.status).toBe('draft');
    const history=await context.makeRequest('GET',`/programme-manager/programmes/${created.id}/history`,null,token);
    expect(history.data.history.map(x=>x.action)).toEqual(['reinstated','withdrawn','revised','created']);
  });

  test('enforces academic-year identity, uniqueness and pagination cap',async()=>{
    expect((await context.makeRequest('POST','/programme-manager/programmes',{external_key:'bad-year',academic_year_id:999999,name:'Bad',programme_type:'custom'},token)).status).toBe(404);
    expect((await context.makeRequest('POST','/programme-manager/programmes',{external_key:'enrichment:t1',academic_year_id:year.id,name:'Duplicate',programme_type:'custom'},token)).status).toBe(409);
    const list=await context.makeRequest('GET','/programme-manager/programmes?limit=500',null,token);
    expect(list.data.limit).toBe(50);
    expect(list.data.total).toBe(1);
  });
});
