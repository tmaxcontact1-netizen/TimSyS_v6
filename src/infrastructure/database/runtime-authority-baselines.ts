import { createHash } from "node:crypto";

import type { Pool, QueryResult } from "pg";
import { z } from "zod";

import type {
  PositionRuntimeAuthorityBaseline,
  RuntimeAuthorityBaselineSink,
  RuntimeAuthorityBaselineSource,
} from "../../application/ports/runtime-authority-inputs.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import {
  asDecimal,
  asPercentage,
  asRawAmount,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type PositionId,
} from "../../domain/shared/types.js";

interface Row extends Record<string, unknown> {
  readonly captured_at: Date | string;
  readonly content_hash: string;
  readonly payload_json: unknown;
}

interface DatabasePort {
  query<RowValue extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<RowValue>>;
}

const evidence = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
  sourceKey: z.string().min(1),
  slot: z.string().regex(/^\d+$/).optional(),
  contentHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
});
const tracked = z.object({ wallet: z.string().min(1), entryBalanceRaw: z.string().regex(/^\d+$/) });
const security = z.object({
  observedAt: z.string().datetime({ offset: true }),
  evidence: z.array(evidence).min(1),
  directlyVerifiedOnChain: z.literal(true),
  program: z.enum(["spl_token", "token_2022", "unknown"]),
  mintAuthority: z.enum(["active", "revoked", "unknown"]),
  freezeAuthority: z.enum(["active", "revoked", "unknown"]),
  extensions: z.array(
    z.enum([
      "transfer_fee",
      "transfer_hook",
      "permanent_delegate",
      "pausable_transfer",
      "default_account_frozen",
      "unapproved",
    ]),
  ),
  extensionsVerified: z.boolean(),
  holders: z
    .object({
      topTenNormalPercentage: z.string(),
      largestNormalPercentage: z.string(),
      exclusionsVerified: z.boolean(),
    })
    .nullable(),
});
const schema = z
  .object({
    wallet: z.string().min(1),
    tokenMint: z.string().min(1),
    settlementMint: z.string().min(1),
    developerRelated: z.array(tracked),
    originatingTierA: tracked.nullable(),
    confirmingTierB: z.tuple([tracked, tracked]).nullable(),
    excludedHolderTokenAccounts: z.array(z.string().min(1)),
    entrySecurity: security,
    history: z.object({
      liquidityUsdTenMinutesAgo: z.string().nullable(),
      priorFullExitPriceImpactPercentages: z.array(z.string()).max(2),
      marketDataUnavailableSince: z.string().datetime({ offset: true }).nullable(),
      allChainAccessUnavailableSince: z.string().datetime({ offset: true }).nullable(),
      evidence: z.array(evidence),
    }),
  })
  .strict();

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object")
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  throw new InvariantViolationError("Authority baseline is not canonical JSON");
}

function evidencePayload(
  item: PositionRuntimeAuthorityBaseline["entrySecurity"]["evidence"][number],
) {
  return {
    id: item.id,
    provider: item.provider,
    observedAt: item.observedAt,
    sourceKey: item.sourceKey,
    ...(item.slot === undefined ? {} : { slot: item.slot.toString() }),
    ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
  };
}

function baselinePayload(baseline: PositionRuntimeAuthorityBaseline): z.infer<typeof schema> {
  const tracked = (item: PositionRuntimeAuthorityBaseline["developerRelated"][number]) => ({
    wallet: item.wallet,
    entryBalanceRaw: item.entryBalanceRaw.toString(),
  });
  const payload = {
    wallet: baseline.wallet,
    tokenMint: baseline.tokenMint,
    settlementMint: baseline.settlementMint,
    developerRelated: baseline.developerRelated.map(tracked),
    originatingTierA:
      baseline.originatingTierA === null ? null : tracked(baseline.originatingTierA),
    confirmingTierB:
      baseline.confirmingTierB === null
        ? null
        : [tracked(baseline.confirmingTierB[0]), tracked(baseline.confirmingTierB[1])],
    excludedHolderTokenAccounts: [...baseline.excludedHolderTokenAccounts].sort(),
    entrySecurity: {
      ...baseline.entrySecurity,
      evidence: baseline.entrySecurity.evidence.map(evidencePayload),
      holders:
        baseline.entrySecurity.holders === null
          ? null
          : {
              topTenNormalPercentage:
                baseline.entrySecurity.holders.topTenNormalPercentage.toString(),
              largestNormalPercentage:
                baseline.entrySecurity.holders.largestNormalPercentage.toString(),
              exclusionsVerified: baseline.entrySecurity.holders.exclusionsVerified,
            },
    },
    history: {
      liquidityUsdTenMinutesAgo: baseline.history.liquidityUsdTenMinutesAgo?.toString() ?? null,
      priorFullExitPriceImpactPercentages: baseline.history.priorFullExitPriceImpactPercentages.map(
        (value) => value.toString(),
      ),
      marketDataUnavailableSince: baseline.history.marketDataUnavailableSince,
      allChainAccessUnavailableSince: baseline.history.allChainAccessUnavailableSince,
      evidence: baseline.history.evidence.map(evidencePayload),
    },
  };
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new InvariantViolationError("Runtime authority baseline is malformed");
  if (baseline.entrySecurity.observedAt > baseline.capturedAt)
    throw new InvariantViolationError("Entry security evidence cannot be from the future");
  const allEvidence = [...baseline.entrySecurity.evidence, ...baseline.history.evidence];
  if (allEvidence.some(({ observedAt }) => observedAt > baseline.capturedAt))
    throw new InvariantViolationError("Authority baseline evidence cannot be from the future");
  return parsed.data;
}

