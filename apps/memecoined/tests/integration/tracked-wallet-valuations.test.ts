import { describe, expect, it } from "vitest";

import { runTrackedWalletValuationCycle } from "../../src/application/services/tracked-wallet-valuations.js";
import {
  asNonNegativeDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type CandidateId,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const now = asTimestamp("2026-08-04T20:00:00Z");
const candidateId = asUuid<CandidateId>("00000000-0000-4000-8000-000000002001");
const purchase = {
  observationId: 1n,
  candidateId,
  wallet: "wallet" as never,
  mint: "mint" as never,
  acquiredAmountRaw: asRawAmount(2_000_000n),
  tokenDecimals: 6,
};
const trace = {
  evidenceId: asUuid<EvidenceId>("00000000-0000-4000-8000-000000002002"),
  provider: "dexscreener" as const,
  method: "test",
  requestedAt: now,
  respondedAt: now,
  sourceTimestamp: null,
  normalizedAt: now,
  sourceKey: "key",
  contentHash: "hash",
};

describe("tracked-wallet purchase valuation", () => {
  it("binds USD value and agreed retained balance without exceeding 100%", async () => {
    const saved: unknown[] = [];
    await expect(
      runTrackedWalletValuationCycle({
        repository: {
          loadUnvalued: async () => [purchase],
          save: async (value) => (saved.push(value), true),
        },
        market: {
          observePrimaryPool: async () => ({
            ok: true,
            value: {
              mint: purchase.mint,
              priceUsd: asNonNegativeDecimal("0.25"),
              liquidityUsd: asNonNegativeDecimal("100000"),
              trace,
            } as never,
          }),
        },
        balances: {
          observeBalances: async () => ({
            ok: true,
            value: {
              wallet: purchase.wallet,
              mint: purchase.mint,
              tokenBalanceRaw: asRawAmount(3_000_000n),
              traces: [trace],
            } as never,
          }),
        },
        now: () => now,
        limit: 10,
      }),
    ).resolves.toBe(1);
    expect(saved[0]).toMatchObject({ purchaseValueUsd: expect.anything() });
    expect((saved[0] as any).purchaseValueUsd.toString()).toBe("0.5");
    expect((saved[0] as any).retainedPercentage.toString()).toBe("100");
  });

  it.each(["market", "balance"] as const)(
    "fails closed when %s evidence is unavailable",
    async (part) => {
      await expect(
        runTrackedWalletValuationCycle({
          repository: { loadUnvalued: async () => [purchase], save: async () => true },
          market: {
            observePrimaryPool: async () =>
              part === "market"
                ? ({ ok: false, error: { code: "unavailable" } } as never)
                : ({
                    ok: true,
                    value: {
                      mint: purchase.mint,
                      priceUsd: asNonNegativeDecimal(1),
                      liquidityUsd: asNonNegativeDecimal(1),
                      trace,
                    },
                  } as never),
          },
          balances: {
            observeBalances: async () =>
              part === "balance"
                ? ({ ok: false, error: { code: "contradictory" } } as never)
                : ({
                    ok: true,
                    value: {
                      wallet: purchase.wallet,
                      mint: purchase.mint,
                      tokenBalanceRaw: asRawAmount(1n),
                      traces: [trace],
                    },
                  } as never),
          },
          now: () => now,
          limit: 1,
        }),
      ).rejects.toThrow(/unavailable/i);
    },
  );
});
