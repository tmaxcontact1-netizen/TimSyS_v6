const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('./domain');
function fixture(){let s=D.apply(D.empty(),{action:'createClass',name:'Synthetic class'});const id=s.classes[0].id;s=D.apply(s,{action:'addStudent',classId:id,quarter:1,name:'Synthetic learner',pronoun:'they'});return s;}
test('empty workspace, setup, invalid inputs and quarter isolation',()=>{
 assert.deepEqual(D.empty().classes,[]);let s=fixture(),c=s.classes[0];assert.equal(c.categories.length,5);assert.ok(c.categories.every(c=>!c.options.length));
 s=D.apply(s,{action:'copyRoster',classId:c.id,quarter:2,fromQuarter:1});assert.notEqual(s.classes[0].quarters[0][0].id,s.classes[0].quarters[1][0].id);
 assert.equal(s.classes[0].quarters[1][0].personal,null);assert.throws(()=>D.apply(s,{action:'copyRoster',classId:c.id,quarter:2,fromQuarter:1}));
 assert.throws(()=>D.apply(s,{action:'addStudent',classId:c.id,quarter:0,name:'X',pronoun:'they'}));assert.throws(()=>D.apply(s,{action:'target',quarter:1,value:-1}));
 assert.throws(()=>D.apply(s,{action:'bank',classId:c.id,categories:c.categories.map(cat=>({...cat,options:[{text:'{unknown}'}]}))}));
});
test('bank removal retains unresolved identity and personal wording; deletion stays scoped',async()=>{
 const U=await import('../../../apps/principaled/src/dashboard/widgets/comment-builder-utils.mjs');
 let s=fixture(),c=s.classes[0];s=D.apply(s,{action:'bank',classId:c.id,categories:c.categories.map((cat,i)=>({...cat,options:i?[]:[{text:'{name} can explain the answer.'}]}))});c=s.classes[0];const student=c.quarters[0][0];
 s=D.apply(s,{action:'comment',classId:c.id,quarter:1,studentId:student.id,selections:[c.categories[0].options[0].id,null,null,null,null],personal:'Personal wording.'});
 s=D.apply(s,{action:'bank',classId:c.id,categories:c.categories.map(cat=>({...cat,options:[]}))});c=s.classes[0];assert.equal(U.unresolved(c,c.quarters[0][0]).length,1);assert.equal(c.quarters[0][0].personal,'Personal wording.');assert.equal(U.generated(c,c.quarters[0][0]),'');
 s=D.apply(s,{action:'copyRoster',classId:c.id,quarter:2,fromQuarter:1});s=D.apply(s,{action:'deleteStudent',classId:c.id,quarter:1,studentId:student.id,confirmId:student.id});assert.equal(s.classes[0].quarters[0].length,0);assert.equal(s.classes[0].quarters[1].length,1);
 assert.throws(()=>D.apply(s,{action:'deleteClass',classId:c.id,confirmId:'wrong'}));s=D.apply(s,{action:'deleteClass',classId:c.id,confirmId:c.id});assert.equal(s.classes.length,0);
});
test('wording, CSV and advisory checks preserve text safely',async()=>{
 const U=await import('../../../apps/principaled/src/dashboard/widgets/comment-builder-utils.mjs');let c=fixture().classes[0],s=c.quarters[0][0];
 assert.equal(U.fill('{name}: {heCap} uses {his} notes.',s),'Synthetic learner: They uses their notes.');
 s.name='=SUM(1,2)';s.personal='A "quote", then\na line.';const csv=U.csv(c,1);assert.ok(csv.includes("'=SUM(1,2)"));assert.ok(csv.includes('""quote""'));
 const issues=U.checkComment('test test {name}',c,s,3);assert.ok(issues.length>=3);
 const cats=c.categories.map((cat,i)=>({...cat,options:i<2?[{id:'o'+i,text:i?'They never explain answers.':'They always explain answers.',skill:'explanation',level:i?'rare':'consistent'}]:[]}));assert.ok(U.checkBank(cats).some(s=>s.includes(' / ')));
});
test('HTTP persistence, ownership, registration, revisions and idempotency',async()=>{
 const file=path.resolve(__dirname,'synthetic-http-'+process.pid+'.sqlite');
 Object.assign(process.env,{NODE_ENV:'test',DB_PATH:file,PORT:'0',JWT_SECRET:'synthetic-comment-builder-jwt-secret-32',REFRESH_TOKEN_SECRET:'synthetic-comment-builder-refresh-secret-32',TIMSYS_LAUNCHER_DIST:path.resolve(__dirname,'../../../apps/launcher/dist')});
 const runtime=process.env.COMMENT_VERIFY_PLATFORM||path.resolve(__dirname,'../..');
 const platform=require(path.join(runtime,'index.js')),jwt=require('jsonwebtoken');let server;
 try{
  server=await platform.bootPlatform();const base='http://127.0.0.1:'+server.address().port;
  const req=async(method,url,body,token)=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json','X-Requested-With':'XMLHttpRequest',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
  const token=(await req('POST','/api/auth/dev-login',{})).data.token;
  const db=require(path.join(runtime,'shared/services/db'));
  assert.ok((await req('GET','/modules/list-for-app?appId=principal-ed',null,token)).data.data.find(m=>m.name==='comment_builder'&&m.enabled));
  assert.equal((await req('GET','/comment-builder/workspace',null,token)).data.workspace.classes.length,0);
  assert.equal(db.query('SELECT * FROM comment_builder_workspaces').rows.length,0,'reading creates no records');
  assert.notEqual((await req('GET','/comment-builder/workspace')).status,200);
  db.query("INSERT INTO users(external_id,username,display_name) VALUES('cb-user','cb-user','Synthetic user')");
  const other=jwt.sign({userId:'cb-user',permissions:[],sessionId:'cb-user'},process.env.JWT_SECRET,{expiresIn:'1h'});
  assert.equal((await req('GET','/comment-builder/access',null,other)).status,200);
  const payload={action:'createClass',name:'Synthetic HTTP class',expected_revision:0,command_id:'synthetic-command-01'};
  const made=await req('POST','/comment-builder/commands',payload,token);assert.equal(made.status,200,JSON.stringify(made));assert.equal(made.data.workspace.revision,1);
  assert.equal((await req('POST','/comment-builder/commands',payload,token)).data.workspace.classes.length,1);
  assert.equal((await req('POST','/comment-builder/commands',{...payload,name:'Changed'},token)).status,409);
  assert.equal((await req('POST','/comment-builder/commands',{...payload,command_id:'synthetic-command-02'},token)).status,409);
  assert.equal((await req('GET','/comment-builder/workspace',null,other)).data.workspace.classes.length,0);
  assert.equal((await req('POST','/comment-builder/commands',{action:'deleteClass',classId:made.data.workspace.classes[0].id,expected_revision:0,command_id:'other-delete-attempt'},other)).status,404);
  assert.equal((await req('GET','/comment-builder/workspace?app_id=tradeed',null,token)).status,400);
  const native=await fetch(base+'/app/principal-ed');assert.equal(native.status,200);
  for(const asset of ['index.js','BinaryModule-DTTQwokQ.js','harper_wasm_bg.wasm'])assert.equal((await fetch(base+'/comment-builder/harper/'+asset)).status,200);
  const migration=fs.readFileSync(path.join(__dirname,'migrations/001_comment_builder.sql'),'utf8');db.query("DELETE FROM app_module_assignments WHERE module_name='comment_builder'");db.exec(migration);db.exec(migration);assert.equal(db.query("SELECT * FROM app_module_assignments WHERE module_name='comment_builder'").rows.length,1);
  db.query("DELETE FROM app_module_assignments WHERE module_name='comment_builder'");assert.equal((await req('GET','/comment-builder/workspace',null,token)).status,403);
 }finally{if(server)await platform.shutdownPlatform(server);for(const suffix of ['','-wal','-shm'])if(fs.existsSync(file+suffix))fs.unlinkSync(file+suffix);if(fs.existsSync(file+'.documents'))fs.rmdirSync(file+'.documents');}
});
