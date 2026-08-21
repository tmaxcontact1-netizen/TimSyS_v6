'use strict';
const helper=require('../../helpers/test-server');
let context,token,setup,scope;
beforeAll(async()=>{
 context=await helper.createTestServer('scheduler_rules');token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;
 const year=(await context.makeRequest('POST','/academic-structure/years',{code:'2032-33',name:'2032/33',starts_on:'2032-08-01',ends_on:'2033-07-31'},token)).data.year;
 setup=(await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Rules School',scope_mode:'school'},token)).data.setup;scope=setup.scopes[0];
 await context.makeRequest('PUT','/scheduler/structures',{scheduler_setup_id:setup.id,cycle:{name:'Standard',week_count:1,week_labels:['Week']},period_templates:[{external_key:'single',name:'Single',duration_minutes:50}],day_patterns:[{scheduler_scope_id:scope.id,cycle_week:1,day_index:1,name:'Monday',periods:[{external_key:'p1',name:'Period 1',sequence:1,starts_at:'08:00',ends_at:'08:50',kind:'instruction',period_template_key:'single'}]}]},token);
});
afterAll(async()=>context.cleanup());

function rules(){return{scheduler_setup_id:setup.id,availability:[
 {external_key:'staff:esl:monday-meeting',entity_type:'staff',entity_ref:'staff:esl',state:'unavailable',cycle_week:1,day_index:1,starts_at:'10:00',ends_at:'11:00',reason:'Department meeting'},
 {external_key:'room:gym:maintenance',entity_type:'room',entity_ref:'room:gym',state:'unavailable',valid_from:'2032-10-01',valid_to:'2032-10-05',reason:'Planned maintenance'},
 {external_key:'resource:laptops:preferred',entity_type:'resource',entity_ref:'inventory:laptop-cart-1',state:'preferred',cycle_week:1,day_index:1,starts_at:'08:00',ends_at:'12:00',reason:'Cart is based in this section'}
],constraints:[
 {code:'CORE_BEFORE_LUNCH',name:'Core subjects before lunch',level:'soft',scope_type:'school',scope_ref:'school',rule_type:'time_window_preference',weight:8,parameters:{subject_categories:['core'],before:'12:00'},explanation_template:'Core subject scheduled after the preferred lunch boundary.'},
 {code:'NO_ELECTIVE_P1',name:'No electives first period',level:'hard',scope_type:'school',scope_ref:'school',rule_type:'excluded_period',parameters:{subject_categories:['elective'],period_keys:['p1']},explanation_template:'Electives cannot be scheduled in first period.'},
 {code:'PE_BEFORE_BREAK',name:'PE before breaks',level:'advisory',scope_type:'school',scope_ref:'school',rule_type:'adjacency_preference',weight:1,parameters:{subject_categories:['pe'],next_kinds:['break']},explanation_template:'Consider placing PE immediately before a break.'}
],travel_times:[
 {from_location_ref:'building:elementary',to_location_ref:'building:secondary',minutes:10,bidirectional:true,reason:'Normal walking time across campus'}
]};}

test('stores staff, room and resource availability with transparent philosophy rules',async()=>{let r=await context.makeRequest('PUT','/scheduler/rules',rules(),token);expect(r.status).toBe(200);expect(r.data.rules.availability).toHaveLength(3);expect(r.data.rules.constraints.map(x=>x.level)).toEqual(expect.arrayContaining(['hard','soft','advisory']));expect(r.data.rules.travel_times[0].minutes).toBe(10);r=await context.makeRequest('GET','/scheduler/rules?scheduler_setup_id='+setup.id,null,token);expect(r.data.rules.constraints.find(x=>x.code==='CORE_BEFORE_LUNCH').parameters.before).toBe('12:00');});

test('requires explanations and preserves valid rules atomically',async()=>{const invalid=rules();invalid.availability[0].reason='';let r=await context.makeRequest('PUT','/scheduler/rules',invalid,token);expect(r.status).toBe(400);expect(r.data.error.message).toMatch(/reason/);r=await context.makeRequest('GET','/scheduler/rules?scheduler_setup_id='+setup.id,null,token);expect(r.data.rules.availability).toHaveLength(3);});

test('rejects availability outside the configured rotation',async()=>{const invalid=rules();invalid.availability[0].cycle_week=2;const r=await context.makeRequest('PUT','/scheduler/rules',invalid,token);expect(r.status).toBe(400);expect(r.data.error.message).toMatch(/rotation/);});
