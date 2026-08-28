import type { JobId, Timestamp } from "../../domain/shared/types.js";

export type JobState = "available" | "leased" | "completed" | "failed";

export interface DurableJob<Payload extends Readonly<Record<string, unknown>>> {
  readonly id: JobId;
  readonly jobType: string;
  readonly idempotencyKey: string;
  readonly payload: Payload;
  readonly state: JobState;
  readonly availableAt: Timestamp;
  readonly attempts: number;
  readonly maximumAttempts: number;
}

export interface JobLease<Payload extends Readonly<Record<string, unknown>>> {
  readonly job: DurableJob<Payload>;
  readonly ownerId: string;
  readonly leasedUntil: Timestamp;
  readonly version: bigint;
}

