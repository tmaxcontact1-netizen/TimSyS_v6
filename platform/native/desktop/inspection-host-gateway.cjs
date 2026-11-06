'use strict';
// Public, fixed host integration entry; no trading modules or database access.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='C:/TradeEd-Sandbox/host-gateway';
class InspectionBroker {
 constructor(options={}){this.options=options;this.delegate=null;this.fault=null;}
 load(){
  if(this.delegate)return this.delegate;
  const contract=JSON.parse(fs.readFileSync(path.join(root,'gateway-seal.json'),'utf8'));
  if(contract.schemaVersion!==1||contract.mode!=='inspection'||contract.automaticRestart!==false)throw Error('TRADEED_GATEWAY_CONTRACT_STOP');
  for(const name of ['inspection-broker.cjs','sandbox-task.ps1']){
   const bytes=fs.readFileSync(path.join(root,name));
   if(crypto.createHash('sha256').update(bytes).digest('hex')!==contract.files[name])throw Error('TRADEED_GATEWAY_HASH_STOP');
  }
  this.delegate=new(require(path.join(root,'inspection-broker.cjs')).InspectionBroker)(this.options);
  return this.delegate;
 }
 status(){return this.fault||this.delegate?.status()||{id:'tradeed',state:'failed',mode:'inspection',detail:'Sandbox availability has not been verified',processes:[]};}
 async attach(){try{return await this.load().attach();}catch(error){this.fault={id:'tradeed',state:'failed',mode:'inspection',detail:'Sandbox unavailable: '+error.message,processes:[]};this.options.onStatus?.(this.fault);return this.fault;}}
 async start(request){try{const result=await this.load().start(request);this.fault=null;return result;}catch(error){this.fault={id:'tradeed',state:'failed',mode:'inspection',detail:error.message,processes:[]};throw error;}}
 dashboardUrl(){if(!this.delegate||this.fault)throw Error('SANDBOX_UNAVAILABLE');return this.delegate.dashboardUrl();}
 token(){return this.fault?undefined:this.delegate?.token();}
 async stop(){return this.delegate?this.delegate.stop():this.status();}
}
// Optional gateway failure must not prevent TimSyS or other apps from starting.
module.exports={InspectionBroker};
