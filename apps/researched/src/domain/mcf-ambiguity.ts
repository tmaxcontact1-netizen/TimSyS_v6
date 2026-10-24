import {z} from 'zod';
import {MCF} from './mcf.js';
const competency=z.enum(MCF.competencies.map(c=>c.id) as [string,...string[]]);
export const ambiguityInput=z.object({version:z.literal(1),status:z.enum(['not-assessed','none','identified','unresolved']),reason:z.string().trim().max(10000),evidenceUnitIds:z.array(z.uuid()).max(500),alternatives:z.array(z.object({competencyId:competency,interpretation:z.string().trim().min(1).max(10000),evidenceUnitIds:z.array(z.uuid()).min(1).max(500)}).strict()).max(21)}).strict().superRefine((v,c)=>{
 const flagged=['identified','unresolved'].includes(v.status);
 if(flagged&&(!v.reason||!v.evidenceUnitIds.length))c.addIssue({code:'custom',message:'Explain the ambiguity and cite its source passages'});
 if(!flagged&&(v.reason||v.evidenceUnitIds.length||v.alternatives.length))c.addIssue({code:'custom',message:'Ambiguity details require an identified or unresolved status'});
 if(new Set(v.alternatives.map(a=>a.competencyId)).size!==v.alternatives.length)c.addIssue({code:'custom',message:'Duplicate alternative competency'});
 for(const ids of [v.evidenceUnitIds,...v.alternatives.map(a=>a.evidenceUnitIds)])if(new Set(ids).size!==ids.length)c.addIssue({code:'custom',message:'Duplicate ambiguity evidence passage'});
});
export function retainAmbiguity(value:z.infer<typeof ambiguityInput>|undefined,target:any,context:any[]){
 if(!value)return undefined;
 const cite=(ids:string[])=>ids.map(id=>{const u=context.find(x=>x.id===id);if(!u||!target.record_id||u.record_id!==target.record_id||u.unit_set_id!==target.unit_set_id)throw Error('Ambiguity evidence must come from permitted passages in the same review');return{unitId:id,recordId:u.record_id,unitSetId:u.unit_set_id,startOffset:u.start_offset,endOffset:u.end_offset,quote:u.original_text};});
 return{...value,evidence:cite(value.evidenceUnitIds),alternatives:value.alternatives.map(a=>({...a,evidence:cite(a.evidenceUnitIds)}))};
}
export function ambiguityReport(units:any[],history:any[],phase:string){
 const rows=units.map(u=>{const h=history.filter(h=>h.after_value.unitId===u.id&&h.after_value.phase===phase).at(-1),v=h?.after_value;return{unitId:u.id,recordId:u.record_id,text:u.original_text,decisionId:h?.id??null,actor:h?.actor??null,recordedAt:h?.occurred_at??null,complete:!!v?.complete,status:v?.ambiguity?.status??'not-assessed',ambiguity:v?.ambiguity??null,applications:v?.applications??[],notes:v?.notes??'',outcome:v?.outcome??null};});
 const completed=rows.filter(r=>r.complete),eligible=completed.filter(r=>r.status!=='unresolved');
 return{version:1,phase,scope:'Selected validation passages only; not whole-corpus prevalence. Latest draft revisions are excluded from completed-judgement counts.',totalPassages:rows.length,completedJudgements:completed.length,notAssessed:rows.filter(r=>r.status==='not-assessed').length,flagged:rows.filter(r=>['identified','unresolved'].includes(r.status)).length,unresolved:rows.filter(r=>r.status==='unresolved').length,comparison:{allCompletedPassages:completed.length,excludingUnresolvedPassages:eligible.length,competencies:MCF.competencies.map(c=>({competencyId:c.id,competency:c.competency,allSupported:completed.filter(r=>r.applications.some((a:any)=>a.competencyId===c.id)).length,excludingUnresolved:eligible.filter(r=>r.applications.some((a:any)=>a.competencyId===c.id)).length,alternativeMentions:completed.filter(r=>r.ambiguity?.alternatives?.some((a:any)=>a.competencyId===c.id)).length}))},rows};
}
