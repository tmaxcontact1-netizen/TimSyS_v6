import { createHash } from "node:crypto";

import type { Pool, QueryResult } from "pg";

import type {
  PortfolioOperationalSafetyObservation,
  PortfolioOperationalSafetySource,
} from "../../application/services/live-portfolio-accounting-observation.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface SerializedEvidence {
  readonly id: string;
  readonly provider: EvidenceReference["provider"];
  readonly observedAt: string;
  readonly sourceKey: string;
  readonly slot?: string;
  readonly contentHash?: string;
}

interface OperationalSafetyRow extends Record<string, unknown> {
  readonly id: string;
  readonly wallet: string;
  readonly observed_at: Date | string;
  readonly content_hash: string;
  readonly open_cost_exposure_sol: string;
  readonly liquidity_capacity_sol: string;
  readonly estimated_entry_costs_sol: string;
  readonly open_position_count: string;
  readonly executable_unrealized_loss_sol: string;
  readonly reconciliation_failures_last_24_hours: string;
  readonly authoritative_disagreement_duration_ms: string;
  readonly uses_leverage_or_borrowing: boolean;
  readonly evidence_json: readonly SerializedEvidence[];
}

export interface PersistPortfolioOperationalSafetyObservation extends PortfolioOperationalSafetyObservation {
  readonly id: EvidenceId;
}

function serializeEvidence(evidence: readonly EvidenceReference[]): readonly SerializedEvidence[] {
  return evidence.map((item) => ({
    id: item.id,
    provider: item.provider,
    observedAt: item.observedAt,
    sourceKey: item.sourceKey,
    ...(item.slot === undefined ? {} : { slot: item.slot.toString() }),
    ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
  }));
}

