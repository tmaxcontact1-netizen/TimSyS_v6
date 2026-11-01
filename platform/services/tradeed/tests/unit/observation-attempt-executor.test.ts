import { describe, expect, test, vi } from "vitest";

import { ObservationAttemptExecutor } from "../../src/workers/observation-attempt-executor.js";

describe("production observation attempt executor", () => {
  test("executes through the bounded production queue and cancels rotating before probe before watch", async () => {
    const executor = new ObservationAttemptExecutor<string>(1);
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cancelled: string[] = [];
    const submit = (id: string, cohort: "watch" | "ot_probe" | "rotating") =>
      executor.submit({
        id,
        tokenMint: id,
        cohort,
        selectedAt: "2026-09-25T00:00:00Z",
        execute: async () => {
          await blocked;
          return id;
        },
        cancel: async () => {
          cancelled.push(id);
        },
      });
    const promises = [submit("active", "watch")];
    for (let index = 0; index < 64; index += 1)
      promises.push(submit(`r${index}`, "rotating"));
    promises.push(submit("probe", "ot_probe"));
    promises.push(submit("watch", "watch"));
    await vi.waitFor(() => expect(cancelled.length).toBeGreaterThanOrEqual(2));
    expect(executor.maximumDepth).toBe(64);
    expect(cancelled.some((id) => id.startsWith("r"))).toBe(true);
    release();
    await Promise.all(promises);
    expect(executor.depth).toBe(0);
  });
});
