'use strict';
var helper=require('../helpers/test-server');
describe('historical intelligence provider',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('compares equal periods and produces evidence-backed products and metrics',async function(){
 server=await helper.createTestServer('historical_intelligence');var login=await server.makeRequest('POST','/api/auth/dev-login',{});var token=login.data.token;var now=Date.now();var day=86400000;var created=[];
 for(var i=0;i<6;i++){var response=await server.makeRequest('POST','/students',{student_id:'HIST-'+i,first_name:'Student',last_name:String(i),date_of_birth:'2012-01-01',sex:'Female',current_grade_level:i<4?'8':'9'},token);created.push(response.data.student.id);}
 for(var p=0;p<2;p++)await server.makeRequest('PUT','/students/'+created[p]+'/withdraw',{reasonCode:'unknown',effectiveAt:new Date(now-50*day+p*day).toISOString()},token);
 for(var c=2;c<6;c++)await server.makeRequest('PUT','/students/'+created[c]+'/withdraw',{reasonCode:'family_decision',effectiveAt:new Date(now-10*day+c*day).toISOString()},token);
 var run=await server.makeRequest('POST','/intelligence/providers/core.withdrawal-patterns/run',{from:now-30*day,to:now,comparisonStart:now-60*day,comparisonEnd:now-30*day},token);
 expect(run.status).toBe(200);expect(run.data.run.analysed).toBe(4);expect(run.data.run.comparisonCount).toBe(2);expect(run.data.run.products.length).toBeGreaterThanOrEqual(3);
 var list=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,token);expect(list.data.products.some(function(p){return p.product_type==='alert';})).toBe(true);expect(list.data.products.every(function(p){return p.evidence.length>0;})).toBe(true);
 var series=await server.makeRequest('GET','/intelligence/metrics/student.withdrawals.count?scope_type=organisation&scope_id=current',null,token);var runPoints=series.data.points.filter(function(point){return point.provider_run_id===run.data.run.runId;});expect(runPoints.length).toBe(2);
});});
