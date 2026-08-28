import { describe, expect, it } from "vitest";
import {
  CV_CONTRACT_VERSION,
  cvAnalysisRequestSchema,
  cvAnalysisResponseSchema,
} from "../../src/application/contracts/cv.js";

const identity = "11111111-1111-4111-8111-111111111111";
const hash = "a".repeat(64);

describe("CV contract v1", () => {
  it("accepts a bounded deterministic analysis request and response", () => {
    const request = cvAnalysisRequestSchema.parse({
      contractVersion: CV_CONTRACT_VERSION,
      requestId: identity,
      imageId: identity,
      imageRole: "whole",
      relativePath: "images/11/whole.jpg",
      contentHash: hash,
      analysisVersion: "quality-v1",
      operations: ["quality"],
    });
    expect(request.imageRole).toBe("whole");
    expect(() => cvAnalysisResponseSchema.parse({
      contractVersion: CV_CONTRACT_VERSION,
      requestId: identity,
      imageId: identity,
      contentHash: hash,
      analysisVersion: "quality-v1",
      processedAt: "2026-08-28T00:00:00.000Z",
      durationMs: 12,
      confidence: 0.9,
      quality: { accepted: true, findings: [] },
      measurements: {},
    })).not.toThrow();
  });
});

