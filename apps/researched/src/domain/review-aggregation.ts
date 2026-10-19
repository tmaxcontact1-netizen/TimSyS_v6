import MCF from '../../instruments/mcf/1.0.json' with {type:'json'};
export const REVIEW_REPORT_VERSION='mcf-review-report.v1';
export const REVIEW_PRIVACY_NOTICE='Review prevalence describes representation across distinct reviews in the analysed corpus. It must not be interpreted as prevalence across unique directors or schools. Multiple reviews may concern the same director, but director and school identifiers were excluded from the research dataset in accordance with the data-use agreement.';
export function reviewAggregation(units:any[],proposals:any[]){
 const substantive=units.filter(u=>u.original_text?.trim()),byId=new Map(substantive.map(u=>[u.id,u]));
 if(substantive.some(u=>!u.record_id))throw Error('review_identity_missing');
 const eligibleReviewIds=[...new Set<string>(substantive.map(u=>u.record_id))].sort();
 const locations=proposals.flatMap(p=>{const u=byId.get(p.unit_id),v=p.payload??p;if(!u||v.method==='deterministic')return[];return(v.codes??[]).filter((c:any)=>c.evidenceProtocol===2&&['Explicit','Contextual'].includes(c.evidenceStrength)).map((c:any)=>({unitId:u.id,reviewId:u.record_id,proposalId:p.id??null,competencyId:c.competencyId,route:c.evidenceStrength,valence:c.valence??null,startOffset:u.start_offset,endOffset:u.end_offset}));});
 return{version:REVIEW_REPORT_VERSION,notice:REVIEW_PRIVACY_NOTICE,denominator:'Distinct source-record IDs with at least one substantive unit in this frozen population',eligibleReviews:eligibleReviewIds.length,eligibleReviewIds,competencies:MCF.competencies.map(c=>{
  const evidence=locations.filter((e:any)=>e.competencyId===c.id),reviewIds=[...new Set<string>(evidence.map((e:any)=>e.reviewId))].sort(),explicitReviewIds=[...new Set<string>(evidence.filter((e:any)=>e.route==='Explicit').map((e:any)=>e.reviewId))].sort(),contextualOnlyReviewIds=reviewIds.filter(id=>!explicitReviewIds.includes(id));
  const valence=Object.fromEntries(['positive','negative','neutral-descriptive','mixed-ambiguous'].map(v=>[v,evidence.filter((e:any)=>e.valence===v).length]));
  return{competencyId:c.id,competency:c.competency,evidenceLocations:evidence.length,reviewsRepresented:reviewIds.length,reviewPrevalence:eligibleReviewIds.length?100*reviewIds.length/eligibleReviewIds.length:null,explicitReviews:explicitReviewIds.length,contextualOnlyReviews:contextualOnlyReviewIds.length,evidenceDensity:reviewIds.length?evidence.length/reviewIds.length:null,valence:{...valence,unassigned:evidence.filter((e:any)=>e.valence===null).length},reviewIds,explicitReviewIds,contextualOnlyReviewIds,evidence};
 })};
}
