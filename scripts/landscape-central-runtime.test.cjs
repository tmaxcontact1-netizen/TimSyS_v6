const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
test('central platform engine is used without a legacy ResearchEd code bundle',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'nb-central-test-'));
 const moduleDir=path.join(dir,'modules/nervous_breakdown'),engineDir=path.join(dir,'services/researched/dist/src/domain');
 await fs.mkdir(moduleDir,{recursive:true});await fs.mkdir(engineDir,{recursive:true});
 await fs.copyFile(path.join(__dirname,'../platform/modules/nervous_breakdown/documentary-connections.js'),path.join(moduleDir,'documentary-connections.cjs'));
 await fs.writeFile(path.join(engineDir,'jd-matrix.js'),"exports.jdMatrix=()=>({contract:'researched.jd-matrix.v1',rows:[{documentId:'d',id:'p',start:0,end:4,text:'Test'}],documentedRelationships:[]});");
 const old=process.env.NB_FROZEN_JD_MATRIX;delete process.env.NB_FROZEN_JD_MATRIX;
 try{const result=await require(path.join(moduleDir,'documentary-connections.cjs')).connections({documents:[{id:'d',extracted:'Test'}],review:{roles:{}}},'d','p');assert.deepEqual(result.records,[]);assert.equal(result.projection,'researched.jd-matrix.v1');}
 finally{if(old!==undefined)process.env.NB_FROZEN_JD_MATRIX=old;await fs.rm(dir,{recursive:true,force:true});}
});
