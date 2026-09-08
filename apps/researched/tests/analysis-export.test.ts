import {describe,expect,it} from "vitest";
import {analysisRunArchive,analysisRunCsv,analysisRunMarkdown} from "../src/application/analysis-export.js";
const run={id:"run-1",status:"completed",progress_completed:1,progress_total:1,results:[{analysis_type:"themes",source_id:null,method:"ai",status:"accepted",confidence:.8,evidence_segment_ids:["one","two"],value:{themes:[{name:'Access, "fairness"'}]}}]};
describe("analysis run exports",()=>{
  it("exports spreadsheet-safe CSV with explicit scope",()=>{const value=analysisRunCsv(run);expect(value).toContain('"corpus"');expect(value).toContain('""name""');expect(value).toContain('Access,');});
  it("exports readable Markdown without losing the structured value",()=>{const value=analysisRunMarkdown(run);expect(value).toContain("# Analysis run run-1");expect(value).toContain("Cross-source corpus");expect(value).toContain('Access, \\"fairness\\"');});
  it("exports a versioned lossless JSON archive",()=>expect(JSON.parse(analysisRunArchive(run))).toMatchObject({contract:"researched.analysis-run-export.v1",run:{id:"run-1"}}));
});
