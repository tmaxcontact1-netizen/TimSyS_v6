'use strict';
var helper=require('../helpers/test-server');
describe('data-quality intelligence',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('reports stale, contradictory, broken and duplicate data with evidence',async function(){
 server=await helper.createTestServer('data_quality_intelligence');var db=require('../../shared/services/db'),now=Date.now(),old=new Date(now-400*86400000).toISOString();
 function entity(type,id,facts){db.query('INSERT INTO world_entities(entity_type,entity_id,owning_module,display_name,lifecycle_status,facts,data_quality,first_seen_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?,?)',[type,id,'fixture',type+' '+id,'active',JSON.stringify(facts),1,now,now]);}
 entity('student','dq-1',{student_id:'DUP-1',first_name:'One',updated_at:old});entity('student','dq-2',{student_id:'DUP-1',first_name:'Two',updated_at:old});
 entity('inventory_item','dq-item',{item_number:'DQ-I',item_name:'Shared',assigned_to_staff_id:3,assigned_to_student_id:4,updated_at:old});
 db.query("INSERT INTO world_relationships(id,subject_type,subject_id,relationship_type,object_type,object_id,provenance,confidence,created_at) VALUES ('dq-rel','inventory_item','dq-item','assigned_to','staff','missing','{}',1,?)",[now]);
 var login=await server.makeRequest('POST','/api/auth/dev-login',{}),run=await server.makeRequest('POST','/intelligence/providers/core.registry-quality/run',{from:now-86400000,to:now},login.data.token);
 expect(run.status).toBe(200);expect(run.data.run.issues).toEqual({stale:3,contradictory:1,brokenRelationships:1,duplicates:1});
 var list=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,login.data.token),titles=list.data.products.map(function(p){return p.title;});
 expect(titles).toEqual(expect.arrayContaining(['Some records may be stale','Contradictory record states detected','Broken entity relationships detected','Duplicate identifiers detected']));
 expect(list.data.products.filter(function(p){return titles.indexOf(p.title)>=0;}).every(function(p){return p.evidence.length>0&&p.uncertainty!==undefined;})).toBe(true);
});});
