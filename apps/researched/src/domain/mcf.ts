import {structuralMappingInput} from './compiled-review.js';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import instrument from '../../instruments/mcf/1.0.json' with {type:'json'};
import aids from '../../analysis-config/mcf-retrieval/1.0.json' with {type:'json'};

function freeze<T>(value:T):T { if(value && typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value; }
export const MCF=freeze(instrument);
export const MCF_ANALYSIS_CONFIG=freeze(aids);
export const MCF_HASH=createHash('sha256').update(JSON.stringify(MCF)).digest('hex');
export const MANUAL_ENGINE='researched.mcf.manual.v1';
export const SOFTWARE_VERSION='researched.0.6.0+mcf-proposals.1';
export const SEGMENTER_VERSION=`intl-sentence-en-v1;icu=${process.versions.icu}`;
export const valence=z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous']);
export const competencyId=z.string().refine(id=>MCF.competencies.some(c=>c.id===id),'Unknown MCF competency');
export const actor=z.string().trim().min(1).max(200);
export const datasetInput=z.object({title:z.string().trim().min(1).max(200),mode:z.enum(['reviews','documentary']),reviewCategory:z.enum(['Director','Principal','School','Documentary']),actor}).strict().refine(v=>v.mode==='documentary'?v.reviewCategory==='Documentary':v.reviewCategory!=='Documentary','Choose a category appropriate to the dataset mode');
export const mappingInput=z.object({previousMappingId:z.uuid().nullable().optional(),sheet:z.string().default(''),headerRow:z.number().int().min(1).max(1000).default(1),textColumn:z.number().int().min(0).max(1000).nullable().default(null),institutionColumn:z.number().int().min(0).max(1000).nullable().default(null),identifierColumn:z.number().int().min(0).max(1000).nullable().default(null),categoryColumn:z.number().int().min(0).max(1000).nullable().default(null),institution:z.string().max(500).default(''),reviewIdentifier:z.string().max(500).default(''),structural:structuralMappingInput.optional(),recordMode:z.enum(['document','paragraphs']).default('document'),actor}).strict();
export const sessionInput=z.object({title:z.string().trim().min(1).max(200),kind:z.enum(['coding','validation']),includedUnitIds:z.array(z.uuid()).min(1).max(25000).optional(),blind:z.boolean().default(false),seed:z.string().min(1).max(200).default('pilot-1'),sampleSize:z.number().int().min(1).max(10000).default(20),actor}).strict().refine(v=>!v.blind||v.kind==='validation','Blind review requires a validation sample');
export const decisionInput=z.object({proposalId:z.uuid().optional(),previousId:z.uuid().nullable(),codes:z.array(z.object({competencyId,evidenceStrength:z.enum(['Explicit','Implicit']),valence:valence.nullable(),rationale:z.string().max(5000),evidence:z.string().min(1)}).strict()).max(21),valence:valence.nullable(),reviewedNoCode:z.boolean(),notes:z.string().max(10000),actor}).strict().superRefine((v,c)=>{if(new Set(v.codes.map(x=>x.competencyId)).size!==v.codes.length)c.addIssue({code:'custom',message:'Duplicate competency'});if(v.reviewedNoCode!==(v.codes.length===0))c.addIssue({code:'custom',message:'Explicitly mark a zero-code unit as reviewed with no applicable competency'});});
export const representationInput=z.object({previousId:z.uuid().nullable(),competencyId,state:z.enum(['assessed','not-yet-assessed','source-unavailable']),score:z.number().int().min(0).max(3).nullable(),evidenceUnitIds:z.array(z.uuid()).max(100),notes:z.string().max(10000),actor}).strict().superRefine((v,c)=>{if((v.state==='assessed')!==(v.score!==null))c.addIssue({code:'custom',message:'Assessment state and score disagree'});if(v.score!==null&&v.score>0&&!v.evidenceUnitIds.length)c.addIssue({code:'custom',message:'A score above zero requires traceable evidence'});if(new Set(v.evidenceUnitIds).size!==v.evidenceUnitIds.length)c.addIssue({code:'custom',message:'Duplicate evidence unit'});});
export const segmentInput=z.object({baseSetId:z.uuid(),operation:z.enum(['split','join']),ordinal:z.number().int().min(1),offset:z.number().int().min(1).optional(),reason:z.string().trim().min(1).max(2000),actor}).strict();
export interface Span { start:number; end:number }
export function initialSpans(text:string):Span[]{return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(s=>({start:s.index,end:s.index+s.segment.length}));}
export function editSpans(text:string,spans:Span[],operation:'split'|'join',ordinal:number,offset?:number):Span[]{
 const next=spans.map(s=>({...s})),i=ordinal-1,current=next[i];if(!current)throw Error('unit_not_found');
 if(operation==='join'){const adjacent=next[i+1];if(!adjacent)throw Error('next_unit_required');next.splice(i,2,{start:current.start,end:adjacent.end});}
 else{const position=current.start+(offset??0);if(position<=current.start||position>=current.end||!text.slice(current.start,position).trim()||!text.slice(position,current.end).trim())throw Error('invalid_split_offset');if(/[\uD800-\uDBFF]/.test(text[position-1]??'')&&/[\uDC00-\uDFFF]/.test(text[position]??''))throw Error('split_inside_unicode_character');next.splice(i,1,{start:current.start,end:position},{start:position,end:current.end});}
 return next;
}
export function seededSample(ids:string[],seed:string,count:number){const population=[...new Set(ids)].sort();return population.map(id=>({id,key:createHash('sha256').update(JSON.stringify([seed,id])).digest('hex')})).sort((a,b)=>a.key.localeCompare(b.key)||a.id.localeCompare(b.id)).slice(0,count).map(x=>x.id);}
export function validateDecision(value:z.infer<typeof decisionInput>,text:string,mode:string){
 for(const code of value.codes){if(!text.includes(code.evidence))throw Error('evidence_must_be_an_exact_unit_substring');if(mode==='documentary'&&code.valence!==null)throw Error('documentary_mode_has_no_valence');}
 if(mode==='documentary'&&value.valence!==null)throw Error('documentary_mode_has_no_valence');
}
