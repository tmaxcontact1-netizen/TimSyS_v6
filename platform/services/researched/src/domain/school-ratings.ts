export const SCHOOL_ITEMS=[
 ['academic_integrity','Academic integrity of school'],['administration','Effectiveness of administration'],
 ['academic_disciplinary_support','Academic and disciplinary support provided'],['director_academics',"Director's involvement in academics"],
 ['fair_treatment','Fair and equitable treatment by board and director'],['educational_materials','School has adequate educational materials on hand'],
 ['community_attitude','Attitude of local community towards foreigners'],['cost_of_living','Cost of living in relation to salary'],
 ['housing','Satisfaction with housing'],['community_activities','Community offers a variety of activities'],
 ['healthcare','Availability and quality of local health care'],['health_insurance','Satisfaction with school health insurance policy'],
 ['family_friendly','Family friendly / child friendly school and community'],['relocation','Assistance with visas, shipping and air travel'],
 ['extra_curricular','Extra curricular load is reasonable'],['security','Security / personal safety']
] as const;
export const SCHOOL_SCALE={minimum:1,maximum:10,integerRatings:true,higher:'more favourable',source:'https://w.internationalschoolsreview.com/nonmembers/quickevalform.htm',verifiedOn:'2026-11-05',sourceStatement:'Please Rate Each Item on a Scale of 1 - 10. Top Rating = 10'};
export const SCHOOL_NARRATIVE_RULES='School review scope v1: Apply the unchanged MCF definitions only where this target, interpreted with permitted same-review narrative, establishes the required organisational practice or decision. Generic satisfaction or dissatisfaction with housing, healthcare, salary, resources or local conditions alone is insufficient. Do not infer a management practice from a condition or outcome alone. Preserve attribution: quotations and references to earlier reviews are not automatically the current reviewer’s own experience. Structured respondent ratings, averages and salary fields are not evidence for MCF applications.';
export const schoolNormal=(s:string)=>s.replace(/\s+/g,' ').trim();
export function schoolPromptId(raw:string){const t=schoolNormal(raw);return SCHOOL_ITEMS.find(([,p])=>t===p||(['Cost of living in relation to salary','Security / personal safety'].includes(p)&&new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:[\\s\\uFFFD]*\\(10 = (?:most favorable|very safe in and out of school)\\))?$').test(t)))?.[0];}
export function schoolRatingsReport(session:any){
 if(session?.blind)return null;
 const records=(session?.records??[]).filter((r:any)=>r.locator?.profile==='school-questionnaire@1.0');if(!records.length)return null;
 const seen=new Set(),sourceSeen=new Set(),issues:any[]=[];
 const idCounts=new Map<string,number>(),sourceCounts=new Map<string,number>();
 for(const r of records){idCounts.set(r.id,(idCounts.get(r.id)??0)+1);const q=r.locator.respondentRatings;if(q){const key=q.sourceHash+':'+q.sourceTableIndex;sourceCounts.set(key,(sourceCounts.get(key)??0)+1);}}
 for(const id of (session.configuration?.unitSets??[]).map((s:any)=>s.record_id))if(!(session.records??[]).some((r:any)=>r.id===id))issues.push({reviewId:id,warnings:['missing_review_id']});
 const reviews=records.map((r:any)=>{const q=r.locator.respondentRatings,key=q?.sourceHash+':'+q?.sourceTableIndex,warnings=[];
  if((idCounts.get(r.id)??0)>1)warnings.push('duplicate_review_id');seen.add(r.id);
  if(q&&(sourceCounts.get(key)??0)>1)warnings.push('duplicate_questionnaire_join');if(q)sourceSeen.add(key);
  if(warnings.length)issues.push({reviewId:r.id,warnings});
  return{reviewId:r.id,sourceReviewId:r.locator.sourceReviewId,originalReviewNumber:r.locator.metadata?.originalReviewNumber,institution:r.locator.institution,sourceTableIndex:q?.sourceTableIndex??null,ratings:q?.ratings??[],reportedAverage:q?.reportedAverage??null,salaries:q?.salaries??[],warnings};});
 const prompts=SCHOOL_ITEMS.map(([promptId,prompt])=>{const rows=reviews.map((r:any)=>{const found=r.ratings.filter((x:any)=>x.itemId===promptId);return{review:r,row:found[0],duplicate:found.length>1};});const valid=rows.filter((x:any)=>!x.duplicate&&!x.review.warnings.length&&x.row?.status==='valid');return{promptId,prompt,expected:reviews.length,validDenominator:valid.length,missing:rows.filter((x:any)=>!x.row||x.row.status==='missing').length,unresolved:rows.filter((x:any)=>x.row&&(x.duplicate||x.review.warnings.length||x.row.status==='unresolved')).length,categories:Array.from({length:10},(_,i)=>{const value=i+1,count=valid.filter((x:any)=>x.row.value===value).length;return{value,count,percentage:valid.length?count/valid.length*100:null};})};});
 return{version:'researched.school-isr-ratings-report.v1',scale:SCHOOL_SCALE,notice:'School ISR respondent ratings are separate from narrative MCF findings. Original 1–10 categories; percentages use valid responses per prompt. Reported averages and salary ranges remain source records, not calculated composites or competency evidence.',reviews,prompts,issues};
}
