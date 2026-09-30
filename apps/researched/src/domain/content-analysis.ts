import { z } from "zod";

export const CONTENT_VERSION = "researched.content-analysis.v1";
export const FIELD_CATALOG = [
  { id: "curriculum", label: "Curriculum and modules", pattern: /curricul|modules?|course (?:structure|content|list|description|requirements)|core courses|electives?|programme structure|program structure/i },
  { id: "outcomes", label: "Learning outcomes and skills", pattern: /learning outcomes?|learning objectives?|competenc|skills|graduates will|students will (?:learn|develop|demonstrate)/i },
  { id: "assessment", label: "Assessment and research", pattern: /assessment|assessed|examination|dissertation|capstone|thesis|research project/i },
  { id: "practice", label: "Professional practice and development", pattern: /practicum|placement|internship|professional development|professional practice|fieldwork|career outcomes?|licen[cs]ure|certification/i },
  { id: "delivery", label: "Delivery and attendance", pattern: /delivery|study mode|attendance|residen(?:cy|tial)|on[- ]campus|in[- ]person|hybrid|distance learning/i },
  { id: "duration", label: "Duration and study load", pattern: /duration|programme length|program length|time to complete|credit requirements?|credit hours|units required/i },
  { id: "admissions", label: "Entry requirements", pattern: /admission|entry requirements?|eligibility|prerequisites?|applicants/i },
] as const;
export type ContentField = typeof FIELD_CATALOG[number]["id"];
export const DEFAULT_FIELDS: ContentField[] = ["curriculum", "outcomes", "assessment", "practice", "delivery", "duration", "admissions"];
const field = z.enum(["curriculum", "outcomes", "assessment", "practice", "delivery", "duration", "admissions"]);
export const contentPlanInput = z.object({
  goal: z.string().trim().min(1).max(3000).default("Explain the curriculum, modules and professional development offered, with evidence."),
  fields: z.array(field).min(1).transform(values => [...new Set(values)]).default(DEFAULT_FIELDS),
  maxDepth: z.number().int().min(0).max(2).default(2),
  maxPages: z.number().int().min(1).max(15).default(8),
  allowedHosts: z.array(z.string().trim().toLowerCase().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/)).max(30).default([]),
  aiEnabled: z.boolean().default(false),
}).strict();
export type ContentPlan = z.infer<typeof contentPlanInput>;
export const workflowInput = z.object({title: z.string().trim().min(1).max(200), plan: contentPlanInput.default(() => contentPlanInput.parse({}))}).strict();
export type LinkOccurrence = {label: string; context: string; locator: string; originalUrl: string};
export type IntakeLink = {url: string; occurrences: LinkOccurrence[]};
export type EvidenceBlock = {id: string; text: string; heading: string; locator: string; pageId: string};
export type CapturedPage = {id: string; url: string; requestedUrl: string; title: string; mediaType: string; hash: string; capturedAt: string; depth: number; parentUrl: string | null; reason: string; blocks: EvidenceBlock[]; warnings: string[]; snapshotId?: string};
export type LinkObservation = {url: string; status: string; detail: string; parentUrl: string | null; httpStatus?: number};
export type ContentResult = {
  version: string; title: string; kind: "programme" | "training" | "accreditation" | "directory" | "unresolved";
  fields: Record<string, EvidenceBlock[]>; pages: CapturedPage[]; observations: LinkObservation[];
  warnings: string[]; suggestions: {url: string; label: string; reason: string}[];
  coverage: {found: number; requested: number; missing: string[]};
  ai: {status: string; notes: {text: string; evidenceIds: string[]}[]; detail: string};
};

export function canonicalContentUrl(value: string, base?: string) {
  const url = new URL(value.trim().replace(/[),.;\\]+$/u, ""), base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("unsupported_link");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:srsltid|fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function failureObservation(error: unknown, url: string, parentUrl: string | null): LinkObservation {
  const detail = error instanceof Error ? error.message : String(error);
  const httpStatus = Number((error as {status?: number})?.status) || undefined;
  const status = httpStatus === 404 || httpStatus === 410 ? "missing" : httpStatus === 401 || httpStatus === 403 || /captcha|access.denied|login_required/i.test(detail) ? "blocked" : httpStatus === 429 ? "rate_limited" : /timeout|abort|ECONN|ENOTFOUND|EAI_AGAIN|fetch failed|5\d\d/i.test(detail) || (httpStatus !== undefined && httpStatus >= 500) ? "temporary_failure" : /unsupported|not_public|not_allowed/i.test(detail) ? "unsupported" : "capture_failed";
  return {url, parentUrl, status, detail, ...(httpStatus !== undefined ? {httpStatus} : {})};
}
