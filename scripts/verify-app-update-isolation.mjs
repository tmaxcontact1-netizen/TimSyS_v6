import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import net from 'node:net';
const require=createRequire(import.meta.url),{SupervisedAppManager}=require('../apps/launcher/electron/supervised-app-manager.cjs'),{applyAppUpdate}=require('../apps/launcher/electron/app-update-runtime.cjs');
const root=await mkdtemp(join(tmpdir(),'timsys-app-update-')),manager=new SupervisedAppManager({startTimeoutMilliseconds:2000,healthIntervalMilliseconds:40,runtimeHealthIntervalMilliseconds:50});
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function fixture(id,version){const path=join(root,id+'-'+version);await mkdir(path);await writeFile(join(path,'server.cjs'),`require('node:http').createServer((q,s)=>s.end(JSON.stringify({version:'${version}',pid:process.pid}))).listen(Number(process.env.PORT),'127.0.0.1')`);await writeFile(join(path,'timsys.app.json'),JSON.stringify({schemaVersion:1,id,kind:'supervised-child',applicationRootEnvironment:'APP_ROOT',processes:{api:{command:'node',arguments:['server.cjs'],health:{url:'http://127.0.0.1:${PORT}',expectedStatus:200}}}}));return join(path,'timsys.app.json');}
const ports={researched:await port(),dressed:await port()},old=await fixture('researched','old'),next=await fixture('researched','new'),other=await fixture('dressed','unaffected');let current=old,confirmed=false,backupCalls=0;const health=id=>fetch('http://127.0.0.1:'+ports[id]).then(r=>r.json());
try{await manager.start(old,{PORT:String(ports.researched)});await manager.start(other,{PORT:String(ports.dressed)});const before=await health('dressed');
await applyAppUpdate({installed:[{id:'researched'}]}, {status:id=>manager.status(id),stop:id=>manager.stop(id),refreshRoots:async()=>{current=next;},start:id=>manager.start(current,{PORT:String(ports[id])}),reload:async()=>{},confirm:async()=>{confirmed=true;},rollback:async()=>false,progress:()=>{},backup:async()=>{backupCalls++;}});
assert.equal((await health('researched')).version,'new');assert.deepEqual(await health('dressed'),before);assert.equal(backupCalls,0);assert.ok(confirmed);console.log('PASS Real supervised ResearchEd process replaced; unrelated PID and heartbeat unchanged; no backup invoked');
}finally{await manager.stopAll();}
