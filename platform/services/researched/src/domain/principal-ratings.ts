export const PRINCIPAL_ITEMS=[['fair_equitable','Fair & equitable with all staff'],['listener_approachable','Good listener, easily approachable'],['disciplinary_support','Provides disciplinary support'],['effective_leadership','Displays effective leadership'],['delegates_responsibility','Delegates responsibility well'],['curriculum_knowledge','Demonstrates curriculum knowledge'],['positive_supportive_climate','Fosters positive, supportive climate'],['relates_to_kids','Strong ability to relate to kids'],['overall_rating','Overall rating']] as const;
export const PRINCIPAL_CATEGORIES=['Excellent','Good','Average','Poor'];

/** Read-only report projection from the saved session's review records. Never joins by names or order. */
export function principalRatingsReport(session:any){
 if(session?.blind)return null;
 const source:any[]=session?.records??[];
 if(!source.some(r=>r.locator?.respondentRatings?.schema==='isr-principal-ratings@1.0'||r.locator?.profile==='principal-questionnaire@1.0'))return null;
 const ids:string[]=(session.configuration?.unitSets??[]).map((s:any)=>s.record_id);
 const expected=[...new Set(ids.length?ids:source.map(r=>r.id))];
 const issues:any[]=[];const reviews:any[]=[];const excludedReviewIds:string[]=[];
 const sourceKeys=new Map<string,string[]>();
 for(const id of expected){const matches=source.filter(r=>r.id===id);const r=matches[0],q=r?.locator?.respondentRatings;
  if(q?.excludeFromAnalysis||r?.locator?.excludeFromAnalysis||q?.schema==='other-questionnaire@1.0'){excludedReviewIds.push(id);continue;}
  if(q?.schema==='isr-principal-ratings@1.0'){const key=JSON.stringify([q.sourceHash,q.sourceTableIndex]);sourceKeys.set(key,[...(sourceKeys.get(key)??[]),id]);}
 }
 const duplicatedSourceReviewIds=[...sourceKeys.values()].filter(a=>a.length>1).flat();
 for(const reviewId of expected.filter(id=>!excludedReviewIds.includes(id))){
  const matches=source.filter(r=>r.id===reviewId),record=matches[0],q=record?.locator?.respondentRatings;
  const reviewWarnings:string[]=[];
  if(matches.length!==1)reviewWarnings.push(matches.length?'duplicate_review_id':'missing_review_id');
  if(duplicatedSourceReviewIds.includes(reviewId))reviewWarnings.push('duplicate_source_questionnaire');
  if(!q)reviewWarnings.push('missing_questionnaire');
  else if(q.schema!=='isr-principal-ratings@1.0')reviewWarnings.push('unexpected_questionnaire_profile');
  const ratings=PRINCIPAL_ITEMS.map(([promptId,expectedPrompt])=>{
   const found=(q?.ratings??[]).filter((r:any)=>r.itemId===promptId),r=found[0];
   const warnings=[...reviewWarnings,...(r?.warnings??[])];
   if(found.length!==1)warnings.push(found.length?'duplicate_prompt':'missing_prompt');
   const cells=r?.candidates??[];
   if(r&&!(cells.length===4&&cells.filter((c:any)=>c.state==='selected_empty_paragraph').length===1&&cells.filter((c:any)=>c.state==='non_selected_nbsp').length===3))warnings.push('malformed_cell_structure');
   if(r&&(!PRINCIPAL_CATEGORIES.includes(r.value)||r.status!=='RECOVERED'||cells.find((c:any)=>c.state==='selected_empty_paragraph')?.label!==r.value))warnings.push('unresolved_selection');
   const missing=!r||r.warnings?.includes('missing_prompt');
   const status=missing?'missing':warnings.length?'unresolved':'valid';
   return{reviewId,promptId,prompt:r?.prompt??null,expectedPrompt,selectedLabel:status==='valid'?r.value:null,status,warnings:[...new Set(warnings)],sourceTableIndex:r?.sourceTableIndex??q?.sourceTableIndex??null,sourceRowIndex:r?.sourceRowIndex??null,sourceRows:found.flatMap((x:any)=>x.sourceRowIndices??(x.sourceRowIndex?[x.sourceRowIndex]:[])),sourceRatings:found};
  });
  for(const rating of ratings)if(rating.status!=='valid')issues.push({reviewId,promptId:rating.promptId,warnings:rating.warnings,sourceTableIndex:rating.sourceTableIndex,sourceRows:rating.sourceRows});
  const unknown=(q?.ratings??[]).filter((r:any)=>!PRINCIPAL_ITEMS.some(([id])=>id===r.itemId));
  for(const r of unknown)issues.push({reviewId,promptId:r.itemId,warnings:['unknown_prompt'],sourceTableIndex:r.sourceTableIndex,sourceRows:r.sourceRowIndices??[r.sourceRowIndex]});
  reviews.push({reviewId,reviewIdentifier:record?.review_identifier??null,importId:record?.import_id??null,mappingId:record?.mapping_id??null,sourceHash:q?.sourceHash??null,sourceTableIndex:q?.sourceTableIndex??null,sourceOrderId:q?.sourceOrderId??null,warnings:reviewWarnings,ratings,unrecognisedRatings:unknown});
 }
 reviews.sort((a,b)=>String(a.sourceHash??'').localeCompare(String(b.sourceHash??''))||(a.sourceTableIndex??Infinity)-(b.sourceTableIndex??Infinity)||a.reviewId.localeCompare(b.reviewId));
 const prompts=PRINCIPAL_ITEMS.map(([promptId,prompt])=>{
  const ratings=reviews.flatMap(r=>r.ratings.filter((v:any)=>v.promptId===promptId));
  const valid=ratings.filter(r=>r.status==='valid'),validDenominator=valid.length;
  return{promptId,prompt,expected:ratings.length,validDenominator,missing:ratings.filter(r=>r.status==='missing').length,unresolved:ratings.filter(r=>r.status==='unresolved').length,categories:PRINCIPAL_CATEGORIES.map(label=>{const count=valid.filter(r=>r.selectedLabel===label).length;return{label,count,percentage:validDenominator?count/validDenominator*100:null};})};
 });
 return{version:'researched.principal-isr-ratings-report.v1',notice:'Structured ISR respondent ratings, separate from narrative MCF findings. Excellent, Good, Average and Poor are ordered categories, not numeric scores. Percentages use valid ratings per prompt; missing and unresolved ratings are reported separately. No composite, weighting or competency mapping.',categories:[...PRINCIPAL_CATEGORIES],reviews,prompts,issues,join:{expectedReviewIds:expected,matchedReviewIds:reviews.filter(r=>!r.warnings.includes('missing_review_id')&&!r.warnings.includes('duplicate_review_id')).map(r=>r.reviewId),missingReviewIds:reviews.filter(r=>r.warnings.includes('missing_review_id')).map(r=>r.reviewId),duplicateReviewIds:reviews.filter(r=>r.warnings.includes('duplicate_review_id')).map(r=>r.reviewId),duplicatedSourceReviewIds,excludedReviewIds,unexpectedReviewIds:source.filter(r=>!expected.includes(r.id)).map(r=>r.id)},totals:{reviews:reviews.length,expected:reviews.length*PRINCIPAL_ITEMS.length,valid:prompts.reduce((n,p)=>n+p.validDenominator,0),missing:prompts.reduce((n,p)=>n+p.missing,0),unresolved:prompts.reduce((n,p)=>n+p.unresolved,0)}};
}
