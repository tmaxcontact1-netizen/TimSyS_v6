import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";
import type { Pool, QueryResult } from "pg";

import type { PersistRiskAuthoritySnapshot } from "./risk-authority.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type DecimalValue,
  type EvidenceId,
  type MintAddress,
  type SignalId,
  type Timestamp,
} from "../../domain/shared/types.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface CheckpointRow extends Record<string, unknown> {
  readonly observed_at: Date | string;
  readonly content_hash: string;
  readonly equity_sol: string;
  readonly uncommitted_sol: string;
  readonly open_cost_exposure_sol: string;
  readonly liquidity_capacity_sol: string;
  readonly estimated_entry_costs_sol: string;
  readonly open_position_count: string;
  readonly cumulative_realized_pnl_sol: string;
  readonly executable_unrealized_loss_sol: string;
  readonly consecutive_closed_losing_trades: string;
  readonly reconciliation_failures_last_24_hours: string;
  readonly unauthorized_transaction_detected: boolean;
  readonly authoritative_disagreement_duration_ms: string;
  readonly uses_leverage_or_borrowing: boolean;
  readonly evidence_json: readonly SerializedEvidence[];
}

interface SerializedEvidence {
  readonly id: string;
  readonly provider: EvidenceReference["provider"];
  readonly observedAt: string;
  readonly sourceKey: string;
  readonly slot?: string;
  readonly contentHash?: string;
}

export interface PortfolioAccountingCheckpoint {
  readonly id: string;
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly equitySol: DecimalValue;
  readonly uncommittedSol: DecimalValue;
  readonly openCostExposureSol: DecimalValue;
  readonly liquidityCapacitySol: DecimalValue;
  readonly estimatedEntryCostsSol: DecimalValue;
  readonly openPositionCount: bigint;
  readonly cumulativeRealizedPnlSol: DecimalValue;
  readonly executableUnrealizedLossSol: DecimalValue;
  readonly consecutiveClosedLosingTrades: bigint;
  readonly reconciliationFailuresLast24Hours: bigint;
  readonly unauthorizedTransactionDetected: boolean;
  readonly authoritativeDisagreementDurationMs: bigint;
  readonly usesLeverageOrBorrowing: boolean;
}

function serializedEvidence(evidence: readonly EvidenceReference[]): readonly SerializedEvidence[] {
  return evidence.map((item) => ({
    id: item.id,
    provider: item.provider,
    observedAt: item.observedAt,
    sourceKey: item.sourceKey,
    ...(item.slot === undefined ? {} : { slot: item.slot.toString() }),
    ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
  }));
}

function hydratedEvidence(evidence: readonly SerializedEvidence[]): readonly EvidenceReference[] {
  return Object.freeze(
    evidence.map((item) =>
      Object.freeze({
        id: asUuid<EvidenceId>(item.id),
        provider: item.provider,
        observedAt: asTimestamp(item.observedAt),
        sourceKey: item.sourceKey,
        ...(item.slot === undefined ? {} : { slot: asSolanaSlot(BigInt(item.slot)) }),
        ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
      }),
    ),
  );
}

function canonical(input: PortfolioAccountingCheckpoint): string {
  return JSON.stringify({
    ...input,
    evidence: serializedEvidence(input.evidence),
    equitySol: input.equitySol.toString(),
    uncommittedSol: input.uncommittedSol.toString(),
    openCostExposureSol: input.openCostExposureSol.toString(),
    liquidityCapacitySol: input.liquidityCapacitySol.toString(),
    estimatedEntryCostsSol: input.estimatedEntryCostsSol.toString(),
    openPositionCount: input.openPositionCount.toString(),
    cumulativeRealizedPnlSol: input.cumulativeRealizedPnlSol.toString(),
    executableUnrealizedLossSol: input.executableUnrealizedLossSol.toString(),
    consecutiveClosedLosingTrades: input.consecutiveClosedLosingTrades.toString(),
    reconciliationFailuresLast24Hours: input.reconciliationFailuresLast24Hours.toString(),
    authoritativeDisagreementDurationMs: input.authoritativeDisagreementDurationMs.toString(),
  });
}

function percentageDecline(high: Decimal, current: Decimal): DecimalValue {
  if (high.lte(0) || current.gte(high)) return asNonNegativeDecimal(0);
  return asNonNegativeDecimal(high.minus(current).div(high).mul(100));
}

function verifyCheckpoint(input: PortfolioAccountingCheckpoint): void {
  if (input.evidence.length === 0)
    throw new InvariantViolationError("Accounting evidence is required");
  if (input.uncommittedSol.gt(input.equitySol))
    throw new InvariantViolationError("Uncommitted SOL cannot exceed equity");
  if (
    input.openPositionCount < 0n ||
    input.consecutiveClosedLosingTrades < 0n ||
    input.reconciliationFailuresLast24Hours < 0n ||
    input.authoritativeDisagreementDurationMs < 0n
  )
    throw new InvariantViolationError("Accounting counters must be non-negative");
  if (input.evidence.some((item) => item.observedAt > input.observedAt))
    throw new InvariantViolationError("Accounting evidence cannot postdate its checkpoint");
}

