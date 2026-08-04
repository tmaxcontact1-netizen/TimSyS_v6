import { Decimal } from "decimal.js";
import type { Pool, QueryResult } from "pg";
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
