import { describe, expect, test } from "vitest";
import { runObservationScheduler } from "../../src/workers/observation-scheduler.js";

describe("independent observation scheduler", () => {
  test("keeps timer cadence while slow work remains unresolved and delegates overload to the attempt queue", async () => {
    const controller = new AbortController(),
      scheduled: string[] = [],
      cohorts: string[][] = [],
      skipped: string[] = [];
    let now = Date.parse("2026-09-25T00:00:00.000Z"),
      waits = 0;
    const pending: Array<() => void> = [];
    const resultPromise = runObservationScheduler({
      signal: controller.signal,
      now: () => new Date(now),
      wait: {
        wait: async (delay) => {
          now += delay;
          waits += 1;
          if (waits === 7) controller.abort();
        },
      },
      runTick: ({ scheduledAt, allowedCohorts }) => {
        scheduled.push(scheduledAt);
        cohorts.push([...allowedCohorts]);
        return new Promise<void>((resolve) => pending.push(resolve));
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    pending.forEach((resolve) => resolve());
    const result = await resultPromise;
    expect(scheduled.slice(0, 4)).toEqual([
      "2026-09-25T00:00:00.000Z",
      "2026-09-25T00:00:15.000Z",
      "2026-09-25T00:00:30.000Z",
      "2026-09-25T00:00:45.000Z",
    ]);
    expect(cohorts[0]).toEqual(["watch", "ot_probe", "rotating"]);
    expect(cohorts[1]).toEqual(["watch", "ot_probe"]);
    expect(cohorts[2]).toEqual(["watch", "ot_probe", "rotating"]);
    expect(skipped).toHaveLength(0);
    expect(result.maximumConcurrentTicks).toBeGreaterThan(4);
  });

  test("a completed tick restores full cohort admission", async () => {
    const controller = new AbortController();
    let now = Date.parse("2026-09-25T00:00:00Z"),
      ticks = 0;
    const admitted: string[][] = [];
    await runObservationScheduler({
      signal: controller.signal,
      now: () => new Date(now),
      wait: {
        wait: async (delay) => {
          now += delay;
          if (ticks >= 2) controller.abort();
        },
      },
      runTick: async ({ allowedCohorts }) => {
        ticks += 1;
        admitted.push([...allowedCohorts]);
      },
    });
    expect(admitted[0]).toContain("rotating");
    expect(admitted[1]).not.toContain("rotating");
  });
});
