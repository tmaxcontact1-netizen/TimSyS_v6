import type {Passage} from '../application/jd-documents.js';
export type DocumentaryRow=Passage&{documentId:string;filename:string;role:string};
const actorNoun='(?:principals?|coordinators?|directors?|teachers?|counsel(?:l)?ors?|parents?|students?|staff|administrators?|families|family|teams?|committees?|supervisors?|leaders?|nurses?|specialists?|personnel|heads?|school administration|interventionists?|departments?|faculty|partners?|agencies|academic leadership|school leadership|leadership|student council)';
const actorEnd=new RegExp('\\b'+actorNoun+'(?:\\s*\\([^)]*\\))?$','i');
const negation=/\b(?:does? not|do not|cannot|can not|must not|may not|is not|are not|not permitted|never|no authority|remain(?:s)? (?:with|the responsibility of)|sit with|not discipline|outside (?:the|their|its) (?:role|authority)|beyond (?:the|their|its) (?:role|authority))\b/i;
// Closed literal grammar. No synonym expansion, role equivalence or semantic matching.
const verbs=/\b(?:reports?(?:\s+(?:findings|outcomes|progress|concerns))?\s+to|reporting to|line[ -]manages?|works?\s+(?:closely\s+)?(?:with|alongside)|collaborat(?:e|es)\s+(?:closely\s+|effectively\s+)?with|coordinat(?:e|es) with|in coordination with|provides? (?:professional )?guidance to|supports?|assists?|advises?|refers?(?:\s+[^.!?;]{1,80}?)?\s+to|escalat(?:e|es)(?:\s+[^.!?;]{1,80}?)?\s+to|shares?(?:\s+(?:findings|outcomes|progress|concerns))?\s+with|communicat(?:e|es) with|(?:serves? as (?:the )?)?primary contact for|(?:as )?directed by|(?:as )?supervised by|(?:as )?assigned by|approved by|accountable to)\b/gi;
const imperative=/^(?:manage|manages|perform|performs|supervise|supervises|demonstrate|demonstrates|deal|deals|work|works|collaborate|collaborates|coordinate|coordinates|provide|provides|support|supports|assist|assists|advise|advises|refer|refers|escalate|escalates|share|shares|communicate|communicates|serve|serves|report|reports|line[ -]manage|line[ -]manages|document|documents|conduct|conducts|keep|keeps|maintain|maintains|monitor|monitors|attend|attends|participate|participates|create|creates|implement|implements)\b/i;
const trimActor=(s:string)=>s.replace(/^(?:the|a|an)\s+/i,'').trim();
function isActor(s:string,labels:string[]){const t=trimActor(s);return labels.some(x=>x.toLowerCase()===t.toLowerCase())||(!/\b(?:if|when|where|unless|while|who|that|not|will|must|may|can|to|with|works|provides|supports|assists|ensures|implements|shares|refers|reports|facilitate|facilitates|recruit|recruits|hire|hires|retain|retains|develop|develops|led)\b/i.test(t)&&t.split(/\s+/).length<=12&&(actorEnd.test(t)||/^(?:Deputy\s+)?(?:Director|Head) of [A-Za-z ]+$/i.test(t)));}
function counterparts(text:string,labels:string[]){
 if(/^[,;:.!?]/.test(text)||/^(?:to|for|with|in|of|on|by|and|or)\b/i.test(text))return[];
 const end=text.search(/\s+(?:to|for|with|who|which|that|where|when|unless|as|through|regarding|concerning|seeking|enrolled|in order to)\b|,\s*(?:recruit|hire|retain|support|provide|communicate|work|facilitate)\b|(?:^|\s+)(?:and|or)\s+(?:holds?|has|maintains?|retains?|performs?|facilitat(?:e|es)|works?|provides?|supports?|assists?|ensures?|shares?|refers?|reports?|communicat(?:e|es))\b|[;.!?]/i);
 const clause=(end<0?text:text.slice(0,end)).trim().replace(/[,\s]+$/,'');
 const parts:{text:string;index:number}[]=[];
 for(const m of clause.matchAll(/[^,]+/g)){
  const chunk=m[0],offset=m.index!;
  const conjunctions=[...chunk.matchAll(/\s+(?:and|or)\s+/gi)];let divided=false;
  for(const join of conjunctions){const left=chunk.slice(0,join.index),right=chunk.slice(join.index!+join[0].length);if(isActor(left.trim(),labels)&&isActor(right.trim(),labels)){parts.push({text:left,index:offset},{text:right,index:offset+join.index!+join[0].length});divided=true;break;}}
  if(!divided)parts.push({text:chunk,index:offset});
 }
 const candidates=parts.map(p=>{const leading=p.text.match(/^\s*(?:(?:and|or)\s+)?/)![0];const wording=p.text.slice(leading.length).trim();return{wording,index:p.index+leading.length};});const result:typeof candidates=[];for(const candidate of candidates){if(!isActor(candidate.wording,labels))break;result.push(candidate);}return result;
}
function resolveActor(prefix:string,sentence:string,sourceRole:string,labels:string[],phrase:string){
 const clean=prefix.replace(/^[•●▪◦\s]+/,'').trim();
 if(!clean)return{actor:sourceRole,basis:'JD responsibility subject'};
 const explicit=clean.replace(/\s+(?:will|must|shall|may|can|also|is|are)\s*$/i,'').trim();
 if(isActor(explicit,labels))return{actor:trimActor(explicit),basis:'Explicit sentence subject'};
 if(/^(?:in coordination with|(?:as )?(?:directed|supervised|assigned) by)$/i.test(phrase)){const root=/^(?:the\s+)?(.+?)\s+(?:provides?|supports?|works?|conducts?|documents?|keeps?|maintains?|monitors?|serves?)\b/i.exec(clean);if(root&&isActor(root[1]!,labels))return{actor:trimActor(root[1]!),basis:'Explicit subject with stated condition'};if(imperative.test(clean)&&!new RegExp('\\b'+actorNoun+'\\s+(?:who|that|will|must|can|may|works?|supports?)\\b','i').test(clean))return{actor:sourceRole,basis:'JD responsibility with stated condition'};}
 // A second coordinated predicate may inherit an already stated subject, never a nearby title.
 const finalSubject=clean.split(',').at(-1)?.trim();if(finalSubject&&isActor(finalSubject,labels))return{actor:trimActor(finalSubject),basis:'Explicit subject after stated condition'};
 if(/^in coordination with [^,]+,\s*$/i.test(clean))return{actor:sourceRole,basis:'JD responsibility following stated coordination condition'};
 const coordinated=/^(?:the\s+)?(.+?)\s+(?:provides?|supports?|works?|conducts?|documents?|keeps?|maintains?|monitors?|leads?)\b[\s\S]*(?:\band\s*|,\s*)$/i.exec(clean);
 if(coordinated&&isActor(coordinated[1]!,labels))return{actor:trimActor(coordinated[1]!),basis:'Same-sentence coordinated subject'};
 if(imperative.test(clean)&&/\band\s*$|\bas\s*$|,\s*$/i.test(clean)&&!new RegExp('\\b'+actorNoun+'\\s+(?:who|that|will|must|can|may)\\b','i').test(clean))return{actor:sourceRole,basis:'Coordinated JD responsibility subject'};
 if(/^(?:as )?(?:directed|supervised|assigned) by$/i.test(phrase)&&imperative.test(sentence.trim().replace(/^[•●▪◦]\s*/,'')))return{actor:sourceRole,basis:'JD responsibility with stated direction condition'};
 return null;
}
function evidence(row:DocumentaryRow,clause:string,start:number,end:number){
 const full=[...row.text.matchAll(/[^.!?]+(?:[.!?]|$)/g)].find(m=>m.index!<=start&&m.index!+m[0].length>=end);
 const sentence=full?.[0]??clause,sentenceStart=full?.index??start;
 return{documentId:row.documentId,sourceDocument:row.filename,sourceRole:row.role,sourceLocation:row.location,passageId:row.id,documentaryLevel:row.kind,fullSourceSentence:sentence,clauseText:clause,fullSourcePassage:row.text,passageStart:row.start,passageEnd:row.end,sentenceSpan:{start:row.start+sentenceStart,end:row.start+sentenceStart+sentence.length},clauseSpan:{start:row.start+start,end:row.start+end},physicalSourceSpans:row.sourceSpans??[]};
}
export function documentaryRelationships(rows:DocumentaryRow[],labels:string[]){
 const documented=[] as (ReturnType<typeof evidence>&{id:string;status:'documented_relationship';actor:string;actorBasis:string;counterpart:string;counterpartWording:string;phrase:string;phraseSpan:{start:number;end:number};counterpartSpan:{start:number;end:number};statedObject:string;purposeOrCondition:string;statedCondition:string;polarity:'positive';sequenceEstablished:false})[];
 const boundaries=[] as (ReturnType<typeof evidence>&{id:string;status:'documentary_boundary';phrase:string;condition:string})[];
 const unresolved=[] as (ReturnType<typeof evidence>&{id:string;status:'unresolved_connection';topic:string;reason:string})[];
 for(const row of rows){
  for(const sentenceMatch of row.text.matchAll(/[^.!?;]+(?:[.!?;]|$)/g)){
   const sentence=sentenceMatch[0],start=sentenceMatch.index!,ev=evidence(row,sentence,start,start+sentence.length);
   if(negation.test(sentence)){boundaries.push({...ev,id:row.id+':boundary:'+start,status:'documentary_boundary',phrase:sentence.match(negation)![0],condition:sentence.match(/\b(?:unless|except|when|where|while)\b[\s\S]*/i)?.[0]??''});continue;}
   for(const match of sentence.matchAll(verbs)){
    if(documented.some(r=>r.passageId===row.id&&r.counterpartSpan.start<=row.start+start+match.index!&&r.counterpartSpan.end>row.start+start+match.index!))continue;
    const phrase=match[0],at=match.index!,prefix=sentence.slice(0,at),tail=sentence.slice(at+phrase.length),trim=tail.length-tail.trimStart().length,base=at+phrase.length+trim;
    const actor=resolveActor(prefix,sentence,row.role,labels,phrase),targets=counterparts(tail.trimStart(),labels);
    if(!targets.length)continue; // A supported programme or a noun mentioning students is not an actor.
    if(!actor){unresolved.push({...ev,id:row.id+':unresolved:'+start+':'+at,status:'unresolved_connection',topic:'Relationship subject',reason:'Relational wording is present but its actor cannot be established safely by the literal grammar. No connection created.'});continue;}
    for(const target of targets){
     const targetStart=start+base+target.index,targetEnd=targetStart+target.wording.length;
     const rest=sentence.slice(base+Math.max(...targets.map(t=>t.index+t.wording.length))).replace(/^[,\s]+/,'');
     const object=phrase.match(/^(?:refers?|escalat(?:e|es)|reports?|shares?)\s+(.+?)\s+(?:to|with)$/i)?.[1]??prefix.match(/\bdocument\s+([^,;]+?)\s+and\s*$/i)?.[1]??'';
     documented.push({...ev,id:row.id+':relationship:'+start+':'+at+':'+targetStart,status:'documented_relationship',actor:actor.actor,actorBasis:actor.basis,counterpart:trimActor(target.wording),counterpartWording:target.wording,phrase,phraseSpan:{start:row.start+start+at,end:row.start+start+at+phrase.length},counterpartSpan:{start:row.start+targetStart,end:row.start+targetEnd},statedObject:object,purposeOrCondition:/^[.;!?]*$/.test(rest)?'':rest,statedCondition:sentence.match(/^\s*(?:[•●▪◦]\s*)?(?:where|when|if|unless)\b[^,;]+,/i)?.[0]??'',polarity:'positive',sequenceEstablished:false});
    }
   }
   if(/\b(?:who|that)\s+(?:qualify|qualifies|are eligible)\b/i.test(sentence))unresolved.push({...ev,id:row.id+':eligibility:'+start,status:'unresolved_connection',topic:'Qualification / eligibility decision',reason:'This passage conditions provision on eligibility but does not identify who determines it. No eligibility decision-maker is inferred; cross-document evidence requires researcher review.'});
   if(/\bin committee meetings\b/i.test(sentence))unresolved.push({...ev,id:row.id+':committee:'+start,status:'unresolved_connection',topic:'Committee identity / membership',reason:'The committee is unnamed in this passage. No identity, membership or decision authority is inferred.'});
  }
 }
 return{documentedRelationships:documented,documentaryBoundaries:boundaries,unresolvedConnections:unresolved};
}
