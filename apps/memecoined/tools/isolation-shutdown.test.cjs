const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const {shutdown}=require('./isolation-shutdown.cjs');
test('durable stop is acknowledged and releases both processes and ports',async()=>{
 const root=path.resolve(__dirname,'../../../../verification/shutdown-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const config={port:18396,workerPort:18397,intervalMs:200,cwd:__dirname,executable:process.execPath,args:[path.join(__dirname,'isolation-deployment-fixture.cjs')],dataDirectory:path.join(root,'data'),logDirectory:path.join(root,'logs')};
 fs.mkdirSync(config.logDirectory,{recursive:true});fs.writeFileSync(path.join(root,'config.json'),JSON.stringify(config));
 const p=spawn(process.execPath,[path.join(__dirname,'validation-watchdog.cjs'),path.join(root,'config.json')],{stdio:'ignore'});
 const exited=new Promise(resolve=>p.once('exit',resolve));
 const stateFile=path.join(config.logDirectory,'watchdog-state.json');let state;
 for(let n=0;n<100;n++){if(fs.existsSync(stateFile)){state=JSON.parse(fs.readFileSync(stateFile));if(state.workerPid)break;}await new Promise(r=>setTimeout(r,100));}
 assert.ok(state?.workerPid);
 // Exercise the race that orphaned the original deployment: completion arrives
 // before the stop request. Completed status must not disable stop polling.
 fs.appendFileSync(path.join(config.dataDirectory,'events.ndjson'),JSON.stringify({kind:'finished'})+'\n');
 for(let n=0;n<50;n++){state=JSON.parse(fs.readFileSync(stateFile));if(state.status==='completed')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(state.status,'completed');
 const result=await shutdown(config,state,15000);assert.ok(result.passed,JSON.stringify(result));
 assert.equal(await exited,0);assert.equal(result.watchdog_force_killed,false);
});
test('nonresponsive supervisor is force-killed, incident persisted, and acceptance fails',async()=>{
 const root=path.resolve(__dirname,'../../../../verification/shutdown-refusal-'+Date.now());fs.mkdirSync(root,{recursive:true});
 const p=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 const result=await shutdown({port:18496,workerPort:18497,logDirectory:root},{watchdogPid:p.pid,workerPid:null,configHash:'fixture'},300);
 assert.equal(result.passed,false);assert.equal(result.watchdog_force_killed,true);assert.ok(fs.existsSync(path.join(root,'shutdown-force-kill.json')));
});
