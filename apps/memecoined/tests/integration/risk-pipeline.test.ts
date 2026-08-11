import { describe, expect, it } from "vitest";
import type { PortfolioSnapshot } from "../../src/domain/portfolio/model.js";
import { createPortfolioSnapshot } from "../../src/domain/portfolio/model.js";
import type { CircuitBreakerSnapshot } from "../../src/domain/portfolio/breakers.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { PostgresRiskDecisionRepository } from "../../src/infrastructure/database/risk-decisions.js";
import { assessAndPersistEntry } from "../../src/application/services/entry-planner.js";

const at = asTimestamp("2026-08-04T20:00:00Z");
const signalId = asUuid<SignalId>("00000000-0000-4000-8000-000000000711");
const evidence = Object.freeze([
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000712"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "risk",
    slot: asSolanaSlot(8n),
  },
]);
const sol = asNonNegativeDecimal;
function portfolio(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return createPortfolioSnapshot({
    observedAt: at,
    evidence,
    mint: "So11111111111111111111111111111111111111112" as MintAddress,
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
    ...overrides,
  });
}
function breakers(overrides: Partial<CircuitBreakerSnapshot> = {}): CircuitBreakerSnapshot {
  return Object.freeze({
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
    ...overrides,
  });
}
function client(queries: string[], fail = false) {
  return {
    query: async (text: string) => {
      queries.push(text);
      if (fail && text.includes("entry_plans")) throw new Error("entry plan failed");
      return { rowCount: 1, rows: [] };
    },
    release: () => undefined,
  } as never;
}

describe("durable risk pipeline", () => {
  it("atomically approves, sizes, and schedules an entry plan", async () => {
    const queries: string[] = [];
    const result = await assessAndPersistEntry({
      signalId,
      riskRunId: "risk-1",
      portfolio: portfolio(),
      breakers: breakers(),
      repository: new PostgresRiskDecisionRepository({ connect: async () => client(queries) }),
    });
    expect(result.approved).toBe(true);
    expect(result.sizing.positionSizeSol?.toString()).toBe("3.3333333333333333333");
    expect(queries.some((query) => query.includes("entry_plans"))).toBe(true);
    expect(queries.some((query) => query.includes("entry_planning"))).toBe(true);
    expect(queries.at(-1)).toBe("COMMIT");
  });
  it("persists rejection without scheduling entry work", async () => {
    const queries: string[] = [];
    const result = await assessAndPersistEntry({
      signalId,
      riskRunId: "risk-2",
      portfolio: portfolio(),
      breakers: breakers({ unauthorizedTransactionDetected: true }),
      repository: new PostgresRiskDecisionRepository({ connect: async () => client(queries) }),
    });
    expect(result.approved).toBe(false);
    expect(queries.some((query) => query.includes("entry_plans"))).toBe(false);
    expect(queries.some((query) => query.includes("entry_planning"))).toBe(false);
    expect(queries.at(-1)).toBe("COMMIT");
  });
  it("rolls back the complete approval when entry-plan creation fails", async () => {
    const queries: string[] = [];
    await expect(
      assessAndPersistEntry({
        signalId,
        riskRunId: "risk-3",
        portfolio: portfolio(),
        breakers: breakers(),
        repository: new PostgresRiskDecisionRepository({
          connect: async () => client(queries, true),
        }),
      }),
    ).rejects.toThrow("entry plan failed");
    expect(queries.at(-1)).toBe("ROLLBACK");
  });
  it("rejects risk facts from different instants", async () => {
    await expect(
      assessAndPersistEntry({
        signalId,
        riskRunId: "risk-4",
        portfolio: portfolio(),
        breakers: breakers({ observedAt: asTimestamp("2026-08-04T20:00:01Z") }),
        repository: new PostgresRiskDecisionRepository({ connect: async () => client([]) }),
      }),
    ).rejects.toThrow("one observation instant");
  });
});
