import {it,expect,vi} from 'vitest';
import {principalRatingsReport,PRINCIPAL_ITEMS,PRINCIPAL_CATEGORIES} from '../src/domain/principal-ratings.js';
import {McfRepository} from '../src/infrastructure/mcf-repository.js';
import {createMcfApi} from '../src/entrypoints/mcf-api.js';
// @ts-ignore browser module
import {principalRatingsHtml} from '../../../../apps/researched/frontend/src/workbench/principal-ratings-report.js';
// @ts-ignore browser module
import {summariseMcf} from '../../../../apps/researched/frontend/src/workbench/mcf-report.js';
function record(id='review',table=1){return{id,review_identifier:id,locator:{profile:'principal-questionnaire@1.0',analysisScope:'narrative-only',respondentRatings:{schema:'isr-principal-ratings@1.0',sourceHash:'source',sourceTableIndex:table,ratings:PRINCIPAL_ITEMS.map(([itemId,prompt],i)=>({itemId,prompt,value:'Poor',status:'RECOVERED',warnings:[],sourceTableIndex:table,sourceRowIndex:i+2,candidates:PRINCIPAL_CATEGORIES.map((label,j)=>({label,state:j===3?'selected_empty_paragraph':'non_selected_nbsp',codepoints:j===3?[]:['U+00a0']}))}))}}};}
function fixture(){return{records:[record()],configuration:{unitSets:[{record_id:'review'}]},units:[]};}
it('reports all four ordered categories including zero counts, per-prompt valid denominators and source locations',()=>{
 const s=fixture(),before=JSON.stringify(s),r=principalRatingsReport(s)!;
 expect(r.totals).toEqual({reviews:1,expected:9,valid:9,missing:0,unresolved:0});
 expect(r.prompts[0]).toMatchObject({validDenominator:1,missing:0,unresolved:0,categories:[{label:'Excellent',count:0,percentage:0},{label:'Good',count:0,percentage:0},{label:'Average',count:0,percentage:0},{label:'Poor',count:1,percentage:100}]});
 expect(r.reviews[0].ratings[0]).toMatchObject({reviewId:'review',promptId:'fair_equitable',prompt:'Fair & equitable with all staff',selectedLabel:'Poor',sourceTableIndex:1,sourceRowIndex:2,sourceRows:[2]});
 expect(JSON.stringify(s)).toBe(before);
});
it('separates missing and unresolved rows and uses only valid ratings as percentage denominator',()=>{
 const s=fixture();s.records.push(record('second',2));s.configuration.unitSets.push({record_id:'second'});
 s.records[1].locator.respondentRatings.ratings.shift();s.records[1].locator.respondentRatings.ratings[0].candidates[0].state='ambiguous';
 const r=principalRatingsReport(s)!;expect(r.prompts[0]).toMatchObject({expected:2,validDenominator:1,missing:1,unresolved:0});expect(r.prompts[1]).toMatchObject({validDenominator:1,missing:0,unresolved:1});expect(r.prompts[0]!.categories[3]!.percentage).toBe(100);
});
it('keeps a zero-valid denominator unavailable rather than inventing zero percentages',()=>{
 const s=fixture();s.records[0].locator.respondentRatings.ratings=[];const r=principalRatingsReport(s)!;expect(r.prompts[0]!.categories.every(c=>c.count===0&&c.percentage===null)).toBe(true);
});
it('does not count duplicate prompt rows and retains every source row',()=>{
 const s=fixture(),q=s.records[0].locator.respondentRatings;q.ratings.push({...q.ratings[0],sourceRowIndex:20});const r=principalRatingsReport(s)!;
 expect(r.prompts[0]!.unresolved).toBe(1);expect(r.reviews[0].ratings[0].sourceRows).toEqual([2,20]);
});
it('flags missing and duplicate stable IDs, never matching by identifier or order',()=>{
 const s=fixture();s.records.push(record());s.configuration.unitSets.push({record_id:'absent'});const r=principalRatingsReport(s)!;
 expect(r.join.duplicateReviewIds).toEqual(['review']);expect(r.join.missingReviewIds).toEqual(['absent']);expect(r.totals.valid).toBe(0);
});
it('does not count one source questionnaire twice under different review IDs',()=>{
 const s=fixture();s.records.push(record('other'));s.configuration.unitSets.push({record_id:'other'});const r=principalRatingsReport(s)!;expect(r.join.duplicatedSourceReviewIds).toEqual(['review','other']);expect(r.totals.valid).toBe(0);
});
it('excludes Director questionnaires and blind validation without touching the source',()=>{
 const s:any=fixture();s.records.push({id:'director',locator:{excludeFromAnalysis:true,respondentRatings:{schema:'other-questionnaire@1.0',ratings:[]}}});s.configuration.unitSets.push({record_id:'director'});
 expect(principalRatingsReport(s)!.totals.expected).toBe(9);expect(principalRatingsReport(s)!.join.excludedReviewIds).toEqual(['director']);expect(principalRatingsReport({...s,blind:true})).toBe(null);
});
it('uses the same report data in printable HTML, includes per-review ratings and escapes source text',()=>{
 const s=fixture();s.records[0].locator.respondentRatings.ratings[0].prompt='<script>prompt</script>';const r=principalRatingsReport(s)!;const html=principalRatingsHtml(r,{expanded:true});
 expect(html).toContain('&lt;script&gt;prompt&lt;/script&gt;');expect(html).not.toContain('<script>');expect(html).toContain('0 (0.00%)');expect(html).toContain('1 (100.00%)');expect(html).toContain('Source table 1');expect(html).toContain('Valid ratings: 9 / 9');
});
it('adds ratings to the actual JSON export without changing narrative outputs or invoking AI',async()=>{
 const s:any={...fixture(),configuration:{unitSets:[{record_id:'review'}],machineRunId:'run'},blind:false};
 const machine={run:{id:'run',status:'completed',configuration:{semanticPolicy:{version:10},classificationConfig:{competencyRuleRevisions:{F1:'f1-internal-communication.v1'}}}},proposals:[],coverage:{semanticAssessed:0}};
 const before=JSON.stringify(machine),archive=vi.spyOn(McfRepository.prototype,'archive').mockResolvedValue({session:s} as any),provider=vi.fn(()=>{throw Error('AI forbidden');});
 const api=createMcfApi({query:async()=>({rows:[{payload:machine}]})} as any,'unused',provider);let output='';
 try{await api({url:'/api/mcf/sessions/11111111-1111-4111-8111-111111111111/export',method:'GET',headers:{}} as any,{setHeader:vi.fn(),writeHead:vi.fn(),end:(v:string)=>{output=v;}} as any);
 const json=JSON.parse(output);expect(json.principalIsrRatings).toEqual(principalRatingsReport(s));expect(JSON.stringify(json.machineOutputs)).toBe(before);expect(provider).not.toHaveBeenCalled();
 const baseline=summariseMcf(s,{competencies:[]},{useAi:true,step:5},{snapshot:machine});principalRatingsReport(s);expect(summariseMcf(s,{competencies:[]},{useAi:true,step:5},{snapshot:machine})).toEqual(baseline);
 }finally{archive.mockRestore();}
});
