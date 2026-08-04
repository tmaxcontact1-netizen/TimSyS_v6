import type { PositionId } from "../domain/shared/types.js";
import { asTimestamp, type Timestamp } from "../domain/shared/types.js";
import { PositionReconciliationUnavailableError } from "../application/services/reconciliation.js";
import type {
  ReconciliationEscalationPort,
  ReconciliationJobFailure,
  ReconciliationJobStore,
} from "../application/ports/runtime.js";
import type { PositionWorkerDependencies, PositionWorkerCycleResult } from "./position-worker.js";
import { runPositionWorkerCycle } from "./position-worker.js";

export interface ReconciliationWorkerDependencies extends PositionWorkerDependencies {
  readonly jobs: ReconciliationJobStore;
  readonly escalation: ReconciliationEscalationPort;
  readonly ownerId: string;
  readonly now: () => Timestamp;
  readonly maximumAttempts?: number;
  readonly baseRetryDelayMs?: number;
  readonly maximumRetryDelayMs?: number;
}

export type ReconciliationWorkerCycleResult =
  | Readonly<{ status: "locked" }>
  | Readonly<{ status: "completed"; cycle: PositionWorkerCycleResult }>
  | Readonly<{ status: "retry_scheduled"; attempts: number; availableAt: Timestamp }>
  | Readonly<{ status: "escalated"; attempts: number }>;

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${label} must be positive`);
  return value;
}

function retryAt(now: Timestamp, attempt: number, baseMs: number, maximumMs: number): Timestamp {
  const delay = Math.min(maximumMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return asTimestamp(new Date(new Date(now).getTime() + delay));
}

function unresolvedFailure(
  now: Timestamp,
  reason: "pending" | "on_chain_failure" | "balance_mismatch",
): ReconciliationJobFailure {
  return Object.freeze({
    stage: "confirmation",
    code: reason,
    reason:
      reason === "on_chain_failure"
        ? "Submitted transaction finalized with an on-chain error"
        : reason === "balance_mismatch"
          ? "Confirmed transaction does not yet match authoritative balances"
          : "Submitted transaction is not yet authoritatively reconciled",
    occurredAt: now,
  });
}

/** Owns one position for the full durable reconciliation cycle. */
export async function runReconciliationWorkerCycle(
  positionId: PositionId,
  dependencies: ReconciliationWorkerDependencies,
): Promise<ReconciliationWorkerCycleResult> {
  if (dependencies.ownerId.trim().length === 0) throw new RangeError("Worker owner ID is required");
  const maximumAttempts = requirePositiveInteger(
    dependencies.maximumAttempts ?? 5,
    "Maximum attempts",
  );
  const baseDelay = requirePositiveInteger(
    dependencies.baseRetryDelayMs ?? 1_000,
    "Base retry delay",
  );
  const maximumDelay = requirePositiveInteger(
    dependencies.maximumRetryDelayMs ?? 30_000,
    "Maximum retry delay",
  );
  const startedAt = dependencies.now();
  const lease = await dependencies.jobs.tryAcquire({
    positionId,
    ownerId: dependencies.ownerId,
    now: startedAt,
  });
  if (lease === null) return Object.freeze({ status: "locked" });

  const schedule = async (
    failure: ReconciliationJobFailure,
    retryable: boolean,
  ): Promise<ReconciliationWorkerCycleResult> => {
    const attempts = lease.failedAttempts + 1;
    if (!retryable || attempts >= maximumAttempts) {
      await dependencies.jobs.fail(lease, failure);
      await dependencies.escalation.critical({ positionId, attempts, failure });
      return Object.freeze({ status: "escalated", attempts });
    }
    const availableAt = retryAt(failure.occurredAt, attempts, baseDelay, maximumDelay);
    await dependencies.jobs.retry(lease, availableAt, failure);
    return Object.freeze({ status: "retry_scheduled", attempts, availableAt });
  };

  try {
    const cycle = await runPositionWorkerCycle(positionId, dependencies);
    if (cycle.action.type === "await_reconciliation")
      return schedule(
        unresolvedFailure(dependencies.now(), cycle.action.reason),
        cycle.action.reason !== "on_chain_failure",
      );
    await dependencies.jobs.complete(lease);
    return Object.freeze({ status: "completed", cycle });
  } catch (error) {
    if (error instanceof PositionReconciliationUnavailableError) {
      return schedule(
        Object.freeze({
          stage: error.stage,
          code: error.code,
          reason: error.message,
          occurredAt: dependencies.now(),
        }),
        error.retryable,
      );
    }
    try {
      await dependencies.jobs.fail(
        lease,
        Object.freeze({
          stage: "confirmation",
          code: "worker_failure",
          reason: error instanceof Error ? error.message : "Unknown reconciliation failure",
          occurredAt: dependencies.now(),
        }),
      );
    } catch {
      // Preserve the original failure while the session lock is released by the store.
    }
    throw error;
  }
}