export class PostgresPortfolioAccountingLedger {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async record(input: PortfolioAccountingCheckpoint): Promise<void> {
    verifyCheckpoint(input);
    const contentHash = createHash("sha256").update(canonical(input)).digest("hex");
    const result = await (this.database as DatabasePort).query(
      `INSERT INTO portfolio_accounting_checkpoints
         (id, observed_at, content_hash, equity_sol, uncommitted_sol,
          open_cost_exposure_sol, liquidity_capacity_sol, estimated_entry_costs_sol,
          open_position_count, cumulative_realized_pnl_sol, executable_unrealized_loss_sol,
          consecutive_closed_losing_trades, reconciliation_failures_last_24_hours,
          unauthorized_transaction_detected, authoritative_disagreement_duration_ms,
          uses_leverage_or_borrowing, evidence_json)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
       ON CONFLICT DO NOTHING`,
      [
        input.id,
        input.observedAt,
        contentHash,
        input.equitySol.toString(),
        input.uncommittedSol.toString(),
        input.openCostExposureSol.toString(),
        input.liquidityCapacitySol.toString(),
        input.estimatedEntryCostsSol.toString(),
        input.openPositionCount.toString(),
        input.cumulativeRealizedPnlSol.toString(),
        input.executableUnrealizedLossSol.toString(),
        input.consecutiveClosedLosingTrades.toString(),
        input.reconciliationFailuresLast24Hours.toString(),
        input.unauthorizedTransactionDetected,
        input.authoritativeDisagreementDurationMs.toString(),
        input.usesLeverageOrBorrowing,
        JSON.stringify(serializedEvidence(input.evidence)),
      ],
    );
    if (result.rowCount !== 1)
      throw new InvariantViolationError("Portfolio accounting checkpoint already exists");
  }

  public async reconstruct(input: {
    readonly signalId: SignalId;
    readonly mint: MintAddress;
    readonly observedAt: Timestamp;
    readonly hasNonClosedPositionForMint: boolean;
    readonly hasConfirmedPriorClosure: boolean;
    readonly lastConfirmedClosureAt: Timestamp | null;
    readonly increasesLosingPosition: boolean;
  }): Promise<PersistRiskAuthoritySnapshot> {
    const result = await (this.database as DatabasePort).query<CheckpointRow>(
      `SELECT observed_at, content_hash, equity_sol::text, uncommitted_sol::text,
              open_cost_exposure_sol::text, liquidity_capacity_sol::text,
              estimated_entry_costs_sol::text, open_position_count::text,
              cumulative_realized_pnl_sol::text, executable_unrealized_loss_sol::text,
              consecutive_closed_losing_trades::text,
              reconciliation_failures_last_24_hours::text,
              unauthorized_transaction_detected,
              authoritative_disagreement_duration_ms::text,
              uses_leverage_or_borrowing, evidence_json
       FROM portfolio_accounting_checkpoints
       WHERE observed_at <= $1
       ORDER BY observed_at ASC, id ASC`,
      [input.observedAt],
    );
    const current = result.rows.at(-1);
    if (current === undefined)
      throw new InvariantViolationError("Portfolio accounting authority is unavailable");
    if (asTimestamp(current.observed_at) !== input.observedAt)
      throw new InvariantViolationError("Portfolio accounting checkpoint is stale");
    const now = new Date(input.observedAt);
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
    const dayRows = result.rows.filter((row) => new Date(row.observed_at) >= dayStart);
    const sevenDayRows = result.rows.filter((row) => new Date(row.observed_at) >= sevenDaysAgo);
    const dayOpening = dayRows[0];
    if (dayOpening === undefined)
      throw new InvariantViolationError("UTC-day opening authority is unavailable");
    const equity = new Decimal(current.equity_sol);
    const maxEquity = (rows: readonly CheckpointRow[]) =>
      rows.reduce((maximum, row) => Decimal.max(maximum, row.equity_sol), new Decimal(0));
    const dailyLoss = Decimal.max(
      0,
      new Decimal(dayOpening.cumulative_realized_pnl_sol).minus(
        current.cumulative_realized_pnl_sol,
      ),
    );
    return Object.freeze({
      signalId: input.signalId,
      mint: input.mint,
      observedAt: input.observedAt,
      evidence: hydratedEvidence(current.evidence_json),
      portfolio: {
        equitySol: asNonNegativeDecimal(equity),
        uncommittedSol: asNonNegativeDecimal(current.uncommitted_sol),
        openCostExposureSol: asNonNegativeDecimal(current.open_cost_exposure_sol),
        liquidityCapacitySol: asNonNegativeDecimal(current.liquidity_capacity_sol),
        estimatedEntryCostsSol: asNonNegativeDecimal(current.estimated_entry_costs_sol),
        openPositionCount: BigInt(current.open_position_count),
        hasNonClosedPositionForMint: input.hasNonClosedPositionForMint,
        hasConfirmedPriorClosure: input.hasConfirmedPriorClosure,
        lastConfirmedClosureAt: input.lastConfirmedClosureAt,
        usesLeverageOrBorrowing: current.uses_leverage_or_borrowing,
        increasesLosingPosition: input.increasesLosingPosition,
        requestedPositionPercentage: null,
      },
      breakers: {
        utcDayStartingEquitySol: asNonNegativeDecimal(dayOpening.equity_sol),
        dailyRealizedLossSol: asNonNegativeDecimal(dailyLoss),
        executableUnrealizedLossSol: asNonNegativeDecimal(current.executable_unrealized_loss_sol),
        rollingSevenDayDrawdownPercentage: percentageDecline(maxEquity(sevenDayRows), equity),
        highWaterDrawdownPercentage: percentageDecline(maxEquity(result.rows), equity),
        consecutiveClosedLosingTrades: BigInt(current.consecutive_closed_losing_trades),
        reconciliationFailuresLast24Hours: BigInt(current.reconciliation_failures_last_24_hours),
        unauthorizedTransactionDetected: current.unauthorized_transaction_detected,
        authoritativeDisagreementDurationMs: BigInt(current.authoritative_disagreement_duration_ms),
      },
    });
  }
}
