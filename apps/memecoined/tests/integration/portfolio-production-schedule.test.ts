import { describe, expect, it, vi } from "vitest";

import { runScheduledPortfolioProductionCycle } from "../../src/application/services/portfolio-production-schedule.js";
import { asTimestamp } from "../../src/domain/shared/types.js";
import { PostgresPortfolioProductionSchedule } from "../../src/infrastructure/database/portfolio-production-schedule.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const later = (milliseconds: number) =>
  asTimestamp(new Date(Date.parse(at) + milliseconds).toISOString());

describe("portfolio production scheduling", () => {
  it("publishes before evaluating risk and completes the active lease", async () => {
    const order: string[] = [];
    const complete = vi.fn();
    const result = await runScheduledPortfolioProductionCycle({
      schedule: {
        claim: async () => ({ ownerId: "worker-1", observedAt: at }),
        complete,
        retry: vi.fn(),
      },
      ownerId: "worker-1",
      now: () => at,
      leaseExpiresAt: () => later(60_000),
      nextAvailableAt: () => later(30_000),
      retryAt: () => later(10_000),
      publish: async () => void order.push("publish"),
      evaluateRisk: async () => (order.push("risk"), 2),
    });
    expect(order).toEqual(["publish", "risk"]);
    expect(result).toEqual({ status: "completed", evaluated: 2 });
    expect(complete).toHaveBeenCalledWith({
      lease: { ownerId: "worker-1", observedAt: at },
      availableAt: later(30_000),
    });
  });

  it("does nothing without the durable lease", async () => {
    const publish = vi.fn();
    const result = await runScheduledPortfolioProductionCycle({
      schedule: { claim: async () => null, complete: vi.fn(), retry: vi.fn() },
      ownerId: "worker-2",
      now: () => at,
      leaseExpiresAt: () => later(60_000),
      nextAvailableAt: () => later(30_000),
      retryAt: () => later(10_000),
      publish,
      evaluateRisk: vi.fn(),
    });
    expect(result.status).toBe("locked");
    expect(publish).not.toHaveBeenCalled();
  });

  it("reschedules the lease when publication fails", async () => {
    const retry = vi.fn();
    const result = await runScheduledPortfolioProductionCycle({
      schedule: {
        claim: async () => ({ ownerId: "worker-3", observedAt: at }),
        complete: vi.fn(),
        retry,
      },
      ownerId: "worker-3",
      now: () => at,
      leaseExpiresAt: () => later(60_000),
      nextAvailableAt: () => later(30_000),
      retryAt: () => later(10_000),
      publish: async () => Promise.reject(new Error("portfolio unavailable")),
      evaluateRisk: vi.fn(),
    });
    expect(result.status).toBe("retry_scheduled");
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "portfolio unavailable" }),
    );
  });

  it("reschedules the whole cycle when risk evaluation fails after publication", async () => {
    const retry = vi.fn();
    const complete = vi.fn();
    const result = await runScheduledPortfolioProductionCycle({
      schedule: {
        claim: async () => ({ ownerId: "worker-4", observedAt: at }),
        complete,
        retry,
      },
      ownerId: "worker-4",
      now: () => at,
      leaseExpiresAt: () => later(60_000),
      nextAvailableAt: () => later(30_000),
      retryAt: () => later(10_000),
      publish: async () => undefined,
      evaluateRisk: async () => Promise.reject(new Error("risk authority stale")),
    });
    expect(result).toEqual({ status: "retry_scheduled", evaluated: 0 });
    expect(complete).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "risk authority stale", availableAt: later(10_000) }),
    );
  });

  it("fences a delayed release from an expired lease after same-owner restart", async () => {
    const queries: Array<{ text: string; values: readonly unknown[] | undefined }> = [];
    const database = {
      connect: async () => ({
        query: async (text: string, values?: readonly unknown[]) => {
          queries.push({ text, values });
          return { rows: [], rowCount: 0 };
        },
        release: () => undefined,
      }),
    };
    const schedule = new PostgresPortfolioProductionSchedule(database as never);
    await expect(
      schedule.complete({
        lease: { ownerId: "stable-instance", observedAt: at },
        availableAt: later(30_000),
      }),
    ).rejects.toThrow("active lease");
    expect(queries[0]?.text).toContain("updated_at=$6");
    expect(queries[0]?.values?.[5]).toBe(at);
  });
});
