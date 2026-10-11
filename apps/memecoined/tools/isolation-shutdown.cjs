const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {alive,atomic}=require('./validation-watchdog.cjs');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const portReleased=port=>new Promise(resolve=>{
  const server=net.createServer();server.once('error',()=>resolve(false));
  server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));
});
async function shutdown(config,state,graceMs=45000){
  const request={id:crypto.randomUUID(),at:new Date().toISOString(),watchdogPid:state.watchdogPid,configHash:state.configHash};
  atomic(path.join(config.logDirectory,'stop-request.json'),request);
  const result={requestedAt:request.at,watchdog_force_killed:false,acknowledged:false};
  const deadline=Date.now()+graceMs;
  while(alive(state.watchdogPid)&&Date.now()<deadline){
    try{const h=await fetch(`http://127.0.0.1:${config.port}`,{signal:AbortSignal.timeout(1500)}).then(r=>r.json());
      if(h.watchdogPid===state.watchdogPid&&h.status==='stopping'&&h.stopRequestId===request.id){result.acknowledged=true;atomic(path.join(config.logDirectory,'stop-confirmed.json'),{id:request.id});}
    }catch{}await wait(100);
  }
  if(alive(state.watchdogPid)){
    result.watchdog_force_killed=true;
    fs.appendFileSync(path.join(config.logDirectory,'incidents.ndjson'),JSON.stringify({at:new Date().toISOString(),kind:'watchdog_force_killed',detail:{pid:state.watchdogPid,request}})+'\n');
    atomic(path.join(config.logDirectory,'shutdown-force-kill.json'),{request,state});
    process.kill(state.watchdogPid);await wait(1000);
  }
  if(alive(state.workerPid)){result.worker_force_killed=true;process.kill(state.workerPid);await wait(1000);}
  result.watchdogAbsent=!alive(state.watchdogPid);result.workerAbsent=!alive(state.workerPid);
  result.watchdogPortReleased=await portReleased(config.port);result.workerPortReleased=await portReleased(config.workerPort);
  result.passed=result.acknowledged&&!result.watchdog_force_killed&&!result.worker_force_killed&&result.watchdogAbsent&&result.workerAbsent&&result.watchdogPortReleased&&result.workerPortReleased;
  return result;
}
module.exports={shutdown,portReleased};
