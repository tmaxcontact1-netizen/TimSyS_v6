'use strict';
var helper=require('../helpers/test-server');var Database=require('better-sqlite3');
describe('engine operations and generality',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('backfills declared sources with an explicit boundary and runs governed positive providers',async function(){server=await helper.createTestServer('engine_operations');var login=await server.makeRequest('POST','/api/auth/dev-login',{}),token=login.data.token;
 await server.makeRequest('POST','/rooms',{room_number:'POS-1',capacity:20},token);await server.makeRequest('POST','/inventory',{item_name:'Projector',item_number:'POS-I1'},token);
 var quality=await server.makeRequest('POST','/intelligence/providers/core.registry-quality/run',{},token);var strengths=await server.makeRequest('POST','/intelligence/providers/core.operational-strengths/run',{},token);expect(quality.status).toBe(200);expect(strengths.status).toBe(200);expect(strengths.data.run.products.length).toBe(2);
 var providers=await server.makeRequest('GET','/intelligence/providers',null,token);expect(providers.data.providers).toHaveLength(4);expect(providers.data.providers.every(function(p){return p.governance&&p.governance.confidenceMethod;})).toBe(true);
 var db=new Database(server.dbPath,{readonly:true});var backfill=db.prepare("SELECT * FROM world_model_backfills ORDER BY started_at DESC LIMIT 1").get();var fabricated=db.prepare("SELECT COUNT(*) total FROM event_store WHERE source='backfill'").get();db.close();expect(backfill.status).toMatch(/^completed/);expect(backfill.boundary_at).toBeTruthy();expect(fabricated.total).toBe(0);
});});
