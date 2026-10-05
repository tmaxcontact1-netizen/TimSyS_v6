import profile from '../../analysis-config/compiled-review/1.0.json' with {type:'json'};
import JSZip from 'jszip';
import {load} from 'cheerio';
import {createHash} from 'node:crypto';
import type {z} from 'zod';
import {structuralMappingInput} from '../domain/compiled-review.js';
export {structuralMappingInput} from '../domain/compiled-review.js';

// A parser profile is analysis configuration, never part of the MCF instrument.
export const QUESTIONNAIRE_PROFILE=Object.freeze(profile);
export type Component='heading'|'questionnaire'|'editorial'|'marker'|'narrative';
export interface DocBlock {index:number;bodyIndex:number;kind:'paragraph'|'table';text:string;rows?:string[][];component:Component}
export interface Candidate {start:number;end:number;heading:string|null;originalReviewNumber:string|null;headingNameRaw:string|null;periodRaw:string|null;campusRaw:string|null;receiptDateRaw:string|null;reviewTypeRaw:string|null;confidence:'high'|'review-required';warnings:string[]}
export interface StructuralPreview {profile:typeof QUESTIONNAIRE_PROFILE;hash:string;blocks:DocBlock[];candidates:Candidate[];warnings:string[]}
const normal=(s:string)=>s.replace(/\s+/g,' ').trim();

