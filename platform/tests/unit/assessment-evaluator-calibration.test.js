"use strict";

const { _classify: classify } = require("../../modules/assessment_evaluator");
const { _parseDocumentStandards: parseStandards } = require("../../modules/standards_repository");

const item = (task, extras = {}) => ({
  task,
  response_format: extras.response_format || "written response",
  supporting_information: extras.supporting_information || null,
  stimulus: extras.stimulus || null,
  answer_choices_json: JSON.stringify(extras.answer_choices || []),
  visible_scaffolding_json: JSON.stringify(extras.scaffolds || []),
});

describe("Standards PDF structure calibration", () => {
  test("recognises common code shapes and preserves page provenance", () => {
    const result = parseStandards({ segments: [
      { locator: { page: 12 }, content: "CCSS.ELA-LITERACY.RL.9-10.1 Cite strong and thorough textual evidence.\nInclude inferences drawn from the text." },
      { locator: { page: 18 }, content: "5.RL.2 Determine a theme of a story from details in the text." },
    ] });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ code: "CCSS.ELA-LITERACY.RL.9-10.1", source_page: 12 });
    expect(result.rows[0].statement).toContain("inferences drawn");
    expect(result.rows[1]).toMatchObject({ code: "5.RL.2", source_page: 18 });
  });

  test("refuses to invent rows when no coded standards are present", () => {
    const result = parseStandards({ segments: [{ locator: { page: 1 }, content: "Introduction to the publication" }] });
    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0].code).toBe("NO_STANDARD_CODES_DETECTED");
  });
});

describe("Assessment Evaluator ELA calibration corpus", () => {
  test.each([
    ["Compare how the two authors develop their central ideas.", "comparative analysis"],
    ["Which evidence best supports the author's claim?", "evaluation of evidence"],
    ["Write an argument and justify your claim with relevant evidence.", "evidence-based argumentation"],
    ["What can the reader infer from the final paragraph?", "inference from evidence"],
    ["What does the phrase mean in the context of paragraph four?", "word meaning in context"],
    ["Analyse how the structure contributes to the effect of the ending.", "analysis of development and effect"],
    ["Identify the location named in the passage.", "retrieval of explicit information"],
  ])("classifies a representative task without consulting standards", (task, expected) => {
    expect(classify(item(task)).primary_construct).toBe(expected);
  });

  test("treats unknown and underspecified demands as review work", () => {
    expect(classify(item("Sketch anything you remember."))).toMatchObject({ status: "human_review" });
    expect(classify(item("Why?"))).toMatchObject({ status: "insufficient_information" });
  });

  test("reports visible scaffolding without changing the underlying construct", () => {
    const result = classify(item("Which evidence best supports the claim?", {
      answer_choices: ["A", "B", "C", "D"],
      scaffolds: ["relevant paragraph highlighted"],
    }));
    expect(result.primary_construct).toBe("evaluation of evidence");
    expect(result.scaffolding_analysis).toContain("answer choices");
    expect(result.scaffolding_analysis).toContain("relevant paragraph highlighted");
  });
});
