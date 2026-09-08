import { z } from "zod";

export const analysisMethod = z.enum(["rules", "ai", "hybrid"]);
export const analysisTypeId = z.enum([
  "syntax",
  "readability",
  "terminology",
  "entities",
  "semantics",
  "sentiment",
  "themes",
  "claims",
  "comparison",
  "contradictions",
  "bias-framing",
  "completeness",
  "custom-extraction",
  "custom-questions",
]);

export const ANALYSIS_CATALOG = [
  { id: "syntax", name: "Writing structure", description: "Sentence, paragraph and structural measurements.", method: "rules" },
  { id: "readability", name: "Readability", description: "Reading difficulty, sentence length and word complexity.", method: "rules" },
  { id: "terminology", name: "Topics and terminology", description: "Repeated words, phrases and specialist vocabulary.", method: "hybrid" },
  { id: "entities", name: "People, organisations, places and dates", description: "Named subjects and important factual references.", method: "hybrid" },
  { id: "semantics", name: "Meaning and intent", description: "What the material says and appears intended to communicate.", method: "ai" },
  { id: "sentiment", name: "Sentiment and emotional tone", description: "Positive, negative and neutral language with supporting passages.", method: "hybrid" },
  { id: "themes", name: "Themes", description: "Recurring ideas across one or more sources.", method: "ai" },
  { id: "claims", name: "Claims and supporting evidence", description: "Claims, qualifications and the evidence offered for them.", method: "hybrid" },
  { id: "comparison", name: "Similarities and differences", description: "A source-by-source comparison grounded in cited passages.", method: "hybrid" },
  { id: "contradictions", name: "Contradictions", description: "Potentially incompatible statements for human review.", method: "hybrid" },
  { id: "bias-framing", name: "Bias and framing", description: "Persuasive choices, omissions and framing signals, presented as reviewable interpretations.", method: "hybrid" },
  { id: "completeness", name: "Missing information", description: "Checks expected fields and identifies information not found.", method: "hybrid" },
  { id: "custom-extraction", name: "Custom fields", description: "Extracts a user-defined structured schema.", method: "hybrid" },
  { id: "custom-questions", name: "Custom questions", description: "Answers research questions only from preserved evidence.", method: "ai" },
].map(item=>({...item,scope:["themes","comparison","contradictions"].includes(item.id)?"corpus":"source",contractVersion:"researched.analysis-result.v1"})) as readonly ({id:AnalysisTypeId;name:string;description:string;method:"rules"|"ai"|"hybrid";scope:"source"|"corpus";contractVersion:string})[];

export const analysisPlanInput = z.object({
  studyId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  analysisTypes: z.array(analysisTypeId).min(1),
  sourceIds: z.array(z.string().uuid()).default([]),
  customQuestions: z.array(z.string().trim().min(1).max(2000)).default([]),
  expectedFields: z.array(z.string().trim().min(1).max(200)).default([]),
  options: z.record(z.string(), z.unknown()).default({}),
  actor: z.string().trim().min(1).max(200).default("local-researcher"),
}).strict().superRefine((value,context)=>{
  if(value.analysisTypes.includes("custom-extraction")&&!value.expectedFields.length)context.addIssue({code:"custom",path:["expectedFields"],message:"Custom field analysis requires at least one expected field"});
  if(value.analysisTypes.includes("custom-questions")&&!value.customQuestions.length)context.addIssue({code:"custom",path:["customQuestions"],message:"Custom question analysis requires at least one question"});
});

export const analysisRunInput = z.object({
  actor: z.string().trim().min(1).max(200).default("local-researcher"),
  maximumAttempts: z.number().int().min(1).max(10).default(3),
}).strict();

export const analysisTemplateInput=z.object({
  name:z.string().trim().min(1).max(200),
  description:z.string().trim().max(2000).nullable().optional(),
  analysisTypes:z.array(analysisTypeId).min(1),
  customQuestions:z.array(z.string().trim().min(1).max(2000)).default([]),
  expectedFields:z.array(z.string().trim().min(1).max(200)).default([]),
  options:z.record(z.string(),z.unknown()).default({}),
  actor:z.string().trim().min(1).max(200).default("local-researcher"),
}).strict().superRefine((value,context)=>{
  if(value.analysisTypes.includes("custom-extraction")&&!value.expectedFields.length)context.addIssue({code:"custom",path:["expectedFields"],message:"Custom field analysis requires at least one expected field"});
  if(value.analysisTypes.includes("custom-questions")&&!value.customQuestions.length)context.addIssue({code:"custom",path:["customQuestions"],message:"Custom question analysis requires at least one question"});
});

export const analysisRunControlInput = z.object({
  actor: z.string().trim().min(1).max(200).default("local-researcher"),
}).strict();

export const analysisFindingStatus = z.enum(["generated", "accepted", "amended", "rejected"]);

export const analysisFindingDecisionInput = z.object({
  status: z.enum(["accepted", "amended", "rejected"]),
  amendedValue: z.unknown().optional(),
  reason: z.string().trim().min(1).max(2000),
  actor: z.string().trim().min(1).max(200).default("local-researcher"),
}).strict();
export const aiConnectionInput=z.object({
  protocol:z.enum(["openai-responses","openai-chat","anthropic-messages","generic-json"]),
  model:z.string().trim().min(1).max(200),
  baseUrl:z.url(),
  apiKey:z.string().max(10000).optional(),
}).strict();
export const aiDiscoveryInput=aiConnectionInput;

export type AnalysisTypeId = z.infer<typeof analysisTypeId>;
