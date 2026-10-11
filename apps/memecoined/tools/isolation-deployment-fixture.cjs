// No market APIs, database, or trading code: deployed-supervisor acceptance only.
const fs=require('node:fs');
const path=require('node:path');
const dir=process.env.CRYPTOED_SOAK_OUTPUT;
const checkpoint=path.join(dir,'checkpoint.json');
const prior=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):{count:0};
console.log(JSON.stringify({event:'fixture_started',pid:process.pid,recoveredCount:prior.count}));
console.error('Isolation fixture stderr capture verified');
const server=require('node:http').createServer((q,r)=>r.end(JSON.stringify({pid:process.pid,count:prior.count}))).listen(Number(process.env.CRYPTOED_HEARTBEAT_PORT),'127.0.0.1');
setInterval(()=>{
  prior.count++;
  const temp=checkpoint+'.tmp';fs.writeFileSync(temp,JSON.stringify(prior));fs.renameSync(temp,checkpoint);
  if(fs.existsSync(path.join(dir,'close-port')))server.close();
},1000);
