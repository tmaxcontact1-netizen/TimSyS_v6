import {describe,it,expect,vi} from 'vitest';
import {reviewAggregation} from '../src/domain/review-aggregation.js';
import {McfValidation} from '../src/application/mcf-validation.js';
import {McfRepository} from '../src/infrastructure/mcf-repository.js';
import {createMcfApi} from '../src/entrypoints/mcf-api.js';
// @ts-ignore browser module
import {reportHtml} from '../frontend/src/workbench/report.js';
// @ts-ignore browser module
import {summariseMcf} from '../frontend/src/workbench/mcf-report.js';
import MCF from '../instruments/mcf/1.0.json' with {type:'json'};
const units=Array.from({length:14},(_,i)=>({id:'u'+i,record_id:i<12?'r1':i===12?'r2':'zero',unit_set_id:'set'+i,original_text:'Same narrative, Director Example at School Example',filename:'fixture',session_ordinal:i+1}));
const proposals=units.map((u,i)=>({id:'p'+i,unit_id:u.id,run_id:'run',payload:{method:'ai',codes:i===13?[]:[{competencyId:'A1',evidenceProtocol:2,evidenceStrength:i===0?'Explicit':'Contextual',valence:'negative'}]}}));
const session={id:'session',units,configuration:{machineRunId:'run'},blind:false};
const report={run:{id:'run',status:'completed'},proposals,candidates:[],coverage:{semanticAssessed:14,semanticPending:0,semanticFailed:0}};
const data={tool:'mcf',session,instrument:MCF,machine:{snapshot:report},draft:{step:5,useAi:true,machineRunId:'run',title:'Fixture'}};
describe('retrospective review reporting safeguards',()=>{
 it('counts twelve locations once per review, preserving original density numerator',()=>{const c=reviewAggregation(units,proposals).competencies[0]!;expect(c.evidenceLocations).toBe(13);expect(c.reviewsRepresented).toBe(2);expect(c.evidenceDensity).toBe(6.5);});
 it('partitions mixed and contextual-only reviews without overlap for all 21 competencies',()=>{const result=reviewAggregation(units,proposals);expect(result.competencies[0]).toMatchObject({explicitReviewIds:['r1'],contextualOnlyReviewIds:['r2']});for(const c of result.competencies)expect(c.reviewsRepresented).toBe(c.explicitReviews+c.contextualOnlyReviews);});
 it('uses all substantive review IDs including zero-code reviews, never segmentation IDs',()=>{const a=reviewAggregation(units,proposals);expect(a.eligibleReviews).toBe(3);expect(a.competencies[0]!.reviewPrevalence).toBeCloseTo(200/3);expect(a.competencies[0]!.reviewIds).not.toContain('zero');});
 it('excludes historical and deterministic classifications from both numerator and represented reviews',()=>{const mixed=[...proposals,{unit_id:'u13',payload:{codes:[{competencyId:'A1',evidenceStrength:'Implicit'}]}},{unit_id:'u13',payload:{method:'deterministic',codes:proposals[0]!.payload.codes}}];expect(reviewAggregation(units,mixed)).toEqual(reviewAggregation(units,proposals));});
 it('never infers identity from repeated text or metadata and leaves source/results unchanged',()=>{const before=JSON.stringify({units,proposals});const a=reviewAggregation(units,proposals);expect(a.eligibleReviewIds).toEqual(['r1','r2','zero']);expect(JSON.stringify(a)).not.toContain('Director Example');expect(JSON.stringify(a)).not.toContain('School Example');expect(JSON.stringify({units,proposals})).toBe(before);});
 it('shows both tables automatically in order with two-decimal density and an explicit denominator',()=>{const html=reportHtml(data);expect(html).toMatch(/<\/table><h2>Review-level analysis<\/h2>/);expect(html).toContain('Eligible distinct reviews: 3');expect(html).toContain('Review prevalence = reviews represented ÷ 3 × 100');expect(html).toContain('<td>6.50</td>');expect(summariseMcf(session,MCF,data.draft,data.machine,'Contextual').reviewLevel).toEqual(summariseMcf(session,MCF,data.draft,data.machine).reviewLevel);});
 it('reports unavailable review IDs without inventing substitutes',()=>{const html=reportHtml({...data,session:{...session,units:units.map(u=>({...u,record_id:null}))}});expect(html).toContain('Review-level analysis unavailable');});
 it('generates the dedicated frozen review report with only a snapshot read and no sample creation',async()=>{const query=vi.fn(async(sql:string)=>{expect(sql).toMatch(/^SELECT payload FROM researched.mcf_report_snapshots/);return{rows:[{payload:report}]};});const validation=new McfValidation({workspace:async()=>session,db:{query}} as any);const result=await validation.reviewReport('session','run');expect(result.aggregation.eligibleReviews).toBe(3);expect(query).toHaveBeenCalledTimes(1);});
 it('JSON export adds review aggregation without calling the semantic provider or altering evidence counts',async()=>{const archive=vi.spyOn(McfRepository.prototype,'archive').mockResolvedValue({session} as any);const provider=vi.fn(()=>{throw Error('semantic provider must not be invoked');});const query=vi.fn(async(sql:string)=>{expect(sql).toMatch(/^SELECT payload FROM researched.mcf_report_snapshots/);return{rows:[{payload:report}]};});const api=createMcfApi({query} as any,'unused',provider);let output='';const response={setHeader:vi.fn(),writeHead:vi.fn(),end:(s:string)=>{output=s;}};try{await api({url:'/api/mcf/sessions/11111111-1111-4111-8111-111111111111/export',method:'GET',headers:{}} as any,response as any);const json=JSON.parse(output);expect(json.reviewLevel.eligibleReviews).toBe(3);expect(json.reviewLevel.competencies[0].evidenceLocations).toBe(13);expect(json.machineOutputs).toEqual(report);expect(provider).not.toHaveBeenCalled();}finally{archive.mockRestore();}});
});


