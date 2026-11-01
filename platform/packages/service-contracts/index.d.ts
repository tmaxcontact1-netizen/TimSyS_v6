export const PROTOCOL: "timsys.services.v1";
export const APPS: readonly ["principaled", "dressed", "researched", "tradeed"];
export type AppId = (typeof APPS)[number];
export const VERSION: RegExp;
export const IDENTIFIER: RegExp;
export function assertSchema(
  schema: unknown,
  depth?: number,
): Record<string, unknown>;
export function validate(
  schema: Record<string, unknown>,
  value: unknown,
  location?: string,
  depth?: number,
): string[];
export interface Envelope<T> {
  success: true;
  data: T;
  meta: {
    protocol: typeof PROTOCOL;
    requestId: string;
    appId: AppId;
    serviceId?: string;
    contractVersion?: string;
    contractHash?: string;
  };
}
export class ServiceError extends Error {
  constructor(code: string, message: string, status?: number);
  code: string;
  status: number;
}
export interface ServiceContract {
  serviceId: string;
  version: string;
  owner: "timsys";
  apps: AppId[];
  operations: Record<
    string,
    {
      permission: string;
      effect: "read" | "command";
      idempotency?: "required";
      timeoutMs: number;
      maximumInputBytes: number;
      maximumOutputBytes: number;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
    }
  >;
}
export interface AdvertisedContract extends ServiceContract {
  contractHash: string;
}
export class TimSysServiceClient {
  constructor(options: {
    baseUrl: string;
    appId: AppId;
    getToken: () => string | Promise<string>;
    fetch?: typeof fetch;
    timeoutMs?: number;
    maximumResponseBytes?: number;
  });
  list(options?: {
    signal?: AbortSignal;
  }): Promise<Envelope<{ services: AdvertisedContract[] }>>;
  contract(
    serviceId: string,
    version: string,
    options?: { signal?: AbortSignal },
  ): Promise<Envelope<AdvertisedContract>>;
  invoke<T = unknown>(
    serviceId: string,
    version: string,
    operation: string,
    input?: unknown,
    options?: { signal?: AbortSignal; idempotencyKey?: string },
  ): Promise<Envelope<T>>;
}
