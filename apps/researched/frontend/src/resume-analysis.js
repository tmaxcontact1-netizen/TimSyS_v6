// Legacy runs require an explicit researcher attestation; never auto-resume.
export async function resumeAnalysis(api,path,actor,confirm=message=>window.confirm(message)){
 const post=value=>({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});
 try{await api(path,post({actor}));return true;}catch(e){
  if(e.message.replaceAll(' ','_')!=='legacy_provider_confirmation_required')throw e;
  if(!confirm('This older run did not record a stable AI profile. Confirm that the currently connected AI account/profile is the original one. The provider and model match. Resume only unfinished work and record this confirmation?'))return false;
  await api(path,post({actor,confirmLegacyProvider:true}));return true;
 }
}
