import { describe, expect, it, vi } from "vitest";

import { runPaperPositionMonitorCycle } from "../../src/application/services/paper-position-monitor.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");
const lease = {
  tokenMint: "token" as never,
  openAmountRaw: 100n,
  leaseOwner: "worker",
  leaseAcquiredAt: at,
};

describe("paper position monitoring", () => {
  it("executes a full exit and completes the fenced lease", async () => {
    const fill = { id: "fill" } as never;
    const queue = {
      claim: vi.fn(async () => [lease]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };
    const execution = { execute: vi.fn(async () => fill) };
    const result = await runPaperPositionMonitorCycle({
      queue,
      execution: execution as never,
      ownerId: "worker",
      now: () => at,
      leaseExpiresAt: () => at,
      nextAt: () => at,
      retryAt: () => at,
      monitor: {
        evaluate: async () => ({
          action: "full",
          requestedAmountRaw: 0n,
          evaluatedAt: at,
          reason: "stop",
        }),
      },
    });
    expect(execution.execute).toHaveBeenCalledWith({
      side: "sell",
      tokenMint: "token",
      inputAmountRaw: 100n,
      requestedAt: at,
    });
    expect(queue.complete).toHaveBeenCalledWith(expect.objectContaining({ lease, fill }));
    expect(result).toEqual([fill]);
  });

  it("reschedules monitoring without creating a fill", async () => {
    const queue = {
      claim: vi.fn(async () => [lease]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };
    const execution = { execute: vi.fn() };
    await runPaperPositionMonitorCycle({
      queue,
      execution: execution as never,
      ownerId: "worker",
      now: () => at,
      leaseExpiresAt: () => at,
      nextAt: () => at,
      retryAt: () => at,
      monitor: {
        evaluate: async () => ({
          action: "none",
          requestedAmountRaw: 0n,
          evaluatedAt: at,
          reason: "hold",
        }),
      },
    });
    expect(execution.execute).not.toHaveBeenCalled();
    expect(queue.complete).toHaveBeenCalledWith(expect.objectContaining({ fill: null }));
  });

  it("releases failed exits for retry", async () => {
    const queue = {
      claim: vi.fn(async () => [lease]),
      complete: vi.fn(),
      retry: vi.fn(async () => undefined),
    };
    await runPaperPositionMonitorCycle({
      queue,
      execution: {
        execute: async () => {
          throw new Error("quote down");
        },
      } as never,
      ownerId: "worker",
      now: () => at,
      leaseExpiresAt: () => at,
      nextAt: () => at,
      retryAt: () => at,
      monitor: {
        evaluate: async () => ({
          action: "partial",
          requestedAmountRaw: 25n,
          evaluatedAt: at,
          reason: "take profit",
        }),
      },
    });
    expect(queue.retry).toHaveBeenCalledWith({ lease, availableAt: at, reason: "quote down" });
  });
});
