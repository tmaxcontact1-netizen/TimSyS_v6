import {describe,it,expect} from 'vitest';
// @ts-ignore browser component
import ProcessingProgress,{analysisProgress} from '../frontend/src/ProcessingProgress.jsx';
// @ts-ignore browser renderer
import {renderToStaticMarkup} from 'react-dom/server';
// @ts-ignore browser runtime
import React from 'react';
describe('processing progress',()=>{
 it('never labels a stopped or retrying partial semantic run complete',()=>{
  const coverage={semanticAssessed:306,substantivePopulationUnits:2772,semanticPending:2460,semanticFailed:6};
  for(const status of ['partial','failed','cancelled'])expect(analysisProgress('mcf',{status,coverage}).label).toBe('Semantic analysis incomplete');
  expect(analysisProgress('mcf',{status:'running',coverage}).label).toBe('Semantic analysis in progress');
  expect(analysisProgress('mcf',{status:'completed',coverage:{...coverage,semanticAssessed:2772,semanticPending:0,semanticFailed:0}}).label).toBe('Semantic analysis complete');
 });
 it('counts semantic successes including zero-code results without counting deterministic candidates or failures',()=>{
  const p=analysisProgress('mcf',{coverage:{semanticAssessed:300,substantivePopulationUnits:2772,semanticPending:2460,semanticFailed:12,deterministicCandidateMatches:2472}});
  expect(p.completed).toBe(300);expect(p.total).toBe(2772);expect(p.detail).toContain('12 failed');
  const html=renderToStaticMarkup(React.createElement(ProcessingProgress,p));expect(html).toContain('value="300"');expect(html).toContain('max="2772"');expect(html).toContain('10%');
 });
 it('distinguishes finished links with errors from successful retrieval, leaving retries and cancellations unfinished',()=>{
  const p=analysisProgress('content',{tasks:['completed','failed','retry','running','queued','cancelled'].map(status=>({status}))});
  expect(p.completed).toBe(2);expect(p.total).toBe(6);expect(p.detail).toContain('1 successfully collected · 1 failed · 1 cancelled');
 });
 it('uses an indeterminate accessible bar when the server cannot provide a total',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcessingProgress,{label:'Reading document'}));expect(html).toContain('aria-label="Reading document"');expect(html).not.toContain('value=');expect(html).not.toContain('%');expect(html).toContain('total is not available');
 });
 it('keeps interrupted semantic work visibly incomplete and clamps malformed progress',()=>{
  const html=renderToStaticMarkup(React.createElement(ProcessingProgress,{label:'Passages',completed:6,total:14,active:false}));expect(html).toContain('incomplete');expect(html).toContain('42%');
  expect(renderToStaticMarkup(React.createElement(ProcessingProgress,{completed:12,total:10}))).toContain('value="10"');
 });
});
