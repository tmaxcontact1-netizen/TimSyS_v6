'use strict';
// Engineering only. Monotonic elapsed time is observed, never substituted for UTC evidence.
const fs=require('node:fs'),path=require('node:path'),{monitorEventLoopDelay}=require('node:perf_hooks');
function snapshot(previous=null){const wallMs=Date.now(),monotonicNs=process.hrtime.bigint().toString(),memory=process.memoryUsage(),cpu=process.cpuUsage();return {wallMs,utc:new Date(wallMs).toISOString(),monotonicNs,uptimeSeconds:process.uptime(),memory,cpu,wallMinusMonotonicDeltaMs:previous?wallMs-previous.wallMs-Number(BigInt(monotonicNs)-BigInt(previous.monotonicNs))/1e6:null};}
function startTelemetry(directory,{io=fs.promises}={}){const file=path.join(directory,'process-resources.ndjson'),hist=monitorEventLoopDelay({resolution:20});hist.enable();let previous=null,closed=false,pending=null,stopping=null;
 const exists=async p=>{try{return await io.stat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
 const write=async()=>{await io.mkdir(directory,{recursive:true});const value=snapshot(previous);previous=value;value.pid=process.pid;value.eventLoop={meanMs:Number.isFinite(hist.mean)?hist.mean/1e6:null,p99Ms:hist.percentile(99)/1e6,maxMs:hist.max/1e6};hist.reset();const state=await exists(file);if(state&&state.size>=8*1024*1024){for(let i=3;i>=1;i--){const old=file+'.'+i;if(await exists(old)){if(i===3)await io.unlink(old);else await io.rename(old,file+'.'+(i+1));}}await io.rename(file,file+'.1');}const fd=await io.open(file,'a');try{await fd.writeFile(JSON.stringify(value)+'\n');await fd.sync();}finally{await fd.close();}return value;};
 // One in-flight durable write; callers share it rather than queueing unbounded
 // samples. Disk stalls never execute synchronous IO on the heartbeat thread.
 const sample=()=>{if(closed)return Promise.resolve(null);if(pending)return pending;pending=write().finally(()=>{pending=null;});return pending;};
 const ready=sample();ready.catch(()=>{});const timer=setInterval(()=>{sample().catch(error=>console.error('RESOURCE_TELEMETRY_FAILED',error));},30000);timer.unref();return {ready,sample,stop(){if(stopping)return stopping;closed=true;clearInterval(timer);stopping=(async()=>{try{if(pending)await pending;await write();}finally{hist.disable();}})();return stopping;}};
}
module.exports={snapshot,startTelemetry};
