'use strict';
const {createTestServer}=require('../helpers/test-server');
let server,token;
beforeAll(async()=>{server=await createTestServer('execution_http');const login=await server.makeRequest('POST','/api/auth/dev-login',{});expect(login.status).toBe(200);token=login.data.token;},60000);
afterAll(async()=>{if(server)await server.cleanup();});
test('module is registered, assigned and usable through authenticated HTTP',async()=>{
 const list=await server.makeRequest('GET','/modules/list-for-app?appId=principal-ed',null,token);expect(list.status).toBe(200);expect(list.data.data.find(m=>m.name==='execution').enabled).toBe(true);
 const created=await server.makeRequest('POST','/execution/instances',{title:'HTTP synthetic plan',timezone:'Asia/Riyadh',command_id:'http-create'},token);expect(created.status).toBe(200);expect(created.data.instance.lifecycle).toBe('planning');
 const id=created.data.instance.id;
 const add=await server.makeRequest('POST',`/execution/instances/${id}/commands`,{type:'task.add',data:{title:'Plan title'},command_id:'http-add',expected_revision:1},token);expect(add.status).toBe(200);expect(add.data.instance.tasks[0].title).toBe('Plan title');
 const stale=await server.makeRequest('POST',`/execution/instances/${id}/commands`,{type:'task.add',data:{title:'Stale'},command_id:'http-stale',expected_revision:1},token);expect(stale.status).toBe(409);
 const get=await server.makeRequest('GET',`/execution/instances/${id}`,null,token);expect(get.data.instance.tasks).toHaveLength(1);
});
