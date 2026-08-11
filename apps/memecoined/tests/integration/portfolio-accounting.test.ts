import { expect, it } from "vitest";

import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type SignalId,
} from "../../src/domain/shared/types.js";
import { PostgresPortfolioAccountingLedger } from "../../src/infrastructure/database/portfolio-accounting.js";

const at = asTimestamp("2026-08-05T12:00:00Z");
const evidence = [
  {
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000000923"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "portfolio:checkpoint",
    slot: asSolanaSlot(123n),
  },
];

function checkpoint() {
  return {
    id: "00000000-0000-4000-8000-000000000924",
    observedAt: at,
    evidence,
    equitySol: asNonNegativeDecimal(90),
    uncommittedSol: asNonNegativeDecimal(80),
    openCostExposureSol: asNonNegativeDecimal(10),
    liquidityCapacitySol: asNonNegativeDecimal(5),
    estimatedEntryCostsSol: asNonNegativeDecimal("0.1"),
    openPositionCount: 1n,
    cumulativeRealizedPnlSol: asNonNegativeDecimal(7),
    executableUnrealizedLossSol: asNonNegativeDecimal(1),
    consecutiveClosedLosingTrades: 2n,
    reconciliationFailuresLast24Hours: 1n,
    unauthorizedTransactionDetected: false,
    authoritativeDisagreementDurationMs: 0n,
    usesLeverageOrBorrowing: false,
  };
}

it("records only complete immutable accounting checkpoints", async () => {
  const calls: readonly unknown[][] = [];
  const ledger = new PostgresPortfolioAccountingLedger({
    query: async (_sql: string, values: readonly unknown[]) => {
      (calls as unknown[][]).push([...values]);
      return { rowCount: 1, rows: [] };
    },
  } as never);
  await ledger.record(checkpoint());
  expect(calls[0]?.[2]).toMatch(/^[0-9a-f]{64}$/);
  expect(calls[0]?.[16]).toContain('"slot":"123"');
  await expect(ledger.record({ ...checkpoint(), evidence: [] })).rejects.toThrow(/evidence/);
});

it("reconstructs daily and historical breakers from checkpoint history", async () => {
  const rows = [
    { observed_at: "2026-07-30T00:00:00Z", equity_sol: "100", cumulative_realized_pnl_sol: "10" },
    { observed_at: "2026-08-05T00:00:00Z", equity_sol: "95", cumulative_realized_pnl_sol: "9" },
    { observed_at: at, equity_sol: "90", cumulative_realized_pnl_sol: "7" },
  ].map((row) => ({
    ...row,
    content_hash: "0".repeat(64),
    uncommitted_sol: "80",
    open_cost_exposure_sol: "10",
    liquidity_capacity_sol: "5",
    estimated_entry_costs_sol: "0.1",
    open_position_count: "1",
    executable_unrealized_loss_sol: "1",
    consecutive_closed_losing_trades: "2",
    reconciliation_failures_last_24_hours: "1",
    unauthorized_transaction_detected: false,
    authoritative_disagreement_duration_ms: "0",
    uses_leverage_or_borrowing: false,
    evidence_json: evidence,
  }));
  const ledger = new PostgresPortfolioAccountingLedger({
    query: async () => ({ rowCount: rows.length, rows }),
  } as never);
  const authority = await ledger.reconstruct({
    signalId: asUuid<SignalId>("00000000-0000-4000-8000-000000000925"),
    mint: "So11111111111111111111111111111111111111112" as MintAddress,
    observedAt: at,
    hasNonClosedPositionForMint: false,
    hasConfirmedPriorClosure: false,
    lastConfirmedClosureAt: null,
    increasesLosingPosition: false,
  });
  expect(authority.breakers.dailyRealizedLossSol?.toString()).toBe("2");
  expect(authority.breakers.rollingSevenDayDrawdownPercentage?.toFixed(2)).toBe("10.00");
  expect(authority.breakers.highWaterDrawdownPercentage?.toString()).toBe("10");
  expect(authority.breakers.utcDayStartingEquitySol?.toString()).toBe("95");
});

it("refuses stale accounting authority", async () => {
  const row = {
    observed_at: "2026-08-05T11:59:59Z",
    equity_sol: "90",
    cumulative_realized_pnl_sol: "7",
  };
  const ledger = new PostgresPortfolioAccountingLedger({
    query: async () => ({ rowCount: 1, rows: [{ ...row, evidence_json: evidence }] }),
  } as never);
  await expect(
    ledger.reconstruct({
      signalId: asUuid<SignalId>("00000000-0000-4000-8000-000000000925"),
      mint: "So11111111111111111111111111111111111111112" as MintAddress,
      observedAt: at,
      hasNonClosedPositionForMint: false,
      hasConfirmedPriorClosure: false,
      lastConfirmedClosureAt: null,
      increasesLosingPosition: false,
    }),
  ).rejects.toThrow(/stale/);
});
