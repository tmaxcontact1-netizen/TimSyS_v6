import { z } from "zod";
export const studyInput = z
  .object({
    title: z.string().trim().min(1).max(240),
    researchQuestion: z.string().trim().min(1).max(4000),
    description: z.string().trim().max(10000).nullable().optional(),
    methodology: z.string().trim().max(10000).nullable().optional(),
    inclusionRules: z.array(z.string().trim().min(1)).default([]),
    exclusionRules: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();
export const entityTypeInput = z
  .object({
    studyId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    fieldSchema: z.record(z.string(), z.unknown()).default({}),
    parentTypeId: z.string().uuid().nullable().optional(),
  })
  .strict();
export const entityInput = z
  .object({
    studyId: z.string().uuid(),
    entityTypeId: z.string().uuid(),
    parentId: z.string().uuid().nullable().optional(),
    label: z.string().trim().min(1).max(300),
    attributes: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
export const sourceInput = z
  .object({
    studyId: z.string().uuid(),
    entityId: z.string().uuid().nullable().optional(),
    label: z.string().trim().min(1).max(500),
    originalUrl: z
      .url()
      .refine(
        (v) => ["http:", "https:"].includes(new URL(v).protocol),
        "Only HTTP(S) sources are supported",
      ),
    sourceType: z.enum(["webpage", "pdf", "document", "other"]),
    authority: z.enum(["primary", "secondary", "unknown"]).default("unknown"),
    corpusStatus: z
      .enum(["pending", "included", "excluded"])
      .default("pending"),
    completeness: z.string().trim().min(1).max(120).default("unassessed"),
    exclusionReason: z.string().trim().max(2000).nullable().optional(),
    notes: z.string().trim().max(10000).nullable().optional(),
  })
  .strict()
  .refine((v) => v.corpusStatus !== "excluded" || Boolean(v.exclusionReason), {
    message: "Excluded sources require a reason",
    path: ["exclusionReason"],
  });
export const batchSourceInput = z.object({
  studyId:z.string().uuid(),
  urls:z.array(z.url().refine((value)=>["http:","https:"].includes(new URL(value).protocol),"Only HTTP(S) sources are supported")).min(1).max(500),
  authority:z.enum(["primary","secondary","unknown"]).default("unknown"),
  corpusStatus:z.enum(["pending","included"]).default("pending"),
  actor:z.string().trim().min(1).max(200).default("local-researcher"),
}).strict();
export const renderedFetchInput = z.object({
  expandInteractiveContent:z.boolean().default(true),
  maximumInteractions:z.number().int().min(0).max(100).default(40),
}).strict();
export const sourceDecision = z
  .object({
    corpusStatus: z.enum(["pending", "included", "excluded"]),
    reason: z.string().trim().max(2000).nullable().optional(),
    actor: z.string().trim().min(1).max(200).default("local-researcher"),
  })
  .strict()
  .refine((v) => v.corpusStatus !== "excluded" || Boolean(v.reason), {
    message: "Exclusion requires a reason",
    path: ["reason"],
  });
export const researchCodeInput = z
  .object({
    studyId: z.string().uuid(),
    label: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    colour: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .default("#59b8a8"),
  })
  .strict();
export const evidenceInput = z
  .object({
    studyId: z.string().uuid(),
    segmentId: z.string().uuid(),
    evidenceType: z.enum([
      "claim",
      "fact",
      "observation",
      "definition",
      "requirement",
      "method",
      "counterevidence",
      "other",
    ]),
    interpretation: z.string().trim().min(1).max(10000),
    confidence: z
      .enum(["low", "medium", "high", "unassessed"])
      .default("unassessed"),
    notes: z.string().trim().max(10000).nullable().optional(),
    codeIds: z.array(z.string().uuid()).max(50).default([]),
    actor: z.string().trim().min(1).max(200).default("local-researcher"),
  })
  .strict();
export const findingInput = z
  .object({
    studyId: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
    conclusion: z.string().trim().min(1).max(20000),
    confidence: z
      .enum(["low", "medium", "high", "unassessed"])
      .default("unassessed"),
    limitations: z.string().trim().max(10000).nullable().optional(),
    evidenceIds: z.array(z.string().uuid()).min(1).max(500),
    actor: z.string().trim().min(1).max(200).default("local-researcher"),
  })
  .strict();
export const reportInput = z
  .object({
    studyId: z.string().uuid(),
    title: z.string().trim().min(1).max(300),
    findingIds: z.array(z.string().uuid()).max(500).default([]),
    includeMethodology: z.boolean().default(true),
    includeCorpus: z.boolean().default(true),
    includeEvidenceTable: z.boolean().default(true),
    actor: z.string().trim().min(1).max(200).default("local-researcher"),
  })
  .strict();
const transitionBase = {
  reason: z.string().trim().max(4000).nullable().optional(),
  actor: z.string().trim().min(1).max(200).default("local-researcher"),
};
export const studyTransitionInput = z
  .object({
    targetStatus: z.enum(["draft", "active", "locked", "archived"]),
    ...transitionBase,
  })
  .strict();
export const evidenceTransitionInput = z
  .object({
    targetStatus: z.enum(["active", "superseded", "withdrawn"]),
    ...transitionBase,
  })
  .strict()
  .refine((value) => value.targetStatus === "active" || Boolean(value.reason), {
    message: "Withdrawal and supersession require a reason",
    path: ["reason"],
  });
export const findingTransitionInput = z
  .object({
    targetStatus: z.enum(["draft", "confirmed", "withdrawn"]),
    ...transitionBase,
  })
  .strict()
  .refine(
    (value) => value.targetStatus !== "withdrawn" || Boolean(value.reason),
    {
      message: "Withdrawal requires a reason",
      path: ["reason"],
    },
  );
export const discoveryInput = z
  .object({
    sameOrigin: z.boolean().default(true),
    maximumLinks: z.number().int().min(1).max(200).default(100),
  })
  .strict();
export const discoveryDecisionInput = z
  .object({
    action: z.enum(["add", "dismiss"]),
    label: z.string().trim().max(500).nullable().optional(),
    reason: z.string().trim().max(2000).nullable().optional(),
    actor: z.string().trim().min(1).max(200).default("local-researcher"),
  })
  .strict()
  .refine((value) => value.action !== "dismiss" || Boolean(value.reason), {
    message: "Dismissal requires a reason",
    path: ["reason"],
  });
export const queueInput = z
  .object({
    studyId: z.string().uuid(),
    sourceIds: z.array(z.string().uuid()).min(1).max(200),
    maximumAttempts: z.number().int().min(1).max(10).default(3),
  })
  .strict();
export const queueRunInput = z
  .object({
    studyId: z.string().uuid(),
    maximumItems: z.number().int().min(1).max(20).default(5),
  })
  .strict();
