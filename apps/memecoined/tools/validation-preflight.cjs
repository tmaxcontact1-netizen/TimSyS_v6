const fs=require('node:fs');
const path=require('node:path');
const {ancestry,alive}=require('./validation-watchdog.cjs');
const stateFile=process.argv[2];
if(!stateFile||!fs.existsSync(stateFile)){console.error('BLOCKED: validation state cannot be verified');process.exit(1);}
const state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
if(state.status==='idle'||state.status==='completed'){console.log('TradeEd validation inactive; platform development permitted');process.exit(0);}
const chain=ancestry(state.workerPid);
const rows=Array.isArray(chain)?chain:[chain];
if(!alive(state.watchdogPid)||!alive(state.workerPid)||rows.some(row=>/timsys.*launcher/i.test(row.name)))throw Error('BLOCKED: validation isolation not verified');
const log=path.join(path.dirname(stateFile),'incidents.ndjson');
fs.accessSync(path.dirname(log),fs.constants.W_OK);
const recent=fs.readFileSync(log,'utf8').trim().split('\n').map(JSON.parse).filter(row=>Date.now()-Date.parse(row.at)<=15*60000);
if(!state.lastCheck||Date.now()-Date.parse(state.lastCheck)>60000||recent.some(row=>/failed|error|restart/.test(row.kind)))throw Error('BLOCKED: watchdog anomaly or stale heartbeat');
console.log('Isolated validation verified. Platform modifications still require explicit proof of non-interference or Tim override.');
process.exitCode=1;
