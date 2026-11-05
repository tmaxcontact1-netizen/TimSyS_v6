import {it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {CLASSIFICATION_RULES_V9,CLASSIFICATION_RULES_V10,F1_INTERNAL_COMMUNICATION_RULES,F1_RULE_REVISION} from '../src/domain/mcf-semantic-policy.js';
import {SemanticWorker,SEMANTIC_POLICY} from '../src/application/mcf-semantic.js';
import {MCF_HASH} from '../src/domain/mcf.js';
import {competencyEvidenceCounts} from '../src/domain/mcf-evidence.js';
import {aiAmbiguitySummary} from '../src/domain/ai-ambiguity.js';
import {McfRepository} from '../src/infrastructure/mcf-repository.js';
import {createMcfApi} from '../src/entrypoints/mcf-api.js';

it('changes exactly the F1 paragraph and retains the original v9 policy',()=>{
 const old=CLASSIFICATION_RULES_V9.split('\n').find(x=>x.startsWith('A meeting, email,'))!;
 expect(CLASSIFICATION_RULES_V10.replace(F1_INTERNAL_COMMUNICATION_RULES,old)).toBe(CLASSIFICATION_RULES_V9);
 expect(CLASSIFICATION_RULES_V10).not.toContain(old);
 for(const rule of ['Poor follow-through','a separate example elsewhere','unstated message, purpose, or participant role','basis or substance','staff attendance','hypothetical exception','F1 alternative']){
  expect(F1_INTERNAL_COMMUNICATION_RULES).toContain(rule);
 }
 expect(MCF_HASH).toBe('0c10b62334e888084a0d293e8d2d0a08f634035f3b7212e1e791e57a011d5f24');
});

it('exports the pinned F1 revision and unresolved alternative without invoking analysis',async()=>{
 const id=randomUUID(),unit={id,record_id:'review',original_text:'Teachers are supported unless instructed otherwise.'};
 const configuration={semanticProtocol:3,semanticPolicy:SEMANTIC_POLICY,classificationConfig:{version:'3.2',competencyRuleRevisions:{F1:F1_RULE_REVISION},rules:CLASSIFICATION_RULES_V10}};
 const proposal={unit_id:id,payload:{method:'ai',codes:[],unresolvedCompetencyIds:['F1'],noApplicationCompetencyIds:[],ambiguity:{version:1,status:'identified',reason:'Actual directive or hypothetical exception.',evidence:[{unitId:id,quote:unit.original_text}],alternatives:[{competencyId:'F1',interpretation:'Actual directive or hypothetical exception.',evidence:[{unitId:id,quote:unit.original_text}]}]}}};
 const report={run:{id:'run',status:'completed',configuration},proposals:[proposal],coverage:{semanticAssessed:1}};
 const session={configuration:{machineRunId:'run'},units:[unit],blind:false};
 const archive=vi.spyOn(McfRepository.prototype,'archive').mockResolvedValue({session} as any);
 const provider=vi.fn(()=>{throw Error('No provider calls during export');});
 const query=vi.fn(async(sql:string)=>{expect(sql).toMatch(/^SELECT payload FROM researched.mcf_report_snapshots/);return{rows:[{payload:report}]};});
 const api=createMcfApi({query} as any,'unused',provider);let output='';
 try{
  await api({url:'/api/mcf/sessions/'+randomUUID()+'/export',method:'GET',headers:{}} as any,{setHeader:vi.fn(),writeHead:vi.fn(),end:(value:string)=>{output=value;}} as any);
  const exported=JSON.parse(output);
  expect(exported.machineOutputs.run.configuration).toEqual(configuration);
  expect(exported.machineOutputs.proposals[0].payload.unresolvedCompetencyIds).toEqual(['F1']);
  expect(exported.evidentialCounts.find((c:any)=>c.competencyId==='F1').totalFindings).toBe(0);
  expect(provider).not.toHaveBeenCalled();
 }finally{archive.mockRestore();}
});

// Contract/pipeline tests use synthetic provider responses, not live-model accuracy claims.
const cases=[
 ['They told the teachers not to contact the parents.','supported'],
 ['She listened to staff input but did nothing.','supported'],
 ['Feedback was exchanged with teachers through a weekly channel.','supported'],
 ['Meeting after meeting.','none'],
 ['Teachers are supported.','none'],
 ['My appraisal was based only on rumours.','none'],
 ['Teachers and parents attended a meeting.','none'],
 ['She facilitated the exchange between teachers and parents.','unresolved'],
 ['Teachers are supported unless director has instructed principal to do otherwise.','unresolved'],
] as const;

it.each(cases)('retains the production F1 response contract for %s',async(text,decision)=>{
 const unit={id:randomUUID(),unit_set_id:randomUUID(),record_id:randomUUID(),original_text:text,start_offset:0};
 const task={id:randomUUID(),run_id:randomUUID(),unit_ids:[unit.id]};
 const configuration={semanticProtocol:3,evidenceProtocol:2,ambiguityProtocol:2,instrumentHash:MCF_HASH,semanticPolicy:SEMANTIC_POLICY,contextUnitIds:[unit.id],contextPolicy:{maximumCharacters:200000},classificationConfig:{version:'3.2',rules:CLASSIFICATION_RULES_V10,promptVersion:'mcf-evidential-proposals.v3',competencyRuleRevisions:{F1:F1_RULE_REVISION}},provider:{id:'fixture',model:'fixture',connectionId:null}};
 let sent:any,retained:any;const errors:any[]=[];
 const query=async(sql:string,args:any[]=[])=>{
  let rows:any[]=[];
  if(sql.startsWith('WITH next'))rows=[task];
  else if(sql.startsWith('SELECT * FROM researched.mcf_ai_runs'))rows=[{id:task.run_id,session_id:'session',configuration}];
  else if(sql.startsWith('SELECT s.cycle'))rows=[{cycle:0,attempts:0}];
  else if(sql.startsWith('SELECT * FROM researched.mcf_units')||sql.startsWith('SELECT u.*'))rows=[unit];
  else if(sql.startsWith('SELECT status'))rows=[{status:'running'}];
  else if(sql.startsWith('INSERT INTO researched.mcf_ai_outputs'))retained=JSON.parse(args[3]);
  else if(sql.includes("outcome='semantic_failed'"))errors.push(args);
  return{rows,rowCount:rows.length};
 };
 const repo:any={db:{query},transaction:async(fn:any)=>fn({query}),session:async()=>({id:'session',dataset_id:'dataset',instrument_hash:MCF_HASH,mode:'general'}),writable:async()=>{},active:async()=>{}};
 const provider:any={id:'fixture',model:'fixture',analyse:async(request:any)=>{
  sent=request;const evidence=[{unitId:unit.id,quote:text}];
  return{value:{units:[{unitId:unit.id,codes:decision==='supported'?[{competencyId:'F1',evidenceStrength:'Explicit',context:[],valence:null,rationale:'Synthetic supported communication function.',evidence:text}]:[],valence:null,notes:'Synthetic contract fixture.',ambiguity:decision==='unresolved'?{status:'identified',reason:'Two grounded readings remain.',evidence,alternatives:[{competencyId:'F1',interpretation:'Internal/external or actual/hypothetical readings remain unresolved.',evidence}]}:{status:'none',reason:'No competing reading in this fixture.',evidence:[],alternatives:[]}}]},confidence:1,evidenceSegmentIds:[unit.id],limitations:['Synthetic provider response']};
 }};
 await new SemanticWorker(repo,()=>provider).process();
 expect(errors).toEqual([]);expect(retained).toBeDefined();
 expect(sent.instructions.startsWith(CLASSIFICATION_RULES_V10)).toBe(true);
 expect(sent.evidence).toEqual([{segmentId:unit.id,sourceId:unit.unit_set_id,content:text}]);
 const p=retained.proposals[0];
 expect(p.provenance.semanticPolicyVersion).toBe(10);
 expect(p.codes.some((c:any)=>c.competencyId==='F1')).toBe(decision==='supported');
 expect(p.unresolvedCompetencyIds.includes('F1')).toBe(decision==='unresolved');
 expect(p.noApplicationCompetencyIds.includes('F1')).toBe(decision==='none');
 expect(competencyEvidenceCounts([{payload:p}]).find(c=>c.competencyId==='F1')?.totalFindings).toBe(decision==='supported'?1:0);
 expect(aiAmbiguitySummary([unit],[{unit_id:unit.id,payload:p}]).alternativeMentions).toBe(decision==='unresolved'?1:0);
 // Existing lossless JSON serialization retains policy identity and alternatives.
 const archive=JSON.parse(JSON.stringify({run:{configuration},proposals:[p]}));
 expect(archive.run.configuration.classificationConfig.competencyRuleRevisions.F1).toBe(F1_RULE_REVISION);
 expect(archive.proposals[0].unresolvedCompetencyIds).toEqual(p.unresolvedCompetencyIds);
});
