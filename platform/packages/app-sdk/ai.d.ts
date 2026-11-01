export interface AiEvidence { id: string; content: string; source?: string; observedAt?: string; }
export interface AiAdapter { appId: string; name: string; version: string; instructions: string; help: AiEvidence[]; workflows: string[]; }
export interface AiWatch { workflow: string; instructions: string; enabled: boolean; cooldownSeconds?: number; dailyLimit?: number; }
export interface AiAnswer { summary: string; recommendations: string[]; evidenceIds: string[]; confidence: number; limitations: string[]; needsAttention: boolean; }
export interface AiResult { success: true; runId: number; appId: string; mode: string; answer: AiAnswer; provider: string; model: string; advisory: true; }
export declare class TimSysAiClient {
  constructor(options: { baseUrl: string; appId: string; getToken: () => string | Promise<string>; fetch?: typeof fetch });
  status(): Promise<{ available: boolean; configured: boolean; modes: string[]; workflows: string[]; watchDefault: false }>;
  registerAdapter(definition: AiAdapter): Promise<{ success: true; adapter: AiAdapter }>;
  help(question: string): Promise<AiResult>;
  advise(question: string, evidence: AiEvidence[]): Promise<AiResult>;
  setWatch(settings: AiWatch): Promise<{ success: true; watch: Record<string, unknown> }>;
  watches(): Promise<{ watches: Record<string, unknown>[] }>;
  publishEvidence(workflow: string, eventId: string, evidence: AiEvidence[]): Promise<{ queued: boolean; duplicate?: boolean; jobId?: number }>;
  runs(): Promise<{ runs: Record<string, unknown>[] }>;
  jobs(): Promise<{ jobs: Record<string, unknown>[] }>;
  notifications(): Promise<{ notifications: { id: number; status: string; answer: AiAnswer }[] }>;
  acknowledge(id: number, status?: 'read' | 'dismissed'): Promise<{ success: true }>;
}
