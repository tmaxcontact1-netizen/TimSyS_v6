import { describe, expect, it, vi } from "vitest";

import {
  deterministicRiskRunId,
  runLeasedRiskEvaluationCycle,
  type RiskEvaluationLease,
} from "../../src/application/services/risk-evaluation-work.js";
import { createPortfolioSnapshot } from "../../src/domain/portfolio/model.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { PostgresRiskEvaluationWorkQueue } from "../../src/infrastructure/database/risk-evaluation-jobs.js";

const at = asTimestamp("2026-08-05T10:00:00Z");
const signalId = asUuid<SignalId>("00000000-0000-4000-8000-000000000801");
const mint = "So11111111111111111111111111111111111111112" as MintAddress;
const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000802"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "risk",
    slot: asSolanaSlot(1n),
  },
]);
const lease: RiskEvaluationLease = Object.freeze({
  signalId,
  mint,
  leaseOwner: "worker-1",
  riskRunId: deterministicRiskRunId(signalId),
});

function facts() {
  const sol = asNonNegativeDecimal;
  return Object.freeze({
    portfolio: createPortfolioSnapshot({
      observedAt: at,
      evidence,
      mint,
      equitySol: sol(100),
      uncommittedSol: sol(100),
      openCostExposureSol: sol(0),
      liquidityCapacitySol: sol(10),
      estimatedEntryCostsSol: sol("0.1"),
      openPositionCount: 0n,
      hasNonClosedPositionForMint: false,
      hasConfirmedPriorClosure: false,
      lastConfirmedClosureAt: null,
      usesLeverageOrBorrowing: false,
      increasesLosingPosition: false,
      requestedPositionPercentage: null,
    }),
    breakers: Object.freeze({
      observedAt: at,
      evidence,
      utcDayStartingEquitySol: sol(100),
      dailyRealizedLossSol: sol(0),
      executableUnrealizedLossSol: sol(0),
      rollingSevenDayDrawdownPercentage: sol(0),
      highWaterDrawdownPercentage: sol(0),
      consecutiveClosedLosingTrades: 0n,
      reconciliationFailuresLast24Hours: 0n,
      unauthorizedTransactionDetected: false,
      authoritativeDisagreementDurationMs: 0n,
    }),
  });
}

describe("durable risk evaluation work", () => {
  it("uses a stable risk identity and completes through the active lease", async () => {
    expect(deterministicRiskRunId(signalId)).toBe(deterministicRiskRunId(signalId));
    const saveRiskDecision = vi.fn().mockResolvedValue(undefined);
    const completed = await runLeasedRiskEvaluationCycle({
      queue: { claim: async () => [lease], retry: vi.fn() },
      facts: { load: async () => facts() },
      repository: { saveRiskDecision },
      ownerId: "worker-1",
      now: () => at,
      leaseExpiresAt: () => at,
      retryAt: () => at,
    });
    expect(completed).toBe(1);
    expect(saveRiskDecision).toHaveBeenCalledWith(
      expect.objectContaining({ signalId, riskRunId: lease.riskRunId, leaseOwner: "worker-1" }),
    );
  });

  it("returns unavailable evidence to the queue without making a decision", async () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    const saveRiskDecision = vi.fn();
    const completed = await runLeasedRiskEvaluationCycle({
      queue: { claim: async () => [lease], retry },
      facts: {
        load: async () => {
          throw new Error("portfolio unavailable");
        },
      },
      repository: { saveRiskDecision },
      ownerId: "worker-1",
      now: () => at,
      leaseExpiresAt: () => at,
      retryAt: () => at,
    });
    expect(completed).toBe(0);
    expect(saveRiskDecision).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledWith(
      expect.objectContaining({ lease, reason: "portfolio unavailable" }),
    );
  });

  it("claims only canonical signals and hydrates their mint", async () => {
    const queries: string[] = [];
    const queue = new PostgresRiskEvaluationWorkQueue({
      connect: async () =>
        ({
          query: async (text: string) => {
            queries.push(text);
            return text.includes("RETURNING")
              ? { rowCount: 1, rows: [{ signal_id: signalId, mint_address: mint }] }
              : { rowCount: 0, rows: [] };
          },
          release: () => undefined,
        }) as never,
    });
    const claimed = await queue.claim({
      ownerId: "worker-1",
      now: at,
      leaseExpiresAt: at,
      limit: 10,
    });
    expect(claimed).toEqual([lease]);
    expect(queries.join("\n")).toContain("s.state='eligible'");
    expect(queries.at(-1)).toBe("COMMIT");
  });

  it("rejects retry when the caller no longer owns the lease", async () => {
    const queue = new PostgresRiskEvaluationWorkQueue({
      connect: async () =>
        ({ query: async () => ({ rowCount: 0, rows: [] }), release: () => undefined }) as never,
    });
    await expect(queue.retry({ lease, availableAt: at, reason: "failed" })).rejects.toThrow(
      "active lease",
    );
  });
});
