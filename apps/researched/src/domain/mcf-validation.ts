import {z} from 'zod';
import {MCF,seededSample} from './mcf.js';
const competency=z.enum(MCF.competencies.map(c=>c.id) as [string,...string[]]);
export const validationStratum=z.object({label:z.string().trim().min(1).max(100),competency:competency.optional(),route:z.enum(['Explicit','Contextual']).optional(),valence:z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous','unassigned']).optional(),semantic:z.enum(['coded','zero-code']).optional(),size:z.number().int().min(1).max(25000)}).strict();
export const validationPlan=z.object({title:z.string().trim().min(1).max(200),actor:z.string().trim().min(1).max(200),seed:z.string().trim().min(1).max(200),blind:z.boolean(),strata:z.array(validationStratum).min(1).max(100),overlap:z.enum(['reject','deduplicate'])}).strict();
export const validationJudgement=z.object({previousId:z.uuid().nullable(),actor:z.string().trim().min(1).max(200),applications:z.array(z.object({competencyId:competency,application:z.enum(['supported','not-supported']).nullable(),route:z.enum(['Explicit','Contextual']).nullable(),valence:z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous']).nullable()}).strict()).max(21),zeroCode:z.enum(['supported','not-supported']).nullable(),notes:z.string().max(10000)}).strict().refine(v=>new Set(v.applications.map(x=>x.competencyId)).size===v.applications.length,'Duplicate competency judgement');
export function sampleValidation(proposals:any[],plan:z.infer<typeof validationPlan>){
 const rows=plan.strata.map((s,index)=>{
  const eligible=proposals.filter(p=>{const v=p.payload,codes=v.codes??[];if(v.method==='deterministic')return false;if(s.semantic==='zero-code'&&codes.length||s.semantic==='coded'&&!codes.length)return false;
   if(s.competency||s.route||s.valence)return codes.some((c:any)=>c.evidenceProtocol===2&&(!s.competency||c.competencyId===s.competency)&&(!s.route||c.evidenceStrength===s.route)&&(!s.valence||(c.valence??'unassigned')===s.valence));return true;}).map(p=>p.unit_id);
  if(s.size>new Set(eligible).size)throw Error('Stratum '+s.label+' requests more units than are eligible ('+new Set(eligible).size+').');
  return{...s,index,eligibleUnitIds:[...new Set<string>(eligible)].sort(),selectedUnitIds:seededSample(eligible,JSON.stringify([plan.seed,index]),s.size)};
 });
 const selections=rows.flatMap(r=>r.selectedUnitIds),selectedUnitIds=[...new Set(selections)];
 if(selectedUnitIds.length!==selections.length&&plan.overlap==='reject')throw Error('Selected strata overlap. Change the strata or explicitly choose deduplication; no quota is filled automatically.');
 return{algorithm:'sha256-json-seed-stratum-unit.v1',strata:rows,selectedUnitIds,overlapRemoved:selections.length-selectedUnitIds.length};
}
