import {describe,expect,it} from "vitest";
import {canonicalProgrammeUrl,extractProgrammeCandidates,extractProgrammeRecord} from "../src/application/programme-workflow.js";

describe("focused programme workflow",()=>{
  it("ignores preamble links and extracts deduplicated programme links with context",()=>{
    const text=`Accreditation links\nAACSB https://example.org/accreditation\n\nUS University Master’s and Doctorate Educational Leadership Programmes\nState University\nMaster's Level\nM.Ed. Educational Leadership: https://state.edu/education/med?utm_source=list\nDoctorate Level\nEd.D. Educational Leadership: https://state.edu/education/edd\nEd.D. duplicate: https://state.edu/education/edd#overview`;
    expect(extractProgrammeCandidates(text)).toEqual([
      expect.objectContaining({institution:"State University",programmeName:"M.Ed. Educational Leadership",qualificationLevel:"masters",canonicalUrl:"https://state.edu/education/med"}),
      expect.objectContaining({institution:"State University",programmeName:"Ed.D. Educational Leadership",qualificationLevel:"doctorate",canonicalUrl:"https://state.edu/education/edd"}),
    ]);
  });
  it("normalises tracking URLs without changing programme paths",()=>{
    expect(canonicalProgrammeUrl("https://example.edu/program/?utm_campaign=x&mode=full#courses")).toBe("https://example.edu/program/?mode=full");
  });
  it("extracts comparable claims and declares absent information",()=>{
    const record=extractProgrammeRecord("The online Ed.D. requires 48 credit hours and can be completed in three years. The curriculum includes a research core, internship, and dissertation. Applicants submit transcripts, GPA evidence, and recommendations. Graduates prepare for superintendent certification.",{institution:"State University",programmeName:"Educational Leadership",qualificationLevel:"doctorate",originalUrl:"https://state.edu/edd",canonicalUrl:"https://state.edu/edd",ordinal:1});
    expect(record).toMatchObject({award:"Ed.D.",deliveryModes:["Online"]});
    expect(record.creditRequirement).toContain("48 credit hours");
    expect(record.curriculum.length).toBeGreaterThan(0);
    expect(record.admissionRequirements.length).toBeGreaterThan(0);
    expect(record.professionalOutcomes.length).toBeGreaterThan(0);
  });
});
