import { describe, expect, it } from "vitest";

import { LivePortfolioAccountingObservationSource } from "../../src/application/services/live-portfolio-accounting-observation.js";
import {
  asDecimal,
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-06T12:00:00Z");
const wallet = "wallet-authority" as WalletAddress;

function evidence(suffix: string, provider: "solana_rpc" | "helius" | "dexscreener") {
  return Object.freeze({
    id: asUuid<EvidenceId>(`00000000-0000-4000-8000-0000000000${suffix}`),
    provider,
    observedAt,
    sourceKey: `portfolio:${suffix}`,
  });
}

function sources() {
  return {
    valuation: {
      observe: async () =>
        Object.freeze({
          observedAt,
          wallet,
          nativeBalanceSol: asNonNegativeDecimal(8),
          nativePriceUsd: asNonNegativeDecimal(200),
          tokenValueUsd: asNonNegativeDecimal(400),
          tokenValueSol: asNonNegativeDecimal(2),
          equitySol: asNonNegativeDecimal(10),
          holdings: Object.freeze([]),
          evidence: Object.freeze([evidence("11", "dexscreener")]),
        }),
    },
    transactions: {
      observe: async () =>
        Object.freeze({
          wallet,
          observedAt,
          coverageStartedAt: asTimestamp("2026-08-01T00:00:00Z"),
          systemActivityStartedAt: asTimestamp("2026-08-02T00:00:00Z"),
          realizations: Object.freeze([
            Object.freeze({
              id: "realization-1",
              occurredAt: asTimestamp("2026-08-05T12:00:00Z"),
              realizedPnlDeltaSol: asDecimal(-1),
              closesPosition: true,
              evidence: evidence("12", "solana_rpc"),
            }),
          ]),
          walletInitiatedTransactions: Object.freeze([]),
          authorizedSignatures: Object.freeze([]),
        }),
    },
    operations: {
      observe: async () =>
        Object.freeze({
          wallet,
          observedAt,
          evidence: Object.freeze([evidence("13", "helius")]),
          openCostExposureSol: asNonNegativeDecimal(2),
          liquidityCapacitySol: asNonNegativeDecimal(5),
          estimatedEntryCostsSol: asNonNegativeDecimal("0.1"),
          openPositionCount: 1n,
          executableUnrealizedLossSol: asNonNegativeDecimal("0.5"),
          reconciliationFailuresLast24Hours: 1n,
          authoritativeDisagreementDurationMs: 0n,
          usesLeverageOrBorrowing: false,
        }),
    },
  };
}

describe("live portfolio accounting observation", () => {
  it("joins complete authority at one instant without replacing transaction facts", async () => {
    const input = sources();
    const result = await new LivePortfolioAccountingObservationSource(
      wallet,
      input.valuation,
      input.transactions,
      input.operations,
    ).observe(observedAt);
    expect(result.equitySol.toString()).toBe("10");
    expect(result.uncommittedSol.toString()).toBe("8");
    expect(result.cumulativeRealizedPnlSol.toString()).toBe("-1");
    expect(result.consecutiveClosedLosingTrades).toBe(1n);
    expect(result.reconciliationFailuresLast24Hours).toBe(1n);
    expect(result.evidence).toHaveLength(3);
    expect(Object.isFrozen(result.evidence)).toBe(true);
  });

  it("rejects mismatched time, wallet, and duplicated provenance", async () => {
    const mismatched = sources();
    mismatched.operations.observe = async () => ({
      ...(await sources().operations.observe()),
      wallet: "other-wallet" as WalletAddress,
    });
    await expect(
      new LivePortfolioAccountingObservationSource(
        wallet,
        mismatched.valuation,
        mismatched.transactions,
        mismatched.operations,
      ).observe(observedAt),
    ).rejects.toThrow(/mismatched wallet/);

    const duplicated = sources();
    duplicated.operations.observe = async () => ({
      ...(await sources().operations.observe()),
      evidence: Object.freeze([evidence("11", "dexscreener")]),
    });
    await expect(
      new LivePortfolioAccountingObservationSource(
        wallet,
        duplicated.valuation,
        duplicated.transactions,
        duplicated.operations,
      ).observe(observedAt),
    ).rejects.toThrow(/unique/);
  });

  it("rejects operational claims that exceed live wallet authority", async () => {
    const input = sources();
    input.operations.observe = async () => ({
      ...(await sources().operations.observe()),
      liquidityCapacitySol: asNonNegativeDecimal(9),
    });
    await expect(
      new LivePortfolioAccountingObservationSource(
        wallet,
        input.valuation,
        input.transactions,
        input.operations,
      ).observe(observedAt),
    ).rejects.toThrow(/native balance/);
  });
});
