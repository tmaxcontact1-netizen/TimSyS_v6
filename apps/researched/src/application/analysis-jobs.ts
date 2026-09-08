import { retryDelay } from "@timsys/app-sdk";

export type AnalysisRunState="queued"|"running"|"paused"|"completed"|"partial"|"failed"|"cancelled";
export type AnalysisRunAction="pause"|"resume"|"cancel"|"retry";
const transitions:Record<AnalysisRunAction,readonly AnalysisRunState[]>={pause:["queued","running"],resume:["paused"],cancel:["queued","running","paused"],retry:["failed","partial"]};
const permanentErrors=new Set(["ai_provider_not_configured","analysis_input_unavailable","analysis_evidence_required"]);

export function canControlAnalysisRun(state:AnalysisRunState,action:AnalysisRunAction){return transitions[action].includes(state)}
export function analysisRetry(attempt:number,maximumAttempts:number,reason:string,at:Date){
  const retry=!permanentErrors.has(reason)&&attempt<maximumAttempts;
  const delayMs=retry?retryDelay(attempt,{baseDelayMs:5_000,maximumDelayMs:300_000}):0;
  return{retry,delayMs,nextAttemptAt:new Date(at.getTime()+delayMs).toISOString()};
}
export function buildAnalysisJobs(inputs:readonly {source_id:string}[],types:readonly string[],maximumAttempts:number,at:string,id:()=>string){
  const cross=new Set(["themes","comparison","contradictions"]),sourceTypes=types.filter(type=>!cross.has(type)),corpusTypes=types.filter(type=>cross.has(type)),sourceIds=inputs.map(item=>item.source_id),jobs=[] as Record<string,unknown>[];
  for(const source of inputs)for(const analysisType of sourceTypes)jobs.push({id:id(),sourceId:source.source_id,analysisType,scopeType:"source",scopeKey:source.source_id,sourceIds:[source.source_id],maximumAttempts,nextAttemptAt:at,createdAt:at});
  for(const analysisType of corpusTypes)jobs.push({id:id(),sourceId:null,analysisType,scopeType:"corpus",scopeKey:"corpus",sourceIds,maximumAttempts,nextAttemptAt:at,createdAt:at});
  return jobs;
}
