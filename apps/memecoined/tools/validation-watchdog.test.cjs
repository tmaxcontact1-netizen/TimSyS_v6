const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {atomic,validate,run}=require('./validation-watchdog.cjs');
const root=path.resolve(__dirname,'../../../../verification/isolation-fixture-'+Date.now());
test('production watchdog preserves evidence, alerts, restarts after two failures, and never duplicates healthy work',async()=>{
  fs.mkdirSync(root,{recursive:true});
  const worker=path.join(root,'worker.cjs');
  const flag=path.join(root,'close-port');
  fs.writeFileSync(worker,`const fs=require('node:fs');const server=require('node:http').createServer((q,r)=>r.end(JSON.stringify({pid:process.pid}))).listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),'127.0.0.1');setInterval(()=>{if(fs.existsSync(${JSON.stringify(flag)}))server.close()},100);console.log('fixture started');`);
  const config={port:18196,workerPort:18197,intervalMs:60000,cwd:root,executable:process.execPath,args:[worker],dataDirectory:path.join(root,'data'),logDirectory:path.join(root,'logs')};
  validate(config);assert.throws(()=>validate({...config,intervalMs:61000}));assert.throws(()=>validate({...config,dataDirectory:'C:\\timsys-launcher\\data'}));
  atomic(path.join(config.dataDirectory,'checkpoint.json'),{count:7});
  const watchdog=await run(config);
  try {
    await new Promise(resolve=>setTimeout(resolve,600));
    const initial=watchdog.worker().pid;await watchdog.check();assert.equal(watchdog.worker().pid,initial);
    watchdog.worker().kill();await new Promise(resolve=>setTimeout(resolve,300));
    await watchdog.check();assert.equal(watchdog.state.failures,1);assert.ok(fs.existsSync(path.join(config.logDirectory,'ALERTS.txt')));
    const incident=fs.readdirSync(path.join(config.logDirectory,'incidents'))[0];assert.deepEqual(JSON.parse(fs.readFileSync(path.join(config.logDirectory,'incidents',incident,'checkpoint.json'))),{count:7});
    await watchdog.check();assert.notEqual(watchdog.worker().pid,initial);await new Promise(resolve=>setTimeout(resolve,600));await watchdog.check();assert.equal(watchdog.state.failures,0);
    assert.equal(JSON.parse(fs.readFileSync(path.join(config.logDirectory,'watchdog-state.json'))).workerPid,watchdog.worker().pid);
    const recoveryPid=watchdog.worker().pid;fs.writeFileSync(flag,'close');await new Promise(resolve=>setTimeout(resolve,300));await watchdog.check();assert.equal(watchdog.state.failures,1);assert.equal(watchdog.worker().pid,recoveryPid);
    fs.unlinkSync(flag);await watchdog.check();assert.notEqual(watchdog.worker().pid,recoveryPid);await new Promise(resolve=>setTimeout(resolve,600));await watchdog.check();assert.equal(watchdog.state.failures,0);
    if(process.platform==='win32'){assert.ok(fs.existsSync(path.join(config.logDirectory,'incidents',incident,'Application-events.xml')));assert.ok(fs.existsSync(path.join(config.logDirectory,'incidents',incident,'System-events.xml')));}
  }finally{watchdog.stop();}
});