export async function inspectCompiledDocx(bytes:Buffer):Promise<StructuralPreview>{
 const zip=await JSZip.loadAsync(bytes);let size=0;
 for(const file of Object.values(zip.files)){size+=Number((file as any)._data?.uncompressedSize??0);if(size>100_000_000)throw Error('docx_uncompressed_limit');}
 const part=zip.file('word/document.xml');if(!part)throw Error('missing_docx_document');const xml=await part.async('string');if(xml.length>50_000_000)throw Error('docx_part_limit');
 const $=load(xml,{xml:true}),blocks:DocBlock[]=[],warnings:string[]=[];
 // Keep run boundaries invisible but preserve explicit tabs, line breaks and paragraph boundaries.
 const text=(node:any):string=>{if(node.name==='w:t')return $(node).text();if(node.name==='w:tab')return '\t';if(['w:br','w:cr'].includes(node.name))return '\n';return (node.children??[]).map(text).join('');};
 $('w\\:body').children().each((bodyIndex,node)=>{
  if(node.tagName==='w:p')blocks.push({index:blocks.length,bodyIndex,kind:'paragraph',text:text(node),component:'narrative'});
  else if(node.tagName==='w:tbl'){
   const rows=$(node).children('w\\:tr').toArray().map(r=>$(r).children('w\\:tc').toArray().map(c=>$(c).children('w\\:p').toArray().map(text).join('\n')));
   blocks.push({index:blocks.length,bodyIndex,kind:'table',rows,text:rows.map(r=>r.join('\t')).join('\n'),component:'narrative'});
  }else if(!['w:sectPr','w:bookmarkStart','w:bookmarkEnd','w:proofErr'].includes(node.tagName))warnings.push(`unsupported_body_element:${bodyIndex}:${node.tagName}`);
 });
 if(blocks.reduce((n,b)=>n+b.text.length,0)>5_000_000)throw Error('import_record_limit');
 if($('w\\:drawing,w\\:pict,w\\:altChunk,w\\:ins,w\\:del,w\\:tbl w\\:tbl').length)warnings.push('nonstandard_content_requires_original_document_review');
 const header=new RegExp(QUESTIONNAIRE_PROFILE.heading,'i'),editorial=new RegExp(QUESTIONNAIRE_PROFILE.editorial,'i');
 const anchors:number[]=[];
 for(const b of blocks){if(b.kind!=='table'||normal(blocks[b.index+1]?.text??'')!==QUESTIONNAIRE_PROFILE.comments)continue;
  const labels=b.rows?.map(r=>normal(r[0]??''))??[];
  const signature=QUESTIONNAIRE_PROFILE.labels.every(label=>labels.includes(label));
  const previous=blocks.slice(Math.max(0,b.index-3),b.index);
  const emptyParent=!b.text.trim()&&previous.some(x=>normal(x.text)===QUESTIONNAIRE_PROFILE.parentNote)&&previous.some(x=>header.test(normal(x.text)));
  if(signature||emptyParent){anchors.push(b.index);b.component='questionnaire';blocks[b.index+1]!.component='marker';}
 }
 const starts=anchors.map((a,i)=>{let start=a;for(let j=a-1;j>(anchors[i-1]??-1);j--){const t=normal(blocks[j]!.text);if(!t||editorial.test(t)){start=j;continue;}if(header.test(t)){start=j;blocks[j]!.component='heading';}break;}return start;});
 if(starts.length&&starts[0]!>0){warnings.push('leading_content_requires_boundary_review');starts[0]=0;}
 for(const b of blocks)if(b.kind==='paragraph'&&editorial.test(normal(b.text))&&anchors.some(a=>b.index<a&&starts[anchors.indexOf(a)]!<=b.index))b.component='editorial';
 const candidates=starts.map((start,i)=>describeCandidate(blocks,start,starts[i+1]??blocks.length));
 if(!candidates.length)warnings.push('no_matching_review_candidates');
 if(blocks.some(b=>b.text.includes('\uFFFD')))warnings.push('replacement_characters_preserved');
 if(candidates.some(c=>!c.heading))warnings.push('missing_headings_require_researcher_review');
 warnings.push('Institution identity is not inferred from narrative mentions. Heading names and periods retain their source meaning without author/date assumptions.');
 const payload={profile:QUESTIONNAIRE_PROFILE,blocks,candidates,warnings};
 return{...payload,hash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
}

export function describeCandidate(blocks:DocBlock[],start:number,end:number):Candidate{
 const part=blocks.slice(start,end),heading=part.find(b=>b.component==='heading')?.text??null;
 const match=heading?new RegExp(QUESTIONNAIRE_PROFILE.heading,'i').exec(normal(heading)):null;
 // Slice metadata from the original heading so source spacing/spelling remain available.
 const tail=heading?.match(/Review\s+\d+\)\s*([\s\S]*)$/i)?.[1]??'';
 const period=tail.match(/(?:19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\s*$/);
 const notes=part.filter(b=>b.component==='editorial');const warnings:string[]=[];
 if(!heading)warnings.push('missing_review_heading');
 if(part.filter(b=>b.component==='heading').length>1)warnings.push('multiple_review_headings');
 if(part.some(b=>b.kind==='table'&&b.component!=='questionnaire'))warnings.push('unrecognised_table');
 if(heading&&part.find(b=>b.text.trim())?.component!=='heading')warnings.push('content_before_heading');
 if(part.some(b=>b.text.includes('\uFFFD')))warnings.push('replacement_character');
 if(part.filter(b=>b.component==='questionnaire').length!==1)warnings.push('questionnaire_boundary_requires_review');
 if(!part.some(b=>b.component==='narrative'&&b.text.trim()))warnings.push('missing_narrative');
 return{start,end,heading,originalReviewNumber:match?.[2]??null,headingNameRaw:period?tail.slice(0,period.index).trim()||null:tail.trim()||null,periodRaw:period?.[0].trim()??null,
 campusRaw:match?.[1]&&/Campus$/i.test(match[1])?match[1]:null,
 receiptDateRaw:notes.find(b=>normal(b.text).startsWith(QUESTIONNAIRE_PROFILE.receiptPrefix))?.text??null,
 reviewTypeRaw:notes.find(b=>normal(b.text)===QUESTIONNAIRE_PROFILE.parentNote)?.text??null,
 confidence:heading&&!warnings.some(w=>w!=='replacement_character')?'high':'review-required',warnings};
}

export function mapCompiledRecords(preview:StructuralPreview,input:z.infer<typeof structuralMappingInput>,category:string){
 if(preview.hash!==input.hash)throw Error('stale_structural_preview');
 if(input.profile!==`${preview.profile.id}@${preview.profile.version}`)throw Error('structural_profile_mismatch');
 let next=0;
 const records=input.records.map((r,i)=>{
  if(r.start!==next||r.end<=r.start||r.end>preview.blocks.length)throw Error('boundaries_must_partition_all_source_blocks');next=r.end;
  const metadata=describeCandidate(preview.blocks,r.start,r.end),components=preview.blocks.slice(r.start,r.end),spans:{block:number;start:number;end:number}[]=[];let text='';
  for(const b of components){if(!(r.include as string[]).includes(b.component)||!b.text)continue;if(text)text+='\n\n';const start=text.length;text+=b.text;spans.push({block:b.index,start,end:text.length});}
  if(!text.trim())throw Error('selected_components_have_no_text');if(text.includes('\0'))throw Error('text_contains_null_character');
  return{text,institution:r.institution.name,reviewIdentifier:metadata.originalReviewNumber??`source-block:${r.start+1}`,reviewCategory:category,
   locator:{profile:input.profile,structuralHash:preview.hash,candidateOrdinal:i+1,blockStart:r.start,blockEnd:r.end,metadata,institution:r.institution,components:components.map(({index,bodyIndex,kind,component})=>({index,bodyIndex,kind,component})),analysisComponents:r.include,analysisSpans:spans,researcherNotes:r.notes,identifierIsGenerated:metadata.originalReviewNumber===null}};
 });
 if(next!==preview.blocks.length)throw Error('boundaries_must_partition_all_source_blocks');return records;
}
