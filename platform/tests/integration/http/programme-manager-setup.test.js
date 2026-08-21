'use strict';
const helper=require('../../helpers/test-server');

describe('Programme Manager nested setup',()=>{
  let context,token,year,schedulerSetup,schedulerScope,programme,window;
  beforeAll(async()=>{
    context=await helper.createTestServer('programme_manager_setup');
    token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
    year=(await context.makeRequest('POST','/academic-structure/years',{code:'2042-43',name:'2042–43',starts_on:'2042-08-01',ends_on:'2043-07-31'},token)).data.year;
    schedulerSetup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Programme Setup School',scope_mode:'school'},token)).data.setup;
    schedulerScope=schedulerSetup.scopes[0];
    await context.makeRequest('PUT','/scheduler/structures',{scheduler_setup_id:schedulerSetup.id,cycle:{name:'Week',week_count:1,week_labels:['Week']},period_templates:[{external_key:'single',name:'Single',duration_minutes:50}],day_patterns:[{scheduler_scope_id:schedulerScope.id,cycle_week:1,day_index:1,name:'Monday',periods:[{external_key:'p1',name:'P1',sequence:1,starts_at:'08:00',ends_at:'08:50',kind:'instruction',period_template_key:'single'}]}]},token);
    await context.makeRequest('PUT','/scheduler/requirements',{scheduler_setup_id:schedulerSetup.id,requirements:[{external_key:'window:activities',academic_year_id:String(year.id),teaching_group_external_key:'window:activities',name:'Activities Window',occurrences_per_cycle:1,duration_minutes:50,allowed_period_template_keys:['single'],attributes:{programme_window:true,programme_category:'activities'},status:'active'}]},token);
    let version=(await context.makeRequest('POST','/scheduler/generate',{scheduler_setup_id:schedulerSetup.id,alternative_count:1},token)).data.versions[0];
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/select`,{},token)).data.version;
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/submit`,{reason:'Ready'},token)).data.version;
    version=(await context.makeRequest('PUT',`/scheduler/versions/${version.id}/approve`,{reason:'Approved'},token)).data.version;
    await context.makeRequest('PUT',`/scheduler/versions/${version.id}/publish`,{reason:'Published'},token);
    window=(await context.makeRequest('GET',`/programme-manager/scheduler-windows?scheduler_setup_id=${schedulerSetup.id}`,null,token)).data.windows[0];
    programme=(await context.makeRequest('POST','/programme-manager/programmes',{external_key:'activities:t1',academic_year_id:year.id,name:'Term 1 Activities',programme_type:'activities',operating_mode:'timetabled'},token)).data.programme;
  });
  afterAll(async()=>{if(context)await context.cleanup();});

  test('publishes the ordered setup questions and starts resumably',async()=>{
    const schema=await context.makeRequest('GET','/programme-manager/setup-schema',null,token);
    expect(schema.status).toBe(200);
    expect(schema.data.schema.ordered_steps).toEqual(['purpose','timing','location','participation','governance']);
    expect(schema.data.schema.principles).toMatchObject({scheduler_controls_time_and_availability:true,setup_does_not_allocate:true,human_confirmation_required:true});
    const setup=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}/setup`,null,token);
    expect(setup.data.setup).toMatchObject({status:'in_progress',current_step:'purpose',revision:0,readiness:{percent:0}});
  });

  test('blocks incomplete confirmation and invalid Scheduler windows',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup-confirmation`,{expected_revision:0,confirm:true,reason:'Too soon'},token);
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe('SETUP_INCOMPLETE');
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/timing`,{expected_revision:0,answers:{scheduler_setup_id:schedulerSetup.id,scheduler_window_ids:['999999']}},token);
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe('SCHEDULER_WINDOW_INVALID');
  });

  test('saves validated nested answers with revision protection',async()=>{
    const answers={
      purpose:{summary:'A broad activities programme',intended_outcome:'Place students into suitable activities',programme_categories:['activities']},
      timing:{scheduler_setup_id:schedulerSetup.id,scheduler_window_ids:[String(window.id)]},
      location:{strategy:'select_from_scheduler_availability',requirements:['Suitable activity space']},
      participation:{participant_type:'student',scope:'cross_grade',respondent_mode:'student_parent',scope_notes:'Grades 6–8'},
      governance:{owner_staff_ids:[],submitter_roles:['student','parent'],amendment_roles:['student','parent'],manual_edit_roles:['programme_admin']}
    };
    let revision=0;
    for(const step of ['purpose','timing','location','participation','governance']){
      const r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/${step}`,{expected_revision:revision,answers:answers[step]},token);
      expect(r.status).toBe(200);
      revision=r.data.setup.revision;
    }
    let r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/purpose`,{expected_revision:0,answers:answers.purpose},token);
    expect(r.status).toBe(409);
    r=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}/setup`,null,token);
    expect(r.data.setup).toMatchObject({status:'ready',current_step:'review',revision:5,readiness:{ready:true,percent:100}});
    expect(r.data.setup.timing.scheduler_window_ids).toEqual([String(window.id)]);
  });

  test('requires explicit human confirmation and configures without allocating',async()=>{
    let r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup-confirmation`,{expected_revision:5,confirm:false,reason:'Review complete'},token);
    expect(r.status).toBe(409);
    expect(r.data.error.code).toBe('HUMAN_CONFIRMATION_REQUIRED');
    r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup-confirmation`,{expected_revision:5,confirm:true,reason:'Configuration reviewed and approved'},token);
    expect(r.status).toBe(200);
    expect(r.data.setup).toMatchObject({status:'confirmed',current_step:'complete',revision:6,confirmed_by:expect.any(String)});
    expect(r.data.programme).toMatchObject({status:'configured',respondent_mode:'student_parent'});
    expect(r.data.setup).not.toHaveProperty('allocations');
  });

  test('audits every answer and reopens confirmation after a revision',async()=>{
    let history=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}/setup-history?limit=500`,null,token);
    expect(history.data.limit).toBe(50);
    expect(history.data.history).toHaveLength(6);
    expect(history.data.history[0].action).toBe('confirmed');
    const r=await context.makeRequest('PUT',`/programme-manager/programmes/${programme.id}/setup/location`,{expected_revision:6,answers:{strategy:'mixed',requirements:['Indoor or outdoor space']}},token);
    expect(r.status).toBe(200);
    expect(r.data.setup).toMatchObject({status:'ready',revision:7,confirmed_by:null});
    const current=await context.makeRequest('GET',`/programme-manager/programmes/${programme.id}`,null,token);
    expect(current.data.programme.status).toBe('draft');
  });
});
