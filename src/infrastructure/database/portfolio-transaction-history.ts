import { Decimal } from "decimal.js";
import type { PoolClient } from "pg";

import type {
  PortfolioTransactionHistoryObservation,
  PortfolioTransactionHistorySource,
  WalletHistoryObservationPort,
} from "../../application/services/portfolio-transaction-history.js";
import {
  applyPositionEvent,
  createEmptyPositionLifecycle,
  type PositionEvent,
} from "../../domain/trading/position.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asDecimal,
  asRawAmount,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type EvidenceId,
  type PositionId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

interface AuditRow extends Record<string, unknown> {
  readonly id: string;
  readonly entity_id: string;
  readonly occurred_at: Date | string;
  readonly after_hash: string;
  readonly details_json: Record<string, unknown>;
}

interface WalletRow extends Record<string, unknown> {
  readonly signature: string;
  readonly occurred_at: Date | string;
  readonly successful: boolean;
  readonly evidence_json: {
    readonly id: string;
    readonly provider: "helius";
    readonly observedAt: string;
    readonly sourceKey: string;
    readonly slot: string;
    readonly contentHash: string;
  };
}

function encodedScalar(value: unknown, kind: "bigint" | "decimal"): string {
  if (
    value === null ||
    typeof value !== "object" ||
    (value as Record<string, unknown>).$type !== kind ||
    typeof (value as Record<string, unknown>).value !== "string"
  )
    throw new InvariantViolationError(`Position audit ${kind} is malformed`);
  return (value as { readonly value: string }).value;
}

function hydrateEvent(row: AuditRow): PositionEvent {
  const value = row.details_json;
  const common = {
    eventId: asUuid<AuditEventId>(row.id),
    positionId: asUuid<PositionId>(row.entity_id),
    aggregateVersion: BigInt(encodedScalar(value.aggregateVersion, "bigint")),
    occurredAt: asTimestamp(row.occurred_at),
  };
  switch (value.type) {
    case "position:opened":
      if (typeof value.tokenId !== "string" || typeof value.entryOrderId !== "string")
        throw new InvariantViolationError("Position opened audit is malformed");
      return {
        ...common,
        type: value.type,
        tokenId: value.tokenId as never,
        entryOrderId: asUuid(value.entryOrderId),
        acquiredAmount: asRawAmount(BigInt(encodedScalar(value.acquiredAmount, "bigint"))),
        costBasisSol: asDecimal(encodedScalar(value.costBasisSol, "decimal")),
      };
    case "position:executable-peak-recorded":
      return {
        ...common,
        type: value.type,
        executableValueSol: asDecimal(encodedScalar(value.executableValueSol, "decimal")),
      };
    case "position:exit-requested":
      return { ...common, type: value.type };
    case "position:exit-reconciled":
      if (!["first", "second", "full", "continuation"].includes(String(value.target)))
        throw new InvariantViolationError("Position reconciliation target is malformed");
      return {
        ...common,
        type: value.type,
        target: value.target as "first" | "second" | "full" | "continuation",
        soldAmount: asRawAmount(BigInt(encodedScalar(value.soldAmount, "bigint"))),
        proceedsSol: asDecimal(encodedScalar(value.proceedsSol, "decimal")),
        reconciledRemainingAmount: asRawAmount(
          BigInt(encodedScalar(value.reconciledRemainingAmount, "bigint")),
        ),
      };
    default:
      throw new InvariantViolationError("Unknown position audit event");
  }
}

/** Synchronizes complete Helius coverage, then reconstructs accounting history from durable facts. */
export class PostgresPortfolioTransactionHistorySource implements PortfolioTransactionHistorySource {
  public constructor(
    private readonly database: DatabasePort,
    private readonly history: WalletHistoryObservationPort,
    private readonly wallet: WalletAddress,
  ) {}

