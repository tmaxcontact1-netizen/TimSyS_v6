'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager offerings, eligibility, capacity, and constraints',()=>{
  let context,token,year,schedulerSetup,schedulerScope,window,programme,offeringOne,offeringTwo,roomOne,roomTwo,resource;
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_offerings');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2046-47',name:'2046–47',starts_on:'2046-08-01',ends_on:'2047-07-31'},token)).data.year;
    for(const staff of [{staff_id:'OF-T1',first_name:'Ava',last_name:'Able'},{staff_id:'OF-T2',first_name:'Una',last_name:'Unavailable'},{staff_id:'OF-T3',first_name:'Sam',last_name:'Spare'}])await context.makeRequest('POST','/staff',{...staff,job_title:'Teacher',hire_date:'2030-08-01'},token);
    roomOne=(await context.makeRequest('POST','/rooms',{room_number:'OF-R1',capacity:24,room_type:'classroom'},token)).data.room;
    roomTwo=(await context.makeRequest('POST','/rooms',{room_number:'OF-R2',capacity:20,room_type:'classroom'},token)).data.room;
    resource=(await context.makeRequest('POST','/inventory',{item_name:'Activity Kit',item_number:'OF-KIT',category:'equipment',quantity:2},token)).data.item;
    schedulerSetup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Offering School',scope_mode:'school'},token)).data.setup;
    schedulerScope=schedulerSetup.scopes[0];
    await context.makeRequest('PUT','/scheduler/structures',{scheduler_setup_id:schedulerSetup.id,cycle:{name:'Week',week_count:1,week_labels:['Week']},period_templates:[{external_key:'single',name:'Single',duration_minutes:50}],day_patterns:[{scheduler_scope_id:schedulerScope.id,cycle_week:1,day_index:1,name:'Monday',periods:[{external_key:'p1',name:'P1',sequence:1,starts_at:'08:00',ends_at:'08:50',kind:'instruction',period_template_key:'single'}]}]},token);
    await context.makeRequest('PUT','/scheduler/rules',{scheduler_setup_id:schedulerSetup.id,availability:[{external_key:'of-t2-off',entity_type:'staff',entity_ref:'OF-T2',state:'unavailable',cycle_week:1,day_index:1,starts_at:'08:00',ends_at:'09:00',reason:'Leadership duty'}],constraints:[],travel_times:[]},token);
    await context.makeRequest('PUT','/scheduler/requirements',{scheduler_setup_id:schedulerSetup.id,requirements:[{external_key:'window:offerings',academic_year_id:String(year.id),teaching_group_external_key:'window:offerings',name:'Offering Window',occurrences_per_cycle:1,duration_minutes:50,eligible_staff_ids:['OF-T1','OF-T2','OF-T3'],eligible_room_ids:[String(roomOne.id),String(roomTwo.id)],eligible_resource_ids:[String(resource.id)],allowed_period_template_keys:['single'],attributes:{programme_window:true,programme_category:'activities'},status:'active'}]},token);
    let version=(await context.makeRequest('POST','/scheduler/generate',{scheduler_setup_id:schedulerSetup.id,alternative_count:1},token)).data.versions[0];
    for(const [action,body] of [['select',{}],['submit',{reason:'Ready'}],['approve',{reason:'Approved'}],['publish',{reason:'Published'}]])version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/${action}`,body,token)).data.version;
    window=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${schedulerSetup.id}`,null,token)).data.windows[0];
    programme=(await context.makeRequest('POST','/programme-manager/programmes',{external_key:'offerings:t1',academic_year_id:year.id,name:'Term 1 Offerings',programme_type:'activities',operating_mode:'timetabled'},token)).data.programme;
    const setupAnswers={purpose:{summary:'Student activities',intended_outcome:'Place students into activities'},timing:{scheduler_setup_id:schedulerSetup.id,scheduler_window_ids:[String(window.id)]},location:{strategy:'select_from_scheduler_availability'},participation:{participant_type:'student',scope:'cross_grade',respondent_mode:'student'},governance:{submitter_roles:['student'],amendment_roles:['student'],manual_edit_roles:['programme_admin']}};
    let revision=0;for(const step of ['purpose','timing','location','participation','governance']){const result=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/${step}`,{expected_revision:revision,answers:setupAnswers[step]},token);revision=result.data.setup.revision;}
    const confirmed=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup-confirmation`,{expected_revision:revision,confirm:true,reason:'Programme setup approved'},token);programme=confirmed.data.programme;
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('creates a hard-capacity draft and explains missing facilitator readiness',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'robotics',name:'Robotics',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:20},eligibility:{open_to_all:false,include:{grade_ids:['7','8']}}},token);
    expect(r.status).toBe(200);offeringOne=r.data.offering;
    expect(offeringOne).toMatchObject({status:'draft',capacity:{minimum:0,maximum:20,mode:'hard',hard:true},readiness:{ready:false}});
    expect(offeringOne.readiness.blockers[0].code).toBe('FACILITATOR_REQUIRED');
    r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}/confirm`,{expected_revision:offeringOne.revision,confirm:true,reason:'Ready'},token);
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe('OFFERING_NOT_READY');
  });

  test('rejects unavailable assignments, then confirms against live Scheduler evidence',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}`,{expected_revision:offeringOne.revision,assignments:{staff:['OF-T2']}},token);
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe('ASSIGNMENT_UNAVAILABLE');
    r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}`,{expected_revision:offeringOne.revision,assignments:{staff:['OF-T1'],room:[String(roomOne.id)],resource:[{entity_ref:String(resource.id),quantity:1}]}},token);
    expect(r.status).toBe(200);offeringOne=r.data.offering;
    expect(offeringOne.readiness.ready).toBe(true);
    r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}/confirm`,{expected_revision:offeringOne.revision,confirm:true,reason:'Offering checked by programme lead'},token);
    expect(r.status).toBe(200);offeringOne=r.data.offering;
    expect(offeringOne).toMatchObject({status:'ready'});
    expect(offeringOne).not.toHaveProperty('human_confirmation');
    expect(r.data.human_confirmation).toBe(true);
  });

  test('prevents cross-offering staff, room, and resource conflicts',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'coding',name:'Coding',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:18},assignments:{staff:['OF-T1']}},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('OFFERING_ASSIGNMENT_CONFLICT');
    r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'coding',name:'Coding',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:18},assignments:{staff:['OF-T3'],room:[String(roomTwo.id)],resource:[{entity_ref:String(resource.id),quantity:2}]}},token);
    expect(r.status).toBe(409);expect(r.data.error.code).toBe('OFFERING_RESOURCE_CONFLICT');
  });

  test('records offering dependencies and exposes the programme graph',async()=>{
    let r=await context.makeRequest('POST',`/programme-manager/programmes/${programme.id}/offerings`,{external_key:'coding',name:'Coding',scheduler_setup_id:schedulerSetup.id,scheduler_window_id:String(window.id),capacity:{maximum:18},capacity_mode:'hard',constraints:{prerequisite_offering_ids:[String(offeringOne.id)]},assignments:{staff:['OF-T3'],room:[String(roomTwo.id)],resource:[{entity_ref:String(resource.id),quantity:1}]}},token);
    expect(r.status).toBe(200);offeringTwo=r.data.offering;
    const graph=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}/offering-graph`,null,token);
    expect(graph.data.graph.nodes).toHaveLength(2);
    expect(graph.data.graph.edges).toEqual([expect.objectContaining({from:String(offeringTwo.id),to:String(offeringOne.id),type:'requires',hard:true})]);
    expect(graph.data.graph.human_decision_required).toBe(true);
    const cycle=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}`,{expected_revision:offeringOne.revision,constraints:{prerequisite_offering_ids:[String(offeringTwo.id)]}},token);
    expect(cycle.status).toBe(409);
    expect(cycle.data.error.code).toBe('OFFERING_DEPENDENCY_CYCLE');
  });

  test('withdraws with a reason and reinstates as draft for fresh validation',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}/withdraw`,{expected_revision:offeringOne.revision,reason:'Offering paused'},token);
    expect(r.status).toBe(200);expect(r.data.offering.status).toBe('withdrawn');
    r=await context.makeRequest('PUT',`/programme-manager/offerings/${offeringOne.id}/reinstate`,{expected_revision:r.data.offering.revision,reason:'Offering restored'},token);
    expect(r.data.offering.status).toBe('draft');
    const history=await context.makeRequest('GET',`/programme-manager/offerings/${offeringOne.id}/history?limit=500`,null,token);
    expect(history.data.limit).toBe(50);
    expect(history.data.history.map(x=>x.action)).toEqual(['reinstated','withdrawn','confirmed','revised','created']);
  });
});
