// Shared by server exports, assistant reports and browser HTML/PDF rendering.
// A zero-code semantic response is a retained assessment; a deterministic no-match is not.
export function semanticCoverage(units:any[],proposals:any[]=[],candidates:any[]=[],tasks:any[]=[],reviewedIds:string[]=[]){
 const population=units.filter(u=>typeof u.original_text==='string'&&u.original_text.trim());
 const semantic=new Map(proposals.filter(p=>p.payload?.method!=='deterministic').map(p=>[p.unit_id,p.payload]));
 const local=new Map([...proposals.filter(p=>p.payload?.method==='deterministic'),...candidates].map(p=>[p.unit_id,p.payload]));
 const taskByUnit=new Map<string,any>(tasks.flatMap(t=>(t.unit_ids??[]).map((id:string)=>[id,t] as const)));
 const reviewed=new Set([...reviewedIds,...population.filter(u=>u.decision).map(u=>u.id)]);
 const pathways=population.map(u=>{const s=semantic.get(u.id),d=local.get(u.id),t=taskByUnit.get(u.id);return{
  unitId:u.id,semantic:s?(s.codes?.length?'semantic_success':'semantic_zero_code'):t?.status==='failed'?'semantic_failed':'semantic_pending',
  deterministic:d?(d.matches?.length?'deterministic_candidate':'deterministic_no_match'):'not_retrieved',researcherReviewed:reviewed.has(u.id),error:!s?t?.error??null:null
 };});
 const count=(key:string,value:string)=>pathways.filter(p=>(p as any)[key]===value).length;
 const semanticCoded=count('semantic','semantic_success'),semanticZeroCode=count('semantic','semantic_zero_code'),semanticAssessed=semanticCoded+semanticZeroCode;
 return {substantivePopulationUnits:population.length,excludedWhitespaceUnits:units.length-population.length,semanticAssessed,semanticCoded,semanticZeroCode,semanticPending:count('semantic','semantic_pending'),semanticFailed:count('semantic','semantic_failed'),deterministicCandidateMatches:count('deterministic','deterministic_candidate'),deterministicNoMatch:count('deterministic','deterministic_no_match'),deterministicNotRetrieved:count('deterministic','not_retrieved'),researcherReviewedUnits:pathways.filter(p=>p.researcherReviewed).length,
  semanticStatus:population.length>0&&semanticAssessed===population.length?'complete_semantic_analysis':semanticAssessed>0?'partial_semantic_analysis':'semantic_analysis_pending_failed_or_interrupted',pathways};
}
export const coverageLabels={substantivePopulationUnits:'Substantive population units',semanticAssessed:'Successfully semantically assessed',semanticCoded:'Semantic coded results',semanticZeroCode:'Semantic zero-code results',semanticPending:'Semantic pending units',semanticFailed:'Semantic failed units',deterministicCandidateMatches:'Deterministic candidate matches',deterministicNoMatch:'Deterministic no-match results',researcherReviewedUnits:'Researcher-reviewed units'};
