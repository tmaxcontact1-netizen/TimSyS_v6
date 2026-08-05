import { createHash } from "node:crypto";

import type { Pool, QueryResult } from "pg";
import { z } from "zod";

import type {
  RiskEvaluationFactSource,
  RiskEvaluationLease,
} from "../../application/services/risk-evaluation-work.js";
import type { CircuitBreakerSnapshot } from "../../domain/portfolio/breakers.js";
import { createPortfolioSnapshot, type PortfolioSnapshot } from "../../domain/portfolio/model.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  asPercentage,
  asSolanaSlot,
  asTimestamp,
  asUuid,
  type EvidenceId,
  type MintAddress,
  type ProviderId,
  type SignalId,
  type Timestamp,
} from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

interface SnapshotRow extends Record<string, unknown> {
  readonly signal_id: string;
  readonly mint_address: string;
  readonly observed_at: Date | string;
  readonly content_hash: string;
  readonly portfolio_json: unknown;
  readonly breakers_json: unknown;
  readonly evidence_json: unknown;
}

const decimal = z.string().refine((value) => {
  try {
    return !asNonNegativeDecimal(value).isNegative();
  } catch {
    return false;
  }
});
const integer = z.string().regex(/^\d+$/);
const timestamp = z.string().datetime({ offset: true });
const provider = z.enum([
  "solana_rpc",
  "helius",
  "jupiter",
  "dexscreener",
  "gmgn",
  "birdeye",
  "telegram",
]);
const evidenceSchema = z
  .object({
    id: z.string().uuid(),
    provider,
    observedAt: timestamp,
    sourceKey: z.string().trim().min(1),
    slot: integer.optional(),
    contentHash: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
const portfolioSchema = z
  .object({
    equitySol: decimal,
    uncommittedSol: decimal,
    openCostExposureSol: decimal,
    liquidityCapacitySol: decimal,
    estimatedEntryCostsSol: decimal,
    openPositionCount: integer,
    hasNonClosedPositionForMint: z.boolean(),
    hasConfirmedPriorClosure: z.boolean(),
    lastConfirmedClosureAt: timestamp.nullable(),
    usesLeverageOrBorrowing: z.boolean(),
    increasesLosingPosition: z.boolean(),
    requestedPositionPercentage: decimal.nullable(),
  })
  .strict();
const breakersSchema = z
  .object({
    utcDayStartingEquitySol: decimal,
    dailyRealizedLossSol: decimal,
    executableUnrealizedLossSol: decimal,
    rollingSevenDayDrawdownPercentage: decimal,
    highWaterDrawdownPercentage: decimal,
    consecutiveClosedLosingTrades: integer,
    reconciliationFailuresLast24Hours: integer,
    unauthorizedTransactionDetected: z.boolean(),
    authoritativeDisagreementDurationMs: integer,
  })
  .strict();

type PersistedPortfolio = z.infer<typeof portfolioSchema>;
type PersistedBreakers = z.infer<typeof breakersSchema>;

export interface PersistRiskAuthoritySnapshot {
  readonly signalId: SignalId;
  readonly mint: MintAddress;
  readonly observedAt: Timestamp;
  readonly evidence: readonly EvidenceReference[];
  readonly portfolio: Omit<PortfolioSnapshot, "observedAt" | "evidence" | "mint">;
  readonly breakers: Omit<CircuitBreakerSnapshot, "observedAt" | "evidence">;
}

function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  throw new InvariantViolationError("Risk authority contains a non-canonical value");
}

function iso(value: Date | string): Timestamp {
  return asTimestamp(value instanceof Date ? value : new Date(value));
}

function evidence(value: unknown): readonly EvidenceReference[] {
  const parsed = z.array(evidenceSchema).min(1).safeParse(value);
  if (!parsed.success) throw new InvariantViolationError("Risk authority evidence is malformed");
  return Object.freeze(
    parsed.data.map((item) =>
      Object.freeze({
        id: asUuid<EvidenceId>(item.id),
        provider: item.provider as ProviderId,
        observedAt: asTimestamp(item.observedAt),
        sourceKey: item.sourceKey,
        ...(item.slot === undefined ? {} : { slot: asSolanaSlot(BigInt(item.slot)) }),
        ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
      }),
    ),
  );
}

function persistedPortfolio(value: PortfolioSnapshot): PersistedPortfolio {
  if (
    value.equitySol === null ||
    value.uncommittedSol === null ||
    value.openCostExposureSol === null ||
    value.liquidityCapacitySol === null ||
    value.estimatedEntryCostsSol === null ||
    value.openPositionCount === null ||
    value.hasNonClosedPositionForMint === null ||
    value.hasConfirmedPriorClosure === null ||
    value.usesLeverageOrBorrowing === null ||
    value.increasesLosingPosition === null
  )
    throw new InvariantViolationError("Risk authority snapshot must be complete");
  return {
    equitySol: value.equitySol.toString(),
    uncommittedSol: value.uncommittedSol.toString(),
    openCostExposureSol: value.openCostExposureSol.toString(),
    liquidityCapacitySol: value.liquidityCapacitySol.toString(),
    estimatedEntryCostsSol: value.estimatedEntryCostsSol.toString(),
    openPositionCount: value.openPositionCount.toString(),
    hasNonClosedPositionForMint: value.hasNonClosedPositionForMint,
    hasConfirmedPriorClosure: value.hasConfirmedPriorClosure,
    lastConfirmedClosureAt: value.lastConfirmedClosureAt,
    usesLeverageOrBorrowing: value.usesLeverageOrBorrowing,
    increasesLosingPosition: value.increasesLosingPosition,
    requestedPositionPercentage: value.requestedPositionPercentage?.toString() ?? null,
  };
}

function persistedBreakers(value: CircuitBreakerSnapshot): PersistedBreakers {
  if (
    value.utcDayStartingEquitySol === null ||
    value.dailyRealizedLossSol === null ||
    value.executableUnrealizedLossSol === null ||
    value.rollingSevenDayDrawdownPercentage === null ||
    value.highWaterDrawdownPercentage === null ||
    value.consecutiveClosedLosingTrades === null ||
    value.reconciliationFailuresLast24Hours === null ||
    value.unauthorizedTransactionDetected === null ||
    value.authoritativeDisagreementDurationMs === null
  )
    throw new InvariantViolationError("Circuit-breaker authority snapshot must be complete");
  return {
    utcDayStartingEquitySol: value.utcDayStartingEquitySol.toString(),
    dailyRealizedLossSol: value.dailyRealizedLossSol.toString(),
    executableUnrealizedLossSol: value.executableUnrealizedLossSol.toString(),
    rollingSevenDayDrawdownPercentage: value.rollingSevenDayDrawdownPercentage.toString(),
    highWaterDrawdownPercentage: value.highWaterDrawdownPercentage.toString(),
    consecutiveClosedLosingTrades: value.consecutiveClosedLosingTrades.toString(),
    reconciliationFailuresLast24Hours: value.reconciliationFailuresLast24Hours.toString(),
    unauthorizedTransactionDetected: value.unauthorizedTransactionDetected,
    authoritativeDisagreementDurationMs: value.authoritativeDisagreementDurationMs.toString(),
  };
}

function hydrate(row: SnapshotRow, expected: RiskEvaluationLease) {
  if (asUuid<SignalId>(row.signal_id) !== expected.signalId)
    throw new InvariantViolationError("Risk authority belongs to a different signal");
  const mint = asMintAddress(row.mint_address);
  if (mint !== expected.mint)
    throw new InvariantViolationError("Risk authority belongs to a different mint");
  const observedAt = iso(row.observed_at);
  const references = evidence(row.evidence_json);
  if (references.some((item) => item.observedAt > observedAt))
    throw new InvariantViolationError("Risk evidence cannot postdate its snapshot");
  const portfolio = portfolioSchema.safeParse(row.portfolio_json);
  const breakers = breakersSchema.safeParse(row.breakers_json);
  if (!portfolio.success || !breakers.success)
    throw new InvariantViolationError("Risk authority snapshot is malformed");
  const payload = canonical({
    breakers: breakers.data,
    evidence: row.evidence_json,
    mint,
    observedAt,
    portfolio: portfolio.data,
    signalId: expected.signalId,
  });
  if (createHash("sha256").update(payload).digest("hex") !== row.content_hash)
    throw new InvariantViolationError("Risk authority content hash is invalid");
  const p = portfolio.data;
  const b = breakers.data;
  return Object.freeze({
    portfolio: createPortfolioSnapshot({
      observedAt,
      evidence: references,
      mint,
      equitySol: asNonNegativeDecimal(p.equitySol),
      uncommittedSol: asNonNegativeDecimal(p.uncommittedSol),
      openCostExposureSol: asNonNegativeDecimal(p.openCostExposureSol),
      liquidityCapacitySol: asNonNegativeDecimal(p.liquidityCapacitySol),
      estimatedEntryCostsSol: asNonNegativeDecimal(p.estimatedEntryCostsSol),
      openPositionCount: BigInt(p.openPositionCount),
      hasNonClosedPositionForMint: p.hasNonClosedPositionForMint,
      hasConfirmedPriorClosure: p.hasConfirmedPriorClosure,
      lastConfirmedClosureAt:
        p.lastConfirmedClosureAt === null ? null : asTimestamp(p.lastConfirmedClosureAt),
      usesLeverageOrBorrowing: p.usesLeverageOrBorrowing,
      increasesLosingPosition: p.increasesLosingPosition,
      requestedPositionPercentage:
        p.requestedPositionPercentage === null ? null : asPercentage(p.requestedPositionPercentage),
    }),
    breakers: Object.freeze({
      observedAt,
      evidence: references,
      utcDayStartingEquitySol: asNonNegativeDecimal(b.utcDayStartingEquitySol),
      dailyRealizedLossSol: asNonNegativeDecimal(b.dailyRealizedLossSol),
      executableUnrealizedLossSol: asNonNegativeDecimal(b.executableUnrealizedLossSol),
      rollingSevenDayDrawdownPercentage: asNonNegativeDecimal(b.rollingSevenDayDrawdownPercentage),
      highWaterDrawdownPercentage: asNonNegativeDecimal(b.highWaterDrawdownPercentage),
      consecutiveClosedLosingTrades: BigInt(b.consecutiveClosedLosingTrades),
      reconciliationFailuresLast24Hours: BigInt(b.reconciliationFailuresLast24Hours),
      unauthorizedTransactionDetected: b.unauthorizedTransactionDetected,
      authoritativeDisagreementDurationMs: BigInt(b.authoritativeDisagreementDurationMs),
    }),
  });
}

export class PostgresRiskAuthorityRepository implements RiskEvaluationFactSource {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async record(input: PersistRiskAuthoritySnapshot): Promise<void> {
    const portfolio = createPortfolioSnapshot({
      ...input.portfolio,
      observedAt: input.observedAt,
      evidence: input.evidence,
      mint: input.mint,
    });
    const portfolioJson = persistedPortfolio(portfolio);
    const breakersJson = persistedBreakers({
      ...input.breakers,
      observedAt: input.observedAt,
      evidence: input.evidence,
    });
    const evidenceJson = input.evidence.map((item) => ({
      id: item.id,
      provider: item.provider,
      observedAt: item.observedAt,
      sourceKey: item.sourceKey,
      ...(item.slot === undefined ? {} : { slot: item.slot.toString() }),
      ...(item.contentHash === undefined ? {} : { contentHash: item.contentHash }),
    }));
    const payload = canonical({
      breakers: breakersJson,
      evidence: evidenceJson,
      mint: input.mint,
      observedAt: input.observedAt,
      portfolio: portfolioJson,
      signalId: input.signalId,
    });
    const contentHash = createHash("sha256").update(payload).digest("hex");
    const result = await (this.database as DatabasePort).query(
      `INSERT INTO risk_authority_snapshots
         (signal_id, mint_address, observed_at, content_hash, portfolio_json, breakers_json, evidence_json)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb)
       ON CONFLICT (signal_id) DO NOTHING`,
      [
        input.signalId,
        input.mint,
        input.observedAt,
        contentHash,
        JSON.stringify(portfolioJson),
        JSON.stringify(breakersJson),
        JSON.stringify(evidenceJson),
      ],
    );
    if (result.rowCount !== 1)
      throw new InvariantViolationError("Risk authority already exists for this signal");
  }

  public async load(lease: RiskEvaluationLease) {
    const result = await (this.database as DatabasePort).query<SnapshotRow>(
      `SELECT signal_id, mint_address, observed_at, content_hash,
              portfolio_json, breakers_json, evidence_json
       FROM risk_authority_snapshots WHERE signal_id=$1`,
      [lease.signalId],
    );
    const row = result.rows[0];
    if (result.rowCount !== 1 || row === undefined)
      throw new InvariantViolationError("Complete risk authority is unavailable");
    return hydrate(row, lease);
  }
}
