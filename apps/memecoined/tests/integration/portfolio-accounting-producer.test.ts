import { expect, it, vi } from "vitest";

import {
  deterministicPortfolioCheckpointId,
  producePortfolioAccountingCheckpoint,
} from "../../src/application/services/portfolio-accounting-producer.js";
import {
  asDecimal,
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";

const observedAt = asTimestamp("2026-08-05T12:00:00Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000931"),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey: "portfolio:wallet-wide",
  }),
]);

function observation() {
  return Object.freeze({
    observedAt,
    evidence,
    equitySol: asNonNegativeDecimal(100),
    uncommittedSol: asNonNegativeDecimal(90),
    openCostExposureSol: asNonNegativeDecimal(10),
    liquidityCapacitySol: asNonNegativeDecimal(5),
    estimatedEntryCostsSol: asNonNegativeDecimal("0.1"),
    openPositionCount: 1n,
    cumulativeRealizedPnlSol: asDecimal(7),
    executableUnrealizedLossSol: asNonNegativeDecimal(1),
    consecutiveClosedLosingTrades: 2n,
    reconciliationFailuresLast24Hours: 1n,
    unauthorizedTransactionDetected: false,
    authoritativeDisagreementDurationMs: 0n,
    usesLeverageOrBorrowing: false,
  });
}

it("publishes one complete observation with deterministic restart identity", async () => {
  const record = vi.fn(async () => undefined);
  const first = await producePortfolioAccountingCheckpoint({
    source: { observe: async () => observation() },
    sink: { record },
    observedAt,
  });
  const second = await producePortfolioAccountingCheckpoint({
    source: { observe: async () => ({ ...observation(), evidence: [...evidence] }) },
    sink: { record: async () => undefined },
    observedAt,
  });
  expect(first.id).toBe(deterministicPortfolioCheckpointId(observation()));
  expect(second.id).toBe(first.id);
  expect(record).toHaveBeenCalledWith(first);
});

it("rejects stale, postdated, duplicated, and internally contradictory authority", async () => {
  const sink = { record: vi.fn(async () => undefined) };
  const invalid = [
    { ...observation(), observedAt: asTimestamp("2026-08-05T11:59:59Z") },
    {
      ...observation(),
      evidence: [...evidence, { ...evidence[0]!, observedAt: asTimestamp("2026-08-05T12:00:01Z") }],
    },
    { ...observation(), evidence: [...evidence, ...evidence] },
    {
      ...observation(),
      uncommittedSol: asNonNegativeDecimal(101),
    },
    {
      ...observation(),
      openPositionCount: 0n,
    },
    {
      ...observation(),
      usesLeverageOrBorrowing: true,
    },
  ];
  for (const item of invalid)
    await expect(
      producePortfolioAccountingCheckpoint({
        source: { observe: async () => item },
        sink,
        observedAt,
      }),
    ).rejects.toThrow();
  expect(sink.record).not.toHaveBeenCalled();
});

it("propagates source and durable publication failures", async () => {
  await expect(
    producePortfolioAccountingCheckpoint({
      source: { observe: async () => Promise.reject(new Error("source unavailable")) },
      sink: { record: async () => undefined },
      observedAt,
    }),
  ).rejects.toThrow("source unavailable");
  await expect(
    producePortfolioAccountingCheckpoint({
      source: { observe: async () => observation() },
      sink: { record: async () => Promise.reject(new Error("database unavailable")) },
      observedAt,
    }),
  ).rejects.toThrow("database unavailable");
});
