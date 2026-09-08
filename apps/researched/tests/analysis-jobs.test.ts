import {describe,expect,it} from "vitest";
import {analysisRetry,buildAnalysisJobs,canControlAnalysisRun} from "../src/application/analysis-jobs.js";

describe("persistent analysis job policy",()=>{
  it("supports explicit pause, resume, cancel and failed-item retry transitions",()=>{
    expect(canControlAnalysisRun("running","pause")).toBe(true);
    expect(canControlAnalysisRun("paused","resume")).toBe(true);
    expect(canControlAnalysisRun("completed","cancel")).toBe(false);
    expect(canControlAnalysisRun("partial","retry")).toBe(true);
  });
  it("backs off transient failures and stops at the attempt limit",()=>{
    const at=new Date("2026-09-07T00:00:00.000Z");
    expect(analysisRetry(1,3,"ai_provider_http_503",at)).toMatchObject({retry:true,delayMs:5000});
    expect(analysisRetry(3,3,"ai_provider_http_503",at).retry).toBe(false);
  });
  it("does not repeatedly retry configuration or input defects",()=>{
    expect(analysisRetry(1,3,"ai_provider_not_configured",new Date()).retry).toBe(false);
    expect(analysisRetry(1,3,"analysis_input_unavailable",new Date()).retry).toBe(false);
  });
  it("builds thousands of unique source jobs while creating one job per corpus method",()=>{
    let sequence=0;const inputs=Array.from({length:1000},(_,index)=>({source_id:`00000000-0000-4000-8000-${String(index).padStart(12,"0")}`})),jobs=buildAnalysisJobs(inputs,["syntax","readability","themes","comparison"],3,"2026-09-08T00:00:00.000Z",()=>`job-${sequence++}`);
    expect(jobs).toHaveLength(2002);expect(new Set(jobs.map(job=>job.id)).size).toBe(2002);expect(jobs.filter(job=>job.scopeType==="corpus")).toHaveLength(2);
  });
});
