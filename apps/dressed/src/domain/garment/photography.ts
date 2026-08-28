import { z } from "zod";

export const calibrationProfileInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  cardType: z.string().trim().min(1).max(120),
  notes: z.string().trim().min(1).max(2_000).optional().nullable(),
  patches: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    labL: z.number().min(0).max(100),
    labA: z.number().min(-160).max(160),
    labB: z.number().min(-160).max(160),
  }).strict()).min(3).max(100),
}).strict().superRefine((value, context) => {
  const labels = value.patches.map((patch) => patch.label.toLocaleLowerCase());
  if (new Set(labels).size !== labels.length) context.addIssue({ code: "custom", path: ["patches"], message: "Patch labels must be unique" });
});

export type CalibrationProfileInput = z.infer<typeof calibrationProfileInputSchema>;
export type ImageRole = "whole" | "detail" | "additional";

export type ImageFinding = Readonly<{ code: string; severity: "info" | "warning" | "error"; message: string }>;
export type ValidatedImage = Readonly<{
  mediaType: "image/jpeg" | "image/png";
  extension: ".jpg" | ".png";
  width: number;
  height: number;
  byteSize: number;
  contentHash: string;
  findings: readonly ImageFinding[];
  status: "accepted_for_analysis" | "recapture_required";
}>;