function hydrateEvidence(evidence: readonly SerializedEvidence[]): readonly EvidenceReference[] {
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

function canonical(input: PortfolioOperationalSafetyObservation): string {
  return JSON.stringify({
    wallet: input.wallet,
    observedAt: input.observedAt,
    evidence: serializeEvidence(input.evidence),
    openCostExposureSol: input.openCostExposureSol.toString(),
    liquidityCapacitySol: input.liquidityCapacitySol.toString(),
    estimatedEntryCostsSol: input.estimatedEntryCostsSol.toString(),
    openPositionCount: input.openPositionCount.toString(),
    executableUnrealizedLossSol: input.executableUnrealizedLossSol.toString(),
    reconciliationFailuresLast24Hours: input.reconciliationFailuresLast24Hours.toString(),
    authoritativeDisagreementDurationMs: input.authoritativeDisagreementDurationMs.toString(),
    usesLeverageOrBorrowing: input.usesLeverageOrBorrowing,
  });
}

function verify(input: PortfolioOperationalSafetyObservation): void {
  if (input.evidence.length === 0)
    throw new InvariantViolationError("Operational safety authority requires evidence");
  if (new Set(input.evidence.map(({ id }) => id)).size !== input.evidence.length)
    throw new InvariantViolationError("Operational safety evidence must be unique");
  if (input.evidence.some(({ observedAt }) => observedAt > input.observedAt))
    throw new InvariantViolationError("Operational safety evidence cannot be postdated");
  if (
    input.openPositionCount < 0n ||
    input.reconciliationFailuresLast24Hours < 0n ||
    input.authoritativeDisagreementDurationMs < 0n
  )
    throw new InvariantViolationError("Operational safety counters must be non-negative");
  if (
    input.openPositionCount === 0n &&
    (!input.openCostExposureSol.isZero() || !input.executableUnrealizedLossSol.isZero())
  )
    throw new InvariantViolationError("Flat operational safety authority cannot contain exposure");
}

function hydrate(row: OperationalSafetyRow): PortfolioOperationalSafetyObservation {
  const observation = Object.freeze({
    wallet: row.wallet as WalletAddress,
    observedAt: asTimestamp(row.observed_at),
    evidence: hydrateEvidence(row.evidence_json),
    openCostExposureSol: asNonNegativeDecimal(row.open_cost_exposure_sol),
    liquidityCapacitySol: asNonNegativeDecimal(row.liquidity_capacity_sol),
    estimatedEntryCostsSol: asNonNegativeDecimal(row.estimated_entry_costs_sol),
    openPositionCount: BigInt(row.open_position_count),
    executableUnrealizedLossSol: asNonNegativeDecimal(row.executable_unrealized_loss_sol),
    reconciliationFailuresLast24Hours: BigInt(row.reconciliation_failures_last_24_hours),
    authoritativeDisagreementDurationMs: BigInt(row.authoritative_disagreement_duration_ms),
    usesLeverageOrBorrowing: row.uses_leverage_or_borrowing,
  });
  verify(observation);
  if (createHash("sha256").update(canonical(observation)).digest("hex") !== row.content_hash)
    throw new InvariantViolationError("Operational safety authority hash verification failed");
  return observation;
}

/** Persists and reconstructs one immutable, same-instant operational-safety authority. */
export class PostgresPortfolioOperationalSafetyAuthority implements PortfolioOperationalSafetySource {
  public constructor(
    private readonly database: Pick<Pool, "query">,
    private readonly wallet: WalletAddress,
  ) {}

  public async record(input: PersistPortfolioOperationalSafetyObservation): Promise<void> {
    verify(input);
    if (input.wallet !== this.wallet)
      throw new InvariantViolationError("Operational safety authority targets another wallet");
    const contentHash = createHash("sha256").update(canonical(input)).digest("hex");
    const result = await (this.database as DatabasePort).query<{ readonly id: string }>(
      `WITH inserted AS (
         INSERT INTO portfolio_operational_safety_observations
           (id, wallet, observed_at, content_hash, open_cost_exposure_sol,
            liquidity_capacity_sol, estimated_entry_costs_sol, open_position_count,
            executable_unrealized_loss_sol, reconciliation_failures_last_24_hours,
            authoritative_disagreement_duration_ms, uses_leverage_or_borrowing, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
         ON CONFLICT (wallet, observed_at) DO NOTHING RETURNING id
       )
       SELECT id FROM inserted UNION ALL
       SELECT id FROM portfolio_operational_safety_observations
       WHERE id=$1 AND wallet=$2 AND observed_at=$3 AND content_hash=$4 LIMIT 1`,
      [
        input.id,
        input.wallet,
        input.observedAt,
        contentHash,
        input.openCostExposureSol.toString(),
        input.liquidityCapacitySol.toString(),
        input.estimatedEntryCostsSol.toString(),
        input.openPositionCount.toString(),
        input.executableUnrealizedLossSol.toString(),
        input.reconciliationFailuresLast24Hours.toString(),
        input.authoritativeDisagreementDurationMs.toString(),
        input.usesLeverageOrBorrowing,
        JSON.stringify(serializeEvidence(input.evidence)),
      ],
    );
    if (result.rowCount !== 1 || result.rows[0]?.id !== input.id)
      throw new InvariantViolationError("Operational safety authority conflicts with persistence");
  }

  public async observe(requestedAt: Timestamp): Promise<PortfolioOperationalSafetyObservation> {
    const result = await (this.database as DatabasePort).query<OperationalSafetyRow>(
      `SELECT id, wallet, observed_at, content_hash, open_cost_exposure_sol::text,
              liquidity_capacity_sol::text, estimated_entry_costs_sol::text,
              open_position_count::text, executable_unrealized_loss_sol::text,
              reconciliation_failures_last_24_hours::text,
              authoritative_disagreement_duration_ms::text,
              uses_leverage_or_borrowing, evidence_json
       FROM portfolio_operational_safety_observations
       WHERE wallet=$1 AND observed_at=$2`,
      [this.wallet, requestedAt],
    );
    if (result.rowCount !== 1 || result.rows[0] === undefined)
      throw new InvariantViolationError("Exact operational safety authority is unavailable");
    const observation = hydrate(result.rows[0]);
    if (observation.wallet !== this.wallet || observation.observedAt !== requestedAt)
      throw new InvariantViolationError("Operational safety authority identity mismatch");
    return observation;
  }
}
