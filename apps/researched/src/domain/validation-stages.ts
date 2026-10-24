import {ambiguityInput,retainAmbiguity} from './mcf-ambiguity.js';
import {z} from 'zod';
import {MCF} from './mcf.js';
const competency=z.enum(MCF.competencies.map(c=>c.id) as [string,...string[]]);
const application=z.object({competencyId:competency,route:z.enum(['Explicit','Contextual']),valence:z.enum(['positive','negative','neutral-descriptive','mixed-ambiguous']).nullable(),contextUnitIds:z.array(z.uuid()).max(500),rationale:z.string().trim().max(10000)}).strict();
const coding={ambiguity:ambiguityInput.optional(),applications:z.array(application).max(21),complete:z.boolean(),notes:z.string().trim().max(10000)};
const base={previousId:z.uuid().nullable(),actor:z.string().trim().min(1).max(200)};
export const stagedJudgement=z.discriminatedUnion('phase',[
 z.object({...base,...coding,phase:z.literal('initial')}).strict(),
 z.object({...base,...coding,phase:z.literal('final'),outcome:z.enum(['agreement','additional-application','rejected-application','route-or-valence-change','mixed','unresolved'])}).strict(),
 z.object({...base,phase:z.literal('assistance'),assistant:z.string().trim().min(1).max(200),model:z.string().trim().max(200),reference:z.string().trim().max(1000),advice:z.string().trim().min(1).max(30000),notes:z.string().trim().max(10000),withdrawn:z.boolean()}).strict()
]).superRefine((v,ctx)=>{
 if(v.phase==='assistance')return;
 if(v.ambiguity?.alternatives.some(a=>v.applications.some(s=>s.competencyId===a.competencyId)))ctx.addIssue({code:'custom',message:'An alternative must be separate from supported applications'});
 if(new Set(v.applications.map(a=>a.competencyId)).size!==v.applications.length)ctx.addIssue({code:'custom',message:'Duplicate competency'});
 for(const a of v.applications){
  if(new Set(a.contextUnitIds).size!==a.contextUnitIds.length)ctx.addIssue({code:'custom',message:'Duplicate context passage'});
  if(a.route==='Explicit'&&a.contextUnitIds.length)ctx.addIssue({code:'custom',message:'Explicit coding must stand on the target alone'});
  if(v.complete&&a.route==='Contextual'&&(!a.contextUnitIds.length||!a.rationale))ctx.addIssue({code:'custom',message:'Contextual coding requires supporting passages and an explanation'});
 }
 if(v.phase==='final'&&v.complete&&!v.notes)ctx.addIssue({code:'custom',message:'Explain your final decision, including any use of AI advice'});
});
export type StagedJudgement=z.infer<typeof stagedJudgement>;
export function latestStage(history:any[],unitId:string,phase:string){return history.filter(h=>h.after_value.unitId===unitId&&h.after_value.phase===phase).at(-1);}
export function stageProgress(units:any[],history:any[]){return{total:units.length,initialComplete:units.filter(u=>latestStage(history,u.id,'initial')?.after_value.complete).length,finalComplete:units.filter(u=>latestStage(history,u.id,'final')?.after_value.complete).length};}
export function retainHumanContext(v:StagedJudgement,target:any,context:any[]){
 if(v.phase==='assistance')return v;
 return{...v,...(v.ambiguity?{ambiguity:retainAmbiguity(v.ambiguity,target,context)}:{}),zeroCode:v.complete?v.applications.length===0:null,applications:v.applications.map(a=>({...a,context:a.contextUnitIds.map(id=>{
  const u=context.find(x=>x.id===id);
  if(!u||id===target.id||u.unit_set_id!==target.unit_set_id||!u.record_id||u.record_id!==target.record_id)throw Error('Context must cite an additional permitted passage from this same review');
  return{unitId:u.id,recordId:u.record_id,unitSetId:u.unit_set_id,startOffset:u.start_offset,endOffset:u.end_offset,quote:u.original_text};
 })}))};
}
