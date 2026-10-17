import React from 'react';
import './processing-progress.css';

export function analysisProgress(tool,run){
 if(!run)return null;
 if(tool==='content'){
  const tasks=run.tasks??[],successful=tasks.filter(t=>t.status==='completed').length,failed=tasks.filter(t=>t.status==='failed').length,cancelled=tasks.filter(t=>t.status==='cancelled').length;
  return {completed:successful+failed,total:tasks.length,label:'Links finished',detail:`${successful} successfully collected · ${failed} failed${cancelled?` · ${cancelled} cancelled`:''}. Each link includes its permitted supporting pages and documents.`};
 }
 if(run.kind==='interpretation')return {completed:run.completed??0,total:run.total??0,label:'Explanation requests completed',detail:''};
 const c=run.coverage;
 return c?{completed:c.semanticAssessed,total:c.substantivePopulationUnits,label:c.semanticAssessed===c.substantivePopulationUnits?'Semantic analysis complete':['queued','running'].includes(run.status)?'Semantic analysis in progress':'Semantic analysis incomplete',detail:`${c.semanticPending} pending · ${c.semanticFailed} failed. Local candidate matches do not count as semantic completion.`}:null;
}

export default function ProcessingProgress({label='Processing',completed,total,detail,active=true}){
 const known=Number.isFinite(total)&&total>0&&Number.isFinite(completed),done=known?Math.max(0,Math.min(completed,total)):0;
 const percent=known?Math.floor(done/total*100):null;
 return <section className="processing-progress" role="status" aria-live="polite" aria-atomic="true">
  <div className="processing-progress-heading"><strong>{label}{!active&&known&&done<total?' — incomplete':''}</strong>{known&&<span>{done.toLocaleString()} / {total.toLocaleString()} completed · {percent}%</span>}</div>
  <progress aria-label={label} {...(known?{value:done,max:total}:{})}/>
  {detail&&<small>{detail}</small>}{!known&&<small>Working… The total is not available yet.</small>}
 </section>;
}
