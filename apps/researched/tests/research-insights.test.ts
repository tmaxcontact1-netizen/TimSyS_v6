import {describe,expect,it} from "vitest";
import {buildResearchInsights} from "../src/application/research-insights.js";
const clear={pendingSources:0,unextractedSources:0,failedTasks:0,unreviewedResults:0,lowConfidenceResults:0,potentialContradictions:0,missingExpectedFields:0,confirmedFindings:0,completedResults:0};
describe("research decision-support insights",()=>{
  it("links measured workflow gaps to their real action area",()=>{const result=buildResearchInsights({...clear,pendingSources:2,failedTasks:1});expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({id:"pending-corpus-decisions",action:{label:"Review corpus",tab:"corpus"}}),expect.objectContaining({id:"failed-analysis-tasks",severity:"critical"})]));});
  it("does not invent issues when no recorded evidence supports them",()=>expect(buildResearchInsights(clear).items).toEqual([]));
  it("states the limits of missing-field and low-confidence interpretations",()=>{const result=buildResearchInsights({...clear,missingExpectedFields:3,lowConfidenceResults:1});expect(result.items.find(item=>item.id==="missing-information")?.message).toContain("not proof");expect(result.interpretation).toContain("do not establish");});
});
