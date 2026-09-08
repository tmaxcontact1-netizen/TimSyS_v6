import { describe,expect,it } from "vitest";
import { ANALYSIS_CATALOG,analysisPlanInput } from "../src/domain/analysis.js";
import { analyseDeterministically } from "../src/application/deterministic-analysis.js";

describe("hybrid analysis foundation",()=>{
  it("publishes plain-language, method-labelled analysis choices",()=>{
    expect(ANALYSIS_CATALOG.length).toBeGreaterThan(10);
    expect(new Set(ANALYSIS_CATALOG.map((item)=>item.id)).size).toBe(ANALYSIS_CATALOG.length);
    expect(ANALYSIS_CATALOG.every((item)=>item.description && ["rules","ai","hybrid"].includes(item.method))).toBe(true);
  });
  it("validates versionable analysis plans",()=>{
    expect(analysisPlanInput.parse({studyId:"9a9a4ff3-d836-4d7a-82d4-e0ff12d8d046",name:"Review",analysisTypes:["syntax"]}).analysisTypes).toEqual(["syntax"]);
    expect(()=>analysisPlanInput.parse({studyId:"bad",name:"",analysisTypes:[]})).toThrow();
  });
  it("produces reproducible structural, readability, terminology and completeness results",()=>{
    const result=analyseDeterministically("Research evidence matters. Research findings require evidence.\n\nThe report was published on 2026-09-07 and reached 75% completion.",["report","budget"]);
    expect(result.syntax).toMatchObject({sentenceCount:3,paragraphCount:2});
    expect(result.terminology[0]).toEqual({term:"evidence",count:2});
    expect(result.facts.dates).toContain("2026-09-07");
    expect(result.completeness).toEqual([{field:"report",found:true},{field:"budget",found:false}]);
  });
});
