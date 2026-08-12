'use strict';
var helper=require('../helpers/test-server');
describe('intelligence operational health',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('reports healthy contracts and visibly detects an unevidenced product',async function(){server=await helper.createTestServer('intelligence_health');var login=await server.makeRequest('POST','/api/auth/dev-login',{}),token=login.data.token;
 var healthy=await server.makeRequest('GET','/intelligence/health',null,token);expect(healthy.status).toBe(200);expect(healthy.data.health.status).toBe('healthy');expect(healthy.data.health.checks.find(function(c){return c.name==='provider_scheduling';}).detail.registered).toBe(4);
 var db=require('../../shared/services/db'),now=Date.now();db.query("INSERT INTO insight_products(id,product_type,scope_type,scope_id,title,summary,evidence,confidence,severity,status,audience,provider_id,provider_version,detected_at) VALUES ('invalid-health','observation','organisation','current','Invalid fixture','Fixture','[]',0.4,'information','detected','[]','test.health','1',?)",[now]);
 var degraded=await server.makeRequest('GET','/intelligence/health',null,token);expect(degraded.data.health.status).toBe('degraded');expect(degraded.data.health.checks.find(function(c){return c.name==='traceable_evidence';}).status).toBe('fail');expect(degraded.data.health.checks.find(function(c){return c.name==='uncertainty_reporting';}).status).toBe('fail');
});});
