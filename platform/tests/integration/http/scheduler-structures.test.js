'use strict';
const helper=require('../../helpers/test-server');
let context,token,setup,elementary,secondary;
beforeAll(async()=>{
  context=await helper.createTestServer('scheduler_structures');token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
  const year=(await context.makeRequest('POST','/academic-structure/years',{code:'2031-32',name:'2031/32',starts_on:'2031-08-01',ends_on:'2032-07-31'},token)).data.year;
  setup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Mixed School',scope_mode:'selected'},token)).data.setup;
  elementary=(await context.makeRequest('POST','/scheduler/scopes',{scheduler_setup_id:setup.id,external_key:'section:elementary',scope_type:'section',scope_ref:'elementary',name:'Elementary'},token)).data.scope;
  secondary=(await context.makeRequest('POST','/scheduler/scopes',{scheduler_setup_id:setup.id,external_key:'section:secondary',scope_type:'section',scope_ref:'secondary',name:'Secondary'},token)).data.scope;
});
afterAll(async()=>context.cleanup());

function structures(){return{
  scheduler_setup_id:setup.id,
  cycle:{name:'A/B Rotation',week_count:2,week_labels:['A Week','B Week']},
  period_templates:[
    {external_key:'elementary-single',name:'Elementary period',duration_minutes:45,multiplier:1},
    {external_key:'secondary-block',name:'Secondary block',duration_minutes:90,multiplier:2},
    {external_key:'break',name:'Break',duration_minutes:20,multiplier:1}
  ],
  day_patterns:[
    {scheduler_scope_id:elementary.id,cycle_week:1,day_index:1,name:'Elementary Monday',periods:[
      {external_key:'p1',name:'Period 1',sequence:1,starts_at:'08:00',ends_at:'08:45',kind:'instruction',period_template_key:'elementary-single'},
      {external_key:'break',name:'Break',sequence:2,starts_at:'08:45',ends_at:'09:05',kind:'break',counts_as_instruction:false,period_template_key:'break'}]},
    {scheduler_scope_id:secondary.id,cycle_week:1,day_index:1,name:'Secondary A Monday',periods:[
      {external_key:'a1',name:'Block 1',sequence:1,starts_at:'08:00',ends_at:'09:30',kind:'instruction',period_template_key:'secondary-block'}]},
    {scheduler_scope_id:secondary.id,cycle_week:2,day_index:5,name:'Secondary B Friday Half Day',periods:[
      {external_key:'b1',name:'Block 1',sequence:1,starts_at:'08:00',ends_at:'09:30',kind:'instruction',period_template_key:'secondary-block'},
      {external_key:'meeting',name:'Department meeting',sequence:2,starts_at:'09:40',ends_at:'10:30',kind:'meeting',counts_as_instruction:false}]}
  ]
};}

test('persists different section timetables, A/B weeks, breaks and half days',async()=>{
  let r=await context.makeRequest('PUT','/scheduler/structures',structures(),token);expect(r.status).toBe(200);expect(r.data.structures.cycle.week_labels).toEqual(['A Week','B Week']);expect(r.data.structures.day_patterns).toHaveLength(3);
  r=await context.makeRequest('GET','/scheduler/structures?scheduler_setup_id='+setup.id,null,token);const friday=r.data.structures.day_patterns.find(x=>x.name.includes('Friday'));expect(friday.periods).toHaveLength(2);expect(friday.periods[1].counts_as_instruction).toBe(false);
});

test('rejects overlap and preserves the last valid structure atomically',async()=>{
  const invalid=structures();invalid.day_patterns[0].periods[1].starts_at='08:30';
  let r=await context.makeRequest('PUT','/scheduler/structures',invalid,token);expect(r.status).toBe(400);expect(r.data.error.message).toMatch(/overlap/);
  r=await context.makeRequest('GET','/scheduler/structures?scheduler_setup_id='+setup.id,null,token);expect(r.data.structures.day_patterns).toHaveLength(3);
});

test('rejects a day outside the configured rotation',async()=>{const invalid=structures();invalid.day_patterns[0].cycle_week=3;const r=await context.makeRequest('PUT','/scheduler/structures',invalid,token);expect(r.status).toBe(400);expect(r.data.error.message).toMatch(/rotation/);});
