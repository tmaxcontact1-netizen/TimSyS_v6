import {describe,it,expect} from 'vitest';
import {initialSpans} from '../src/domain/mcf.js';
import {semanticCoverage,coverageLabels} from '../src/domain/mcf-coverage.js';
import {SEMANTIC_POLICY,transientSemanticError,semanticAttemptTimeout} from '../src/application/mcf-semantic.js';
import {GenericJsonAnalysisProvider} from '../src/application/ai-analysis.js';
// @ts-ignore browser module
import {reportHtml} from '../frontend/src/workbench/report.js';
describe('semantic analytical integrity',()=>{
 it('excludes whitespace spans while retaining exact original offsets and text',()=>{
  const text='\n\u00a0\nThe principal leads.\n\nThe staff learn.\n';const spans=initialSpans(text);
  expect(spans.length).toBeGreaterThan(0);expect(spans.every(s=>text.slice(s.start,s.end).trim())).toBe(true);
  expect(spans.map(s=>text.slice(s.start,s.end)).join('')).toContain('The principal leads.');
  expect(initialSpans(' \n\u00a0\t\r\n')).toEqual([]);
 });
 it('counts retained zero codes as semantic assessment and never promotes candidates',()=>{
  const units=['a','b','c','d','e'].map(id=>({id,original_text:'Text.'}));units.push({id:'blank',original_text:'\u00a0\n'});
  const proposals=[{unit_id:'a',payload:{codes:[{}]}},{unit_id:'b',payload:{codes:[]}},{unit_id:'c',payload:{method:'deterministic',matches:[]}}];
  const coverage=semanticCoverage(units,proposals,[{unit_id:'d',payload:{matches:[{}]}}],[{unit_ids:['d'],status:'failed',error:'timeout'}],['c']);
  expect(coverage).toMatchObject({substantivePopulationUnits:5,excludedWhitespaceUnits:1,semanticAssessed:2,semanticCoded:1,semanticZeroCode:1,semanticPending:2,semanticFailed:1,deterministicCandidateMatches:1,deterministicNoMatch:1,researcherReviewedUnits:1,semanticStatus:'partial_semantic_analysis'});
  expect(coverage.pathways.find(p=>p.unitId==='c')).toMatchObject({semantic:'semantic_pending',deterministic:'deterministic_no_match'});
 });
 it('requires every substantive unit to have a retained semantic result for completion',()=>{
  const units=[{id:'a',original_text:'Text.'}];expect(semanticCoverage(units,[],[],[],['a']).semanticStatus).not.toBe('complete_semantic_analysis');
  expect(semanticCoverage(units,[{unit_id:'a',payload:{codes:[]}}]).semanticStatus).toBe('complete_semantic_analysis');
 });
 it('uses finite retries only for transient failures',()=>{
  for(const message of ['This operation was aborted','ai_provider_http_429','ai_provider_http_503','fetch failed','timeout'])expect(transientSemanticError(message)).toBe(true);
  for(const message of ['ai_provider_http_401','ai_provider_http_403','incomplete_mcf_response','evidence_must_be_an_exact_unit_substring'])expect(transientSemanticError(message)).toBe(false);
  expect(SEMANTIC_POLICY).toMatchObject({maximumAttempts:3,retryDelaysMs:[30000,120000],timeoutMs:120000,maximumBatchUnits:6,maximumBatchCharacters:10000,concurrency:1});
 });
 it('uses bounded escalating deadlines below the bridge deadline and preserves legacy policies until resume',()=>{
  expect([1,2,3].map(n=>semanticAttemptTimeout(SEMANTIC_POLICY,n))).toEqual([120000,180000,210000]);
  expect(Math.max(...SEMANTIC_POLICY.attemptTimeoutsMs)).toBeLessThan(240000);
  expect(semanticAttemptTimeout({timeoutMs:90000},3)).toBe(90000);
 });
 it('includes all semantic coverage categories in manual and automatic HTML reports',()=>{
  for(const useAi of [false,true]){const html=reportHtml({tool:'mcf',draft:{title:'Audit',useAi,decisions:{},observations:[]},session:{units:[{id:'a',original_text:'A.'}]},instrument:{competencies:[]},machine:{runs:[],proposals:[]}});for(const label of Object.values(coverageLabels))expect(html).toContain(label);expect(html).not.toContain('machine proposals');}
 });
 it('enforces a per-request timeout through the real HTTP adapter',async()=>{
  const provider=new GenericJsonAnalysisProvider('fixture',{protocol:'generic-json',model:'fixture',baseUrl:'http://127.0.0.1/fixture',timeoutMs:60000,fetch:async(_url,init)=>new Promise((_resolve,reject)=>{init!.signal!.addEventListener('abort',()=>reject(new Error('This operation was aborted')));})});
  await expect(provider.analyse({requestId:'fixture',analysisType:'fixture',instructions:'fixture',evidence:[],timeoutMs:5})).rejects.toThrow('aborted');
 });
});
