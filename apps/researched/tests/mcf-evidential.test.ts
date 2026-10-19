import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {retainContext,validateContext,evidentialResponse,confirmedReview,evidenceCounts,normalizeMachineContext} from '../src/domain/mcf-evidence.js';
import {decisionInput,MCF_HASH} from '../src/domain/mcf.js';
// @ts-ignore browser module
import {summariseMcf} from '../frontend/src/workbench/mcf-report.js';
// @ts-ignore browser module
import {reportHtml} from '../frontend/src/workbench/report.js';
const set=randomUUID(),record=randomUUID();
const a={id:randomUUID(),unit_set_id:set,record_id:record,start_offset:0,end_offset:38,original_text:'Recruitment is handled by the director.'};
const b={id:randomUUID(),unit_set_id:set,record_id:record,start_offset:40,end_offset:58,original_text:'Very slow process.'};
const code={competencyId:'A1',evidenceProtocol:2,evidenceStrength:'Contextual',context:[{unitId:a.id,quote:a.original_text}],evidence:b.original_text,rationale:'The preceding statement establishes recruitment as the process.',valence:'negative'};
describe('review-bound evidential protocol',()=>{
 it('removes only exact duplicate machine references and records every removal without mutating the response',()=>{
  const ref={unitId:a.id,quote:'Recruitment'},other={unitId:a.id,quote:'the director'};
  const original={...code,context:[ref,ref,other,ref]},before=JSON.stringify(original);
  const result=normalizeMachineContext([original]);expect(JSON.stringify(original)).toBe(before);
  expect(result.codes[0].context).toEqual([ref,other]);expect(result.normalization.removedExactDuplicates.map(r=>r.index)).toEqual([1,3]);
  const retained=retainContext(result.codes,b,[a,b])[0].context;
  expect(retained.map((r:any)=>r.quote)).toEqual(['Recruitment','the director']);
  expect(retained[1].startOffset).toBe(a.original_text.indexOf('the director'));
  for(const r of retained)expect(a.original_text.slice(r.startOffset,r.endOffset)).toBe(r.quote);
 });
 it('normalization cannot hide invalid, self or cross-review context',()=>{
  for(const ref of [{unitId:a.id,quote:'invented'},{unitId:b.id,quote:b.original_text}]){
   const result=normalizeMachineContext([{...code,context:[ref,ref]}]);expect(()=>retainContext(result.codes,b,[a,b])).toThrow();
  }
  const result=normalizeMachineContext([{...code,context:[...code.context,...code.context]}]);
  expect(()=>retainContext(result.codes,b,[{...a,unit_set_id:randomUUID()},b])).toThrow();
  expect(()=>validateContext([{...code,context:[...code.context,...code.context]}],b,[a,b])).toThrow('Duplicate contextual quotation');
 });
 it('retains exact review, segmentation and UTF-16 context spans',()=>{const c=retainContext([code],b,[a,b])[0];expect(c.context[0]).toMatchObject({unitId:a.id,recordId:record,unitSetId:set,startOffset:0,endOffset:a.original_text.length});});
 it('rejects other-review, other-version, absent, self and fabricated context',()=>{for(const pool of [[],[{...a,unit_set_id:randomUUID()}]])expect(()=>validateContext([code],b,pool)).toThrow();expect(()=>validateContext([{...code,context:[{unitId:b.id,quote:b.original_text}]}],b,[a,b])).toThrow();expect(()=>validateContext([{...code,context:[{unitId:a.id,quote:'invented'}]}],b,[a,b])).toThrow();});
 it('requires contextual support and rationale but forbids extra evidence for Explicit',()=>{for(const patch of [{context:[]},{rationale:''},{evidenceStrength:'Explicit'}])expect(()=>validateContext([{...code,...patch}],b,[a,b])).toThrow();expect(()=>validateContext([{...code,evidenceStrength:'Explicit',context:[]}],b,[a,b])).not.toThrow();});
 it('does not accept legacy Implicit as a current classification',()=>{expect(evidentialResponse.safeParse({units:[{unitId:b.id,codes:[{...code,evidenceProtocol:undefined,evidenceStrength:'Implicit'}],valence:null,notes:''}]}).success).toBe(false);expect(decisionInput.safeParse({previousId:null,codes:[{...code,evidenceProtocol:undefined}],valence:null,reviewedNoCode:false,notes:'',actor:'Test'}).success).toBe(false);});
 it('counts both bases equally, separates all historical findings and handles zero denominators',()=>{expect(evidenceCounts([code,{...code,evidenceStrength:'Explicit'},{evidenceStrength:'Explicit'},{evidenceStrength:'Implicit'}])).toEqual({totalFindings:2,explicitFindings:1,contextualFindings:1,explicitPercentage:50,contextualPercentage:50,historicalFindings:2});expect(evidenceCounts([]).contextualPercentage).toBeNull();});
 it('requires structural confirmation or explicit record-boundary confirmation',()=>{expect(confirmedReview({locator:{}},{})).toBe(false);expect(confirmedReview({locator:{profile:'legacy-questionnaire@1.0'}},{})).toBe(true);expect(confirmedReview({}, {reviewBoundariesConfirmed:true})).toBe(true);});
 it('filters independently without changing the full population counts; HTML includes auditable context and totals',()=>{const session={units:[{...b,filename:'review.txt',session_ordinal:2}],contextUnits:[a,b]},instrument={competencies:[{id:'A1',competency:'Example'}]},draft={useAi:true,title:'Test',machineRunId:'run'},machine={runs:[{id:'run'}],proposals:[{run_id:'run',unit_id:b.id,payload:{codes:retainContext([code],b,[a,b]),evidenceProtocol:2}}]};
  expect(summariseMcf(session,instrument,draft,machine,'Explicit').competencies[0].findings).toHaveLength(0);const contextual=summariseMcf(session,instrument,draft,machine,'Contextual').competencies[0];expect(contextual.findings).toHaveLength(1);expect(contextual.counts.contextualPercentage).toBe(100);const html=reportHtml({tool:'mcf',session,instrument,draft,machine});expect(html).toContain(a.id);expect(html).toContain(a.original_text);expect(html).toContain('Contextual %');expect(html).toContain('not independent observations');expect(MCF_HASH).toMatch(/^[a-f0-9]{64}$/);
 });
});
