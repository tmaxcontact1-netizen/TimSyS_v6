import {it,expect,vi} from 'vitest';
import {mcfReportView} from '../src/domain/mcf-report-view.js';
import {aiAmbiguitySummary} from '../src/domain/ai-ambiguity-summary.js';
import {McfRepository} from '../src/infrastructure/mcf-repository.js';
import {createMcfApi} from '../src/entrypoints/mcf-api.js';
// @ts-ignore frontend JS
import {summariseMcf} from '../../../../apps/researched/frontend/src/workbench/mcf-report.js';
// @ts-ignore frontend JS
import {reportHtml} from '../../../../apps/researched/frontend/src/workbench/report.js';
// @ts-ignore frontend JS
import {schoolRatingsHtml} from '../../../../apps/researched/frontend/src/workbench/school-ratings-report.js';
// @ts-ignore frontend JSX
import {LazyDetails} from '../../../../apps/researched/frontend/src/workbench/shared.jsx';
// @ts-ignore use the same React instance as the frontend
import React from '../../../../apps/researched/node_modules/react/index.js';
// @ts-ignore frontend React renderer
import {renderToStaticMarkup} from '../../../../apps/researched/node_modules/react-dom/server.node.js';

it('does not construct hidden detail children until opened',()=>{
 const children=vi.fn(()=>React.createElement('div',null,'private detail'));
 const html=renderToStaticMarkup(React.createElement(LazyDetails,{title:'Inspect',children}));
 expect(children).not.toHaveBeenCalled();expect(html).toContain('Inspect');expect(html).not.toContain('private detail');
});
it('retains all 7500 assessments, context, provenance and exported findings in the compact view',()=>{
 const units=Array.from({length:7500},(_,i)=>({id:'unit-'+i,record_id:'review-'+Math.floor(i/31),original_text:'Evidence '+i,filename:'test',session_ordinal:i+1,locator:{respondentRatings:{raw:'repeated metadata'}}}));
 const codes=(i:number)=>[{competencyId:'F1',evidenceProtocol:2,evidenceStrength:'Explicit',evidence:'Evidence '+i,rationale:'Communication',valence:'positive',context:[]}];
 const proposals=units.map((u,i)=>({run_id:'run',unit_id:u.id,payload:{method:'ai',codes:codes(i),ambiguity:{version:1,status:'none',alternatives:[]},provenance:{runId:'run'}}}));
 const session={units,records:[],configuration:{unitSets:[]}},machine={run:{id:'run',configuration:{}},proposals,outputs:[{payload:{proposals}}],aiAmbiguity:aiAmbiguitySummary(units,proposals)};
 const before=JSON.stringify({session,machine}),view=mcfReportView(session,machine),draft={step:5,useAi:true,title:'Test',decisions:{}},instrument={competencies:[{id:'F1',competency:'Internal Communication'}]};
 expect(view.session.units).toHaveLength(7500);expect(view.machineOutputs.proposals).toBe(proposals);expect(view.machineOutputs.outputs).toBeUndefined();expect(view.machineOutputs.aiAmbiguity).toBeUndefined();expect(view.session.units[0].locator).toBeUndefined();
 const full={tool:'mcf',session,machine:{snapshot:machine},draft,instrument},compact={...full,session:view.session,machine:{snapshot:view.machineOutputs}};
 expect(reportHtml(compact)).toBe(reportHtml(full));expect(reportHtml(compact)).toContain('Evidence 7499');expect(summariseMcf(compact.session,instrument,draft,compact.machine).coverage.semanticAssessed).toBe(7500);expect(JSON.stringify({session,machine})).toBe(before);
});
it('keeps first matching AI proposal semantics and does not call array find per unit',()=>{
 const proposals:any[]=[{unit_id:'u',payload:{method:'deterministic'}},{unit_id:'u',payload:{method:'ai',codes:[{competencyId:'F1'}]}},{unit_id:'u',payload:{method:'ai',codes:[{competencyId:'A1'}]}}];
 const find=vi.spyOn(proposals,'find');expect(aiAmbiguitySummary([{id:'u',original_text:'text'}],proposals).rows[0].supportedCompetencyIds).toEqual(['F1']);expect(find).not.toHaveBeenCalled();
});
it('hides per-review rating tables only in the screen summary, never in default exports',()=>{
 const report={notice:'Ratings',prompts:[],reviews:[{reviewId:'last-review',ratings:[{prompt:'Original prompt',rawValue:'7',status:'valid',sourceRows:[1]}],salaries:[]}]};
 expect(schoolRatingsHtml(report,{includeReviews:false})).not.toContain('last-review');expect(schoolRatingsHtml(report)).toContain('last-review');expect(schoolRatingsHtml(report)).toContain('Original prompt');
});
it('serves frozen report view through SELECTs without archive construction or AI calls',async()=>{
 const session={units:[{id:'unit',locator:{raw:'metadata'}}],configuration:{machineRunId:'run'},blind:false};
 const workspace=vi.spyOn(McfRepository.prototype,'workspace').mockResolvedValue(session as any),archive=vi.spyOn(McfRepository.prototype,'archive').mockRejectedValue(Error('Full archive must be download-only'));
 const provider=vi.fn(()=>{throw Error('AI prohibited');}),query=vi.fn(async(sql:string)=>{expect(sql).toContain("payload - 'outputs' - 'aiAmbiguity'");return{rows:[{payload:{run:{id:'run'},proposals:[]}}]};});let body='';
 try{await createMcfApi({query} as any,'unused',provider)({url:'/api/mcf/sessions/11111111-1111-4111-8111-111111111111/report-view',method:'GET',headers:{}} as any,{writeHead:vi.fn(),end:(v:string)=>{body=v;}} as any);expect(JSON.parse(body).session.units[0]).toEqual({id:'unit'});expect(workspace).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111',true);expect(archive).not.toHaveBeenCalled();expect(provider).not.toHaveBeenCalled();}finally{workspace.mockRestore();archive.mockRestore();}
});
