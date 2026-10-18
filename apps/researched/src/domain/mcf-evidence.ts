import {suspectedCompilation} from './review-boundaries.js';
import {evidenceCounts} from './evidence-summary.js';
export {evidenceCounts} from './evidence-summary.js';
import {z} from 'zod';
import {MCF} from './mcf.js';
export const EVIDENTIAL_PROTOCOL=2;
export const EVIDENTIAL_RULES=`Assess all 21 competencies for every TARGET unit. Explicit means the target alone contains sufficient meaning; its application remains defensible without surrounding text. Contextual means the target supports the application only when interpreted with relevant permitted units from the SAME individual review. These are equally valid supported applications, never confidence levels. Use antecedents, pronouns, contrasts, examples and cumulative narrative where relevant. For Contextual cite every additional unit actually relied on and explain what it establishes. Never infer an application merely because another unit discusses a competency. Do not cross review boundaries. Return codes only for supported applications; omitted competencies mean No application after assessing the target and all supplied permitted context. Return exactly the requested TARGET IDs, not context-only units. Preserve valence independently. Evidence must be an exact target quotation. Context quotations must be exact substrings of their cited units.`;
export const contextReference=z.object({unitId:z.uuid(),quote:z.string().min(1)}).strict();
export const evidentialResponse=z.object({units:z.array(z.object({unitId:z.uuid(),codes:z.array(z.object({competencyId:z.enum(MCF.competencies.map(c=>c.id) as [string,...string[]]),evidenceStrength:z.enum(['Explicit','Contextual']),context:z.array(contextReference),valence:z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous']).nullable(),rationale:z.string().trim().min(1).max(5000),evidence:z.string().min(1).max(20000)}).strict()).max(21),valence:z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous']).nullable(),notes:z.string().max(10000)}).strict()).min(1).max(6)}).strict();
export function confirmedReview(record:any,configuration:any){return !!record?.locator?.profile||(!suspectedCompilation(record?.original_text??'')&&configuration?.reviewBoundariesConfirmed===true);}
export function validateContext(codes:any[],target:any,pool:any[]){
 for(const code of codes){
  if(code.evidenceProtocol!==2)continue;
  if(!['Explicit','Contextual'].includes(code.evidenceStrength))throw Error('Choose Explicit or Contextual under the current evidential protocol.');
  const refs=code.context??[];
  if(code.evidenceStrength==='Contextual'&&(!refs.length||!code.rationale?.trim()))throw Error('Contextual application requires contextual evidence and a rationale.');
  if(code.evidenceStrength==='Explicit'&&refs.length)throw Error('Explicit application must be supported by the target alone.');
  if(new Set(refs.map((r:any)=>r.unitId)).size!==refs.length)throw Error('Duplicate contextual unit.');
  for(const ref of refs){const u=pool.find(u=>u.id===ref.unitId);if(!u||u.id===target.id||u.unit_set_id!==target.unit_set_id||!ref.quote||!u.original_text.includes(ref.quote))throw Error('Context must cite exact text from another permitted unit in the same review and segmentation version.');}
 }
}
export function retainContext(codes:any[],target:any,pool:any[]){validateContext(codes,target,pool);return codes.map(code=>({...code,context:(code.context??[]).map((ref:any)=>{const u=pool.find(u=>u.id===ref.unitId);const start=u.original_text.indexOf(ref.quote);return{unitId:u.id,quote:ref.quote,recordId:target.record_id,unitSetId:u.unit_set_id,startOffset:u.start_offset+start,endOffset:u.start_offset+start+ref.quote.length};})}));}
export function competencyEvidenceCounts(proposals:any[]){return MCF.competencies.map(c=>({competencyId:c.id,competency:c.competency,...evidenceCounts(proposals.flatMap(p=>(p.payload??p).codes??[]).filter(c2=>c2.competencyId===c.id))}));}
