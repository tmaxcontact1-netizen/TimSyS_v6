import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {validateProposals} from '../src/application/mcf-ai.js';
import {answerQuestions} from '../src/application/question-analysis.js';
import {contentPlanInput} from '../src/domain/content-analysis.js';
import {rankSupportingLinks} from '../src/application/content-reader.js';
import type {AiAnalysisProvider} from '../src/application/ai-analysis.js';

describe('reviewable AI findings',()=>{
 const id=randomUUID(),text='The principal allocates resources.',units=[{id,original_text:text}];
 const code={competencyId:'A1',evidenceStrength:'Explicit',valence:null,rationale:'Allocation of resources.',evidence:text};
 const value={units:[{unitId:id,codes:[code],valence:null,notes:''}]};
 it('validates grounded proposals without creating researcher decisions',()=>{const result=validateProposals(value,units,'reviews',[id]);expect(result[0]?.codes).toHaveLength(1);expect(result[0]).not.toHaveProperty('actor');expect(result[0]).not.toHaveProperty('decisionId');});
 it('rejects invented quotes and unknown competencies',()=>{expect(()=>validateProposals({units:[{...value.units[0],codes:[{...code,evidence:'Invented'}]}]},units,'reviews',[id])).toThrow('exact_unit_substring');expect(()=>validateProposals({units:[{...value.units[0],codes:[{...code,competencyId:'Z9'}]}]},units,'reviews',[id])).toThrow();});
 it('rejects missing, duplicate or foreign units and uncited proposals',()=>{expect(()=>validateProposals({units:[]},units,'reviews',[id])).toThrow();expect(()=>validateProposals({units:[value.units[0],value.units[0]]},units,'reviews',[id])).toThrow();expect(()=>validateProposals({units:[{...value.units[0],unitId:randomUUID()}]},units,'reviews',[id])).toThrow('unknown_proposal_unit');expect(()=>validateProposals(value,units,'reviews',[])).toThrow('unsupported_mcf_citation');});
 it('keeps documentary coding free of valence',()=>{expect(()=>validateProposals({units:[{...value.units[0],valence:'negative'}]},units,'documentary',[id])).toThrow('documentary_mode_has_no_valence');});
 it('retains zero-code findings as proposals requiring human review',()=>{expect(validateProposals({units:[{...value.units[0],codes:[]}]},units,'reviews',[id])[0]?.reviewedNoCode).toBe(true);});
 it('answers every question with checked quotations and stable source identities',async()=>{const provider:AiAnalysisProvider={id:'fixture',model:'fixture',analyse:async r=>({value:{answers:[{index:0,status:'supported',text:'Resource allocation is described.',evidence:[{id:r.evidence[0]!.segmentId,quote:text}]},{index:1,status:'not-found',text:'',evidence:[]}]},confidence:0.8,evidenceSegmentIds:r.evidence.map(e=>e.segmentId),limitations:[]})};const result=await answerQuestions(provider,[{id:'original-block',content:text}],['What is managed?','What is the duration?'],'Fixture');expect(result.answers[0]?.findings[0]?.evidence[0]?.id).toBe('original-block');expect(result.answers[1]?.status).toBe('not-found');});
 it('rejects fabricated quotations rather than presenting unsupported answers',async()=>{const provider:AiAnalysisProvider={id:'fixture',model:'fixture',analyse:async r=>({value:{answers:[{index:0,status:'supported',text:'Invented answer',evidence:[{id:r.evidence[0]!.segmentId,quote:'not present'}]}]},confidence:1,evidenceSegmentIds:r.evidence.map(e=>e.segmentId),limitations:[]})};await expect(answerQuestions(provider,[{id,content:text}],['Question?'],'Fixture')).rejects.toThrow('unsupported_ai_quote');});
 it('controls supporting webpages and documents independently',()=>{const html='<a href="/curriculum">Curriculum modules</a><a href="/course.pdf">Programme handbook PDF</a>';const rank=(web:boolean,docs:boolean)=>rankSupportingLinks(html,'https://example.edu/course','https://example.edu/course',contentPlanInput.parse({followWebpages:web,followDocuments:docs})).map(x=>x.url);expect(rank(false,false)).toEqual([]);expect(rank(false,true)).toEqual(['https://example.edu/course.pdf']);expect(rank(true,false)).toEqual(['https://example.edu/curriculum']);expect(rank(true,true)).toHaveLength(2);});
});
