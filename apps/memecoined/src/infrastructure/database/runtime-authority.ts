import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";
import type { Pool, QueryResult } from "pg";
import { z } from "zod";

import type { PositionWorkerCheckpoint } from "../../application/ports/repositories.js";
import type {
  LivePositionObservationContext,
  LivePositionObservationContextSource,
  AuthoritativeRuntimeFactSource,
} from "../../application/services/live-runtime-fact-sources.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  type EvidenceId,
  type MintAddress,
  type PositionId,
  type ProviderId,
  type Timestamp,
  type TokenId,
  type WalletAddress,
} from "../../domain/shared/types.js";

type AuthorityKind = "wallet" | "security" | "execution";
type AuthorityPhase = "monitor" | "reconcile";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface ContextRow extends Record<string, unknown> {
  readonly position_id: string;
  readonly token_id: string;
  readonly wallet: string;
  readonly token_mint: string;
  readonly settlement_mint: string;
}

interface SnapshotRow extends Record<string, unknown> {
  readonly id: string;
  readonly provider: string;
  readonly source_key: string;
  readonly observed_at: Date | string;
  readonly content_hash: string;
  readonly payload_json: unknown;
}

const decimal = z.string().refine((value) => new Decimal(value).isFinite(), "invalid decimal");
const timestamp = z.string().datetime({ offset: true });
const uuid = z.string().uuid();
const evidence = z.object({
  id: uuid,
  provider: z.string().trim().min(1),
  observedAt: timestamp,
  sourceKey: z.string().trim().min(1),
  slot: z.string().regex(/^\d+$/).optional(),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
const walletMonitoring = z
  .object({
    developerRelatedSoldPercentage: decimal.nullable(),
    originatingTierASoldPercentage: decimal.nullable(),
    confirmingTierBSoldPercentages: z.tuple([decimal, decimal]).nullable(),
  })
  .strict();
const securityMonitoring = z
  .object({ dangerousSecurityChangeDetected: z.boolean().nullable() })
  .strict();
const executionMonitoring = z
  .object({
    stepId: z.string().trim().min(1),
    positionId: uuid,
    tokenId: uuid,
    observationRequestedAt: timestamp,
    evaluatedAt: timestamp,
    wallet: z.string().trim().min(1),
    tokenMint: z.string().trim().min(1),
    settlementMint: z.string().trim().min(1),
    liquidityUsdTenMinutesAgo: decimal.nullable(),
    priorFullExitPriceImpactPercentages: z.array(decimal).max(2),
    marketDataUnavailableSince: timestamp.nullable(),
    allChainAccessUnavailableSince: timestamp.nullable(),
    evidence: z.array(evidence),
    orderId: uuid,
    peakEventId: uuid,
    exitRequestedEventId: uuid,
  })
  .strict();
const executionReconciliation = z
  .object({
    stepId: z.string().trim().min(1),
    observationRequestedAt: timestamp,
    evaluatedAt: timestamp,
    wallet: z.string().trim().min(1),
    tokenMint: z.string().trim().min(1),
    eventId: uuid,
  })
  .strict();

function canonicalize(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  throw new InvariantViolationError("Runtime authority payload is not JSON-compatible");
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function schema(kind: AuthorityKind, phase: AuthorityPhase): z.ZodType {
  if (phase === "reconcile") {
    if (kind !== "execution")
      throw new InvariantViolationError("Only execution authority can supply reconciliation facts");
    return executionReconciliation;
  }
  if (kind === "wallet") return walletMonitoring;
  if (kind === "security") return securityMonitoring;
  return executionMonitoring;
}

export interface PositionRuntimeContextInput extends LivePositionObservationContext {
  readonly positionId: PositionId;
  readonly tokenId: TokenId;
  readonly settlementMint: MintAddress;
}

export interface PositionRuntimeAuthoritySnapshotInput {
  readonly id: EvidenceId;
  readonly positionId: PositionId;
  readonly checkpointRevision: bigint;
  readonly phase: AuthorityPhase;
  readonly kind: AuthorityKind;
  readonly provider: ProviderId;
  readonly sourceKey: string;
  readonly observedAt: Timestamp;
  readonly facts: Readonly<Record<string, unknown>>;
}

/** Stores immutable, revision-bound output from completed authority pipelines. */
export class PostgresPositionRuntimeAuthorityRepository implements LivePositionObservationContextSource {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async registerContext(input: PositionRuntimeContextInput): Promise<void> {
    const result = await (this.database as DatabasePort).query<ContextRow>(
      `WITH inserted AS (
         INSERT INTO position_runtime_contexts
           (position_id, token_id, wallet, token_mint, settlement_mint)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (position_id) DO NOTHING
         RETURNING position_id, token_id, wallet, token_mint, settlement_mint
       )
       SELECT * FROM inserted UNION ALL
       SELECT position_id, token_id, wallet, token_mint, settlement_mint
       FROM position_runtime_contexts WHERE position_id = $1 LIMIT 1`,
      [input.positionId, input.tokenId, input.wallet, input.tokenMint, input.settlementMint],
    );
    const row = result.rows[0];
    if (
      row === undefined ||
      row.position_id !== input.positionId ||
      row.token_id !== input.tokenId ||
      row.wallet !== input.wallet ||
      row.token_mint !== input.tokenMint ||
      row.settlement_mint !== input.settlementMint
    )
      throw new InvariantViolationError(
        "Position runtime context conflicts with immutable authority",
      );
  }

  public async load(checkpoint: PositionWorkerCheckpoint): Promise<LivePositionObservationContext> {
    const result = await (this.database as DatabasePort).query<ContextRow>(
      `SELECT position_id, token_id, wallet, token_mint, settlement_mint
       FROM position_runtime_contexts WHERE position_id = $1`,
      [checkpoint.positionId],
    );
    const row = result.rows[0];
    if (result.rowCount !== 1 || row === undefined)
      throw new InvariantViolationError("Exactly one position runtime context is required");
    const position = checkpoint.runtimeState.lifecycle.position;
    if (
      position === null ||
      position.id !== checkpoint.positionId ||
      row.token_id !== position.tokenId
    )
      throw new InvariantViolationError("Position runtime context does not match the checkpoint");
    return Object.freeze({
      wallet: row.wallet as WalletAddress,
      tokenMint: row.token_mint as MintAddress,
    });
  }

  public async recordSnapshot(input: PositionRuntimeAuthoritySnapshotInput): Promise<void> {
    if (input.checkpointRevision < 0n)
      throw new InvariantViolationError("Authority checkpoint revision must be non-negative");
    const parsed = schema(input.kind, input.phase).safeParse(input.facts);
    if (!parsed.success)
      throw new InvariantViolationError("Runtime authority snapshot is malformed");
    const payload = canonicalize(parsed.data);
    const contentHash = createHash("sha256").update(payload).digest("hex");
    const result = await (this.database as DatabasePort).query<SnapshotRow>(
      `WITH inserted AS (
         INSERT INTO position_runtime_authority_snapshots
           (id, position_id, checkpoint_revision, phase, authority_kind, provider,
            source_key, observed_at, content_hash, payload_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
         ON CONFLICT (position_id, checkpoint_revision, phase, authority_kind) DO NOTHING
         RETURNING id, provider, source_key, observed_at, content_hash, payload_json
       )
       SELECT * FROM inserted UNION ALL
       SELECT id, provider, source_key, observed_at, content_hash, payload_json
       FROM position_runtime_authority_snapshots
       WHERE position_id = $2 AND checkpoint_revision = $3 AND phase = $4 AND authority_kind = $5
       LIMIT 1`,
      [
        input.id,
        input.positionId,
        input.checkpointRevision.toString(),
        input.phase,
        input.kind,
        input.provider,
        input.sourceKey,
        input.observedAt,
        contentHash,
        payload,
      ],
    );
    const row = result.rows[0];
    if (
      row === undefined ||
      row.id !== input.id ||
      row.provider !== input.provider ||
      row.source_key !== input.sourceKey ||
      iso(row.observed_at) !== iso(input.observedAt) ||
      row.content_hash !== contentHash ||
      canonicalize(row.payload_json) !== payload
    )
      throw new InvariantViolationError(
        "Runtime authority snapshot conflicts with existing evidence",
      );
  }

  public source(kind: AuthorityKind, provider: ProviderId): AuthoritativeRuntimeFactSource {
    return Object.freeze({
      kind,
      provider,
      load: (checkpoint: PositionWorkerCheckpoint, observedAt: Timestamp) =>
        this.loadSnapshot(checkpoint, observedAt, kind, provider),
    });
  }

  private async loadSnapshot(
    checkpoint: PositionWorkerCheckpoint,
    observedAt: Timestamp,
    kind: AuthorityKind,
    provider: ProviderId,
  ): Promise<{ readonly sourceKey: string; readonly facts: Readonly<Record<string, unknown>> }> {
    const phase = checkpoint.runtimeState.pendingExit === null ? "monitor" : "reconcile";
    const result = await (this.database as DatabasePort).query<SnapshotRow>(
      `SELECT id, provider, source_key, observed_at, content_hash, payload_json
       FROM position_runtime_authority_snapshots
       WHERE position_id = $1 AND checkpoint_revision = $2 AND phase = $3 AND authority_kind = $4
         AND observed_at <= $5`,
      [checkpoint.positionId, checkpoint.revision.toString(), phase, kind, observedAt],
    );
    const row = result.rows[0];
    if (result.rowCount !== 1 || row === undefined)
      throw new InvariantViolationError(`Exactly one ${kind} authority snapshot is required`);
    if (row.provider !== provider)
      throw new InvariantViolationError(`${kind} authority provider does not match configuration`);
    const parsed = schema(kind, phase).safeParse(row.payload_json);
    if (!parsed.success)
      throw new InvariantViolationError(`${kind} authority snapshot is malformed`);
    return Object.freeze({ sourceKey: row.source_key, facts: Object.freeze(parsed.data) });
  }
}
