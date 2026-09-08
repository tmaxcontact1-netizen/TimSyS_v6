export declare const APPLICATION_PROTOCOL: "timsys.application.v1";
export type HealthState = "healthy" | "degraded" | "blocked" | "unavailable";
export interface ComponentHealth { readonly id: string; readonly status: HealthState; readonly message?: string; }
export interface ApplicationHealth { readonly protocol: typeof APPLICATION_PROTOCOL; readonly application: string; readonly status: HealthState; readonly observedAt: string; readonly components: readonly ComponentHealth[]; readonly [key: string]: unknown; }
export declare class InvalidTransitionError extends Error { readonly from: string; readonly to: string; constructor(from: string, to: string); }
export type TransitionTable<State extends string> = Readonly<Record<State, readonly State[]>>;
export interface StateMachine<State extends string> { canTransition(from: State, to: State): boolean; transition(from: State, to: State): State; allowedFrom(from: State): readonly State[]; }
export declare function createStateMachine<const Table extends Readonly<Record<string, readonly string[]>>>(table: Table): StateMachine<keyof Table & string>;
export interface PlatformRuleResult { readonly ruleId: string; readonly ruleSetVersion: string; readonly outcome: "pass" | "fail" | "unknown" | "not_applicable"; readonly evaluatedAt: string; readonly explanation: string; readonly evidenceIds: readonly string[]; readonly measurements?: readonly Readonly<Record<string, unknown>>[]; readonly [key: string]: unknown; }
export declare function createRuleResult<T extends PlatformRuleResult>(input: T): Readonly<T>;
export declare function createApplicationHealth<T extends Omit<ApplicationHealth, "protocol">>(input: T): Readonly<T & { protocol: typeof APPLICATION_PROTOCOL }>;
export declare function contentHash(value: string | Uint8Array): string;
export interface RetryPolicy { readonly baseDelayMs: number; readonly maximumDelayMs: number; }
export declare function retryDelay(attempt: number, policy: RetryPolicy): number;
export declare function redact(value: unknown): unknown;
export interface JsonTransportResponse { readonly status: number; readonly body: unknown; readonly receivedAt: string; }
export interface JsonHttpTransportOptions { readonly allowedOrigins: ReadonlySet<string>; readonly timeoutMs?: number; readonly maximumResponseBytes?: number; readonly fetch?: typeof fetch; }
export declare class BoundedJsonHttpTransport { constructor(options: JsonHttpTransportOptions); request(method: "GET" | "POST", url: string, body: unknown | null, headers?: Readonly<Record<string, string>>): Promise<JsonTransportResponse>; get(url: string, headers?: Readonly<Record<string, string>>): Promise<JsonTransportResponse>; post(url: string, body: unknown, headers?: Readonly<Record<string, string>>): Promise<JsonTransportResponse>; }
