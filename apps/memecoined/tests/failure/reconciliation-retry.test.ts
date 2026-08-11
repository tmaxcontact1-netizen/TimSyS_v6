import { describe, expect, it } from "vitest";

import type { PositionWorkerCheckpointRepository } from "../../src/application/ports/repositories.js";
import type {
  PositionRuntimeActionDispatcher,
  PositionRuntimeStepSource,
  ReconciliationEscalationPort,
  ReconciliationJobFailure,
  ReconciliationJobLease,
  ReconciliationJobStore,
} from "../../src/application/ports/runtime.js";
import { PositionReconciliationUnavailableError } from "../../src/application/services/reconciliation.js";
import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";
import { runReconciliationWorkerCycle } from "../../src/workers/reconciliation-worker.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000951");
const now = asTimestamp("2026-08-04T15:00:00Z");

class Jobs implements ReconciliationJobStore {
  public acquired: ReconciliationJobLease | null = Object.freeze({
    positionId,
    ownerId: "reconciler-1",
    failedAttempts: 0,
  });
  public retried: { availableAt: string; failure: ReconciliationJobFailure } | null = null;
  public failed: ReconciliationJobFailure | null = null;

  public async tryAcquire(): Promise<ReconciliationJobLease | null> {
    return this.acquired;
  }
  public async complete(): Promise<void> {
    throw new Error("not expected");
  }
  public async reschedule(): Promise<void> {
    throw new Error("not expected");
  }
  public async retry(
    _lease: ReconciliationJobLease,
    availableAt: ReturnType<typeof asTimestamp>,
    failure: ReconciliationJobFailure,
  ): Promise<void> {
    this.retried = { availableAt, failure };
  }
  public async fail(
    _lease: ReconciliationJobLease,
    failure: ReconciliationJobFailure,
  ): Promise<void> {
    this.failed = failure;
  }
}

function dependencies(jobs: Jobs, error: Error) {
  const steps = {} as PositionRuntimeStepSource;
  const checkpoints = {
    load: async () => Promise.reject(error),
  } as unknown as PositionWorkerCheckpointRepository;
  const actions = {} as PositionRuntimeActionDispatcher;
  const alerts: Array<{ attempts: number; failure: ReconciliationJobFailure }> = [];
  const escalation: ReconciliationEscalationPort = {
    critical: async ({ attempts, failure }) => void alerts.push({ attempts, failure }),
  };
  return {
    dependencies: {
      checkpoints,
      steps,
      actions,
      jobs,
      escalation,
      ownerId: "reconciler-1",
      now: () => now,
    },
    alerts,
  };
}

describe("reconciliation retry and escalation", () => {
  it("does no work when another worker owns the position", async () => {
    const jobs = new Jobs();
    jobs.acquired = null;
    const ports = dependencies(jobs, new Error("must not run"));
    await expect(runReconciliationWorkerCycle(positionId, ports.dependencies)).resolves.toEqual({
      status: "locked",
    });
  });

  it("schedules retryable provider failure with deterministic exponential backoff", async () => {
    const jobs = new Jobs();
    jobs.acquired = Object.freeze({ positionId, ownerId: "reconciler-1", failedAttempts: 2 });
    const ports = dependencies(
      jobs,
      new PositionReconciliationUnavailableError("transaction", "unavailable", true, "offline"),
    );
    await expect(
      runReconciliationWorkerCycle(positionId, ports.dependencies),
    ).resolves.toMatchObject({
      status: "retry_scheduled",
      attempts: 3,
      availableAt: "2026-08-04T15:00:04.000Z",
    });
    expect(jobs.retried?.failure).toMatchObject({ stage: "transaction", code: "unavailable" });
    expect(ports.alerts).toEqual([]);
  });

  it("caps retry delay without changing the persisted attempt count", async () => {
    const jobs = new Jobs();
    jobs.acquired = Object.freeze({ positionId, ownerId: "reconciler-1", failedAttempts: 4 });
    const ports = dependencies(
      jobs,
      new PositionReconciliationUnavailableError("balance", "rate_limited", true, "slow"),
    );
    await expect(
      runReconciliationWorkerCycle(positionId, {
        ...ports.dependencies,
        maximumAttempts: 10,
        baseRetryDelayMs: 10_000,
        maximumRetryDelayMs: 30_000,
      }),
    ).resolves.toMatchObject({
      status: "retry_scheduled",
      attempts: 5,
      availableAt: "2026-08-04T15:00:30.000Z",
    });
  });

  it("persists terminal failure before escalating a non-retryable fault", async () => {
    const jobs = new Jobs();
    const order: string[] = [];
    jobs.fail = async (_lease, failure) => {
      jobs.failed = failure;
      order.push("persisted");
    };
    const ports = dependencies(
      jobs,
      new PositionReconciliationUnavailableError("transaction", "malformed", false, "bad data"),
    );
    const orderedDependencies = {
      ...ports.dependencies,
      escalation: { critical: async () => void order.push("alerted") },
    };
    await expect(runReconciliationWorkerCycle(positionId, orderedDependencies)).resolves.toEqual({
      status: "escalated",
      attempts: 1,
    });
    expect(order).toEqual(["persisted", "alerted"]);
  });

  it("stops automatic retries at the configured attempt limit", async () => {
    const jobs = new Jobs();
    jobs.acquired = Object.freeze({ positionId, ownerId: "reconciler-1", failedAttempts: 4 });
    const ports = dependencies(
      jobs,
      new PositionReconciliationUnavailableError("balance", "unavailable", true, "offline"),
    );
    await expect(runReconciliationWorkerCycle(positionId, ports.dependencies)).resolves.toEqual({
      status: "escalated",
      attempts: 5,
    });
    expect(jobs.retried).toBeNull();
    expect(jobs.failed?.code).toBe("unavailable");
    expect(ports.alerts).toHaveLength(1);
  });

  it("releases the durable job as failed while preserving unknown worker faults", async () => {
    const jobs = new Jobs();
    const ports = dependencies(jobs, new Error("corrupt checkpoint"));
    await expect(runReconciliationWorkerCycle(positionId, ports.dependencies)).rejects.toThrow(
      "corrupt checkpoint",
    );
    expect(jobs.failed).toMatchObject({ code: "worker_failure", reason: "corrupt checkpoint" });
  });
});
