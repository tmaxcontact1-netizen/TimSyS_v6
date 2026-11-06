// Replay-local durability only. No strategy/configurable retry policy.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const BACKOFF_MS=Object.freeze([50,100,200,400,800]);
const sleepSync=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);
function appendDurable(logFile,record){fs.mkdirSync(path.dirname(logFile),{recursive:true});const fd=fs.openSync(logFile,'a');try{fs.writeSync(fd,JSON.stringify(record)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
// Hooks are test-only IO/clock injection, never retry-count/backoff parameters.
function createAtomicWriter(logFile,hooks={}){
 const rename=hooks.rename??fs.renameSync,wait=hooks.wait??sleepSync;
 return function atomic(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  // Unique per operation: a failure-handler write cannot truncate a preserved
  // newer checkpoint left by an earlier failed replacement of the same path.
  const temporary=`${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const fd=fs.openSync(temporary,'wx');try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  for(let attempt=1;attempt<=6;attempt++){
   try{rename(temporary,file);if(attempt>1)appendDurable(logFile,{at:new Date().toISOString(),level:'event',kind:'atomic_replace_recovered',attempt,destination:file,temporary});return;}
   catch(error){
    const retryable=error.code==='EPERM'||error.code==='EBUSY';
    if(retryable&&attempt<6){const waitMs=BACKOFF_MS[attempt-1];appendDurable(logFile,{at:new Date().toISOString(),level:'event',kind:'atomic_replace_retry',code:error.code,attempt,retryNumber:attempt,nextAttempt:attempt+1,waitMs,destination:file,temporary,message:error.message});wait(waitMs);continue;}
    const failure={at:new Date().toISOString(),level:'incident',kind:retryable?'atomic_replace_exhausted':'atomic_replace_non_retryable',attempt,code:error.code??null,message:error.message,stack:error.stack,syscall:error.syscall??null,underlyingPath:error.path??null,underlyingDestination:error.dest??null,destination:file,temporary,preservedTemporary:fs.existsSync(temporary)};
    appendDurable(logFile,failure);error.durabilityFailure=failure;throw error;
   }
  }
 };
}
function atomic(file,value){const root=process.env.CRYPTOED_SOAK_OUTPUT??path.dirname(file);const logFile=process.env.CRYPTOED_DURABILITY_LOG??path.join(root,'durability-events.ndjson');return createAtomicWriter(logFile)(file,value);}
module.exports={atomic,createAtomicWriter,BACKOFF_MS,sleepSync};
