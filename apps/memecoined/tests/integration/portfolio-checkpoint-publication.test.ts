import { expect, it, vi } from "vitest";

import { LivePortfolioCheckpointPublicationCycle } from "../../src/application/services/portfolio-checkpoint-publication.js";
import {
  asDecimal,
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-07T12:00:00Z");

function observation() {
  return Object.freeze({
    observedAt,
    evidence: Object.freeze([
      Object.freeze({
        id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000941"),
        provider: "solana_rpc" as const,
        observedAt,
        sourceKey: "portfolio:complete",
      }),
    ]),
    equitySol: asNonNegativeDecimal(10),
    uncommittedSol: asNonNegativeDecimal(8),
    openCostExposureSol: asNonNegativeDecimal(2),
    liquidityCapacitySol: asNonNegativeDecimal(5),
    estimatedEntryCostsSol: asNonNegativeDecimal("0.1"),
    openPositionCount: 1n,
    cumulativeRealizedPnlSol: asDecimal(-1),
    executableUnrealizedLossSol: asNonNegativeDecimal("0.5"),
    consecutiveClosedLosingTrades: 1n,
    reconciliationFailuresLast24Hours: 0n,
    unauthorizedTransactionDetected: false,
    authoritativeDisagreementDurationMs: 0n,
    usesLeverageOrBorrowing: false,
  });
}

it("publishes complete accounting authority through one deterministic cycle", async () => {
  const record = vi.fn(async () => undefined);
  const cycle = new LivePortfolioCheckpointPublicationCycle(
    { observe: vi.fn(async () => observation()) },
    { record },
  );
  const checkpoint = await cycle.publish(observedAt);
  expect(checkpoint.observedAt).toBe(observedAt);
  expect(checkpoint.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(record).toHaveBeenCalledOnce();
  expect(record).toHaveBeenCalledWith(checkpoint);
});

it("does not persist when complete authority acquisition fails", async () => {
  const record = vi.fn(async () => undefined);
  const cycle = new LivePortfolioCheckpointPublicationCycle(
    { observe: async () => Promise.reject(new Error("operational authority unavailable")) },
    { record },
  );
  await expect(cycle.publish(observedAt)).rejects.toThrow("operational authority unavailable");
  expect(record).not.toHaveBeenCalled();
});
