'use strict';
const helper=require('../../helpers/test-server');
let context,token,year;
beforeAll(async()=>{context=await helper.createTestServer('scheduler_setup');token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;year=(await context.makeRequest('POST','/academic-structure/years',{code:'2030-31',name:'2030/31',starts_on:'2030-08-01',ends_on:'2031-07-31'},token)).data.year;});
afterAll(async()=>context.cleanup());

test('creates and versions a whole-school setup with its mandatory scope',async()=>{
  let r=await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Whole School 2030/31',scope_mode:'school',timezone:'Asia/Riyadh',week_starts_on:7,configuration:{setup_answers:{friday_half_day:true}}},token);
  expect(r.status).toBe(200);expect(r.data.setup.version).toBe(1);expect(r.data.setup.scopes).toHaveLength(1);expect(r.data.setup.scopes[0].scope_type).toBe('school');
  r=await context.makeRequest('PUT','/scheduler/setup',{academic_year_id:year.id,name:'Selected Sections',scope_mode:'selected',timezone:'Asia/Riyadh',week_starts_on:7,configuration:{notes:'Secondary first'}},token);
  expect(r.data.setup.version).toBe(2);expect(r.data.setup.configuration.notes).toBe('Secondary first');
});

test('supports provider-neutral selected scopes and auditable lifecycle',async()=>{
  const setup=(await context.makeRequest('GET','/scheduler/setup?academic_year_id='+year.id,null,token)).data.setup;
  let r=await context.makeRequest('POST','/scheduler/scopes',{scheduler_setup_id:setup.id,external_key:'section:secondary',scope_type:'section',scope_ref:'secondary',name:'Secondary School',configuration:{campus:'main'}},token);
  expect(r.status).toBe(200);expect(r.data.scope.scope_ref).toBe('secondary');const id=r.data.scope.id;
  r=await context.makeRequest('PUT','/scheduler/scopes/'+id+'/withdraw',{},token);expect(r.data.scope.status).toBe('withdrawn');
  r=await context.makeRequest('PUT','/scheduler/scopes/'+id+'/reinstate',{},token);expect(r.data.scope.status).toBe('active');
  r=await context.makeRequest('GET','/scheduler/scopes?scheduler_setup_id='+setup.id+'&status=active',null,token);expect(r.data.scopes.map(x=>x.external_key)).toContain('section:secondary');
});

test('rejects invalid or duplicate scope identities',async()=>{
  const setup=(await context.makeRequest('GET','/scheduler/setup?academic_year_id='+year.id,null,token)).data.setup;
  let r=await context.makeRequest('POST','/scheduler/scopes',{scheduler_setup_id:setup.id,external_key:'bad',scope_type:'unknown',scope_ref:'x',name:'Bad'},token);expect(r.status).toBe(400);
  r=await context.makeRequest('POST','/scheduler/scopes',{scheduler_setup_id:setup.id,external_key:'another-key',scope_type:'section',scope_ref:'secondary',name:'Duplicate'},token);expect(r.status).toBe(409);
});
