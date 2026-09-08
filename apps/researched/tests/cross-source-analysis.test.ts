import {describe,expect,it} from "vitest";
import {balancedCorpusEvidence,corpusInstructions} from "../src/application/cross-source-analysis.js";
import {validateAnalysisSourceRelationships} from "../src/domain/analysis-results.js";
const a="9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",b="22cd85b5-a1df-447f-8a5e-40916c367c27",segmentA="7e95a638-1579-4be7-b02b-a44971ec2ea6",segmentB="c346b83a-504a-4af1-afb2-2aab4920d39a";
const sources=[{source_id:a,label:"University",entity_path:["Country","University"],evidence_segments:[{segmentId:segmentA,sourceId:a,content:"A".repeat(1000)}]},{source_id:b,label:"College",entity_path:["Country","College"],evidence_segments:[{segmentId:segmentB,sourceId:b,content:"B".repeat(1000)}]}];
describe("cross-source evidence assembly",()=>{
  it("balances a bounded context across sources and retains hierarchy labels",()=>{
    const evidence=balancedCorpusEvidence(sources,400);
    expect(new Set(evidence.map(item=>item.sourceId))).toEqual(new Set([a,b]));
    expect(evidence.reduce((total,item)=>total+item.content.length,0)).toBeLessThanOrEqual(400);
    expect(evidence[0]!.content).toContain("Country > University");
  });
  it("gives the provider stable source identities rather than merged anonymous text",()=>{
    const instructions=corpusInstructions("comparison",sources);
    expect(instructions).toContain(a);expect(instructions).toContain(b);expect(instructions).toContain("do not analyse them as though they were one document");
  });
  it("rejects invented or self-comparing source relationships",()=>{
    expect(()=>validateAnalysisSourceRelationships("comparison",{comparisons:[{topic:"x",observations:[{sourceId:a,summary:"one"},{sourceId:a,summary:"two"}],interpretation:"same"}]},[a,b])).toThrow("comparison_requires_distinct_sources");
    expect(()=>validateAnalysisSourceRelationships("themes",{themes:[{name:"x",description:"x",sourceIds:[a,"ce2af779-734a-4b9a-aa57-3c322963d620"]}]},[a,b])).toThrow("unsupported_analysis_source_relationship");
  });
});
