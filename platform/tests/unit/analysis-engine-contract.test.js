const fs=require("node:fs");
const path=require("node:path");

describe("shared analysis engine contract",()=>{
  test("requires evidence-grounded, provider-neutral requests",()=>{
    const contract=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../shared/contracts/analysis-engine.v1.json"),"utf8"));
    expect(contract.$id).toBe("timsys.analysis-engine.v1");
    expect(contract.required).toEqual(expect.arrayContaining(["requestId","analysisType","instructions","evidence"]));
    expect(contract.properties.evidence.minItems).toBe(1);
    expect(contract.properties.evidence.items.required).toEqual(["segmentId","sourceId","content"]);
    expect(contract.properties.analysisType.enum).toHaveLength(14);
    expect(contract.properties.analysisType.enum).toEqual(expect.arrayContaining(["syntax","semantics","custom-questions"]));
    expect(contract.additionalProperties).toBe(false);
  });
  test("requires confidence, limitations and traceable citations in results",()=>{
    const contract=JSON.parse(fs.readFileSync(path.resolve(__dirname,"../../shared/contracts/analysis-engine-result.v1.json"),"utf8"));
    expect(contract.required).toEqual(["value","confidence","evidenceSegmentIds","limitations"]);
    expect(contract.properties.confidence).toMatchObject({minimum:0,maximum:1});
    expect(contract.properties.evidenceSegmentIds.minItems).toBe(1);
    expect(contract.additionalProperties).toBe(false);
  });
});
