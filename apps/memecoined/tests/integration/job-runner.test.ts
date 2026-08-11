import { describe, expect, it } from "vitest";

import type {
  DuePositionJob,
  PositionJobSchedulerStore,
} from "../../src/application/ports/runtime.js";
import { asTimestamp, asUuid, type PositionId } from "../../src/domain/shared/types.js";
import {
  recoverPositionJobsAtStartup,
  runDuePositionJobBatch,
} from "../../src/workers/supervisor.js";

const now = asTimestamp("2026-08-04T16:00:00Z");
const first = asUuid<PositionId>("00000000-0000-4000-8000-000000000971");
const second = asUuid<PositionId>("00000000-0000-4000-8000-000000000972");

class Jobs implements PositionJobSchedulerStore {
  public recovered: readonly PositionId[] = Object.freeze([]);
  public due: readonly DuePositionJob[] = Object.freeze([]);
  public recoverInput: { now: string; limit: number } | null = null;
  public dueInput: { now: string; limit: number } | null = null;

  public async recoverAbandoned(input: { now: string; limit: number }) {
    this.recoverInput = input;
    return this.recovered;
  }

  public async findDue(input: { now: string; limit: number }) {
    this.dueInput = input;
    return this.due;
  }
}

function due(positionId: PositionId): DuePositionJob {
  return Object.freeze({ positionId, availableAt: now, failedAttempts: 0 });
}

describe("durable position job runner", () => {
  it("reclaims abandoned leases before polling begins", async () => {
    const jobs = new Jobs();
    jobs.recovered = Object.freeze([first, second]);
    await expect(
      recoverPositionJobsAtStartup({ jobs, now: () => now, batchSize: 25 }),
    ).resolves.toEqual({ recoveredPositionIds: [first, second] });
    expect(jobs.recoverInput).toEqual({ now, limit: 25 });
  });

  it("runs due jobs in stable store order and retains every outcome", async () => {
    const jobs = new Jobs();
    jobs.due = Object.freeze([due(first), due(second)]);
    const visited: PositionId[] = [];
    const result = await runDuePositionJobBatch({
      jobs,
      now: () => now,
      run: async (positionId) => {
        visited.push(positionId);
        return Object.freeze({ status: "locked" as const });
      },
    });
    expect(visited).toEqual([first, second]);
    expect(result.duePositionIds).toEqual([first, second]);
    expect(result.results).toEqual([
      { positionId: first, result: { status: "locked" } },
      { positionId: second, result: { status: "locked" } },
    ]);
  });

  it("rejects duplicate scheduler output before executing work", async () => {
    const jobs = new Jobs();
    jobs.due = Object.freeze([due(first), due(first)]);
    let executions = 0;
    await expect(
      runDuePositionJobBatch({
        jobs,
        now: () => now,
        run: async () => {
          executions += 1;
          return Object.freeze({ status: "locked" as const });
        },
      }),
    ).rejects.toThrow("duplicate positions");
    expect(executions).toBe(0);
  });

  it("rejects unsafe batch sizes before accessing the store", async () => {
    const jobs = new Jobs();
    await expect(
      recoverPositionJobsAtStartup({ jobs, now: () => now, batchSize: 0 }),
    ).rejects.toThrow("batch size");
    expect(jobs.recoverInput).toBeNull();
  });
});