  public async observe(requestedAt: Timestamp): Promise<PortfolioTransactionHistoryObservation> {
    const client = await this.database.connect();
    try {
      const start = await client.query<{ readonly started_at: Date | string | null }>(
        `SELECT min(started_at) AS started_at FROM (
           SELECT min(created_at) AS started_at FROM entry_submission_attempts
           UNION ALL
           SELECT min(occurred_at) FROM audit_events WHERE actor_id='position-worker'
         ) boundaries`,
      );
      const startedAt = start.rows[0]?.started_at;
      if (startedAt === null || startedAt === undefined)
        throw new InvariantViolationError("System transaction-history boundary is unavailable");
      const systemActivityStartedAt = asTimestamp(startedAt);
      const observed = await this.history.observe({
        wallet: this.wallet,
        coverageRequiredAt: systemActivityStartedAt,
        requestedAt,
      });
      if (observed.wallet !== this.wallet || observed.requestedAt !== requestedAt)
        throw new InvariantViolationError("Wallet history returned mismatched authority");
      await client.query("BEGIN");
      for (const transaction of observed.transactions) {
        const persisted = await client.query(
          `INSERT INTO wallet_transaction_observations
             (wallet,signature,occurred_at,observed_at,slot,successful,evidence_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
           ON CONFLICT (wallet,signature) DO UPDATE SET signature=EXCLUDED.signature
           WHERE wallet_transaction_observations.occurred_at=EXCLUDED.occurred_at
             AND wallet_transaction_observations.observed_at=EXCLUDED.observed_at
             AND wallet_transaction_observations.slot=EXCLUDED.slot
             AND wallet_transaction_observations.successful=EXCLUDED.successful
             AND wallet_transaction_observations.evidence_json=EXCLUDED.evidence_json
           RETURNING signature`,
          [
            this.wallet,
            transaction.signature,
            transaction.occurredAt,
            transaction.evidence.observedAt,
            transaction.slot.toString(),
            transaction.successful,
            JSON.stringify(transaction.evidence, (_key, item) =>
              typeof item === "bigint" ? item.toString() : item,
            ),
          ],
        );
        if (persisted.rowCount !== 1)
          throw new InvariantViolationError(
            "Wallet transaction observation conflicts with durable evidence",
          );
      }
      await client.query(
        `INSERT INTO wallet_transaction_history_coverage
           (wallet,coverage_started_at,observed_through_at,updated_at)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (wallet) DO UPDATE SET
           coverage_started_at=LEAST(wallet_transaction_history_coverage.coverage_started_at,EXCLUDED.coverage_started_at),
           observed_through_at=GREATEST(wallet_transaction_history_coverage.observed_through_at,EXCLUDED.observed_through_at),
           updated_at=EXCLUDED.updated_at`,
        [this.wallet, observed.coverageStartedAt, requestedAt, observed.evidenceObservedAt],
      );
      await client.query("COMMIT");

      const audits = await client.query<AuditRow>(
        `SELECT id,entity_id,occurred_at,after_hash,details_json FROM audit_events
         WHERE actor_id='position-worker' AND occurred_at <= $1
         ORDER BY entity_id,occurred_at,id`,
        [requestedAt],
      );
      const realizations: PortfolioTransactionHistoryObservation["realizations"][number][] = [];
      let lifecycle = createEmptyPositionLifecycle();
      let positionId: string | null = null;
      for (const row of audits.rows) {
        if (positionId !== row.entity_id) {
          positionId = row.entity_id;
          lifecycle = createEmptyPositionLifecycle();
        }
        const before = lifecycle.position?.realisedPnlSol ?? new Decimal(0);
        const event = hydrateEvent(row);
        lifecycle = applyPositionEvent(lifecycle, event);
        if (event.type === "position:exit-reconciled")
          realizations.push(
            Object.freeze({
              id: row.id,
              occurredAt: event.occurredAt,
              realizedPnlDeltaSol: asDecimal(
                (lifecycle.position?.realisedPnlSol ?? new Decimal(0)).minus(before),
              ),
              closesPosition: event.reconciledRemainingAmount === 0n,
              evidence: Object.freeze({
                id: asUuid<EvidenceId>(row.id),
                provider: "solana_rpc" as const,
                observedAt: event.occurredAt,
                sourceKey: `position-audit:${row.id}`,
                contentHash: row.after_hash,
              }),
            }),
          );
      }
      const walletRows = await client.query<WalletRow>(
        `SELECT signature,occurred_at,successful,evidence_json
         FROM wallet_transaction_observations
         WHERE wallet=$1 AND occurred_at BETWEEN $2 AND $3 ORDER BY occurred_at,signature`,
        [this.wallet, systemActivityStartedAt, requestedAt],
      );
      const signatures = await client.query<{ readonly signature: string }>(
        `SELECT signature FROM entry_submission_attempts WHERE created_at <= $1
         UNION SELECT signature FROM exit_submission_authority WHERE acknowledged_at <= $1
         ORDER BY signature`,
        [requestedAt],
      );
      return Object.freeze({
        wallet: this.wallet,
        observedAt: requestedAt,
        coverageStartedAt: observed.coverageStartedAt,
        systemActivityStartedAt,
        realizations: Object.freeze(realizations),
        walletInitiatedTransactions: Object.freeze(
          walletRows.rows.map((row) =>
            Object.freeze({
              signature: row.signature,
              occurredAt: asTimestamp(row.occurred_at),
              successful: row.successful,
              evidence: Object.freeze({
                ...row.evidence_json,
                id: asUuid<EvidenceId>(row.evidence_json.id),
                observedAt: asTimestamp(row.evidence_json.observedAt),
                slot: BigInt(row.evidence_json.slot) as never,
              }),
            }),
          ),
        ),
        authorizedSignatures: Object.freeze(signatures.rows.map(({ signature }) => signature)),
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
