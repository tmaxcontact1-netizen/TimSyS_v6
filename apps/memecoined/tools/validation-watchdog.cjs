const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const {spawn, execFileSync} = require('node:child_process');
const crypto = require('node:crypto');

function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive:true});
  const temporary = `${file}.${process.pid}.tmp`;
  const fd=fs.openSync(temporary,'w');
  try {fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  fs.renameSync(temporary,file);
}
function alive(pid) {try {process.kill(pid,0);return true;} catch{return false;}}
function portAlive(port) {return new Promise(resolve=>{const socket=net.connect({host:'127.0.0.1',port});const finish=value=>{socket.destroy();resolve(value);};socket.setTimeout(1500,()=>finish(false));socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));});}
function workerHeartbeat(port,pid){return new Promise(resolve=>{const request=http.get(`http://127.0.0.1:${port}/`,response=>{let body='';response.on('data',chunk=>{body+=chunk;if(body.length>4096)request.destroy();});response.on('end',()=>{try{resolve(JSON.parse(body).pid===pid);}catch{resolve(false);}});});request.setTimeout(1500,()=>request.destroy());request.on('error',()=>resolve(false));});}
function ancestry(pid) {
  if(process.platform!=='win32') return [];
  const command=`$p=${Number(pid)}; $seen=@{}; $rows=while($p -and -not $seen.ContainsKey($p)) { $seen[$p]=$true; $r=Get-CimInstance Win32_Process -Filter \"ProcessId=$p\"; if(-not $r){break}; [pscustomobject]@{pid=$r.ProcessId;parent=$r.ParentProcessId;name=$r.Name}; $p=$r.ParentProcessId }; $rows | ConvertTo-Json -Compress`;
  return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true}).trim()||'[]');
}
function validate(config) {
  if(!Number.isInteger(config.port)||config.port<1024||config.port>65535) throw Error('Dedicated heartbeat port required');
  if(!Number.isInteger(config.workerPort)||config.workerPort===config.port)throw Error('Separate worker listening port required');
  if(!config.intervalMs||config.intervalMs>60000||config.intervalMs<100) throw Error('Heartbeat interval must be <=60 seconds');
  for(const key of ['dataDirectory','logDirectory','cwd','executable']) {
    if(!path.isAbsolute(config[key])) throw Error(`${key} must be absolute`);
    if(/timsys-launcher|[\\/]backups[\\/]|[\\/]temp[\\/]/i.test(config[key])) throw Error(`${key} is not isolated`);
  }
  if(path.resolve(config.dataDirectory)===path.resolve(config.logDirectory)) throw Error('Independent log directory required');
  if(!Array.isArray(config.args)) throw Error('Explicit worker arguments required');
}
async function run(config) {
  validate(config);
  const owners=ancestry(process.pid);const ownerRows=Array.isArray(owners)?owners:[owners];
  if(ownerRows.some(row=>/timsys.*launcher/i.test(row.name)))throw Error('Launcher ancestry forbidden');
  fs.mkdirSync(config.logDirectory,{recursive:true});fs.mkdirSync(config.dataDirectory,{recursive:true});
  const lock=path.join(config.logDirectory,'watchdog.lock');
  if(fs.existsSync(lock)&&alive(Number(fs.readFileSync(lock,'utf8'))))throw Error('Watchdog already owns this validation');
  const stateFile=path.join(config.logDirectory,'watchdog-state.json');
  const previous=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):null;
  const configHash=crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
  if(previous&&previous.configHash!==configHash)throw Error('Validation configuration changed');
  const adopt=previous?.workerPid&&alive(previous.workerPid);
  if(adopt&&!await workerHeartbeat(config.workerPort,previous.workerPid))throw Error('Existing worker identity cannot be verified; refusing duplicate');
  fs.writeFileSync(lock,String(process.pid));
  const state={...previous,configHash,watchdogPid:process.pid,status:'active',lastCheck:null,failures:0,workerPid:null};
  const event=(kind,detail)=>fs.appendFileSync(path.join(config.logDirectory,'incidents.ndjson'),JSON.stringify({at:new Date().toISOString(),kind,detail})+'\n');
  const save=()=>atomic(stateFile,state);
  let worker=null,closing=false;
  const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({pid:worker?.pid,watchdogPid:process.pid,alive:worker?alive(worker.pid):false,status:state.status,stopRequestId:state.stopRequestId}));});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,'127.0.0.1',resolve);});
  const start=()=>{
    const stamp=Date.now();
    const out=fs.openSync(path.join(config.logDirectory,`worker-${stamp}.stdout.log`),'a');
    const err=fs.openSync(path.join(config.logDirectory,`worker-${stamp}.stderr.log`),'a');
    worker=spawn(config.executable,config.args,{cwd:config.cwd,windowsHide:true,detached:process.platform==='win32',stdio:['ignore',out,err],env:{...process.env,...config.env,CRYPTOED_SOAK_OUTPUT:config.dataDirectory,CRYPTOED_HEARTBEAT_PORT:String(config.workerPort)}});
    fs.closeSync(out);fs.closeSync(err);state.workerPid=worker.pid;state.failures=0;save();event('worker_started',{pid:worker.pid});
    worker.on('error',error=>event('worker_spawn_error',{message:error.message}));
  };
  const preserve=()=>{
    const destination=path.join(config.logDirectory,'incidents',String(Date.now()));fs.mkdirSync(destination,{recursive:true});
    for(const name of fs.readdirSync(config.dataDirectory)) {const source=path.join(config.dataDirectory,name);if(fs.statSync(source).isFile())fs.copyFileSync(source,path.join(destination,name));}
    if(process.platform==='win32'){
      for(const channel of ['Application','System'])try {const raw=execFileSync('wevtutil.exe',['qe',channel,'/q:*[System[TimeCreated[timediff(@SystemTime) <= 600000]]]','/c:100','/rd:true','/f:xml'],{encoding:'utf8',windowsHide:true,timeout:15000});fs.writeFileSync(path.join(destination,`${channel}-events.xml`),raw);}catch(error){fs.writeFileSync(path.join(destination,`${channel}-capture-error.txt`),error.message);}
      try{atomic(path.join(destination,'supervisor-ancestry.json'),ancestry(process.pid));}catch(error){fs.writeFileSync(path.join(destination,'ancestry-error.txt'),error.message);}
    }
    event('evidence_secured',{destination});return destination;
  };
  if(adopt){worker={pid:previous.workerPid,kill:()=>process.kill(previous.workerPid,'SIGTERM')};state.workerPid=previous.workerPid;save();event('existing_worker_adopted',{pid:previous.workerPid});}else start();
  event('watchdog_started',{pid:process.pid,port:config.port});
  const check=async()=>{
    if(closing)return;
    const stopPath=path.join(config.logDirectory,'stop-request.json');
    if(fs.existsSync(stopPath)){
      const request=JSON.parse(fs.readFileSync(stopPath,'utf8'));
      if(request.configHash===configHash&&request.watchdogPid===process.pid){
        closing=true;clearInterval(timer);state.status='stopping';state.stopRequestId=request.id;save();event('stop_acknowledged',{id:request.id});
        // Keep the endpoint available until the requesting runner has observed acknowledgement.
        const finish=async()=>{if(!fs.existsSync(path.join(config.logDirectory,'stop-confirmed.json')))return;
          const confirmation=JSON.parse(fs.readFileSync(path.join(config.logDirectory,'stop-confirmed.json'),'utf8'));
          if(confirmation.id!==request.id)return;
          clearInterval(stopTimer);await stop();process.exit(0);
        };
        const stopTimer=setInterval(()=>void finish().catch(error=>event('shutdown_error',{message:error.message})),100);
        // A lost runner cannot leave an acknowledged stop alive indefinitely.
        setTimeout(()=>{void stop().then(()=>process.exit(0));},10000).unref();
        return;
      }
    }
    const eventsPath=path.join(config.dataDirectory,'events.ndjson');
    if(fs.existsSync(eventsPath)){
      const tail=fs.readFileSync(eventsPath,'utf8').trim().split('\n').at(-1);
      if(tail&&JSON.parse(tail).kind==='finished'){state.status='completed';save();clearInterval(timer);event('validation_completed',{});return;}
    }
    const pidOk=worker&&alive(worker.pid),portOk=await workerHeartbeat(config.workerPort,state.workerPid);
    state.lastCheck=new Date().toISOString();
    if(pidOk&&portOk){state.failures=0;state.firstFailureAt=null;state.status='active';save();return;}
    if(!state.firstFailureAt||Date.now()-Date.parse(state.firstFailureAt)>300000){state.failures=0;state.firstFailureAt=new Date().toISOString();}
    state.failures++;state.status='interrupted';save();event('heartbeat_failed',{pidOk,portOk,consecutive:state.failures});
    if(state.failures===1){preserve();fs.appendFileSync(path.join(config.logDirectory,'ALERTS.txt'),`${state.lastCheck} Trade'Ed validation heartbeat failed. Evidence secured.\n`);}
    if(state.failures>=2){event('automatic_restart',{previousPid:state.workerPid});if(pidOk){const oldPid=worker.pid;worker.kill();const deadline=Date.now()+10000;while(alive(oldPid)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));if(alive(oldPid))throw Error('Old worker has not exited; refusing duplicate');}start();}
  };
  let checking=false;
  const timer=setInterval(()=>{if(checking)return;checking=true;void check().catch(error=>event('watchdog_error',{message:error.message})).finally(()=>checking=false);},config.intervalMs);
  const stop=async()=>{closing=true;clearInterval(timer);if(worker&&alive(worker.pid)){worker.kill();const deadline=Date.now()+10000;while(alive(worker.pid)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));if(alive(worker.pid))throw Error('Worker refused shutdown');}state.status='stopped';save();await new Promise(resolve=>server.close(resolve));if(fs.existsSync(lock))fs.unlinkSync(lock);event('shutdown_complete',{});};
  process.once('SIGTERM',()=>{void stop().then(()=>process.exit(0));});process.once('SIGINT',()=>{void stop().then(()=>process.exit(0));});
  return {state,check,stop,worker:()=>worker};
}
module.exports={atomic,alive,portAlive,validate,ancestry,run};
if(require.main===module){run(JSON.parse(fs.readFileSync(process.argv[2],'utf8'))).catch(error=>{console.error(error);process.exitCode=1;});}
