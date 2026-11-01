import type {AiAnalysisProvider} from './ai-analysis.js';
export const providerIdentity=(p:AiAnalysisProvider|null)=>p?{id:p.id,model:p.model,connectionId:p.configurationId??null,identityVersion:p.identityVersion??1}:null;
export function checkResumeProvider(saved:any,current:NonNullable<ReturnType<typeof providerIdentity>>,confirmLegacy=false){
 if(!saved)return;
 if(saved.id!==current.id||saved.model!==current.model)throw Error('Reconnect the original provider and model before resuming.');
 if(saved.connectionId===current.connectionId)return;
 if((saved.identityVersion??1)===1&&current.identityVersion===2){
  if(!confirmLegacy)throw Error('legacy_provider_confirmation_required');
  return;
 }
 throw Error('Reconnect the original provider and model before resuming.');
}
