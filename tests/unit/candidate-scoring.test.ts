import { describe, expect, it } from "vitest";
import { scoreCandidate } from "../../src/domain/candidate/scoring.js";
import { asNonNegativeDecimal, asPercentage } from "../../src/domain/shared/types.js";

describe("candidate scoring", () => {
  it("awards the maximum 95 points using exactly one band per component", () => {
    expect(
      scoreCandidate({
        walletConfirmation: "tier_a",
        liquidityUsd: asNonNegativeDecimal(250_000),
        fiveMinutePriceChange: asPercentage(5),
        topTenNormalPercentage: asPercentage("24.999"),
        fiveMinuteBuyTransactions: 18n,
        fiveMinuteSellTransactions: 10n,
      }),
    ).toEqual({
      wallet: 30,
      liquidity: 20,
      momentum: 20,
      holders: 15,
      volumeQuality: 10,
      total: 95,
    });
  });

  it("applies lower inclusive bands at their exact boundaries", () => {
    expect(
      scoreCandidate({
        walletConfirmation: "two_tier_b",
        liquidityUsd: asNonNegativeDecimal(75_000),
        fiveMinutePriceChange: asPercentage(3),
        topTenNormalPercentage: asPercentage(35),
        fiveMinuteBuyTransactions: 13n,
        fiveMinuteSellTransactions: 10n,
      }),
    ).toEqual({ wallet: 25, liquidity: 10, momentum: 12, holders: 8, volumeQuality: 5, total: 60 });
  });

  it("scores missing evidence as zero rather than manufacturing eligibility", () => {
    expect(
      scoreCandidate({
        walletConfirmation: "none",
        liquidityUsd: null,
        fiveMinutePriceChange: null,
        topTenNormalPercentage: null,
        fiveMinuteBuyTransactions: null,
        fiveMinuteSellTransactions: null,
      }).total,
    ).toBe(0);
  });

  it("rejects invalid transaction counts", () => {
    expect(() =>
      scoreCandidate({
        walletConfirmation: "tier_a",
        liquidityUsd: asNonNegativeDecimal(250_000),
        fiveMinutePriceChange: asPercentage(5),
        topTenNormalPercentage: asPercentage(20),
        fiveMinuteBuyTransactions: -1n,
        fiveMinuteSellTransactions: 1n,
      }),
    ).toThrow("non-negative");
  });
});
