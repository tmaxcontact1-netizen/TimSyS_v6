import {describe,it,expect} from 'vitest';
// @ts-ignore browser module
import {summariseMcf} from '../frontend/src/workbench/mcf-report.js';
// @ts-ignore browser module
import {reportHtml} from '../frontend/src/workbench/report.js';
import {machineReport} from '../src/application/mcf-report.js';
const instrument={competencies:[{id:'A1',competency:'Resource Management'},{id:'B1',competency:'Communication'}]};
const session={units:[{id:'one',original_text:'Allocate resources.',filename:'source.txt',session_ordinal:1},{id:'two',original_text:'Unprocessed.'}]};
const payload={codes:[{competencyId:'A1',evidenceStrength:'Implicit',valence:'mixed-ambiguous',evidence:'Allocate resources.',rationale:'Context suggests allocation.'}],notes:''};
const machine={runs:[{id:'current',status:'partial'}],proposals:[{run_id:'current',unit_id:'one',payload},{run_id:'old',unit_id:'two',payload}]};
describe('automatic MCF report',()=>{
 it('uses only the selected run and distinguishes missing results from no supporting evidence',()=>{
  const result=summariseMcf(session,instrument,{machineRunId:'current'},machine);
  expect(result.analysed).toBe(1);expect(result.missing.map((u:any)=>u.id)).toEqual(['two']);expect(result.competencies[1].findings).toEqual([]);expect(result.contextual).toHaveLength(1);expect(result.human).toBe(0);
 });
 it('uses the fixed confirmed snapshot even when a later run arrives',()=>{
  const draft={step:5,machineRunId:'current',machineReport:{run:machine.runs[0],proposals:machine.proposals}};
  expect(summariseMcf(session,instrument,draft,{runs:[],proposals:[]}).analysed).toBe(1);
 });
 it('lets a human no-code correction override a proposal without altering it',()=>{
  const result=summariseMcf(session,instrument,{machineRunId:'current',decisions:{one:{codes:[],reviewedNoCode:true,notes:'Correction'}}},machine);
  expect(result.human).toBe(1);expect(result.competencies[0].findings).toHaveLength(0);expect(result.noCode).toHaveLength(1);expect(machine.proposals[0]!.payload.codes).toHaveLength(1);
 });
 it('exports AI status, partial coverage, escaped evidence, all competencies and provenance',()=>{
  const html=reportHtml({tool:'mcf',draft:{useAi:true,title:'<script>',machineRunId:'current'},session,instrument,machine});
  expect(html).toContain('AI analysis: 1 of 2 passages');expect(html).toContain('AI finding');expect(html).toContain('Communication');expect(html).toContain('Unit: one');expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>');
 });
 it('refuses confirmation of absent, running or wholly failed runs',async()=>{
  for(const run of [undefined,{status:'queued'},{status:'running'},{status:'failed'}])await expect(machineReport({query:async()=>({rows:run?[run]:[]})} as any,'session','run')).rejects.toThrow('finish_analysis_before_confirming');
 });
 it('refuses an empty terminal report',async()=>{
  let calls=0;await expect(machineReport({query:async()=>({rows:calls++===0?[{status:'completed'}]:[]})} as any,'session','run')).rejects.toThrow('no_analysis_findings_to_confirm');
 });
});
