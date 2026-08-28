import { describe, expect, it, vi } from "vitest";
import { runScheduledAcquisitionCycle } from "../../src/application/services/acquisition-schedule.js";
import { evaluateCircuitBreakers } from "../../src/domain/portfolio/breakers.js";
import {
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
} from "../../src/domain/shared/types.js";
import { recoverPositionJobsAtStartup } from "../../src/workers/supervisor.js";

const at = asTimestamp("2026-08-26T12:30:00Z"),
  later = asTimestamp("2026-08-26T12:30:10Z");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000141"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "recovery",
  },
];
const base = {
  schedule: {
    claim: async () => ({ ownerId: "worker", startedAt: at }),
    complete: vi.fn(),
    retry: vi.fn(),
  },
  ownerId: "worker",
  now: () => at,
  leaseExpiresAt: () => later,
  nextAvailableAt: () => later,
  retryAt: () => later,
  discover: async () => ({ candidatesCreated: 1, sourcesAdded: 1 }),
  observeWallets: async () => undefined,
  valueWallets: async () => undefined,
  evaluateCandidates: async () => 1,
  publishPortfolioAndEvaluateRisk: async () => 1,
};

describe("mode ladder failure and recovery", () => {
  it("reschedules the complete acquisition after database interruption", async () => {
    const retry = vi.fn(),
      evaluate = vi.fn();
    const result = await runScheduledAcquisitionCycle({
      ...base,
      schedule: { ...base.schedule, retry },
      observeWallets: async () => Promise.reject(new Error("database connection lost")),
      evaluateCandidates: evaluate,
    });
    expect(result).toMatchObject({ status: "retry_scheduled", failedStage: "wallet_observation" });
    expect(evaluate).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "database connection lost" }),
    );
  });
  it("reclaims abandoned position work once before polling", async () => {
    const recoverAbandoned = vi.fn(async () => ["00000000-0000-4000-8000-000000000142" as never]);
    await expect(
      recoverPositionJobsAtStartup({
        jobs: { recoverAbandoned, findDue: vi.fn() },
        now: () => at,
        batchSize: 25,
      }),
    ).resolves.toMatchObject({ recoveredPositionIds: ["00000000-0000-4000-8000-000000000142"] });
    expect(recoverAbandoned).toHaveBeenCalledOnce();
  });
  it("blocks entries on unauthorized activity and prolonged provider disagreement", () => {
    const decision = evaluateCircuitBreakers({
      observedAt: at,
      evidence,
      utcDayStartingEquitySol: asNonNegativeDecimal(100),
      dailyRealizedLossSol: asNonNegativeDecimal(0),
      executableUnrealizedLossSol: asNonNegativeDecimal(0),
      rollingSevenDayDrawdownPercentage: asNonNegativeDecimal(0),
      highWaterDrawdownPercentage: asNonNegativeDecimal(0),
      consecutiveClosedLosingTrades: 0n,
      reconciliationFailuresLast24Hours: 0n,
      unauthorizedTransactionDetected: true,
      authoritativeDisagreementDurationMs: 60001n,
    });
    expect(decision).toMatchObject({ entryAllowed: false, lockKind: "protected" });
    expect(decision.triggeredRuleIds).toEqual(expect.arrayContaining(["CBR-007", "CBR-008"]));
  });
  it("refuses incomplete breaker authority rather than treating unknown as safe", () => {
    const decision = evaluateCircuitBreakers({
      observedAt: at,
      evidence,
      utcDayStartingEquitySol: null,
      dailyRealizedLossSol: null,
      executableUnrealizedLossSol: null,
      rollingSevenDayDrawdownPercentage: null,
      highWaterDrawdownPercentage: null,
      consecutiveClosedLosingTrades: null,
      reconciliationFailuresLast24Hours: null,
      unauthorizedTransactionDetected: null,
      authoritativeDisagreementDurationMs: null,
    });
    expect(decision.entryAllowed).toBe(false);
    expect(decision.triggeredRuleIds).toHaveLength(8);
  });
});
