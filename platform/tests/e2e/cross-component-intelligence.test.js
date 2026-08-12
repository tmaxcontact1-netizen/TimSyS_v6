'use strict';
var helper=require('../helpers/test-server');
describe('cross-component synthesis',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('finds conflicting dependencies and recognises clean transitions',async function(){server=await helper.createTestServer('cross_component');var db=require('../../shared/services/db'),now=Date.now();
 function entity(type,id,status,facts){db.query('INSERT INTO world_entities(entity_type,entity_id,owning_module,display_name,lifecycle_status,facts,data_quality,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)',[type,id,'fixture',type+' '+id,status,JSON.stringify(facts||{}),1,now,now]);}
 entity('student','withdrawn-with-item','withdrawn',{});entity('student','clean-withdrawal','withdrawn',{});entity('inventory_item','item-1','available',{});
 db.query("INSERT INTO world_relationships(id,subject_type,subject_id,relationship_type,object_type,object_id,provenance,confidence,created_at) VALUES ('cross-rel','inventory_item','item-1','assigned_to','student','withdrawn-with-item','{}',1,?)",[now]);
 var login=await server.makeRequest('POST','/api/auth/dev-login',{}),run=await server.makeRequest('POST','/intelligence/providers/core.cross-component/run',{from:now-86400000,to:now},login.data.token);
 expect(run.status).toBe(200);expect(run.data.run.conflicts).toBe(1);expect(run.data.run.cleanTransitions).toBe(1);
 var list=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,login.data.token),own=list.data.products.filter(function(p){return p.provider_id==='core.cross-component';});
 expect(own.map(function(p){return p.product_type;})).toEqual(expect.arrayContaining(['recommendation','observation']));expect(own.every(function(p){return p.evidence.length&&p.uncertainty;})).toBe(true);
 var portfolio=await server.makeRequest('GET','/intelligence/portfolio?scope_type=organisation&scope_id=current',null,login.data.token);expect(portfolio.status).toBe(200);expect(portfolio.data.portfolio.counts.positive).toBeGreaterThanOrEqual(1);expect(portfolio.data.portfolio.counts.attention).toBeGreaterThanOrEqual(1);expect(portfolio.data.portfolio.counts.total).toBe(portfolio.data.portfolio.positive.length+portfolio.data.portfolio.attention.length+portfolio.data.portfolio.neutral.length);
});});
