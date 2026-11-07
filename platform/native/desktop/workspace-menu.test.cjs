const {test}=require('node:test');
const assert=require('node:assert/strict');
const {workspaceMenu,popoutTarget}=require('./workspace-menu.cjs');
test('the same File / AI integration order separates Back, launcher return and Close',()=>{
  const calls=[];const menu=workspaceMenu(Object.fromEntries(['back','launcher','assistant','settings','close'].map(k=>[k,()=>calls.push(k)])));
  assert.deepEqual(menu.slice(0,2).map(i=>i.label),['File','AI integration']);
  menu[0].submenu.find(i=>i.label==='Back').click();assert.deepEqual(calls,['back']);
  menu[0].submenu.find(i=>i.label==='Return to launcher').click();assert.deepEqual(calls,['back','launcher']);
  menu[1].submenu.find(i=>i.label==='Connections and models…').click();assert.deepEqual(calls,['back','launcher','settings']);
});
test('workspace pop-outs preserve the authorised local route and reject foreign or privileged destinations',()=>{
  const base='http://127.0.0.1:50123';
  assert.equal(popoutTarget(base+'/app/principaled?execution_view=mine',base),base+'/app/principaled?execution_view=mine');
  assert.equal(popoutTarget(base+'/modules',base),base+'/modules');
  assert.equal(popoutTarget(base+'/app/principal-ed',base),base+'/app/principal-ed');
  assert.equal(popoutTarget(base+'/app/builder',base),base+'/app/builder');
  for(const address of ['https://example.com/app/principaled',base+'/assistant',base+'/api/admin',base+'/app/principaled/../../assistant','http://user:secret@127.0.0.1:50123/app/principaled','file:///app/principaled'])assert.throws(()=>popoutTarget(address,base));
});
