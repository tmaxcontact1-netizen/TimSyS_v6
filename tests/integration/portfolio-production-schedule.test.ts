import { describe, expect, it, vi } from "vitest";

import { runScheduledPortfolioProductionCycle } from "../../src/application/services/portfolio-production-schedule.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

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
});
