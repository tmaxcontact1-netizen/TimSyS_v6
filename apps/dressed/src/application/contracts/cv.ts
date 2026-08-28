import { z } from "zod";

export const CV_CONTRACT_VERSION = "1.0.0";

export const cvAnalysisRequestSchema = z.object({
  contractVersion: z.literal(CV_CONTRACT_VERSION),
  requestId: z.string().uuid(),
  imageId: z.string().uuid(),
  imageRole: z.enum(["whole", "detail", "calibration", "additional"]),
  relativePath: z.string().min(1).max(1024),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  analysisVersion: z.string().min(1).max(80),
  operations: z.array(z.enum(["quality", "calibration", "fingerprint"])).min(1),
});

export const cvAnalysisResponseSchema = z.object({
  contractVersion: z.literal(CV_CONTRACT_VERSION),
  requestId: z.string().uuid(),
  imageId: z.string().uuid(),
  contentHash: z.string().regex(/^[0-9a-f]{64}$/),
  analysisVersion: z.string().min(1).max(80),
  processedAt: z.string().datetime({ offset: false }),
  durationMs: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  quality: z.object({
    accepted: z.boolean(),
    findings: z.array(z.object({ code: z.string().min(1), severity: z.enum(["info", "warning", "error"]) })),
  }),
  measurements: z.record(z.string(), z.unknown()),
});

export type CvAnalysisRequest = z.infer<typeof cvAnalysisRequestSchema>;
export type CvAnalysisResponse = z.infer<typeof cvAnalysisResponseSchema>;

