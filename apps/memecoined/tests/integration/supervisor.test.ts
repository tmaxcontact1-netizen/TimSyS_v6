import { describe, expect, it } from "vitest";

import type {
  DuePositionJob,
  PositionJobSchedulerStore,
} from "../../src/application/ports/runtime.js";
import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";
import { SystemSchedulerClock } from "../../src/infrastructure/runtime/system-clock.js";
import { runPositionJobSupervisor } from "../../src/workers/supervisor.js";

const now = asTimestamp("2026-08-04T17:00:00Z");
const positionId = asUuid<PositionId>("00000000-0000-4000-8000-000000000981");

class Jobs implements PositionJobSchedulerStore {
  public recoveryCalls = 0;
  public dueCalls = 0;
  public async recoverAbandoned(): Promise<readonly PositionId[]> {
    this.recoveryCalls += 1;
    return Object.freeze([positionId]);
  }
  public async findDue(): Promise<readonly DuePositionJob[]> {
    this.dueCalls += 1;
    return this.dueCalls === 1
      ? Object.freeze([Object.freeze({ positionId, availableAt: now, failedAttempts: 0 })])
      : Object.freeze([]);
  }
}

describe("position job supervisor", () => {
  it("recovers once, polls repeatedly, and stops through AbortSignal", async () => {
    const jobs = new Jobs();
    const controller = new AbortController();
    let waits = 0;
    const result = await runPositionJobSupervisor({
      jobs,
      now: () => now,
      signal: controller.signal,
      wait: {
        wait: async () => {
          waits += 1;
          if (waits === 2) controller.abort();
        },
      },
      run: async () => Object.freeze({ status: "locked" as const }),
    });
    expect(result).toEqual({
      recoveredPositionIds: [positionId],
      batchesCompleted: 2,
      jobsVisited: 1,
      acquisitionCyclesCompleted: 0,
    });
    expect(jobs.recoveryCalls).toBe(1);
  });

  it("runs acquisition before each position batch", async () => {
    const jobs = new Jobs();
    const controller = new AbortController();
    const order: string[] = [];
    const result = await runPositionJobSupervisor({
      jobs: {
        recoverAbandoned: () => jobs.recoverAbandoned(),
        findDue: async () => {
          order.push("positions");
          return jobs.findDue();
        },
      },
      now: () => now,
      signal: controller.signal,
      wait: {
        wait: async () => {
          controller.abort();
        },
      },
      beforeBatch: async () => {
        order.push("acquisition");
      },
      run: async () => Object.freeze({ status: "locked" as const }),
    });
    expect(order).toEqual(["acquisition", "positions"]);
    expect(result.acquisitionCyclesCompleted).toBe(1);
  });

  it("does not hide fatal worker failures", async () => {
    const jobs = new Jobs();
    await expect(
      runPositionJobSupervisor({
        jobs,
        now: () => now,
        signal: new AbortController().signal,
        wait: { wait: async () => undefined },
        run: async () => Promise.reject(new Error("fatal invariant")),
      }),
    ).rejects.toThrow("fatal invariant");
    expect(jobs.dueCalls).toBe(1);
  });

  it("system wait releases promptly when shutdown is requested", async () => {
    const controller = new AbortController();
    const waiting = new SystemSchedulerClock().wait(60_000, controller.signal);
    controller.abort();
    await expect(waiting).resolves.toBeUndefined();
  });

  it("rejects an unsafe polling interval before startup recovery", async () => {
    const jobs = new Jobs();
    await expect(
      runPositionJobSupervisor({
        jobs,
        now: () => now,
        signal: new AbortController().signal,
        wait: { wait: async () => undefined },
        run: async () => Object.freeze({ status: "locked" as const }),
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow("poll interval");
    expect(jobs.recoveryCalls).toBe(0);
  });
});
