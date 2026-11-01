import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {CLASSIFICATION_RULES_V9,SUBSTANTIVE_ENGAGEMENT_RULES,resumedOperationalPolicy} from '../src/domain/mcf-semantic-policy.js';
import {EVIDENTIAL_RULES,evidentialResponse,retainContext,competencyEvidenceCounts} from '../src/domain/mcf-evidence.js';
import {AI_AMBIGUITY_RULES} from '../src/domain/ai-ambiguity.js';
import {SEMANTIC_POLICY,SemanticWorker} from '../src/application/mcf-semantic.js';
import {MCF_HASH} from '../src/domain/mcf.js';
import fixtures from './fixtures/substantive-engagement.json' with {type:'json'};

describe('v9 reasoning policy and frozen history',()=>{
 it('adds only the general reasoning constraint after byte-identical existing rules',()=>{
  expect(CLASSIFICATION_RULES_V9).toBe(EVIDENTIAL_RULES+'\n'+AI_AMBIGUITY_RULES+'\n'+SUBSTANTIVE_ENGAGEMENT_RULES);
  expect(SUBSTANTIVE_ENGAGEMENT_RULES).toContain('every competency independently');
  expect(SUBSTANTIVE_ENGAGEMENT_RULES).toContain('not a target-only rule');
  expect(SUBSTANTIVE_ENGAGEMENT_RULES).toContain('retain every supported application');
  expect(MCF_HASH).toBe('0c10b62334e888084a0d293e8d2d0a08f634035f3b7212e1e791e57a011d5f24');
 });
 it('freezes v9 only for new runs without changing schemas or analysis protocols',async()=>{
  let configuration:any;const u={id:randomUUID(),unit_set_id:randomUUID(),original_text:'Staff receive mentoring.',start_offset:0,end_offset:24};
  const session={dataset_id:'dataset',instrument_hash:MCF_HASH,units:[u],contextUnits:[u],records:[],configuration:{unitSets:[]}};
  const c={query:async(sql:string,args:any[])=>{if(sql.startsWith('INSERT INTO researched.mcf_ai_runs'))configuration=JSON.parse(args[3]);return{rows:[]};}};
  const repo:any={workspace:async()=>session,transaction:async(fn:any)=>fn(c),writable:async()=>{},active:async()=>{},audit:async()=>{}};
  await new SemanticWorker(repo,()=>null).enqueue('session','researcher',true);
  expect(configuration).toMatchObject({semanticProtocol:3,evidenceProtocol:2,ambiguityProtocol:2,semanticPolicy:{version:9},classificationConfig:{version:'3.1',rules:CLASSIFICATION_RULES_V9,promptVersion:'mcf-evidential-proposals.v3'}});
 });
 it.each([4,5,6,7,8,9])('preserves reasoning identity when resuming policy %i',version=>{
  const saved=Object.freeze({version,timeoutMs:90000});const next=resumedOperationalPolicy(saved,SEMANTIC_POLICY);
  expect(next.version).toBe(version<8?8:version);expect(saved).toEqual({version,timeoutMs:90000});
  if(version>=8)expect(next).toBe(saved);
 });
 it('request construction reads saved rules rather than appending current rules to historical work',()=>{
  const source=readFileSync(new URL('../src/application/mcf-semantic.ts',import.meta.url),'utf8');
  const request=source.slice(source.indexOf('const answer=await runGroundedAiAnalysis'),source.indexOf('let proposals:any[]'));
  expect(request).toContain('run.configuration.classificationConfig.rules');expect(request).not.toContain('CLASSIFICATION_RULES_V9');
 });
});

// These are response-contract regression tests, not claims that a live model
// classified the fixtures correctly. The separate provider evaluator exercises
// the same paired cases against an actual explicitly configured model.
describe('paired substantive-boundary response contracts',()=>{
 for(const pair of fixtures)it(pair.id+' preserves supported routes and accepts zero-code negatives',()=>{
  for(const side of ['negative','positive'] as const){const v:any=pair[side],uid=randomUUID(),set=randomUUID(),record=randomUUID();
   const target={id:uid,unit_set_id:set,record_id:record,original_text:v.target,start_offset:0};
   const pool=[target,...v.context.map((text:string)=>({id:randomUUID(),unit_set_id:set,record_id:record,original_text:text,start_offset:v.target.length+1}))];
   const codes=side==='negative'?[]:[{competencyId:pair.competency,evidenceStrength:v.route,context:v.route==='Contextual'?pool.slice(1).map(u=>({unitId:u.id,quote:u.original_text})):[],valence:null,rationale:'Synthetic criterion-based fixture, not a model finding.',evidence:v.target}];
   const response=evidentialResponse.parse({units:[{unitId:uid,codes,valence:null,notes:''}]});
   const retained=retainContext(response.units[0]!.codes.map(c=>({...c,evidenceProtocol:2})),target,pool);
   expect(retained).toHaveLength(side==='negative'?0:1);
   if(side==='positive'){expect(retained[0].evidenceStrength).toBe(v.route);expect(retained[0].context.map((c:any)=>c.quote)).toEqual(v.route==='Contextual'?v.context:[]);}
  }
 });
 it('does not introduce a single-code or keyword filter for multi-competency evidence',()=>{
  const text='The interview used a capability rubric and candidates received clear selection criteria and timely decision updates.';
  const target={id:randomUUID(),unit_set_id:randomUUID(),record_id:randomUUID(),original_text:text,start_offset:0};
  const codes=['C1','F1'].map(competencyId=>({competencyId,evidenceStrength:'Explicit',evidenceProtocol:2,context:[],valence:null,rationale:'Synthetic supported professional-capability and information-flow fixture.',evidence:text}));
  const retained=retainContext(codes,target,[target]);expect(retained).toEqual(codes);
  const counts=competencyEvidenceCounts([{codes:retained}]);for(const cid of ['C1','F1'])expect(counts.find(c=>c.competencyId===cid)).toMatchObject({totalFindings:1});
 });
});
