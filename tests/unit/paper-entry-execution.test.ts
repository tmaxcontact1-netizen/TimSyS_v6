import { describe, expect, it, vi } from "vitest";

import { runPaperEntryExecutionCycle } from "../../src/application/services/paper-execution.js";
import { asTimestamp } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T10:00:00Z");
const lease = Object.freeze({
  signalId: "00000000-0000-4000-8000-000000000901",
  riskRunId: "risk-paper-1",
  tokenMint: "token-mint" as never,
  inputAmountRaw: 500_000_000n,
  leaseOwner: "paper-01",
});

describe("paper entry execution cycle", () => {
  it("executes and completes an approved paper entry", async () => {
    const fill = Object.freeze({ id: "fill-1" }) as never;
    const queue = {
      claim: vi.fn(async () => [lease]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };
    const execute = vi.fn(async () => fill);
    const execution = { execute } as never;
    const result = await runPaperEntryExecutionCycle({
      queue,
      execution,
      ownerId: "paper-01",
      now: () => at,
      leaseExpiresAt: () => asTimestamp("2026-08-10T10:01:00Z"),
      retryAt: () => asTimestamp("2026-08-10T10:00:10Z"),
    });
    expect(execute).toHaveBeenCalledWith({
      side: "buy",
      tokenMint: "token-mint",
      inputAmountRaw: 500_000_000n,
      requestedAt: at,
    });
    expect(queue.complete).toHaveBeenCalledWith({ lease, fill });
    expect(queue.retry).not.toHaveBeenCalled();
    expect(result).toEqual([fill]);
  });

  it("returns failed work to its durable retry cadence", async () => {
    const queue = {
      claim: vi.fn(async () => [lease]),
      complete: vi.fn(async () => undefined),
      retry: vi.fn(async () => undefined),
    };
    const result = await runPaperEntryExecutionCycle({
      queue,
      execution: {
        execute: vi.fn(async () => {
          throw new Error("quote unavailable");
        }),
      } as never,
      ownerId: "paper-01",
      now: () => at,
      leaseExpiresAt: () => asTimestamp("2026-08-10T10:01:00Z"),
      retryAt: () => asTimestamp("2026-08-10T10:00:10Z"),
    });
    expect(queue.retry).toHaveBeenCalledWith({
      lease,
      availableAt: "2026-08-10T10:00:10.000Z",
      reason: "quote unavailable",
    });
    expect(queue.complete).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
