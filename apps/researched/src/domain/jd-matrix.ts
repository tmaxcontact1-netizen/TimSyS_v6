import type {JdDocument} from '../application/jd-documents.js';
export const SPECIAL_ED_TERMS='AEA; Child Study Team; CST; RAG; referral; referrals; refer; intervention; interventions; accommodation; accommodations; parent; parents; learning support';
export type JdReview={roles:Record<string,string>;excluded:string[];confirmed:boolean;structure?:Record<string,{kind:'statement'|'metadata'|'heading';dimension:string}>|undefined};
export function reviewedPassages(d:JdDocument,review:JdReview){
 let headingOverride:string|null=null;
 return d.passages.map(p=>{
  if(p.kind==='heading')headingOverride=null;
  const correction=review.structure?.[p.id];
  if(correction?.kind==='heading')headingOverride=p.text.trim();
  return{...p,dimension:headingOverride??p.dimension,...correction,originalDimension:p.dimension};
 });
}
export function jdMatrix(documents:JdDocument[],review:JdReview,search=''){
 const terms=search.split(';').map(t=>t.trim().toLowerCase()).filter(Boolean);
 const rows=documents.flatMap(d=>reviewedPassages(d,review).filter(p=>p.kind==='statement'&&!review.excluded.includes(p.id)).map(p=>({...p,documentId:d.id,filename:d.filename,role:review.roles[d.id]||d.role||'Role not established'})))
  .filter(p=>!terms.length||terms.some(t=>(p.text+' '+p.dimension).toLowerCase().includes(t)));
 const labels=[...new Set(documents.map(d=>review.roles[d.id]||d.role).filter(Boolean))];
 const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const mentions=rows.flatMap(p=>labels.filter(role=>role!==p.role&&new RegExp(`\\b${escape(role)}\\b`,'i').test(p.text)).map(role=>({passageId:p.id,sourceRole:p.role,mentionedRole:role,text:p.text,status:'Named role in passage; no handoff or authority inferred'})));
 const relationships=documents.flatMap(d=>{
  const result:{documentId:string;role:string;label:string;target:string;passageIds:string[]}[]=[];
  d.passages.forEach((p,i)=>{
   const match=/^(Reporting To|Works Closely With|Professional Guidance)\s*$/i.exec(p.text.trim());
   if(match){const next=d.passages[i+1];if(next&&next.kind!=='heading'&&!/^(Evaluated By|Appraised By|Document Status)$/i.test(next.text.trim()))result.push({documentId:d.id,role:review.roles[d.id]||d.role||'Role not established',label:match[1]!,target:next.text,passageIds:[p.id,next.id]});}
   const inline=/^(Reporting To|Works Closely With|Professional Guidance)\s+([\s\S]+)$/i.exec(p.text.trim());
   if(inline)result.push({documentId:d.id,role:review.roles[d.id]||d.role||'Role not established',label:inline[1]!,target:inline[2]!,passageIds:[p.id]});
  });return result;
 });
 const explicitPhrases=rows.flatMap(p=>{
  // Retain the literal action and the complete evidence. Do not invent its grammatical target.
  const found=p.text.match(/\b(?:reports? to|reporting to|refers? .{0,100}? to|referred to|collaborat(?:e|es) with|works? (?:closely )?(?:with|alongside)|communicat(?:e|es) with|primary contact for|line.manages?|participat(?:e|es) in|attends?|contributes? to|escalat(?:e|es) .{0,100}? to|responsibility (?:of|for)|responsible for)\b/gi)??[];
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
 return{contract:'researched.jd-matrix.v1',search,terms,rows,relationships,reportingChains,mentions,explicitPhrases,notice:'Original dimensions are retained. Search terms are retrieval aids, not replacement dimensions. Mentions do not establish handoffs. All matching passages remain visible; sequence, missing authority and unstated connections are unresolved. No AI, role equivalence or inferred hierarchy is applied.'};
}
