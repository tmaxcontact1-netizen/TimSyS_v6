'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager Scheduler boundary',()=>{
  let context,token,setup,scope,year,version,roomOne,roomTwo,resourceOne;
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_scheduler_boundary');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2040-41',name:'2040–41',starts_on:'2040-08-01',ends_on:'2041-07-31'},token)).data.year;
    for(const s of [
      {staff_id:'PM-T1',first_name:'Ari',last_name:'Available',job_title:'Teacher'},
      {staff_id:'PM-T2',first_name:'Uma',last_name:'Unavailable',job_title:'Teacher'},
      {staff_id:'PM-T3',first_name:'Lina',last_name:'Lightload',job_title:'Teacher'}
    ]) await context.makeRequest('POST','/staff',{...s,hire_date:'2030-08-01'},token);
    roomOne=(await context.makeRequest('POST','/rooms',{room_number:'PM-R1',capacity:24,room_type:'classroom'},token)).data.room;
    roomTwo=(await context.makeRequest('POST','/rooms',{room_number:'PM-R2',capacity:20,room_type:'classroom'},token)).data.room;
    resourceOne=(await context.makeRequest('POST','/inventory',{item_name:'Programme Kit',item_number:'PM-KIT-1',category:'equipment',quantity:5},token)).data.item;
    setup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Programme Window School',scope_mode:'school'},token)).data.setup;
    scope=setup.scopes[0];
    await context.makeRequest('PUT','/scheduler/structures',{scheduler_setup_id:setup.id,cycle:{name:'Week',week_count:1,week_labels:['Week']},period_templates:[{external_key:'single',name:'Single',duration_minutes:50}],day_patterns:[{scheduler_scope_id:scope.id,cycle_week:1,day_index:1,name:'Monday',periods:[{external_key:'p1',name:'P1',sequence:1,starts_at:'08:00',ends_at:'08:50',kind:'instruction',period_template_key:'single'},{external_key:'p2',name:'P2',sequence:2,starts_at:'09:00',ends_at:'09:50',kind:'instruction',period_template_key:'single'}]}]},token);
    await context.makeRequest('PUT','/scheduler/rules',{scheduler_setup_id:setup.id,availability:[{external_key:'pm-t2-unavailable',entity_type:'staff',entity_ref:'PM-T2',state:'unavailable',cycle_week:1,day_index:1,starts_at:'08:00',ends_at:'10:00',reason:'Assigned to safeguarding duty'}],constraints:[],travel_times:[]},token);
    await context.makeRequest('PUT','/scheduler/requirements',{scheduler_setup_id:setup.id,requirements:[
      {external_key:'window:enrichment:monday',academic_year_id:String(year.id),teaching_group_external_key:'window:enrichment:monday',name:'Monday Enrichment Window',occurrences_per_cycle:1,duration_minutes:50,eligible_staff_ids:['PM-T1','PM-T2','PM-T3'],eligible_room_ids:[String(roomOne.id),String(roomTwo.id)],eligible_resource_ids:[String(resourceOne.id)],allowed_period_template_keys:['single'],attributes:{programme_window:true,programme_category:'enrichment'},status:'active'}
    ]},token);
    version=(await context.makeRequest('POST','/scheduler/generate',{scheduler_setup_id:setup.id,alternative_count:1},token)).data.versions[0];
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('does not expose draft or merely approved programme windows',async()=>{
    let r=await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token);
    expect(r.data.windows).toEqual([]);
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/select`,{},token)).data.version;
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/submit`,{reason:'Ready'},token)).data.version;
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/approve`,{reason:'Approved'},token)).data.version;
    r=await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token);
    expect(r.data.windows).toEqual([]);
  });

  test('exposes only explicitly classified windows after Scheduler publication',async()=>{
    const published=await context.makeRequest('PUT',`/scheduler/versions/${version.id}/publish`,{reason:'Published timetable'},token);
    expect(published.status).toBe(200);
    const r=await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({authority:'published_scheduler',consumed_by:'programme_manager',total:1,page:1,limit:50});
    expect(r.data.windows[0]).toMatchObject({window_name:'Monday Enrichment Window',authority:'published_scheduler',schedule_revision:expect.any(Number),fingerprint:expect.any(String)});
    expect(r.data.windows[0].attributes.programme_window).toBe(true);
  });

  test('returns explainable live availability and recorded load without allocating',async()=>{
    const windows=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token)).data.windows;
    const id=windows[0].id;
    let r=await context.makeRequest('GET',`/programme-manager/scheduler-windows/${id}/availability?scheduler_setup_id=${setup.id}&entity_type=staff`,null,token);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({authority:'published_scheduler',consumed_by:'programme_manager',entity_type:'staff',availability_fingerprint:expect.any(String)});
    const unavailable=r.data.candidates.find(x=>x.entity_ref==='PM-T2');
    expect(unavailable.available).toBe(false);
    expect(unavailable.hard_gates).toEqual(expect.arrayContaining([expect.objectContaining({code:'EXPLICITLY_UNAVAILABLE'})]));
    const available=r.data.candidates.find(x=>x.entity_ref==='PM-T3');
    expect(available.available).toBe(true);
    expect(available.scheduled_minutes_per_cycle).toBe(0);
    r=await context.makeRequest('GET',`/programme-manager/scheduler-windows/${id}/availability?scheduler_setup_id=${setup.id}&entity_type=room&available_only=true`,null,token);
    expect(r.data.candidates.length).toBeGreaterThan(0);
    r=await context.makeRequest('GET',`/programme-manager/scheduler-windows/${id}/availability?scheduler_setup_id=${setup.id}&entity_type=resource`,null,token);
    expect(r.data.candidates.find(x=>x.entity_ref===String(resourceOne.id)).available).toBe(true);
  });

  test('rejects unsupported availability dimensions and caps pages',async()=>{
    const id=(await context.makeRequest('GET',`/scheduler/programme-windows?scheduler_setup_id=${setup.id}`,null,token)).data.windows[0].id;
    expect((await context.makeRequest('GET',`/scheduler/programme-windows/${id}/availability?scheduler_setup_id=${setup.id}&entity_type=student`,null,token)).status).toBe(400);
    const r=await context.makeRequest('GET',`/scheduler/programme-windows/${id}/availability?scheduler_setup_id=${setup.id}&entity_type=staff&limit=500`,null,token);
    expect(r.data.limit).toBe(50);
  });

  test('reads classification from the frozen publication rather than later requirement edits',async()=>{
    const before=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token)).data.windows[0];
    await context.makeRequest('PUT','/scheduler/requirements',{scheduler_setup_id:setup.id,requirements:[
      {external_key:'window:enrichment:monday',academic_year_id:String(year.id),teaching_group_external_key:'window:enrichment:monday',name:'Renamed Current Requirement',occurrences_per_cycle:1,duration_minutes:50,eligible_staff_ids:['PM-T1'],eligible_room_ids:[String(roomOne.id)],allowed_period_template_keys:['single'],attributes:{kind:'ordinary_after_edit'},status:'active'}
    ]},token);
    const after=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${setup.id}`,null,token)).data.windows;
    expect(after).toHaveLength(1);
    expect(after[0].window_name).toBe('Monday Enrichment Window');
    expect(after[0].attributes.programme_window).toBe(true);
    expect(after[0].fingerprint).toBe(before.fingerprint);
  });
});
