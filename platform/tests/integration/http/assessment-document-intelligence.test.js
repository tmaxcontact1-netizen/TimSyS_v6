"use strict";
const helper = require("../../helpers/test-server");
describe("assessment document intelligence", () => {
  let context, token;
  beforeAll(async () => {
    context = await helper.createTestServer("assessment_document_intelligence");
    token = (await context.makeRequest("POST", "/api/auth/dev-login", {})).data
      .token;
  });
  afterAll(async () => {
    if (context) await context.cleanup();
  });
  test("extracts a stored question paper into reviewable rather than automatic items", async () => {
    let r = await context.makeRequest(
        "POST",
        "/documents",
        { title: "ELA question paper", category: "assessment_question_paper" },
        token,
      ),
      document = r.data.document;
    r = await context.makeRequest(
      "POST",
      `/documents/${document.id}/versions`,
      {
        filename: "questions.txt",
        mime_type: "text/plain",
        content_base64: Buffer.from(
          "1. Which evidence best supports the claim?\nA. First detail\nB. Second detail\n\n2. Explain how the author develops the central idea.",
        ).toString("base64"),
      },
      token,
    );
    expect(r.status).toBe(200);
    r = await context.makeRequest(
      "POST",
      "/assessment-evaluator/audits",
      { title: "Uploaded ELA assessment", workflow_mode: "teacher" },
      token,
    );
    const audit = r.data.audit;
    r = await context.makeRequest(
      "POST",
      `/assessment-evaluator/audits/${audit.id}/sources`,
      {
        document_id: document.id,
        filename: "questions.txt",
        mime_type: "text/plain",
        source_role: "question_paper",
      },
      token,
    );
    const source = r.data.source;
    r = await context.makeRequest(
      "POST",
      `/assessment-evaluator/sources/${source.id}/extract`,
      { ocr: false },
      token,
    );
    expect(r.status).toBe(200);
    expect(r.data.source.extraction_status).toBe("needs_review");
    expect(r.data.source.candidates).toHaveLength(2);
    expect(r.data.source.candidates[0].answer_choices).toHaveLength(2);
    r = await context.makeRequest(
      "GET",
      `/assessment-evaluator/audits/${audit.id}`,
      null,
      token,
    );
    expect(r.data.audit.items).toHaveLength(0);
    const candidate = r.data.audit.sources[0].candidates[0];
    r = await context.makeRequest(
      "POST",
      `/assessment-evaluator/candidates/${candidate.id}/decision`,
      { decision: "accept" },
      token,
    );
    expect(r.status).toBe(200);
    expect(r.data.item.task).toMatch(/Which evidence/);
    r = await context.makeRequest(
      "POST",
      `/assessment-evaluator/candidates/${r.data.item.id}/decision`,
      { decision: "accept" },
      token,
    );
    expect(r.status).toBe(409);
  });
  test("records unsupported extraction instead of fabricating text", async () => {
    let r = await context.makeRequest(
        "POST",
        "/documents",
        { title: "Unsupported archive" },
        token,
      ),
      document = r.data.document;
    await context.makeRequest(
      "POST",
      `/documents/${document.id}/versions`,
      {
        filename: "archive.zip",
        mime_type: "application/zip",
        content_base64: Buffer.from("not a real archive").toString("base64"),
      },
      token,
    );
    r = await context.makeRequest(
      "POST",
      `/document-intelligence/documents/${document.id}/extract`,
      {},
      token,
    );
    expect(r.status).toBe(200);
    expect(r.data.run.status).toBe("unsupported");
    expect(r.data.text).toBe("");
  });
});
