import {describe,it,expect} from 'vitest';
import {deterministicMcf,DETERMINISTIC_CONFIG,DETERMINISTIC_HASH} from '../src/application/mcf-deterministic.js';
import {MCF} from '../src/domain/mcf.js';
// @ts-ignore frontend module
import {summariseMcf} from '../frontend/src/workbench/mcf-report.js';
describe('deterministic MCF candidate retrieval',()=>{
 it('covers all frozen competency IDs with a separately versioned configuration',()=>{
  expect(DETERMINISTIC_CONFIG.rules.map(r=>r.competencyId)).toEqual(MCF.competencies.map(c=>c.id));expect(DETERMINISTIC_HASH).toMatch(/^[a-f0-9]{64}$/);
 });
 it('reproduces exact matches with original Unicode offsets and no semantic classifications',()=>{
  const units=[{id:'a',original_text:'😀 The manager allocates resources. PROFESSIONAL DEVELOPMENT is unavailable.'}];
  const first=deterministicMcf(units);expect(first).toEqual(deterministicMcf(units));expect(first[0]!.matches.map(m=>m.competencyId)).toEqual(['A1','C1']);
  for(const m of first[0]!.matches)expect(units[0]!.original_text.slice(m.start,m.end)).toBe(m.matchedText);
  expect(first[0]!.codes).toEqual([]);expect(first[0]!.valence).toBeNull();expect(first[0]!.reviewedNoCode).toBe(false);
 });
 it('does not turn generic excluded terms into candidate competencies',()=>{
  const [result]=deterministicMcf([{id:'x',original_text:'The buildings and technology are new. Student discipline improved. The school collected data. He is visionary and ethical. I am happy.'}]);expect(result!.matches).toEqual([]);expect(result!.reviewedNoCode).toBe(false);
 });
 it('retains negation for review without guessing positive or negative valence',()=>{
  const [result]=deterministicMcf([{id:'x',original_text:'There is no professional development.'}]);expect(result!.matches[0]!.evidence).toBe('There is no professional development.');expect(result!.valence).toBeNull();
 });
 it('reports candidate matches without calling them explicit or implicit findings',()=>{
  const units=[{id:'a',original_text:'The manager allocates resources.'}],payload=deterministicMcf(units)[0];
  const report=summariseMcf({units},MCF,{machineRunId:'run'},{runs:[{id:'run'}],proposals:[{run_id:'run',unit_id:'a',payload}]});
  expect(report.deterministic).toBe(1);expect(report.findings[0].local).toBe(true);expect(report.competencies[0].findings[0].code.evidenceStrength).toBeNull();expect(report.human).toBe(0);
 });
});
