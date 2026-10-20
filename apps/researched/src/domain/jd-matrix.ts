import type {RoleEquivalence} from './jd-role-equivalence.js';
import type {JdDocument,DocumentaryKind} from '../application/jd-documents.js';
export const SPECIAL_ED_TERMS='AEA; Child Study Team; CST; RAG; referral; referrals; refer; intervention; interventions; accommodation; accommodations; parent; parents; learning support';
export type JdReview={roles:Record<string,string>;excluded:string[];confirmed:boolean;roleEquivalences?:RoleEquivalence[]|undefined;structure?:Record<string,{kind:DocumentaryKind;dimension:string}>|undefined};
export function reviewedPassages(d:JdDocument,review:JdReview){
 let headingOverride:string|null=null;
 return d.passages.map(p=>{
  if(p.kind==='heading')headingOverride=null;
  const correction=review.structure?.[p.id];
  if(correction?.kind==='heading')headingOverride=p.text.trim();
  return{...p,dimension:headingOverride??p.dimension,...correction,originalDimension:p.dimension,originalKind:p.kind};
 });
}
export function jdMatrix(documents:JdDocument[],review:JdReview,search=''){
 const terms=search.split(';').map(t=>t.trim().toLowerCase()).filter(Boolean);
 const rows=documents.flatMap(d=>reviewedPassages(d,review).filter(p=>(p.kind==='statement'||p.kind==='descriptor')&&!review.excluded.includes(p.id)).map(p=>({...p,documentId:d.id,filename:d.filename,originalRole:d.role,role:review.roles[d.id]||d.role||'Role not established'})))
  .filter(p=>!terms.length||terms.some(t=>(p.text+' '+p.dimension).toLowerCase().includes(t)));
 const labels=[...new Set(documents.map(d=>review.roles[d.id]||d.role).filter(Boolean))];
 const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const mentions=rows.flatMap(p=>labels.filter(role=>role!==p.role&&new RegExp(`\\b${escape(role)}\\b`,'i').test(p.text)).map(role=>({passageId:p.id,sourceRole:p.role,mentionedRole:role,text:p.text,status:'Named role in passage; no handoff or authority inferred'})));
 const unresolvedFields:{documentId:string;passageId:string;text:string;reason:string}[]=[];
 const relationships=documents.flatMap(d=>{
  const result:{documentId:string;role:string;label:string;target:string;passageIds:string[];evidence:{passageId:string;text:string;location:string;start:number;end:number}[]}[]=[];
  d.passages.forEach((p,i)=>{
   const field=/^(Reporting To|Works Closely With|Professional Guidance)(?:\s+([\s\S]+))?$/i.exec(p.text.trim());
   if(!field)return;
   const next=d.passages[i+1], target=field[2]??next?.text;
   const evidencePassages=field[2]?[p]:next?[p,next]:[p];
   const anotherField=/^(Job Title|Position Title|Reporting To|Works Closely With|Professional Guidance|Department|Applicable Sections|Appraised By|Evaluated By|Document Status|Appraisal Cycle|Framework Reference|Appointment Term)(?:\s|$)/i;
   if(p.kind!=='metadata'||!target?.trim()||(!field[2]&&(!next||next.kind!=='metadata'||anotherField.test(next.text.trim())))||evidencePassages.some(x=>d.extracted.slice(x.start,x.end)!==x.text)){
    unresolvedFields.push({documentId:d.id,passageId:p.id,text:p.text,reason:'Relationship field or counterpart cannot be established safely; check the original. No connection created.'});return;
   }
   result.push({documentId:d.id,role:review.roles[d.id]||d.role||'Role not established',label:field[1]!,target,passageIds:evidencePassages.map(x=>x.id),evidence:evidencePassages.map(x=>({passageId:x.id,text:x.text,location:x.location,start:x.start,end:x.end}))});
  });return result;
 });
 const explicitPhrases=rows.flatMap(p=>{
  // Retain the literal action and the complete evidence. Do not invent its grammatical target.
  const found=p.text.match(/\b(?:reports? to|reporting to|refers? .{0,100}? to|referred to|collaborat(?:e|es) with|works? (?:closely )?(?:with|alongside)|communicat(?:e|es) with|primary contact for|line[ -]manages?|participat(?:e|es) in|attends?|contributes? to|escalat(?:e|es)(?: .{0,100}?)? to|provides? guidance to|responsibility (?:of|for)|responsible for)\b/gi)??[];
  return found.map(phrase=>({passageId:p.id,documentRole:p.role,phrase,evidence:p.text,notice:'Literal relationship wording; read the full passage for actor, counterpart, conditions and negation.'}));
 });
 const key=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
 const reportingChains=documents.map(d=>{
  const start=review.roles[d.id]||d.role||'Role not established',links:typeof relationships=[];let current=d.id,reason='No reporting field extracted',seen=new Set<string>();
  while(!seen.has(current)){
   seen.add(current);const fields=relationships.filter(x=>x.documentId===current&&/^Reporting To$/i.test(x.label));
   if(fields.length!==1){reason=fields.length?'Multiple reporting fields; no choice inferred':'No reporting field extracted';break;}
   const link=fields[0]!;links.push(link);const next=documents.filter(x=>key(review.roles[x.id]||x.role)===key(link.target));
   if(next.length!==1){reason=next.length?'Multiple documents share this exact title; continuation unresolved':'Counterpart JD absent or title does not exactly match; no identity inferred';break;}
   current=next[0]!.id;if(seen.has(current))reason='Reporting cycle in extracted fields; check originals';
  }
  return{start,documentId:d.id,links,unresolved:reason};
 });
 return{contract:'researched.jd-matrix.v1',search,terms,rows,relationships,unresolvedFields,reportingChains,mentions,explicitPhrases,notice:'Original dimensions are retained. Search terms are retrieval aids, not replacement dimensions. Mentions do not establish handoffs. All matching passages remain visible; sequence, missing authority and unstated connections are unresolved. No AI, role equivalence or inferred hierarchy is applied.'};
}
