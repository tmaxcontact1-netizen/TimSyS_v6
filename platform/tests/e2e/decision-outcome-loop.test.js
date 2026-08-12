'use strict';
var helper=require('../helpers/test-server');
describe('human decision and outcome loop',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('preserves decision, action, reminder, outcome and cautious follow-up assessment',async function(){server=await helper.createTestServer('decision_outcome');var login=await server.makeRequest('POST','/api/auth/dev-login',{});var token=login.data.token;var now=Date.now(),day=86400000,ids=[];
 for(var i=0;i<6;i++){var made=await server.makeRequest('POST','/students',{student_id:'LOOP-'+i,first_name:'Loop',last_name:String(i),date_of_birth:'2012-01-01',sex:'Female'},token);ids.push(made.data.student.id);}
 for(var p=0;p<2;p++)await server.makeRequest('PUT','/students/'+ids[p]+'/withdraw',{reasonCode:'family_decision',effectiveAt:new Date(now-50*day+p*day).toISOString()},token);
 for(var c=2;c<6;c++)await server.makeRequest('PUT','/students/'+ids[c]+'/withdraw',{reasonCode:'family_decision',effectiveAt:new Date(now-10*day+c*day).toISOString()},token);
 var period={from:now-30*day,to:now,comparisonStart:now-60*day,comparisonEnd:now-30*day};var run=await server.makeRequest('POST','/intelligence/providers/core.withdrawal-patterns/run',period,token);var insightId=run.data.run.products[0];
 var decision=await server.makeRequest('POST','/intelligence/products/'+insightId+'/decisions',{action:'accepted',rationale:'Review the cases'},token);expect(decision.status).toBe(200);
 var action=await server.makeRequest('POST','/intelligence/actions',{insightId:insightId,decisionId:decision.data.decisionId,title:'Review withdrawal cases',ownerId:'principal',dueAt:now-day},token);expect(action.data.action.status).toBe('open');
 var reminders=await server.makeRequest('POST','/intelligence/reminders/generate',{at:now},token);expect(reminders.data.reminders[0].product_type).toBe('reminder');
 await server.makeRequest('PUT','/intelligence/actions/'+action.data.action.id,{status:'completed',completionNote:'Cases reviewed'},token);
 var outcome=await server.makeRequest('POST','/intelligence/outcomes',{insightId:insightId,decisionId:decision.data.decisionId,actionId:action.data.action.id,entityType:'organisation',entityId:'current',description:'Review completed'},token);
 var assessed=await server.makeRequest('POST','/intelligence/outcomes/'+outcome.data.outcome.id+'/assess',{metricId:'student.withdrawals.count',scope:{type:'organisation',id:'current'},baseline:{start:period.comparisonStart,end:period.comparisonEnd},followup:{start:period.from,end:period.to},lowerIsBetter:true},token);
 expect(assessed.data.assessment.assessment).toBe('worsened');expect(assessed.data.assessment.explanation).toContain('does not prove');
});});
