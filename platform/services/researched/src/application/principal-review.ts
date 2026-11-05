import {createHash} from 'node:crypto';
import type {DocBlock,StructuralPreview} from './compiled-review.js';

export const PRINCIPAL_PROFILE={id:'principal-questionnaire',version:'1.0',name:'Principal ISR reviews',heading:'^$',labels:[],comments:'',editorial:'^$',parentNote:'',receiptPrefix:''};
export const PRINCIPAL_SCOPE='MCF will analyse the narrative. Structured ISR ratings are preserved separately and will not influence this run.';
import {PRINCIPAL_ITEMS,PRINCIPAL_CATEGORIES} from '../domain/principal-ratings.js';
export {PRINCIPAL_ITEMS,PRINCIPAL_CATEGORIES} from '../domain/principal-ratings.js';
export function principalRatingExport(preview:any,format:string){
 if(preview.profile.id!=='principal-questionnaire')throw Error('principal_profile_required');
 const questionnaires=preview.blocks.filter((b:any)=>b.questionnaire).map((b:any)=>b.questionnaire);
 if(format==='json')return JSON.stringify({contract:'researched.isr-respondent-ratings.v1',notice:'Structured ISR respondent data; not MCF findings; excluded from semantic targets and context.',sourceHash:preview.sourceHash,structuralHash:preview.hash,profile:preview.profile,questionnaires},null,2);
 const quote=(v:unknown)=>'"'+String(v??'').replaceAll('"','""')+'"';
 const rows:unknown[][]=format==='wide'?[['review_id',...PRINCIPAL_ITEMS.map(([id])=>id),'qa_status']]:[['review_id','rating_item_id','rating_prompt','selected_rating','source_table_index','source_row_index','structural_status','qa_status']];
 for(const q of questionnaires.filter((q:any)=>!q.excludeFromAnalysis)){
  if(format==='wide')rows.push([q.sourceOrderId,...q.ratings.map((r:any)=>r.value),q.ratings.every((r:any)=>r.status==='RECOVERED')?'PASS':'FAIL']);
  else for(const r of q.ratings)rows.push([q.sourceOrderId,r.itemId,r.prompt,r.value,r.sourceTableIndex,r.sourceRowIndex,r.status,r.status==='RECOVERED'?'PASS':'FAIL']);
 }
 return rows.map(r=>r.map(quote).join(',')).join('\r\n')+'\r\n';
}
const headings=['Management style','Academic & disciplinary support','Hiring Process','Additional Comments'];
export function principalPreview($:any,blocks:DocBlock[],bytes:Buffer):StructuralPreview|null{
 const all=$('w\\:tbl').toArray(),top=$('w\\:body').children('w\\:tbl').toArray();
 const text=(node:any)=>$(node).find('w\\:t').toArray().map((t:any)=>$(t).text()).join('');
 const signature=(node:any)=>{const rows=$(node).children('w\\:tr').toArray(),cells=$(rows[0]).children('w\\:tc').toArray().map(text),prompts=rows.slice(1).map((r:any)=>text($(r).children('w\\:tc')[0]));return{rows,cells,prompts,principal:cells.filter((v:string)=>v!=='\u00a0'&&v!=='').join('|')===PRINCIPAL_CATEGORIES.join('|')||prompts.filter((p:string)=>PRINCIPAL_ITEMS.some(i=>i[1]===p)).length>=2};};
 const firstQuestionnaire=top.find((t:any)=>signature(t).principal||text(t).includes('Characteristics:'));
 if(!firstQuestionnaire||!signature(firstQuestionnaire).principal||!(signature(firstQuestionnaire).cells.includes('Excellent')||$(firstQuestionnaire).find('w\\:tbl').length))return null;
 const sourceHash=createHash('sha256').update(bytes).digest('hex');let principalOrdinal=0;
 const anchors:any[]=top.map((node:any,ordinal:number)=>{
  const block=blocks.filter(b=>b.kind==='table')[ordinal]!,s=signature(node),sourceTableIndex=all.indexOf(node)+1;
  block.component='questionnaire';
  const headerValid=JSON.stringify(s.cells)===JSON.stringify(PRINCIPAL_CATEGORIES)||JSON.stringify(s.cells)===JSON.stringify(['\u00a0',...PRINCIPAL_CATEGORIES]);
  const ratings=s.principal?PRINCIPAL_ITEMS.map(([id,prompt])=>{
   const matches=s.rows.map((r:any,i:number)=>({r,i})).filter(({r}:any)=>text($(r).children('w\\:tc')[0])===prompt),warnings:string[]=[];
   if(matches.length!==1)warnings.push(matches.length?'duplicated_prompt':'missing_prompt');
   if(!headerValid)warnings.push('unexpected_header');
   const row=matches.length===1?matches[0]:null,outer=row?$(row.r).children('w\\:tc').toArray():[],nested=outer.length===2?$(outer[1]).children('w\\:tbl').toArray():[],nr=nested.length===1?$(nested[0]).children('w\\:tr').toArray():[],cells=nr.length===1?$(nr[0]).children('w\\:tc').toArray():[];
   if(cells.length!==4)warnings.push('missing_or_extra_rating_columns');
   const candidates=cells.map((c:any,i:number)=>{
    const ps=$(c).children('w\\:p').toArray(),rs=$(c).find('w\\:r').toArray(),ts=$(c).find('w\\:t').toArray();
    const allowed=(n:any,names:string[])=>$(n).children().toArray().every((x:any)=>names.includes(x.name));
    const valid=ps.length===1&&allowed(c,['w:tcPr','w:p'])&&ps.every((p:any)=>allowed(p,['w:pPr','w:r']))&&rs.every((r:any)=>allowed(r,['w:rPr','w:t']))&&!$(c).find('w\\:gridSpan,w\\:vMerge').length;
    const state=valid&&rs.length===1&&ts.length===1&&text(c)==='\u00a0'?'non_selected_nbsp':valid&&!rs.length&&!ts.length?'selected_empty_paragraph':'ambiguous';
    return{column:i+1,label:PRINCIPAL_CATEGORIES[i]??null,state,codepoints:[...text(c)].map(ch=>'U+'+ch.codePointAt(0)!.toString(16).padStart(4,'0')),xml:$.xml(c),sourceTableIndex:all.indexOf(nested[0])+1};
   });
   const selected=candidates.filter((c:any)=>c.state==='selected_empty_paragraph');
   if(selected.length!==1)warnings.push(selected.length?'multiple_selected_cells':'zero_selected_cells');
   if(candidates.some((c:any)=>c.state==='ambiguous')||candidates.filter((c:any)=>c.state==='non_selected_nbsp').length!==3)warnings.push('ambiguous_marker_structure');
   return{itemId:id,prompt,value:warnings.length?'UNRESOLVED':selected[0].label,selectedColumn:warnings.length?null:selected[0].column,sourceTableIndex,sourceRowIndex:row?row.i+1:null,sourceRowIndices:matches.map(({i}:any)=>i+1),candidates,status:warnings.length?'UNRESOLVED':'RECOVERED',warnings};
  }):[];
  const questionnaire={schema:s.principal?'isr-principal-ratings@1.0':'other-questionnaire@1.0',sourceHash,sourceTableIndex,sourceTopLevelTableIndex:ordinal+1,sourceOrderId:s.principal?`principal_review_${String(++principalOrdinal).padStart(4,'0')}`:`other_questionnaire_${String(ordinal+1).padStart(4,'0')}`,ratings,headerCells:s.cells,excludeFromAnalysis:!s.principal};
  Object.assign(block,{questionnaire});return{block,questionnaire};
 });
 for(const b of blocks)if(b.kind==='paragraph'&&headings.includes(b.text.trim()))b.component='marker';
 const candidates=anchors.map(({block,questionnaire}:any,i:number)=>{
  const start=i===0?0:block.index,end=anchors[i+1]?.block.index??blocks.length,part=blocks.slice(start,end),warnings:string[]=[];
  if(start!==block.index)warnings.push('leading_content_requires_boundary_review');
  if(!part.some(b=>b.component==='marker'))warnings.push('review_boundary_uncertainty');
  if(!part.some(b=>b.component==='narrative'&&b.text.trim()))warnings.push('missing_narrative');
  if(questionnaire.ratings.some((r:any)=>r.status==='UNRESOLVED'))warnings.push('unresolved_structured_ratings');
  return{start,end,heading:null,originalReviewNumber:null,headingNameRaw:null,periodRaw:null,campusRaw:null,receiptDateRaw:null,reviewTypeRaw:null,confidence:warnings.length?'review-required' as const:'high' as const,warnings,sourceProfile:questionnaire.schema,excludeFromAnalysis:questionnaire.excludeFromAnalysis};
 });
 const ratings=anchors.flatMap((a:any)=>a.questionnaire.ratings),payload={profile:PRINCIPAL_PROFILE,sourceHash,blocks,candidates,warnings:[PRINCIPAL_SCOPE,'Different questionnaire profiles are preserved separately and excluded from this Principal analysis.'],principalSummary:{reviews:principalOrdinal,expectedRatings:ratings.length,recovered:ratings.filter((r:any)=>r.status==='RECOVERED').length,unresolved:ratings.filter((r:any)=>r.status==='UNRESOLVED').length,otherProfiles:anchors.length-principalOrdinal,boundariesRequiringReview:candidates.filter(c=>c.confidence!=='high').length}};
 return{...payload,hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')} as unknown as StructuralPreview;
}
