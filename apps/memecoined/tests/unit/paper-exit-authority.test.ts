import { describe, expect, it, vi } from "vitest";

import { AuthoritativePaperExitMonitor } from "../../src/application/services/paper-exit-authority.js";
import { asRawAmount, asTimestamp } from "../../src/domain/shared/types.js";

const at = asTimestamp("2026-08-10T12:00:00.000Z");

describe("paper exit authority adapter", () => {
  it("preserves the deterministic rule, action, and requested quantity", async () => {
    const evaluate = vi.fn(async () => ({
      evaluatedAt: at,
      decision: {
        action: "partial" as const,
        ruleId: "EXT-002",
        requestedAmount: asRawAmount(40n),
        results: Object.freeze([]),
      },
    }));
    const monitor = new AuthoritativePaperExitMonitor({ evaluate });
    const result = await monitor.evaluate(
      {
        tokenMint: "mint" as never,
        openAmountRaw: 100n,
        leaseOwner: "worker",
        leaseAcquiredAt: at,
      },
      at,
    );
    expect(evaluate).toHaveBeenCalledWith({
      tokenMint: "mint",
      openAmountRaw: 100n,
      evaluatedAt: at,
    });
    expect(result).toEqual({
      action: "partial",
      requestedAmountRaw: 40n,
      evaluatedAt: at,
      reason: "EXT-002",
    });
  });

  it("makes a no-exit decision explicit", async () => {
    const monitor = new AuthoritativePaperExitMonitor({
      evaluate: async () => ({
        evaluatedAt: at,
        decision: {
          action: "none",
          ruleId: null,
          requestedAmount: asRawAmount(0n),
          results: Object.freeze([]),
        },
      }),
    });
    await expect(
      monitor.evaluate(
        { tokenMint: "mint" as never, openAmountRaw: 1n, leaseOwner: "w", leaseAcquiredAt: at },
        at,
      ),
    ).resolves.toMatchObject({ action: "none", reason: "No deterministic exit rule triggered" });
  });
});
