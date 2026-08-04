import { createHash } from "node:crypto";

import type { Pool, QueryResult } from "pg";

import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { EvidenceId, PositionId, ProviderId, Timestamp } from "../../domain/shared/types.js";

export type PositionObservationKind = "market" | "chain" | "wallet" | "security" | "execution";

export interface PositionObservationInput {
  readonly id: EvidenceId;
  readonly positionId: PositionId;
  readonly kind: PositionObservationKind;
  readonly provider: ProviderId;
  readonly sourceKey: string;
  readonly observedAt: Timestamp;
  readonly payload: Readonly<Record<string, unknown>>;
}

interface ObservationRow extends Record<string, unknown> {
  readonly id: string;
  readonly position_id: string;
  readonly observation_kind: string;
  readonly provider: string;
  readonly source_key: string;
  readonly observed_at: Date | string;
  readonly content_hash: string;
}

interface DatabasePort {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

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
  throw new InvariantViolationError("Observation payload is not JSON-compatible");
}

function iso(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

export class PostgresPositionObservationStore {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async ingest(input: PositionObservationInput): Promise<{ readonly contentHash: string }> {
    if (input.sourceKey.trim().length === 0)
      throw new InvariantViolationError("Observation source key is required");
    const canonicalPayload = canonicalize(input.payload);
    const contentHash = createHash("sha256").update(canonicalPayload).digest("hex");
    const result = await (this.database as DatabasePort).query<ObservationRow>(
      `INSERT INTO position_observations
         (id, position_id, observation_kind, provider, source_key, observed_at,
          content_hash, payload_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, position_id, observation_kind, provider, source_key, observed_at, content_hash`,
      [
        input.id,
        input.positionId,
        input.kind,
        input.provider,
        input.sourceKey,
        input.observedAt,
        contentHash,
        canonicalPayload,
      ],
    );
    const row = result.rows[0] ?? (await this.load(input.id));
    if (
      row.position_id !== input.positionId ||
      row.observation_kind !== input.kind ||
      row.provider !== input.provider ||
      row.source_key !== input.sourceKey ||
      iso(row.observed_at) !== iso(input.observedAt) ||
      row.content_hash !== contentHash
    )
      throw new InvariantViolationError("Observation identity conflicts with different evidence");
    return Object.freeze({ contentHash });
  }

  private async load(id: EvidenceId): Promise<ObservationRow> {
    const result = await (this.database as DatabasePort).query<ObservationRow>(
      `SELECT id, position_id, observation_kind, provider, source_key, observed_at, content_hash
       FROM position_observations WHERE id = $1`,
      [id],
    );
    if (result.rowCount !== 1 || result.rows[0] === undefined)
      throw new InvariantViolationError("Observation insert conflict could not be resolved");
    return result.rows[0];
  }
}
