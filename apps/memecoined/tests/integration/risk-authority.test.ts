import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { RiskEvaluationLease } from "../../src/application/services/risk-evaluation-work.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { PostgresRiskAuthorityRepository } from "../../src/infrastructure/database/risk-authority.js";

const signalId = asUuid<SignalId>("00000000-0000-4000-8000-000000000901");
const mint = "So11111111111111111111111111111111111111112" as MintAddress;
const at = asTimestamp("2026-08-05T12:00:00Z");
const lease: RiskEvaluationLease = { signalId, mint, leaseOwner: "risk-1", riskRunId: "run-1" };
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000902"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "portfolio:reconciled",
    slot: asSolanaSlot(100n),
  },
];

function input() {
  const sol = asNonNegativeDecimal;
  return {
    signalId,
    mint,
    observedAt: at,
    evidence,
    portfolio: {
      equitySol: sol(100),
      uncommittedSol: sol(90),
      openCostExposureSol: sol(10),
      liquidityCapacitySol: sol(5),
      estimatedEntryCostsSol: sol("0.1"),
      openPositionCount: 1n,
      hasNonClosedPositionForMint: false,
      hasConfirmedPriorClosure: false,
      lastConfirmedClosureAt: null,
      usesLeverageOrBorrowing: false,
      increasesLosingPosition: false,
      requestedPositionPercentage: null,
    },
    breakers: {
      utcDayStartingEquitySol: sol(100),
      dailyRealizedLossSol: sol(0),
      executableUnrealizedLossSol: sol(1),
      rollingSevenDayDrawdownPercentage: sol(1),
      highWaterDrawdownPercentage: sol(1),
      consecutiveClosedLosingTrades: 0n,
      reconciliationFailuresLast24Hours: 0n,
      unauthorizedTransactionDetected: false,
      authoritativeDisagreementDurationMs: 0n,
    },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

it("records only complete immutable risk authority", async () => {
  const calls: unknown[][] = [];
  const repository = new PostgresRiskAuthorityRepository({
    query: async (_sql: string, values?: readonly unknown[]) => {
      calls.push([...(values ?? [])]);
      return { rowCount: 1, rows: [] };
    },
  } as never);
  await repository.record(input());
  expect(calls[0]?.[3]).toMatch(/^[0-9a-f]{64}$/);
  await expect(
    repository.record({
      ...input(),
      portfolio: { ...input().portfolio, equitySol: null },
    }),
  ).rejects.toThrow(/complete/);
});

describe("risk authority reconstruction", () => {
  it("hydrates portfolio and breaker facts at one instant", async () => {
    const recorded = input();
    const portfolio = {
      equitySol: "100",
      uncommittedSol: "90",
      openCostExposureSol: "10",
      liquidityCapacitySol: "5",
      estimatedEntryCostsSol: "0.1",
      openPositionCount: "1",
      hasNonClosedPositionForMint: false,
      hasConfirmedPriorClosure: false,
      lastConfirmedClosureAt: null,
      usesLeverageOrBorrowing: false,
      increasesLosingPosition: false,
      requestedPositionPercentage: null,
    };
    const breakers = {
      utcDayStartingEquitySol: "100",
      dailyRealizedLossSol: "0",
      executableUnrealizedLossSol: "1",
      rollingSevenDayDrawdownPercentage: "1",
      highWaterDrawdownPercentage: "1",
      consecutiveClosedLosingTrades: "0",
      reconciliationFailuresLast24Hours: "0",
      unauthorizedTransactionDetected: false,
      authoritativeDisagreementDurationMs: "0",
    };
    const evidenceJson = recorded.evidence.map((item) => ({
      id: item.id,
      provider: item.provider,
      observedAt: item.observedAt,
      sourceKey: item.sourceKey,
      slot: item.slot?.toString(),
    }));
    const payload = canonical({
      breakers,
      evidence: evidenceJson,
      mint,
      observedAt: at,
      portfolio,
      signalId,
    });
    const repository = new PostgresRiskAuthorityRepository({
      query: async () =>
        ({
          rowCount: 1,
          rows: [
            {
              signal_id: signalId,
              mint_address: mint,
              observed_at: at,
              content_hash: createHash("sha256").update(payload).digest("hex"),
              portfolio_json: portfolio,
              breakers_json: breakers,
              evidence_json: evidenceJson,
            },
          ],
        }) as never,
    });
    const facts = await repository.load(lease);
    expect(facts.portfolio.equitySol?.toString()).toBe("100");
    expect(facts.breakers.executableUnrealizedLossSol?.toString()).toBe("1");
    expect(facts.portfolio.observedAt).toBe(facts.breakers.observedAt);
  });

  it("rejects conflicting identity and tampered authority", async () => {
    const repository = new PostgresRiskAuthorityRepository({
      query: async () =>
        ({
          rowCount: 1,
          rows: [
            {
              signal_id: signalId,
              mint_address: mint,
              observed_at: at,
              content_hash: "0".repeat(64),
              portfolio_json: {},
              breakers_json: {},
              evidence_json: evidence,
            },
          ],
        }) as never,
    });
    await expect(repository.load(lease)).rejects.toThrow(/malformed|hash/);
    await expect(repository.load({ ...lease, mint: "OtherMint" as MintAddress })).rejects.toThrow(
      /different mint/,
    );
  });
});
