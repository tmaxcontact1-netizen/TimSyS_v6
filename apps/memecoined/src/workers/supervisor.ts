import type { PositionJobSchedulerStore } from "../application/ports/runtime.js";
import { InvariantViolationError } from "../domain/shared/errors.js";
import type { PositionId, Timestamp } from "../domain/shared/types.js";
import type { ReconciliationWorkerCycleResult } from "./reconciliation-worker.js";

export interface PositionJobRunnerDependencies {
  readonly jobs: PositionJobSchedulerStore;
  readonly now: () => Timestamp;
  readonly run: (positionId: PositionId) => Promise<ReconciliationWorkerCycleResult>;
  readonly batchSize?: number;
}

export interface SupervisorWaitPort {
  wait(delayMs: number, signal: AbortSignal): Promise<void>;
}

export interface PositionJobSupervisorDependencies extends PositionJobRunnerDependencies {
  readonly wait: SupervisorWaitPort;
  readonly signal: AbortSignal;
  readonly pollIntervalMs?: number;
  readonly beforeBatch?: () => Promise<void>;
}

export interface StartupRecoveryResult {
  readonly recoveredPositionIds: readonly PositionId[];
}

export interface PositionJobBatchResult {
  readonly duePositionIds: readonly PositionId[];
  readonly results: readonly Readonly<{
    positionId: PositionId;
    result: ReconciliationWorkerCycleResult;
  }>[];
}

export interface PositionJobSupervisorResult {
  readonly recoveredPositionIds: readonly PositionId[];
  readonly batchesCompleted: number;
  readonly jobsVisited: number;
  readonly acquisitionCyclesCompleted: number;
}

function batchSize(value: number | undefined): number {
  const size = value ?? 100;
  if (!Number.isSafeInteger(size) || size <= 0 || size > 1_000)
    throw new RangeError("Worker batch size must be between 1 and 1000");
  return size;
}

/** Reclaims only database-expired leases before any worker begins polling. */
export async function recoverPositionJobsAtStartup(
  dependencies: Pick<PositionJobRunnerDependencies, "jobs" | "now" | "batchSize">,
): Promise<StartupRecoveryResult> {
  const recoveredPositionIds = await dependencies.jobs.recoverAbandoned({
    now: dependencies.now(),
    limit: batchSize(dependencies.batchSize),
  });
  if (new Set(recoveredPositionIds).size !== recoveredPositionIds.length)
    throw new InvariantViolationError("Startup recovery returned duplicate position jobs");
  return Object.freeze({ recoveredPositionIds: Object.freeze([...recoveredPositionIds]) });
}

/** Runs one deterministic due-job batch; the job store remains the ownership authority. */
export async function runDuePositionJobBatch(
  dependencies: PositionJobRunnerDependencies,
): Promise<PositionJobBatchResult> {
  const due = await dependencies.jobs.findDue({
    now: dependencies.now(),
    limit: batchSize(dependencies.batchSize),
  });
  const duePositionIds = due.map(({ positionId }) => positionId);
  if (new Set(duePositionIds).size !== duePositionIds.length)
    throw new InvariantViolationError("Due-job query returned duplicate positions");
  const results: Array<{
    positionId: PositionId;
    result: ReconciliationWorkerCycleResult;
  }> = [];
  for (const positionId of duePositionIds)
    results.push({ positionId, result: await dependencies.run(positionId) });
  return Object.freeze({
    duePositionIds: Object.freeze(duePositionIds),
    results: Object.freeze(results.map((item) => Object.freeze(item))),
  });
}

/** Recovers once, polls serially, and propagates every unexpected worker failure. */
export async function runPositionJobSupervisor(
  dependencies: PositionJobSupervisorDependencies,
): Promise<PositionJobSupervisorResult> {
  const pollIntervalMs = dependencies.pollIntervalMs ?? 1_000;
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs <= 0)
    throw new RangeError("Supervisor poll interval must be positive");
  const recovery = await recoverPositionJobsAtStartup(dependencies);
  let batchesCompleted = 0;
  let jobsVisited = 0;
  let acquisitionCyclesCompleted = 0;
  while (!dependencies.signal.aborted) {
    if (dependencies.beforeBatch !== undefined) {
      await dependencies.beforeBatch();
      acquisitionCyclesCompleted += 1;
    }
    const batch = await runDuePositionJobBatch(dependencies);
    batchesCompleted += 1;
    jobsVisited += batch.results.length;
    if (!dependencies.signal.aborted)
      await dependencies.wait.wait(pollIntervalMs, dependencies.signal);
  }
  return Object.freeze({
    recoveredPositionIds: recovery.recoveredPositionIds,
    batchesCompleted,
    jobsVisited,
    acquisitionCyclesCompleted,
  });
}
