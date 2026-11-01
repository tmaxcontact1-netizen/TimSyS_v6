import { describe, expect, it, vi } from "vitest";

import { retryDatabaseOperation } from "../../src/infrastructure/database/pool.js";

describe("database pool acquisition resilience", () => {
  it("backs off through a transient pool timeout and recovers", async () => {
    vi.useFakeTimers();
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("timeout exceeded when trying to connect"))
      .mockRejectedValueOnce(new Error("connection terminated unexpectedly"))
      .mockResolvedValue("recovered");
    const result = retryDatabaseOperation(operation, {
      attempts: 5, initialDelayMs: 10, maximumWaitMs: 1_000,
    });
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe("recovered");
    expect(operation).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("does not retry a SQL or validation defect", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("column does not exist"));
    await expect(retryDatabaseOperation(operation)).rejects.toThrow("column does not exist");
    expect(operation).toHaveBeenCalledOnce();
  });
});