export function prepareRuntimeAuthorityBaseline(baseline: PositionRuntimeAuthorityBaseline) {
  const serialized = canonical(baselinePayload(baseline));
  return Object.freeze({
    capturedAt: baseline.capturedAt,
    contentHash: createHash("sha256").update(serialized).digest("hex"),
    serialized,
  });
}

export class PostgresRuntimeAuthorityBaselineSource
  implements RuntimeAuthorityBaselineSource, RuntimeAuthorityBaselineSink
{
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async capture(
    positionId: PositionId,
    baseline: PositionRuntimeAuthorityBaseline,
  ): Promise<void> {
    const { capturedAt, contentHash, serialized } = prepareRuntimeAuthorityBaseline(baseline);
    const result = await (this.database as DatabasePort).query<Row>(
      `WITH inserted AS (
         INSERT INTO position_runtime_authority_baselines
           (position_id, captured_at, content_hash, payload_json)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (position_id) DO NOTHING
         RETURNING captured_at, content_hash, payload_json
       )
       SELECT * FROM inserted UNION ALL
       SELECT captured_at, content_hash, payload_json
       FROM position_runtime_authority_baselines WHERE position_id = $1 LIMIT 1`,
      [positionId, capturedAt, contentHash, serialized],
    );
    const row = result.rows[0];
    if (
      row === undefined ||
      new Date(row.captured_at).toISOString() !== baseline.capturedAt ||
      row.content_hash !== contentHash ||
      canonical(row.payload_json) !== serialized
    )
      throw new InvariantViolationError(
        "Runtime authority baseline conflicts with immutable evidence",
      );
  }

  public async load(positionId: string) {
    const result = (await this.database.query<Row>(
      `SELECT captured_at, content_hash, payload_json FROM position_runtime_authority_baselines WHERE position_id = $1`,
      [positionId],
    )) as QueryResult<Row>;
    const row = result.rows[0];
    if (result.rowCount !== 1 || row === undefined)
      throw new InvariantViolationError("Exactly one runtime authority baseline is required");
    const hash = createHash("sha256").update(canonical(row.payload_json)).digest("hex");
    if (hash !== row.content_hash)
      throw new InvariantViolationError("Runtime authority baseline hash mismatch");
    const parsed = schema.safeParse(row.payload_json);
    if (!parsed.success)
      throw new InvariantViolationError("Runtime authority baseline is malformed");
    const value = parsed.data;
    const mapEvidence = (item: z.infer<typeof evidence>) =>
      Object.freeze({
        id: asUuid<EvidenceId>(item.id),
        provider: item.provider as never,
        observedAt: asTimestamp(item.observedAt),
        sourceKey: item.sourceKey,
        ...(item.slot === undefined ? {} : { slot: BigInt(item.slot) as never }),
        ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
      });
    return Object.freeze({
      capturedAt: asTimestamp(
        row.captured_at instanceof Date ? row.captured_at : new Date(row.captured_at),
      ),
      wallet: value.wallet as never,
      tokenMint: value.tokenMint as never,
      settlementMint: value.settlementMint as never,
      developerRelated: Object.freeze(
        value.developerRelated.map((item) =>
          Object.freeze({
            wallet: item.wallet as never,
            entryBalanceRaw: asRawAmount(BigInt(item.entryBalanceRaw)),
          }),
        ),
      ),
      originatingTierA:
        value.originatingTierA === null
          ? null
          : Object.freeze({
              wallet: value.originatingTierA.wallet as never,
              entryBalanceRaw: asRawAmount(BigInt(value.originatingTierA.entryBalanceRaw)),
            }),
      confirmingTierB:
        value.confirmingTierB === null
          ? null
          : (Object.freeze(
              value.confirmingTierB.map((item) =>
                Object.freeze({
                  wallet: item.wallet as never,
                  entryBalanceRaw: asRawAmount(BigInt(item.entryBalanceRaw)),
                }),
              ),
            ) as never),
      excludedHolderTokenAccounts: new Set(value.excludedHolderTokenAccounts),
      entrySecurity: Object.freeze({
        ...value.entrySecurity,
        observedAt: asTimestamp(value.entrySecurity.observedAt),
        evidence: Object.freeze(value.entrySecurity.evidence.map(mapEvidence)),
        holders:
          value.entrySecurity.holders === null
            ? null
            : Object.freeze({
                topTenNormalPercentage: asPercentage(
                  value.entrySecurity.holders.topTenNormalPercentage,
                ),
                largestNormalPercentage: asPercentage(
                  value.entrySecurity.holders.largestNormalPercentage,
                ),
                exclusionsVerified: value.entrySecurity.holders.exclusionsVerified,
              }),
      }),
      history: Object.freeze({
        ...value.history,
        liquidityUsdTenMinutesAgo:
          value.history.liquidityUsdTenMinutesAgo === null
            ? null
            : asDecimal(value.history.liquidityUsdTenMinutesAgo),
        priorFullExitPriceImpactPercentages: Object.freeze(
          value.history.priorFullExitPriceImpactPercentages.map(asDecimal),
        ),
        marketDataUnavailableSince:
          value.history.marketDataUnavailableSince === null
            ? null
            : asTimestamp(value.history.marketDataUnavailableSince),
        allChainAccessUnavailableSince:
          value.history.allChainAccessUnavailableSince === null
            ? null
            : asTimestamp(value.history.allChainAccessUnavailableSince),
        evidence: Object.freeze(value.history.evidence.map(mapEvidence)),
      }),
    });
  }
}
