export function fill(text, student) {
  const p=student.pronoun==='he'?['he','him','his']:student.pronoun==='she'?['she','her','her']:['they','them','their'];
  const cap=s=>s[0].toUpperCase()+s.slice(1);
  const values={name:student.name,namePoss:student.name+(/s$/i.test(student.name)?'’':'’s'),he:p[0],him:p[1],his:p[2],heCap:cap(p[0]),hisCap:cap(p[2]),subject:p[0],object:p[1],possessive:p[2]};
  return text.replace(/\{(namePoss|name|hisCap|heCap|he|him|his|subject|object|possessive)\}/g,(_,key)=>values[key]);
}
export function fragments(c,s) {return c.categories.flatMap((category,i)=>{const option=category.options.find(o=>o.id===s.selections[i]);return option?[{option,text:fill(option.text,s)}]:[];});}
export function generated(c,s) {return fragments(c,s).map(f=>f.text).join(' ');}
export function unresolved(c,s) {return c.categories.filter((cat,i)=>s.selections[i]&&!cat.options.some(o=>o.id===s.selections[i]));}
export function csv(c,q) {
  const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['Student','Quarter','Comment','Needs review'],...c.quarters[q-1].map(s=>[s.name,q,s.personal??generated(c,s),unresolved(c,s).length?'Removed bank option':''])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
export function checkComment(text,c,s,target) {
  const findings=[];
  if(!text.trim()) return ['The comment is empty.'];
  if(/[{}]|\[student/i.test(text))findings.push('Check for leftover placeholders.');
  if(!/[.!?][”"’')\]]*$/.test(text.trim()))findings.push('Check punctuation at the end.');
  if(/\b(\p{L}{2,})\s+\1\b/iu.test(text))findings.push('Check for a repeated word.');
  if(/^\p{Ll}|[!?]\s+\p{Ll}/u.test(text))findings.push('Check sentence capitalisation.');
  if(/\s+[,;:]|[,;:](?=\p{L})|[!?]{2,}|,,/u.test(text))findings.push('Check punctuation and spacing.');
  const sentences=text.split(/(?<=[.!?])\s+/).map(s=>s.toLowerCase().trim());
  if(new Set(sentences).size<sentences.length)findings.push('Check for repeated sentences.');
  const escaped=name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const others=c.quarters.flat().filter(p=>p.id!==s.id&&p.name!==s.name);
  if(others.some(p=>new RegExp(`(?<![\\p{L}\\p{N}])${escaped(p.name)}(?![\\p{L}\\p{N}])`,'iu').test(text)))findings.push('Another student’s name appears in this comment.');
  if(target&&Array.from(text).length>target)findings.push(`The comment exceeds the recommendation by ${Array.from(text).length-target} characters.`);
  if(unresolved(c,s).length)findings.push('A selected bank option was removed. Review the selections.');
  const selected=fragments(c,s).filter(f=>text.includes(f.text));
  for(const conflict of findContradictions([{text}],s,selected))findings.push(`Possible contradiction: ${conflict.sentences.join(' / ')}`);
  return [...new Set(findings)];
}
let checkerPromise;
function deadline(promise) {
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Grammar check timed out.')),20000);})]).finally(()=>clearTimeout(timer));
}
export async function grammar(text) {
  if(!checkerPromise) {
    const url='/comment-builder/harper/index.js';
    checkerPromise=import(/* @vite-ignore */ url).then(async({WorkerLinter,Dialect,createBinaryModuleFromUrl})=>{
      const checker=new WorkerLinter({binary:createBinaryModuleFromUrl(new URL('/comment-builder/harper/harper_wasm_bg.wasm',location.origin).href),dialect:Dialect.British});
      try {await deadline(checker.setup());return checker;}catch(e){checker.dispose();throw e;}
    }).catch(e=>{checkerPromise=null;throw e;});
  }
  const checker=await checkerPromise;
  let lints;
  try{lints=await deadline(checker.lint(text,{language:'plaintext'}));}catch(e){checker.dispose();checkerPromise=null;throw e;}
  return lints.map(lint=>{try{return lint.message();}finally{lint.free();}});
}
export function checkBank(categories) {
  const s={name:'Student',pronoun:'they'}, findings=[];
  const options=categories.flatMap(cat=>cat.options.map(option=>({option:{...option,categoryId:cat.id},text:fill(option.text,s)})));
  for(let i=0;i<options.length;i++)for(let j=i+1;j<options.length;j++) {
    if(options[i].option.categoryId===options[j].option.categoryId)continue;
    for(const conflict of findContradictions([options[i],options[j]],s))findings.push(conflict.sentences.join(' / '));
  }
  for(const cat of categories) {
    if(!cat.options.length)findings.push(`${cat.name}: no wording configured.`);
    for(const o of cat.options)if(/[{}]/.test(o.text.replace(/\{(namePoss|name|hisCap|heCap|he|him|his|subject|object|possessive)\}/g,''))) findings.push(`${cat.name}: unsupported placeholder.`);
  }
  return [...new Set(findings)];
}
    const sentenceSplitter = new Intl.Segmenter('en', { granularity: 'sentence' });

    function commentSentences(text) {
      return Array.from(sentenceSplitter.segment(text), part => part.segment.trim()).filter(Boolean);
    }

    function explicitClaim(sentence, student) {
      let text = sentence.toLocaleLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ').trim();
      const name = student.name.toLocaleLowerCase().replace(/[’]/g, "'");
      if (text.startsWith(name + ' ')) text = 'student' + text.slice(name.length);
      const match = text.match(/^(?:he|she|they|student)\s+(always|consistently|regularly|never|rarely|seldom|does not|doesn't|can|cannot|can't)\s+(.+?)[.!?]?$/u);
      if (!match) return null;
      const [, qualifier, predicate] = match;
      const words = predicate.replace(/\b(?:his|her)\b/g, 'their').split(' ');
      // Match common third-person forms to verbs following "does not" or "cannot".
      words[0] = words[0].replace(/ies$/, 'y').replace(/(sh|ch|ss|x|zz|o)es$/, '$1').replace(/(?<!s)s$/, '');
      const kind = /^(?:can|cannot|can't)$/.test(qualifier) ? 'ability' : 'frequency';
      return { topic: kind + ':' + words.join(' '), positive: /^(?:always|consistently|regularly|can)$/.test(qualifier) };
    }

    function findContradictions(fragments, student, taggedFragments = fragments) {
      const claims = fragments.flatMap(fragment =>
        commentSentences(fragment.text).map(sentence => ({
          sentence, option: fragment.option,
          claim: explicitClaim(sentence, student)
        })));
      const conflicts = [];
      const seen = new Set();
      function add(first, second, skill) {
        const sentences = [first.sentence, second.sentence];
        const key = JSON.stringify([first, second].map(item => [
          item.option?.field?.id || '', item.sentence
        ]).sort());
        if (seen.has(key)) return;
        seen.add(key);
        conflicts.push({ sentences, skill, options: [first.option, second.option].filter(Boolean) });
      }
      const byTopic = new Map();
      for (const item of claims) {
        if (!item.claim) continue;
        const { topic, positive } = item.claim;
        const group = byTopic.get(topic) || [[], []];
        group[positive ? 0 : 1].forEach(other => add(other, item));
        group[positive ? 1 : 0].push(item);
        byTopic.set(topic, group);
      }
      const tags = new Map();
      for (const fragment of taggedFragments) {
        const skill = fragment.option?.skill?.trim().toLocaleLowerCase();
        const level = fragment.option?.level;
        if (!skill || (level !== 'consistent' && level !== 'rare') || !fragment.text.trim()) continue;
        const group = tags.get(skill) || [[], []];
        const item = { sentence: fragment.text, option: fragment.option };
        const index = level === 'consistent' ? 0 : 1;
        group[1 - index].forEach(other => add(other, item, fragment.option.skill));
        group[index].push(item);
        tags.set(skill, group);
      }
      return conflicts;
    }

