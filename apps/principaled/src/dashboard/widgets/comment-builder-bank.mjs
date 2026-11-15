import {fill,findContradictions,grammarFindings} from './comment-builder-utils.mjs';

export function previewBank(categories,categoryIndex,optionIndex,student) {
  const person=student||{name:'Student',pronoun:'they'};
  return categories.map((cat,i)=>{
    const option=i===categoryIndex?cat.options[optionIndex]:cat.options.find(o=>o.id&&o.id===person.selections?.[i])||cat.options[0];
    return option?fill(option.text,person):'';
  }).filter(Boolean).join(' ');
}
export function adjacentStudent(roster,id,offset){const index=roster.findIndex(s=>s.id===id);return index<0?null:roster[index+offset]||null;}
function* combinations(rows,i=0,prefix=[]){if(i===rows.length){yield prefix;return;}for(const option of rows[i])yield* combinations(rows,i+1,[...prefix,option]);}
export function bankTotal(categories){return categories.some(c=>c.options.length)?categories.reduce((n,c)=>n*Math.max(1,c.options.length),3):0;}
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));
function deterministic(options,student){
  const fragments=options.filter(Boolean).map(option=>({option,text:fill(option.text,student)}));
  const issues=findContradictions(fragments,student).map(c=>({message:'Possible contradiction',excerpt:c.sentences.join(' / ')}));
  const seen=new Set();
  for(const fragment of fragments){
    if(/[{}]/.test(fragment.text))issues.push({message:'Check for leftover placeholders',excerpt:fragment.text});
    for(const sentence of fragment.text.split(/(?<=[.!?])\s+/).filter(Boolean)){
      const key=sentence.toLocaleLowerCase().replace(/[.!?]+$/,'').trim();
      if(seen.has(key))issues.push({message:'Repeated sentence',excerpt:sentence});seen.add(key);
    }
  }
  return {issues,text:fragments.map(f=>f.text).join(' ')};
}
// A failed grammar worker must not prevent deterministic checks from completing.
export async function scanBank(categories,{cancelled=()=>false,onProgress=()=>{},checkGrammar=grammarFindings,cases=null}={}){
  const rows=categories.map(c=>c.options.length?c.options:[null]);
  const total=cases?cases.length*3:bankTotal(categories),groups=new Map();let checked=0,grammarAvailable=true;
  if(!total)return {checked,total,groups:[],grammarAvailable,cancelled:false};
  for(const options of cases||combinations(rows))for(const pronoun of ['she','he','they']){
    if(cancelled())return result(true);
    const {issues,text}=deterministic(options,{name:'Student',pronoun});
    if(grammarAvailable&&text.trim())try{issues.push(...await checkGrammar(text));}catch{grammarAvailable=false;}
    if(cancelled())return result(true);
    const counted=new Set();
    for(const issue of issues){
      const key=issue.key||issue.message+':'+(issue.excerpt||'').toLocaleLowerCase();
      if(counted.has(key))continue;counted.add(key);
      const group=groups.get(key)||{...issue,count:0};group.count++;groups.set(key,group);
    }
    checked++;if(checked%12===0||checked===total){onProgress({checked,total});await yieldUI();}
  }
  return result(false);
  function result(stopped){return {checked,total,groups:[...groups.values()],grammarAvailable,cancelled:stopped};}
}
export async function scanNeighbours(categories,i,j,options={}){
  const current=categories[i]?.options[j];if(!current)return null;
  const cases=[[current],...(categories[i-1]?.options||[]).map(o=>[o,current]),...(categories[i+1]?.options||[]).map(o=>[current,o])];
  return scanBank(categories,{...options,cases});
}
export function scanMessages(result){return [...result.groups.map(g=>`${g.message}${g.excerpt?' · '+g.excerpt:''} (${g.count} comments)`),`${result.checked.toLocaleString()} of ${result.total.toLocaleString()} comments checked${result.cancelled?' · Cancelled':''}${result.groups.length?'':' · No issues flagged'}${result.grammarAvailable?'':' · English spelling and grammar unavailable. Deterministic checks completed for the checked comments.'}`];}
