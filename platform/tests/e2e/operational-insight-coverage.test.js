'use strict';
const helper=require('../helpers/test-server');

describe('canonical operational insight coverage',function(){
  let server;
  afterEach(async function(){if(server)await server.cleanup();});

  test('publishes component footprints and principal workflow queues into the canonical store',async function(){
    server=await helper.createTestServer('operational_insight_coverage');
    const login=await server.makeRequest('POST','/api/auth/dev-login',{}),token=login.data.token;
    const student=await server.makeRequest('POST','/students',{student_id:'OPS-1',first_name:'Insight',last_name:'Coverage',date_of_birth:'2012-01-01',sex:'Female',current_grade_level:'8'},token);
    expect(student.status).toBe(200);
    const db=require('../../shared/services/db');
    db.query("INSERT INTO student_exits(app_id,student_id,exit_type_code,movement_mode,status,created_by) VALUES('principal-ed','OPS-1','bathroom','routine','checked_out','fixture')");

    const footprint=await server.makeRequest('POST','/intelligence/providers/core.component-operations/run',{},token);
    expect(footprint.status).toBe(200);
    expect(footprint.data.run.components.student_registry.records).toBeGreaterThanOrEqual(1);
    const operations=await server.makeRequest('POST','/intelligence/providers/principal.operations/run',{},token);
    expect(operations.status).toBe(200);
    expect(operations.data.run.queues.unresolvedStudentExits).toBe(1);

    const products=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,token);
    const providers=new Set(products.data.products.map(function(product){return product.provider_id;}));
    expect(providers.has('core.component-operations')).toBe(true);
    expect(providers.has('principal.operations')).toBe(true);
    expect(products.data.products.find(function(product){return product.provider_id==='principal.operations';}).evidence.length).toBeGreaterThan(0);

    db.query("UPDATE student_exits SET status='checked_in' WHERE student_id='OPS-1'");
    const refreshed=await server.makeRequest('POST','/intelligence/providers/principal.operations/run',{},token);
    expect(refreshed.status).toBe(200);
    expect(refreshed.data.run.supersededProducts).toBeGreaterThanOrEqual(1);
    const current=await server.makeRequest('GET','/intelligence/products?scope_type=organisation&scope_id=current',null,token);
    expect(current.data.products.filter(function(product){return product.provider_id==='principal.operations'&&product.status!=='superseded';})).toHaveLength(0);
  });
});
