'use strict';
const helper=require('../../helpers/test-server');
describe('Teacher Preferences foundation',()=>{let context,token;beforeAll(async()=>{context=await helper.createTestServer('teacher_preferences_foundation');token=(await context.makeRequest('POST','/api/auth/dev-login',{})).data.token;});afterAll(async()=>{if(context)await context.cleanup();});
 test('publishes an advisory-only provider contract',async()=>{const r=await context.makeRequest('GET','/teacher-preferences/contract',null,token);expect(r.status).toBe(200);expect(r.data.contract).toMatchObject({provider:'teacher_preferences',authority:'advisory_only',human_confirmation_required:true,qualification_is_preference:false});expect(r.data.contract.stances).toContain('declared_restriction');});
 test('provides a paginated empty feed before preferences are collected',async()=>{const r=await context.makeRequest('GET','/teacher-preferences/provider-records',null,token);expect(r.status).toBe(200);expect(r.data).toMatchObject({provider:'teacher_preferences',authority:'advisory_only',records:[],total:0,page:1,limit:50});});
});
