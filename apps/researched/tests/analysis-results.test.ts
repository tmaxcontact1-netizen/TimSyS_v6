import {describe,expect,it} from "vitest";
import {ANALYSIS_RESULT_CONTRACT_VERSION,analysisResultJsonSchemas,jsonSchemaForAnalysis,parseAnalysisValue,parseStoredAnalysisResult} from "../src/domain/analysis-results.js";
import type {AnalysisTypeId} from "../src/domain/analysis.js";

const valid:Record<AnalysisTypeId,unknown>={
  syntax:{wordCount:10,sentenceCount:2,paragraphCount:1,averageSentenceWords:5},
  readability:{fleschReadingEase:75.2,estimatedMinutes:.2},
  terminology:{summary:"Specialist vocabulary is used.",terms:[{term:"credit",meaning:"A unit",importance:"Central to the requirements"}]},
  entities:{entities:[{name:"Example University",type:"organisation",context:"Programme provider"}]},
  semantics:{summary:"The document explains entry requirements.",intents:["inform applicants"],keyMessages:["Evidence is required"]},
  sentiment:{overall:"neutral",rationale:"Mostly factual wording.",signals:[{label:"required",polarity:"neutral"}]},
  themes:{themes:[{name:"Access",description:"Requirements for entry",sourceIds:["9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046","22cd85b5-a1df-447f-8a5e-40916c367c27"]}]},
  claims:{claims:[{claim:"Applicants need evidence.",support:"supported",qualification:"The evidence type varies."}]},
  comparison:{comparisons:[{topic:"Evidence",observations:[{sourceId:"9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",summary:"Required"},{sourceId:"22cd85b5-a1df-447f-8a5e-40916c367c27",summary:"Recommended"}],interpretation:"Obligation differs"}]},
  contradictions:{contradictions:[{sourceAId:"9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",statementA:"Required",sourceBId:"22cd85b5-a1df-447f-8a5e-40916c367c27",statementB:"Optional",explanation:"The statements use incompatible obligation levels."}]},
  "bias-framing":{frames:["Employability"],indicators:["outcomes-led language"],cautions:["Intent cannot be inferred from wording alone"]},
  completeness:{fields:[{field:"deadline",found:true,evidence:"1 September"}],missing:[]},
  "custom-extraction":{fields:{duration:"One year"}},
  "custom-questions":{answers:[{question:"How long?",answer:"One year"}]},
};

describe("versioned analysis result contracts",()=>{
  it("defines and accepts one explicit schema for every analysis type",()=>{
    expect(ANALYSIS_RESULT_CONTRACT_VERSION).toBe("researched.analysis-result.v1");
    for(const [type,value] of Object.entries(valid) as [AnalysisTypeId,unknown][]){expect(analysisResultJsonSchemas[type]).toBeTruthy();expect(parseAnalysisValue(type,value)).toEqual(value);}
  });
  it("rejects plausible but structurally unusable provider output",()=>{
    expect(()=>parseAnalysisValue("sentiment",{answer:"looks positive"})).toThrow();
    expect(()=>parseAnalysisValue("claims",{claims:[{claim:"Maybe"}]})).toThrow();
    expect(()=>parseAnalysisValue("syntax",{wordCount:-1,sentenceCount:0,paragraphCount:0,averageSentenceWords:0})).toThrow();
  });
  it("validates persisted AI and hybrid envelopes as well as their interpretation",()=>{
    expect(parseStoredAnalysisResult("themes","ai",{interpretation:valid.themes,limitations:[]})).toBeTruthy();
    expect(parseStoredAnalysisResult("completeness","hybrid",{deterministic:{fields:[]},interpretation:valid.completeness,limitations:["One source"]})).toBeTruthy();
    expect(()=>parseStoredAnalysisResult("themes","ai",{interpretation:{themes:"Access"},limitations:[]})).toThrow();
  });
  it("closes custom extraction schemas around the fields selected by the researcher",()=>{
    const schema:any=jsonSchemaForAnalysis("custom-extraction",["duration","deadline"]);
    expect(schema.properties.fields).toMatchObject({additionalProperties:false,required:["duration","deadline"]});
    expect(schema.properties.fields.properties).toHaveProperty("duration");
  });
});
