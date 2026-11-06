'use strict';
const fs=require('node:fs'),path=require('node:path');
function assertTradeedSandboxBundle(root){
 let c;try{c=JSON.parse(fs.readFileSync(path.join(root,'native/desktop/tradeed-sandbox-contract.json'),'utf8'));}catch{throw Error('TRADEED_SANDBOX_UPDATE_INCOMPATIBLE');}
 if(c.schemaVersion!==1||c.protocol!=='tradeed.sandbox.inspection.v1'||c.implementationOwner!=='tradeed-sandbox'||c.mode!=='inspection'||c.backendBundledWithTimSys!==false||c.tradingEnabled!==false||c.collectionEnabled!==false||c.automaticRestart!==false)throw Error('TRADEED_SANDBOX_UPDATE_INCOMPATIBLE');
 if(fs.existsSync(path.join(root,'services/tradeed')))throw Error('TRADEED_BACKEND_REINTRODUCTION_DENIED');
 for(const name of ['inspection-host-gateway.cjs','tradeed-sandbox-update-gate.cjs'])if(!fs.existsSync(path.join(root,'native/desktop',name)))throw Error('TRADEED_GATEWAY_UPDATE_REQUIRED');
 const main=fs.readFileSync(path.join(root,'native/desktop/main.cjs'),'utf8');
 if(!main.includes('new InspectionBroker(')||!main.includes('inspectionBroker.start(')||main.includes('services/tradeed')||!main.includes('infrastructureOnly: true'))throw Error('TRADEED_LEGACY_WIRING_DENIED');
 return true;
}
module.exports={assertTradeedSandboxBundle};
