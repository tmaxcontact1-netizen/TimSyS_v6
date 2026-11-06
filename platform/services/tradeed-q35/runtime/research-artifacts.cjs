'use strict';
// Pure import: no worker entry hooks, processes, IO until a function is called.
const fs=require('node:fs'),{atomic}=require('./replay-durability.cjs'),{sha}=require('./sealed-a-view.cjs');
function durable(file,value){atomic(file,value);return sha(fs.readFileSync(file));}
function sealed(file,value){const seal=file+'.seal.json';if(fs.existsSync(file)){if(!fs.existsSync(seal))throw Error('UNSEALED_ARTIFACT_STOP:'+file);const bytes=fs.readFileSync(file),old=JSON.parse(fs.readFileSync(seal));if(sha(bytes)!==old.sha256||JSON.stringify(JSON.parse(bytes))!==JSON.stringify(value))throw Error('RECOVERY_ARTIFACT_MISMATCH_STOP:'+file);return old.sha256;}const hash=durable(file,value);atomic(seal,{sha256:hash,at:new Date().toISOString()});return hash;}
module.exports={durable,sealed};
