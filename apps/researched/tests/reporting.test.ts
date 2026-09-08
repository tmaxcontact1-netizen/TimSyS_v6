import { describe, expect, it } from "vitest";
import {
  assembleReport,
  renderReportHtml,
} from "../src/application/reporting.js";

describe("reproducible reporting", () => {
  it("produces the same fingerprint for the same fixed inputs", () => {
    const input = {
      title: "Evidence report",
      includeMethodology: true,
      includeCorpus: true,
      includeEvidenceTable: true,
    };
    const data = {
      study: { research_question: "What is supported?" },
      corpus: [],
      findings: [],
      evidence: [],
    };
    const first = assembleReport(input, data, "2026-09-06T00:00:00.000Z");
    const second = assembleReport(input, data, "2026-09-06T00:00:00.000Z");
    expect(first.hash).toBe(second.hash);
    expect(first.payload.schema).toBe("researched.report.v1");
  });

  it("escapes user-authored content in readable exports", () => {
    const html = renderReportHtml({
      content_hash: "fingerprint",
      report_payload: {
        title: "<script>alert(1)</script>",
        generatedAt: "now",
        study: { research_question: "Question" },
        findings: [],
        corpus: [],
        evidence: [],
      },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("fingerprint");
  });
});
