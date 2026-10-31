// Optional live-model evaluation of synthetic, non-corpus examples. No database
// access, no existing run mutation, and no automatic use of the user's live AI.
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {createAiAnalysisProvider,runGroundedAiAnalysis} from '../dist/src/application/ai-analysis.js';
import {CLASSIFICATION_RULES_V9} from '../dist/src/domain/mcf-semantic-policy.js';
import {EVIDENTIAL_RULES,retainContext} from '../dist/src/domain/mcf-evidence.js';
import {AI_AMBIGUITY_RULES,ambiguityResponse,retainAiAmbiguity} from '../dist/src/domain/ai-ambiguity.js';
import {MCF} from '../dist/src/domain/mcf.js';
const {MCF_EVAL_URL:baseUrl,MCF_EVAL_MODEL:model,MCF_EVAL_PROTOCOL:protocol,MCF_EVAL_KEY:apiKey,MCF_EVAL_OUTPUT:output}=process.env;
if(!baseUrl||!model||!protocol||!output)throw Error('Set explicit MCF_EVAL_URL, MCF_EVAL_MODEL, MCF_EVAL_PROTOCOL and MCF_EVAL_OUTPUT. No live configuration is inferred.');
const fixtureBytes=await readFile(new URL('../tests/fixtures/substantive-engagement.json',import.meta.url));
const cases=JSON.parse(fixtureBytes),provider=createAiAnalysisProvider({baseUrl,model,protocol,apiKey}),results=[];
// Compare both policies on identical synthetic documents; no gold labels in requests.
for(const pair of cases)for(const side of ['negative','positive']){
 const v=pair[side],set=randomUUID(),record=randomUUID();let offset=0;
 const pool=[v.target,...v.context].map(text=>{const u={id:randomUUID(),unit_set_id:set,record_id:record,original_text:text,start_offset:offset};offset+=text.length+1;return u;});
 for(const version of [8,9]){
  const started=Date.now(),rules=version===9?CLASSIFICATION_RULES_V9:EVIDENTIAL_RULES+'\n'+AI_AMBIGUITY_RULES;
  try{
   const answer=await runGroundedAiAnalysis(provider,{requestId:randomUUID(),timeoutMs:210000,analysisType:'mcf-evidential-proposals.v3',instructions:rules+'\nCitation formatting: do not repeat an identical unit ID and quotation within a competency. Distinct exact quotations from the same permitted contextual unit may be cited separately.\nMode: reviews. TARGET unit IDs: '+JSON.stringify([pool[0].id])+' Frozen MCF instrument: '+JSON.stringify(MCF),evidence:pool.map(u=>({segmentId:u.id,sourceId:set,content:u.original_text})),outputSchema:z.toJSONSchema(ambiguityResponse)});
   const response=ambiguityResponse.parse(answer.value);if(response.units.length!==1||response.units[0].unitId!==pool[0].id)throw Error('Wrong target returned');
   const unit=response.units[0],codes=unit.codes.map(c=>({...c,evidenceProtocol:2}));retainContext(codes,pool[0],pool);
   retainAiAmbiguity(unit.ambiguity,codes,pool[0],pool,answer.evidenceSegmentIds,{protocolVersion:2});
   const found=codes.find(c=>c.competencyId===pair.competency),pass=side==='negative'?!found:!!found&&found.evidenceStrength===v.route;
   results.push({case:pair.id,side,version,competency:pair.competency,pass,codes:unit.codes,ambiguity:unit.ambiguity,durationMs:Date.now()-started});
  }catch(error){results.push({case:pair.id,side,version,pass:false,error:String(error),durationMs:Date.now()-started});}
  const last=results.at(-1);console.log(JSON.stringify({id:last.case,side,version,pass:last.pass,error:last.error}));
 }
}
await writeFile(output,JSON.stringify({model,protocol,fixtureSha256:createHash('sha256').update(fixtureBytes).digest('hex'),at:new Date().toISOString(),results},null,2),{flag:'wx'});
if(results.some(r=>r.version===9&&!r.pass))process.exitCode=1;
