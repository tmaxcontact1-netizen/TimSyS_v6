import type { DurableJob, JobLease } from "../contracts/jobs.js";
import type { Timestamp } from "../../domain/shared/types.js";

export interface DurableJobStore<Payload extends Readonly<Record<string, unknown>>> {
  enqueue(job: DurableJob<Payload>): Promise<"created" | "existing">;
  lease(jobType: string, ownerId: string, at: Timestamp, limit: number): Promise<readonly JobLease<Payload>[]>;
  complete(lease: JobLease<Payload>, at: Timestamp): Promise<void>;
  retry(lease: JobLease<Payload>, availableAt: Timestamp, reason: string): Promise<void>;
  fail(lease: JobLease<Payload>, at: Timestamp, reason: string): Promise<void>;
  recoverExpired(at: Timestamp, limit: number): Promise<number>;
}

