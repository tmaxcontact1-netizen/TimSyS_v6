import scale from '../../analysis-config/source-metadata/isr-director-ratings-1.0.json' with {type:'json'};

// Source metadata is deliberately separate from the frozen MCF instrument.
export const ISR_RATING_RULES=`Authoritative source metadata for ambiguity assessment only: the supplied ISR numerical ratings use a 5-point evaluative scale. 1 = lowest / strongly negative; 2 = negative; 3 = midpoint / average; 4 = positive; 5 = highest / strongly positive. Do not flag these rating fields as ambiguous merely because the review does not repeat the scale anchors or direction. Transparent 1 has known negative numerical valence; Transparent 5 has known positive numerical valence. A Person of Integrity 1 and Overall Rating 1 are negative; their ratings of 5 are positive. This resolves numerical valence ambiguity only. Known rating direction does not establish competency application or resolve a referent. Flexible 4 may still have an unclear referent between interpersonal accommodation and organisational adaptability. Fair 3 has known midpoint valence but may still have genuine competency ambiguity. Keep all other ambiguity rules and the existing evidential threshold unchanged. Never infer supported competencies from a rating value alone, and never promote alternatives into supported findings. Apply this metadata only to the supplied ISR questionnaire rating spans, not arbitrary numbers, narrative text, other scales or other reviews. Do not change any supported-count logic.`;

export function isrRating(field:string,value:number){
 if(!scale.fields.includes(field)||!Number.isInteger(value)||value<1||value>5)return null;
 return {field,value,...scale.anchors[String(value) as keyof typeof scale.anchors]};
}
type Unit={id:string;record_id:string;unit_set_id:string;start_offset:number;end_offset:number};
type RecordSource={id:string;original_text:string;locator?:{profile?:string;components?:{index:number;component:string}[];analysisSpans?:{block:number;start:number;end:number}[]}};
export function snapshotIsrRatings(records:RecordSource[],units:Unit[]){
 const ratings=[];
 for(const record of records){
  const locator=record.locator;
  if(!/^director-questionnaire@1\.[01]$/.test(locator?.profile??''))continue;
  for(const span of locator?.analysisSpans??[]){
   if(!locator?.components?.some(c=>c.index===span.block&&c.component==='questionnaire'))continue;
   const text=record.original_text.slice(span.start,span.end);
   const pattern=new RegExp('(?:^|\\n)('+scale.fields.join('|')+')[ \\t\\u00a0]*:?[\\s]+([1-5])(?:[ \\t\\u00a0]*\\/[ \\t\\u00a0]*5)?[ \\t\\u00a0]*(?=\\r?\\n|$)','g');
   for(const match of text.matchAll(pattern)){
    const leading=match[0].startsWith('\n')?1:0,startOffset=span.start+match.index+leading,endOffset=span.start+match.index+match[0].length;
    const applicable=units.filter(u=>u.record_id===record.id&&u.start_offset<endOffset&&u.end_offset>startOffset);
    if(!applicable.length)continue;
    // Do not use rating text excluded from the approved contextual population.
    const quote=record.original_text.slice(startOffset,endOffset);
    if([...quote.matchAll(/\S/g)].some(m=>!applicable.some(u=>u.start_offset<=startOffset+m.index&&u.end_offset>startOffset+m.index)))continue;
    ratings.push({...isrRating(match[1]!,Number(match[2]))!,recordId:record.id,unitIds:applicable.map(u=>u.id),unitSetIds:[...new Set(applicable.map(u=>u.unit_set_id))],startOffset,endOffset,quote});
   }
  }
 }
 return {scale:structuredClone(scale),instructions:ISR_RATING_RULES,ratings};
}

export function isrMetadataForRequest(configuration:{ambiguityProtocol?:number;ambiguitySourceMetadata?:ReturnType<typeof snapshotIsrRatings>},unitSetId:string){
 // Never inject current metadata into a historical run or its resume requests.
 const saved=configuration.ambiguityProtocol===2?configuration.ambiguitySourceMetadata:null;
 if(!saved)return {metadata:null,instructions:''};
 const metadata={...saved,ratings:saved.ratings.filter(r=>r.unitSetIds.includes(unitSetId))};
 if(!metadata.ratings.length)return {metadata:null,instructions:''};
 return {metadata,instructions:'\n'+metadata.instructions+'\nAuthoritative ISR rating source metadata: '+JSON.stringify({scale:metadata.scale,ratings:metadata.ratings})};
}
