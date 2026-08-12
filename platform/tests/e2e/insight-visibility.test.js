'use strict';
var helper=require('../helpers/test-server');
describe('insight audience enforcement',function(){var server;afterEach(async function(){if(server)await server.cleanup();});
test('filters products and prevents acting on a hidden insight',async function(){server=await helper.createTestServer('insight_visibility');var products=require('../../shared/services/intelligence/products');
 function create(title,audience){return products.create({type:'observation',scope:{type:'organisation',id:'current'},title:title,summary:title,evidence:[{kind:'fixture'}],confidence:1,severity:'information',audience:audience,providerId:'test.visibility',providerVersion:'1'});}
 var visible=create('Developer view',['developer']),hidden=create('Student view',['student']);var login=await server.makeRequest('POST','/api/auth/dev-login',{}),token=login.data.token;
 var list=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,token),ids=list.data.products.map(function(p){return p.id;});expect(ids).toContain(visible);expect(ids).not.toContain(hidden);
 var denied=await server.makeRequest('POST','/intelligence/products/'+hidden+'/actions',{action:'dismissed'},token);expect(denied.status).toBe(404);
 var allowed=await server.makeRequest('POST','/intelligence/products/'+visible+'/actions',{action:'acknowledged',rationale:'Reviewed'},token);expect(allowed.status).toBe(200);expect(allowed.data.product.actions[0].actor_id).toBeTruthy();expect(allowed.data.product.actions[0].rationale).toBe('Reviewed');
});});
