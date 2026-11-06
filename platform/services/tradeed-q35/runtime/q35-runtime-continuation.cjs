'use strict';
// Deployment provenance only. Never rewrites an origin, decision or checkpoint.
const fs=require('node:fs'),crypto=require('node:crypto');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const deploymentKeys=new Set(['toolCommit','models','inputHashes','frozenFiles','approvalFile','continuation']);
const immutableScience=['q35-prospective-core.cjs','q35-prospective-statistics.cjs','q35-core.cjs','research2-core.cjs','research2-statistics.cjs','research-artifacts.cjs','replay-durability.cjs','sealed-a-view.cjs'];
// Tim's 2026-10-20 narrow recovery amendment: exact old/new bytes only.
const recoveryCorePair=['c68f38d4fc5b20293259453d26c0cbee8c17b0bff6673bf86c38c38c3a8f947b','b3558a306b75c1ba847c9f5d6a5c5edb05c2b82521f68f46a83f600fbe6c0054'];
function ledgerConfigHash(cfg){if(!cfg.continuation)return sha(JSON.stringify(cfg));const x=cfg.continuation,bytes=fs.readFileSync(x.originalConfigFile),original=JSON.parse(bytes),hash=sha(JSON.stringify(original));
 if(sha(bytes)!==x.originalConfigFileSha256||hash!==x.ledgerConfigHash||!cfg.inputHashes.some(f=>f.file===x.originalConfigFile&&f.sha256===x.originalConfigFileSha256))throw Error('CONTINUATION_PREDECESSOR_SEAL_STOP');
 if(original.continuation||original.mode!=='public_paper_collection'||cfg.mode!==original.mode||cfg.collectionAuthorized!==true)throw Error('CONTINUATION_AUTHORITY_STOP');
 const scientific=o=>Object.fromEntries(Object.keys(o).filter(k=>!deploymentKeys.has(k)).sort().map(k=>[k,o[k]]));
 if(JSON.stringify(scientific(cfg))!==JSON.stringify(scientific(original)))throw Error('CONTINUATION_PARAMETER_CHANGE_STOP');
 if(JSON.stringify(Object.keys(cfg.models).sort())!==JSON.stringify(Object.keys(original.models).sort()))throw Error('CONTINUATION_MODEL_KEYS_STOP');
 for(const k of Object.keys(original.models))if(sha(fs.readFileSync(original.models[k]))!==sha(fs.readFileSync(cfg.models[k])))throw Error('CONTINUATION_MODEL_CHANGE_STOP');
 for(const file of immutableScience){const old=original.frozenFiles.find(f=>f.file===file),fresh=cfg.frozenFiles.find(f=>f.file===file);const recoveryOnly=file==='q35-prospective-core.cjs'&&old?.sha256===recoveryCorePair[0]&&fresh?.sha256===recoveryCorePair[1];if(!old||!fresh||(old.sha256!==fresh.sha256&&!recoveryOnly))throw Error('CONTINUATION_SCIENCE_CHANGE_STOP:'+file);}
 return hash;
}
module.exports={ledgerConfigHash,deploymentKeys,immutableScience};
