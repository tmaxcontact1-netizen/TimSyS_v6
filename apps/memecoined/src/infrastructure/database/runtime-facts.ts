import { Decimal } from "decimal.js";
import type { Pool, PoolClient, QueryResult } from "pg";
import { z } from "zod";

import type { EvidenceReference } from "../../domain/shared/evidence.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asDecimal,
  asTimestamp,
  asUuid,
  type AuditEventId,
  type EvidenceId,
  type MintAddress,
  type OrderId,
  type PositionId,
  type ProviderId,
  type SolanaSlot,
  type TokenId,
  type WalletAddress,
} from "../../domain/shared/types.js";
import type { PositionWorkerCheckpoint } from "../../application/ports/repositories.js";
import type {
  PositionMonitoringFacts,
  PositionMonitoringFactsSource,
  PositionReconciliationFacts,
  PositionReconciliationFactsSource,
} from "../../application/ports/runtime.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface FactRow extends Record<string, unknown> {
  readonly payload_json: unknown;
}

interface TransactionalDatabasePort extends DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export interface PublishPositionRuntimeFacts {
  readonly id: EvidenceId;
  readonly checkpoint: PositionWorkerCheckpoint;
  readonly phase: "monitor" | "reconcile";
  readonly facts: PositionMonitoringFacts | PositionReconciliationFacts;
  readonly observationIds: readonly EvidenceId[];
}

const uuid = z.string().uuid();
const timestamp = z.string().datetime({ offset: true });
const decimal = z.string().refine((value) => new Decimal(value).isFinite(), "invalid decimal");
const provider = z.enum([
  "solana_rpc",
  "helius",
  "jupiter",
  "dexscreener",
  "gmgn",
  "birdeye",
  "telegram",
]);
const evidenceSchema = z.object({
  id: uuid,
  provider,
  observedAt: timestamp,
  sourceKey: z.string().trim().min(1),
  slot: z.string().regex(/^\d+$/).optional(),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
const monitoringSchema = z.object({
  stepId: z.string().trim().min(1),
  positionId: uuid,
  tokenId: uuid,
  observationRequestedAt: timestamp,
  evaluatedAt: timestamp,
  wallet: z.string().trim().min(1),
  tokenMint: z.string().trim().min(1),
  settlementMint: z.string().trim().min(1),
  liquidityUsdTenMinutesAgo: decimal.nullable(),
  developerRelatedSoldPercentage: decimal.nullable(),
  originatingTierASoldPercentage: decimal.nullable(),
  confirmingTierBSoldPercentages: z.tuple([decimal, decimal]).nullable(),
  dangerousSecurityChangeDetected: z.boolean().nullable(),
  priorFullExitPriceImpactPercentages: z.array(decimal).max(2),
  marketDataUnavailableSince: timestamp.nullable(),
  allChainAccessUnavailableSince: timestamp.nullable(),
  evidence: z.array(evidenceSchema),
  orderId: uuid,
  peakEventId: uuid,
  exitRequestedEventId: uuid,
});
const reconciliationSchema = z.object({
  stepId: z.string().trim().min(1),
  observationRequestedAt: timestamp,
  evaluatedAt: timestamp,
  wallet: z.string().trim().min(1),
  tokenMint: z.string().trim().min(1),
  eventId: uuid,
});

function encodeFact(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(encodeFact);
  if (typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeFact(item)]));
  throw new InvariantViolationError("Runtime fact snapshot is not JSON-compatible");
}

async function rollback(client: Pick<PoolClient, "query">): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}

function evidence(value: z.infer<typeof evidenceSchema>): EvidenceReference {
  return Object.freeze({
    id: asUuid<EvidenceId>(value.id),
    provider: value.provider as ProviderId,
    observedAt: asTimestamp(value.observedAt),
    sourceKey: value.sourceKey,
    ...(value.slot === undefined ? {} : { slot: BigInt(value.slot) as SolanaSlot }),
    ...(value.contentHash === undefined ? {} : { contentHash: value.contentHash }),
  });
}

abstract class PostgresRuntimeFactSource {
  protected constructor(private readonly database: DatabasePort) {}

  protected async load(
    checkpoint: PositionWorkerCheckpoint,
    phase: "monitor" | "reconcile",
  ): Promise<unknown> {
    const result = await this.database.query<FactRow>(
      `SELECT payload_json FROM position_runtime_facts
       WHERE position_id = $1 AND checkpoint_revision = $2 AND phase = $3`,
      [checkpoint.positionId, checkpoint.revision.toString(), phase],
    );
    if (result.rowCount !== 1 || result.rows[0] === undefined)
      throw new InvariantViolationError(
        `Exactly one ${phase} fact snapshot is required for the checkpoint revision`,
      );
    return result.rows[0].payload_json;
  }
}

