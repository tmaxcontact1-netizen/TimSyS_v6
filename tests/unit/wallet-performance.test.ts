import { describe, expect, it } from "vitest";

import {
  asDecimal,
  asPercentage,
  asTimestamp,
  asUuid,
  type WalletAddress,
  type WalletId,
} from "../../src/domain/shared/types.js";
import type { WalletPerformanceSnapshot } from "../../src/domain/wallet/model.js";
import { qualifyWallet } from "../../src/domain/wallet/performance.js";

const snapshot = (
  overrides: Partial<WalletPerformanceSnapshot> = {},
): WalletPerformanceSnapshot => ({
  walletId: asUuid<WalletId>("00000000-0000-4000-8000-000000000901"),
  address: "11111111111111111111111111111111" as WalletAddress,
  evaluatedAt: asTimestamp("2026-08-04T20:00:00Z"),
  completedTrades: 100n,
  verifiableTradePercentage: asPercentage(80),
  winRate: asPercentage(60),
  profitFactor: asDecimal(2),
  medianReturnPercentage: asPercentage(9),
  totalRealisedProfitUsd: asDecimal(1_000),
  medianHoldingMinutes: asDecimal(30),
  maximumDrawdownPercentage: asPercentage(20),
  manipulationFlags: [],
  evidence: [
    {
      id: asUuid("00000000-0000-4000-8000-000000000902"),
      provider: "solana_rpc",
      observedAt: asTimestamp("2026-08-04T20:00:00Z"),
      sourceKey: "wallet-history",
    },
  ],
  ...overrides,
});

describe("wallet performance qualification", () => {
  it("classifies exact Tier A and Tier B boundaries", () => {
    expect(qualifyWallet(snapshot()).tier).toBe("tier_a");
    expect(
      qualifyWallet(
        snapshot({ completedTrades: 50n, winRate: asPercentage(57), profitFactor: asDecimal(1.7) }),
      ).tier,
    ).toBe("tier_b");
  });

  it("keeps base-eligible wallets in research-only Tier C", () => {
    expect(
      qualifyWallet(
        snapshot({ completedTrades: 30n, winRate: asPercentage(55), profitFactor: asDecimal(1.5) }),
      ).tier,
    ).toBe("tier_c");
  });

  it("fails closed on manipulation or incomplete historical authority", () => {
    expect(qualifyWallet(snapshot({ manipulationFlags: ["self_trading"] })).tier).toBe(
      "ineligible",
    );
    const result = qualifyWallet(snapshot({ verifiableTradePercentage: asPercentage(59) }));
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("fewer than 60% of trades are verifiable");
  });
});
