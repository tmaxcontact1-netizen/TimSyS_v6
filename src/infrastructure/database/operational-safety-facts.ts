import { createHash } from "node:crypto";

import type { QueryResult } from "pg";

import type {
  ProviderDisagreementFactSource,
  ReconciliationFailureFactSource,
} from "../../application/services/live-operational-safety-sources.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asTimestamp,
  asUuid,
  type EvidenceId,
  type Timestamp,
  type WalletAddress,
} from "../../domain/shared/types.js";

interface DatabasePort {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

interface CountRow extends Record<string, unknown> {
  readonly failures: string;
  readonly latest_at: Date | string | null;
}

interface IntervalRow extends Record<string, unknown> {
  readonly began_at: Date | string;
  readonly opening_evidence_json: unknown;
}

function evidenceId(sourceKey: string, observedAt: Timestamp): EvidenceId {
  const hex = createHash("sha256").update(sourceKey).update(observedAt).digest("hex");
  return asUuid<EvidenceId>(
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`,
  );
}

function evidence(sourceKey: string, observedAt: Timestamp): EvidenceReference {
  return Object.freeze({
    id: evidenceId(sourceKey, observedAt),
    provider: "solana_rpc" as const,
    observedAt,
    sourceKey,
  });
}

/** Reconstructs the exact rolling failure count from immutable job-failure events. */
export class PostgresReconciliationFailureFactSource implements ReconciliationFailureFactSource {
  public constructor(
    private readonly database: DatabasePort,
    private readonly wallet: WalletAddress,
  ) {}

  public async observeFailures(requestedAt: Timestamp) {
    const windowStart = asTimestamp(new Date(Date.parse(requestedAt) - 86_400_000));
    const result = await this.database.query<CountRow>(
      `SELECT count(*)::text AS failures, max(occurred_at) AS latest_at
       FROM reconciliation_failure_events
       WHERE occurred_at > $1 AND occurred_at <= $2`,
      [windowStart, requestedAt],
    );
    const row = result.rows[0];
    if (row === undefined)
      throw new InvariantViolationError("Reconciliation failure authority is unavailable");
    const failures = BigInt(row.failures);
    const sourceKey = `reconciliation-failures:${this.wallet}:${windowStart}:${requestedAt}:${failures}`;
    return Object.freeze({
      wallet: this.wallet,
      observedAt: requestedAt,
      failuresLast24Hours: failures,
      evidence: Object.freeze([evidence(sourceKey, requestedAt)]),
    });
  }
}

export interface ProviderAgreementOutcome {
  readonly authorityKey: string;
  readonly wallet: WalletAddress;
  readonly observedAt: Timestamp;
  readonly agrees: boolean;
  readonly evidence: readonly EvidenceReference[];
}

/** Persists disagreement intervals and reconstructs their continuous duration after restart. */
export class PostgresProviderDisagreementAuthority implements ProviderDisagreementFactSource {
  public constructor(
    private readonly database: DatabasePort,
    private readonly wallet: WalletAddress,
  ) {}

  public async record(input: ProviderAgreementOutcome): Promise<void> {
    if (input.wallet !== this.wallet)
      throw new InvariantViolationError("Provider health targets another wallet");
    if (input.authorityKey.trim().length === 0 || input.evidence.length === 0)
      throw new InvariantViolationError("Provider health requires identity and evidence");
    if (input.evidence.some((item) => item.observedAt > input.observedAt))
      throw new InvariantViolationError("Provider health evidence cannot be postdated");
    if (input.agrees) {
      await this.database.query(
        `UPDATE provider_disagreement_intervals
         SET resolved_at=$3, closing_evidence_json=$4::jsonb
         WHERE authority_key=$1 AND wallet=$2 AND resolved_at IS NULL`,
        [input.authorityKey, input.wallet, input.observedAt, JSON.stringify(input.evidence)],
      );
      return;
    }
    await this.database.query(
      `INSERT INTO provider_disagreement_intervals
         (authority_key,wallet,began_at,opening_evidence_json)
       VALUES ($1,$2,$3,$4::jsonb)
       ON CONFLICT (authority_key,wallet) WHERE resolved_at IS NULL DO NOTHING`,
      [input.authorityKey, input.wallet, input.observedAt, JSON.stringify(input.evidence)],
    );
  }

  public async observeHealth(requestedAt: Timestamp) {
    const result = await this.database.query<IntervalRow>(
      `SELECT began_at, opening_evidence_json
       FROM provider_disagreement_intervals
       WHERE wallet=$1 AND resolved_at IS NULL AND began_at <= $2
       ORDER BY began_at ASC LIMIT 1`,
      [this.wallet, requestedAt],
    );
    const row = result.rows[0];
    const beganAt = row === undefined ? requestedAt : asTimestamp(row.began_at);
    const duration = BigInt(Date.parse(requestedAt) - Date.parse(beganAt));
    const sourceKey = `provider-health:${this.wallet}:${beganAt}:${requestedAt}`;
    return Object.freeze({
      wallet: this.wallet,
      observedAt: requestedAt,
      authoritativeDisagreementDurationMs: duration,
      evidence: Object.freeze([evidence(sourceKey, requestedAt)]),
    });
  }
}
