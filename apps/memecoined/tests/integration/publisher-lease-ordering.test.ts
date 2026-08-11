import { describe, expect, it, vi } from "vitest";

import { runReconciliationWorkerCycle } from "../../src/workers/reconciliation-worker.js";
import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";

const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000002201");
const now = asTimestamp("2026-08-04T12:00:00.000Z");

describe("publisher lease ordering", () => {
  it("publishes only after lease acquisition and fails the leased job if publication fails", async () => {
    const order: string[] = [];
    const fail = vi.fn(async () => void order.push("fail"));
    const error = new Error("facts unavailable");
    await expect(
      runReconciliationWorkerCycle(positionId, {
        jobs: {
          tryAcquire: async () => {
            order.push("lease");
            return { positionId, ownerId: "worker", failedAttempts: 0 };
          },
          fail,
        } as never,
        beforeCycle: async () => {
          order.push("publish");
          throw error;
        },
        checkpoints: {} as never,
        steps: {} as never,
        actions: {} as never,
        escalation: {} as never,
        ownerId: "worker",
        now: () => now,
      }),
    ).rejects.toBe(error);
    expect(order).toEqual(["lease", "publish", "fail"]);
    expect(fail).toHaveBeenCalledOnce();
  });

  it("does not publish when the durable lease cannot be acquired", async () => {
    const beforeCycle = vi.fn();
    await expect(
      runReconciliationWorkerCycle(positionId, {
        jobs: { tryAcquire: async () => null } as never,
        beforeCycle,
        checkpoints: {} as never,
        steps: {} as never,
        actions: {} as never,
        escalation: {} as never,
        ownerId: "worker",
        now: () => now,
      }),
    ).resolves.toEqual({ status: "locked" });
    expect(beforeCycle).not.toHaveBeenCalled();
  });
});
