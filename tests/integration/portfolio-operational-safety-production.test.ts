import { expect, it, vi } from "vitest";

import { producePortfolioOperationalSafety } from "../../src/application/services/portfolio-operational-safety-production.js";
import {
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";

const wallet = "wallet-1" as WalletAddress;
const observedAt = asTimestamp("2026-08-10T12:00:00Z");

function evidence(index: number) {
  return Object.freeze([
    Object.freeze({
      id: asUuid<EvidenceId>(`00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`),
      provider: "solana_rpc" as const,
      observedAt,
      sourceKey: `portfolio:safety:${index}`,
    }),
  ]);
}

function source() {
  return {
    observePositions: vi.fn(async () => ({
      wallet,
      observedAt,
      evidence: evidence(1),
      openCostExposureSol: asNonNegativeDecimal(4),
      liquidityCapacitySol: asNonNegativeDecimal(3),
      estimatedEntryCostsSol: asNonNegativeDecimal("0.05"),
      openPositionCount: 2n,
      executableUnrealizedLossSol: asNonNegativeDecimal("0.5"),
      usesLeverageOrBorrowing: false,
    })),
    observeReconciliation: vi.fn(async () => ({
      wallet,
      observedAt,
      evidence: evidence(2),
      failuresLast24Hours: 1n,
    })),
    observeProviderHealth: vi.fn(async () => ({
      wallet,
      observedAt,
      evidence: evidence(3),
      authoritativeDisagreementDurationMs: 2_000n,
    })),
  };
}

it("publishes one deterministic complete operational safety observation", async () => {
  const record = vi.fn(async () => undefined);
  const inputs = source();
  const first = await producePortfolioOperationalSafety({
    wallet,
    observedAt,
    source: inputs,
    sink: { record },
  });
  const second = await producePortfolioOperationalSafety({
    wallet,
    observedAt,
    source: inputs,
    sink: { record },
  });
  expect(first.id).toBe(second.id);
  expect(first.openPositionCount).toBe(2n);
  expect(first.reconciliationFailuresLast24Hours).toBe(1n);
  expect(first.authoritativeDisagreementDurationMs).toBe(2_000n);
  expect(record).toHaveBeenCalledTimes(2);
});

it("fails closed on cross-source identity or provenance contradictions", async () => {
  const mismatched = source();
  mismatched.observeReconciliation.mockResolvedValue({
    wallet: "wallet-2" as WalletAddress,
    observedAt,
    evidence: evidence(2),
    failuresLast24Hours: 0n,
  });
  await expect(
    producePortfolioOperationalSafety({
      wallet,
      observedAt,
      source: mismatched,
      sink: { record: vi.fn() },
    }),
  ).rejects.toThrow(/another wallet/);

  const duplicated = source();
  duplicated.observeProviderHealth.mockResolvedValue({
    wallet,
    observedAt,
    evidence: evidence(1),
    authoritativeDisagreementDurationMs: 0n,
  });
  await expect(
    producePortfolioOperationalSafety({
      wallet,
      observedAt,
      source: duplicated,
      sink: { record: vi.fn() },
    }),
  ).rejects.toThrow(/unique/);
});

it("rejects impossible exposure and does not persist partial authority", async () => {
  const impossible = source();
  impossible.observePositions.mockResolvedValue({
    wallet,
    observedAt,
    evidence: evidence(1),
    openCostExposureSol: asNonNegativeDecimal(0),
    liquidityCapacitySol: asNonNegativeDecimal(3),
    estimatedEntryCostsSol: asNonNegativeDecimal("0.05"),
    openPositionCount: 0n,
    executableUnrealizedLossSol: asNonNegativeDecimal("0.5"),
    usesLeverageOrBorrowing: false,
  });
  const record = vi.fn(async () => undefined);
  await expect(
    producePortfolioOperationalSafety({
      wallet,
      observedAt,
      source: impossible,
      sink: { record },
    }),
  ).rejects.toThrow(/loss|Flat/);
  expect(record).not.toHaveBeenCalled();
});
