import { describe, expect, it } from "vitest";
import {
  evidenceInput,
  findingInput,
  evidenceTransitionInput,
  findingTransitionInput,
  sourceDecision,
  sourceInput,
  studyInput,
} from "../src/domain/contracts.js";
describe("Research'Ed foundation contracts", () => {
  it("keeps study method explicit", () => {
    expect(
      studyInput.parse({
        title: "Study",
        researchQuestion: "What evidence exists?",
      }),
    ).toMatchObject({ inclusionRules: [], exclusionRules: [] });
  });
  it("retains incomplete sources as pending records", () => {
    expect(
      sourceInput.parse({
        studyId: "00000000-0000-4000-8000-000000000001",
        label: "Partial source",
        originalUrl: "https://example.org",
        sourceType: "webpage",
      }),
    ).toMatchObject({ corpusStatus: "pending", completeness: "unassessed" });
  });
  it("requires reasons for exclusions", () => {
    expect(() =>
      sourceInput.parse({
        studyId: "00000000-0000-4000-8000-000000000001",
        label: "Source",
        originalUrl: "https://example.org",
        sourceType: "webpage",
        corpusStatus: "excluded",
      }),
    ).toThrow();
  });
  it("requires an auditable reason when an existing source is excluded", () => {
    expect(() =>
      sourceDecision.parse({ corpusStatus: "excluded", actor: "researcher" }),
    ).toThrow();
    expect(
      sourceDecision.parse({
        corpusStatus: "excluded",
        reason: "Outside the study period",
        actor: "researcher",
      }),
    ).toMatchObject({ reason: "Outside the study period" });
  });
  it("requires human interpretation for captured evidence", () => {
    const identity = "00000000-0000-4000-8000-000000000001";
    expect(() =>
      evidenceInput.parse({
        studyId: identity,
        segmentId: identity,
        evidenceType: "claim",
        interpretation: "",
      }),
    ).toThrow();
    expect(
      evidenceInput.parse({
        studyId: identity,
        segmentId: identity,
        evidenceType: "counterevidence",
        interpretation: "This contradicts the working proposition.",
      }),
    ).toMatchObject({ confidence: "unassessed", codeIds: [] });
  });
  it("will not create an unsupported finding", () => {
    const identity = "00000000-0000-4000-8000-000000000001";
    expect(() =>
      findingInput.parse({
        studyId: identity,
        title: "Finding",
        conclusion: "A conclusion",
        evidenceIds: [],
      }),
    ).toThrow();
  });
  it("requires reasons for destructive lifecycle changes", () => {
    expect(() =>
      evidenceTransitionInput.parse({ targetStatus: "withdrawn" }),
    ).toThrow();
    expect(() =>
      findingTransitionInput.parse({ targetStatus: "withdrawn" }),
    ).toThrow();
    expect(
      evidenceTransitionInput.parse({ targetStatus: "active" }),
    ).toMatchObject({ actor: "local-researcher" });
  });
});
