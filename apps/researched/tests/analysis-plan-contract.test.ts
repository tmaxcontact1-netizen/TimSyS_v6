import {describe,expect,it} from "vitest";
import {analysisPlanInput,analysisTemplateInput} from "../src/domain/analysis.js";
const base={studyId:"9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",name:"Analysis",sourceIds:[],options:{}};
describe("analysis plan contract requirements",()=>{
  it("requires declared fields for custom extraction",()=>expect(()=>analysisPlanInput.parse({...base,analysisTypes:["custom-extraction"],customQuestions:[],expectedFields:[]})).toThrow(/expected field/i));
  it("requires declared questions for custom question analysis",()=>expect(()=>analysisPlanInput.parse({...base,analysisTypes:["custom-questions"],customQuestions:[],expectedFields:[]})).toThrow(/question/i));
  it("accepts fully configured custom work",()=>expect(analysisPlanInput.parse({...base,analysisTypes:["custom-extraction","custom-questions"],customQuestions:["What is required?"],expectedFields:["requirements"]})).toBeTruthy());
  it("keeps reusable templates independent from study and source identity",()=>{
    const template=analysisTemplateInput.parse({name:"Requirements review",analysisTypes:["completeness"],expectedFields:["deadline"],customQuestions:[],options:{}});
    expect(template).not.toHaveProperty("studyId");expect(template).not.toHaveProperty("sourceIds");
  });
});