export class PostgresPositionMonitoringFactsSource
  extends PostgresRuntimeFactSource
  implements PositionMonitoringFactsSource
{
  public constructor(database: Pick<Pool, "query">) {
    super(database);
  }

  public async loadFacts(checkpoint: PositionWorkerCheckpoint): Promise<PositionMonitoringFacts> {
    const parsed = monitoringSchema.safeParse(await this.load(checkpoint, "monitor"));
    if (!parsed.success) throw new InvariantViolationError("Monitoring fact snapshot is malformed");
    const value = parsed.data;
    if (value.positionId !== checkpoint.positionId)
      throw new InvariantViolationError("Monitoring facts target a different position");
    return Object.freeze({
      stepId: value.stepId,
      positionId: asUuid<PositionId>(value.positionId),
      tokenId: asUuid<TokenId>(value.tokenId),
      observationRequestedAt: asTimestamp(value.observationRequestedAt),
      evaluatedAt: asTimestamp(value.evaluatedAt),
      wallet: value.wallet as WalletAddress,
      tokenMint: value.tokenMint as MintAddress,
      settlementMint: value.settlementMint as MintAddress,
      liquidityUsdTenMinutesAgo:
        value.liquidityUsdTenMinutesAgo === null
          ? null
          : asDecimal(value.liquidityUsdTenMinutesAgo),
      developerRelatedSoldPercentage:
        value.developerRelatedSoldPercentage === null
          ? null
          : asDecimal(value.developerRelatedSoldPercentage),
      originatingTierASoldPercentage:
        value.originatingTierASoldPercentage === null
          ? null
          : asDecimal(value.originatingTierASoldPercentage),
      confirmingTierBSoldPercentages:
        value.confirmingTierBSoldPercentages === null
          ? null
          : (Object.freeze(value.confirmingTierBSoldPercentages.map(asDecimal)) as never),
      dangerousSecurityChangeDetected: value.dangerousSecurityChangeDetected,
      priorFullExitPriceImpactPercentages: Object.freeze(
        value.priorFullExitPriceImpactPercentages.map(asDecimal),
      ),
      marketDataUnavailableSince:
        value.marketDataUnavailableSince === null
          ? null
          : asTimestamp(value.marketDataUnavailableSince),
      allChainAccessUnavailableSince:
        value.allChainAccessUnavailableSince === null
          ? null
          : asTimestamp(value.allChainAccessUnavailableSince),
      evidence: Object.freeze(value.evidence.map(evidence)),
      orderId: asUuid<OrderId>(value.orderId),
      peakEventId: asUuid<AuditEventId>(value.peakEventId),
      exitRequestedEventId: asUuid<AuditEventId>(value.exitRequestedEventId),
    });
  }
}

export class PostgresPositionReconciliationFactsSource
  extends PostgresRuntimeFactSource
  implements PositionReconciliationFactsSource
{
  public constructor(database: Pick<Pool, "query">) {
    super(database);
  }

  public async loadFacts(
    checkpoint: PositionWorkerCheckpoint,
  ): Promise<PositionReconciliationFacts> {
    const parsed = reconciliationSchema.safeParse(await this.load(checkpoint, "reconcile"));
    if (!parsed.success)
      throw new InvariantViolationError("Reconciliation fact snapshot is malformed");
    const value = parsed.data;
    return Object.freeze({
      stepId: value.stepId,
      observationRequestedAt: asTimestamp(value.observationRequestedAt),
      evaluatedAt: asTimestamp(value.evaluatedAt),
      wallet: value.wallet as WalletAddress,
      tokenMint: value.tokenMint as MintAddress,
      eventId: asUuid<AuditEventId>(value.eventId),
    });
  }
}

export class PostgresPositionRuntimeFactPublisher {
  public constructor(private readonly database: TransactionalDatabasePort) {}

  public async publish(input: PublishPositionRuntimeFacts): Promise<void> {
    if (new Set(input.observationIds).size !== input.observationIds.length)
      throw new InvariantViolationError("Runtime fact observation IDs must be unique");
    const payload = encodeFact(input.facts);
    const parsed =
      input.phase === "monitor"
        ? monitoringSchema.safeParse(payload)
        : reconciliationSchema.safeParse(payload);
    if (!parsed.success)
      throw new InvariantViolationError(`${input.phase} runtime fact snapshot is malformed`);
    if ("positionId" in input.facts && input.facts.positionId !== input.checkpoint.positionId)
      throw new InvariantViolationError("Runtime facts target a different position");
    const evaluatedAt = input.facts.evaluatedAt;
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const checkpoint = await client.query<{ readonly version: string }>(
        "SELECT version FROM jobs WHERE id = $1 AND job_type = 'position_runtime' FOR SHARE",
        [input.checkpoint.positionId],
      );
      if (
        checkpoint.rowCount !== 1 ||
        checkpoint.rows[0]?.version.toString() !== input.checkpoint.revision.toString()
      )
        throw new InvariantViolationError("Runtime fact checkpoint revision is stale");
      const observations = await client.query<{ readonly id: string }>(
        `SELECT id FROM position_observations
         WHERE position_id = $1 AND id = ANY($2::uuid[]) AND observed_at <= $3`,
        [input.checkpoint.positionId, input.observationIds, evaluatedAt],
      );
      if (observations.rowCount !== input.observationIds.length)
        throw new InvariantViolationError(
          "Runtime facts require complete same-position non-future observations",
        );
      const inserted = await client.query<{ readonly id: string }>(
        `WITH inserted AS (
           INSERT INTO position_runtime_facts
             (id, position_id, checkpoint_revision, phase, payload_json)
           VALUES ($1, $2, $3, $4, $5::jsonb)
           ON CONFLICT (position_id, checkpoint_revision, phase) DO NOTHING
           RETURNING id
         )
         SELECT id FROM inserted
         UNION ALL
         SELECT id FROM position_runtime_facts
         WHERE id = $1 AND position_id = $2 AND checkpoint_revision = $3
           AND phase = $4 AND payload_json = $5::jsonb
         LIMIT 1`,
        [
          input.id,
          input.checkpoint.positionId,
          input.checkpoint.revision.toString(),
          input.phase,
          JSON.stringify(payload),
        ],
      );
      if (inserted.rowCount !== 1 || inserted.rows[0]?.id !== input.id)
        throw new InvariantViolationError(
          "Runtime fact snapshot conflicts with an existing publication",
        );
      for (const observationId of input.observationIds)
        await client.query(
          `INSERT INTO position_runtime_fact_observations (runtime_fact_id, observation_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [input.id, observationId],
        );
      await client.query("COMMIT");
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
