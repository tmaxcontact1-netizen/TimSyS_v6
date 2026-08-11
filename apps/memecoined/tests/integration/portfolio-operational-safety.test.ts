import { createHash } from "node:crypto";

import { expect, it } from "vitest";

import {
  asNonNegativeDecimal,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type WalletAddress,
} from "../../src/domain/shared/types.js";
import { PostgresPortfolioOperationalSafetyAuthority } from "../../src/infrastructure/database/portfolio-operational-safety.js";

const wallet = "wallet-1" as WalletAddress;
const at = asTimestamp("2026-08-10T12:00:00Z");
const evidence = Object.freeze([
  Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000002501"),
    provider: "solana_rpc" as const,
    observedAt: at,
    sourceKey: "portfolio:operations",
  }),
]);

function observation() {
  return Object.freeze({
    id: asUuid<EvidenceId>("00000000-0000-4000-8000-000000002502"),
    wallet,
    observedAt: at,
    evidence,
    openCostExposureSol: asNonNegativeDecimal(4),
    liquidityCapacitySol: asNonNegativeDecimal(3),
    estimatedEntryCostsSol: asNonNegativeDecimal("0.05"),
    openPositionCount: 1n,
    executableUnrealizedLossSol: asNonNegativeDecimal("0.5"),
    reconciliationFailuresLast24Hours: 1n,
    authoritativeDisagreementDurationMs: 2_000n,
    usesLeverageOrBorrowing: false,
  });
}

function row(contentHash: string) {
  return {
    id: observation().id,
    wallet,
    observed_at: at,
    content_hash: contentHash,
    open_cost_exposure_sol: "4",
    liquidity_capacity_sol: "3",
    estimated_entry_costs_sol: "0.05",
    open_position_count: "1",
    executable_unrealized_loss_sol: "0.5",
    reconciliation_failures_last_24_hours: "1",
    authoritative_disagreement_duration_ms: "2000",
    uses_leverage_or_borrowing: false,
    evidence_json: evidence,
  };
}

it("records complete operational safety authority idempotently", async () => {
  const calls: readonly unknown[][] = [];
  const authority = new PostgresPortfolioOperationalSafetyAuthority(
    {
      query: async (_sql: string, values: readonly unknown[]) => {
        (calls as unknown[][]).push([...values]);
        return { rowCount: 1, rows: [{ id: observation().id }] };
      },
    } as never,
    wallet,
  );
  await authority.record(observation());
  expect(calls[0]?.[3]).toMatch(/^[0-9a-f]{64}$/);
  await expect(authority.record({ ...observation(), evidence: [] })).rejects.toThrow(/evidence/);
  await expect(
    authority.record({ ...observation(), wallet: "wallet-2" as WalletAddress }),
  ).rejects.toThrow(/another wallet/);
});

it("reconstructs exact hash-verified operational safety authority", async () => {
  let stored: ReturnType<typeof row>;
  const authority = new PostgresPortfolioOperationalSafetyAuthority(
    {
      query: async () => ({ rowCount: 1, rows: [stored] }),
    } as never,
    wallet,
  );
  const input = observation();
  const canonical = JSON.stringify({
    wallet: input.wallet,
    observedAt: input.observedAt,
    evidence,
    openCostExposureSol: "4",
    liquidityCapacitySol: "3",
    estimatedEntryCostsSol: "0.05",
    openPositionCount: "1",
    executableUnrealizedLossSol: "0.5",
    reconciliationFailuresLast24Hours: "1",
    authoritativeDisagreementDurationMs: "2000",
    usesLeverageOrBorrowing: false,
  });
  stored = row(createHash("sha256").update(canonical).digest("hex"));
  const result = await authority.observe(at);
  expect(result.openCostExposureSol.toString()).toBe("4");
  expect(result.authoritativeDisagreementDurationMs).toBe(2_000n);
});

it("fails closed on missing, contradictory, or tampered operational authority", async () => {
  const missing = new PostgresPortfolioOperationalSafetyAuthority(
    { query: async () => ({ rowCount: 0, rows: [] }) } as never,
    wallet,
  );
  await expect(missing.observe(at)).rejects.toThrow(/unavailable/);
  const tampered = new PostgresPortfolioOperationalSafetyAuthority(
    { query: async () => ({ rowCount: 1, rows: [row("0".repeat(64))] }) } as never,
    wallet,
  );
  await expect(tampered.observe(at)).rejects.toThrow(/hash verification/);
});
