import { createHash } from "node:crypto";

import { Decimal } from "decimal.js";
import type { PoolClient, QueryResult } from "pg";

import type {
  AcknowledgePositionAction,
  InitializePositionWorkerCheckpoint,
  PendingPositionAction,
  PositionOpeningRepository,
  PositionWorkerCheckpoint,
  PositionWorkerCheckpointRepository,
  SavePositionWorkerTransition,
} from "../../application/ports/repositories.js";
import { restorePositionRuntimeState } from "../../application/services/position-monitor.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asUuid, type PositionId } from "../../domain/shared/types.js";
import type { PositionEvent } from "../../domain/trading/position.js";
import { prepareRuntimeAuthorityBaseline } from "./runtime-authority-baselines.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<Row>>;
}

type EncodedValue =
  | null
  | boolean
  | number
  | string
  | readonly EncodedValue[]
  | { readonly [key: string]: EncodedValue };

interface JobRow extends Record<string, unknown> {
  readonly id: string;
  readonly version: string | number | bigint;
  readonly payload_json: unknown;
}

const JOB_TYPE = "position_runtime";

function encode(value: unknown): EncodedValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (typeof value === "bigint") return { $type: "bigint", value: value.toString() };
  if (value instanceof Decimal) return { $type: "decimal", value: value.toString() };
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  throw new InvariantViolationError(`Unsupported persisted value type: ${typeof value}`);
}

function decode(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  )
    return value;
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value !== "object")
    throw new InvariantViolationError("Persisted JSON contains an unsupported value");
  const record = value as Record<string, unknown>;
  if (record.$type === "bigint" && typeof record.value === "string" && /^-?\d+$/.test(record.value))
    return BigInt(record.value);
  if (record.$type === "decimal" && typeof record.value === "string") {
    const decimal = new Decimal(record.value);
    if (!decimal.isFinite()) throw new InvariantViolationError("Persisted decimal must be finite");
    return decimal;
  }
  if ("$type" in record)
    throw new InvariantViolationError("Persisted JSON contains an invalid type tag");
  return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, decode(item)]));
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new InvariantViolationError(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function serializePayload(input: {
  readonly positionId: PositionId;
  readonly runtimeState: PositionWorkerCheckpoint["runtimeState"];
  readonly pendingAction: PendingPositionAction | null;
}): EncodedValue {
  restorePositionRuntimeState(input.runtimeState);
  return encode({
    positionId: input.positionId,
    runtimeState: input.runtimeState,
    pendingAction: input.pendingAction,
  });
}

function checkpointFromRow(row: JobRow): PositionWorkerCheckpoint {
  const payload = requireObject(decode(row.payload_json), "Checkpoint payload");
  if (typeof payload.positionId !== "string")
    throw new InvariantViolationError("Checkpoint position ID is invalid");
  const positionId = asUuid<PositionId>(payload.positionId);
  const runtimeState = restorePositionRuntimeState(
    requireObject(
      payload.runtimeState,
      "Checkpoint runtime state",
    ) as unknown as PositionWorkerCheckpoint["runtimeState"],
  );
  const pendingAction =
    payload.pendingAction === null
      ? null
      : (requireObject(
          payload.pendingAction,
          "Pending action",
        ) as unknown as PendingPositionAction);
  const revision = BigInt(row.version);
  if (revision < 0n) throw new InvariantViolationError("Checkpoint revision must be non-negative");
  return Object.freeze({ positionId, revision, runtimeState, pendingAction });
}

function eventHash(previousHash: string, event: PositionEvent): string {
  return createHash("sha256")
    .update(previousHash)
    .update(JSON.stringify(encode(event)))
    .digest("hex");
}

async function rollback(client: Pick<PoolClient, "query">): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}

export class PostgresPositionWorkerCheckpointRepository
  implements PositionOpeningRepository, PositionWorkerCheckpointRepository
{
  public constructor(private readonly database: DatabasePort) {}

  public async initialize(
    checkpoint: InitializePositionWorkerCheckpoint,
  ): Promise<PositionWorkerCheckpoint> {
    const runtimeState = restorePositionRuntimeState(checkpoint.runtimeState);
    const position = runtimeState.lifecycle.position;
    if (position === null || position.id !== checkpoint.positionId)
      throw new InvariantViolationError("Position opening requires the reconciled position");
    if (checkpoint.authorityBaseline.capturedAt < position.openedAt)
      throw new InvariantViolationError("Authority baseline cannot predate the opened position");
    const baseline = prepareRuntimeAuthorityBaseline(checkpoint.authorityBaseline);
    const payload = serializePayload({ ...checkpoint, pendingAction: null });
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO position_runtime_contexts
           (position_id, token_id, wallet, token_mint, settlement_mint)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          checkpoint.positionId,
          position.tokenId,
          checkpoint.authorityBaseline.wallet,
          checkpoint.authorityBaseline.tokenMint,
          checkpoint.authorityBaseline.settlementMint,
        ],
      );
      await client.query(
        `INSERT INTO position_runtime_authority_baselines
           (position_id, captured_at, content_hash, payload_json)
         VALUES ($1, $2, $3, $4::jsonb)`,
        [checkpoint.positionId, baseline.capturedAt, baseline.contentHash, baseline.serialized],
      );
      const result = await client.query<JobRow>(
        `INSERT INTO jobs
           (id, job_type, idempotency_key, payload_json, state, version)
         VALUES ($1, $2, $3, $4::jsonb, 'available', 0)
         RETURNING id, version, payload_json`,
        [
          checkpoint.positionId,
          JOB_TYPE,
          `${JOB_TYPE}:${checkpoint.positionId}`,
          JSON.stringify(payload),
        ],
      );
      if (result.rowCount !== 1 || result.rows[0] === undefined)
        throw new InvariantViolationError("Position worker checkpoint was not initialized");
      await client.query("COMMIT");
      return checkpointFromRow(result.rows[0]);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async load(positionId: PositionId): Promise<PositionWorkerCheckpoint> {
    const result = await this.database.query<JobRow>(
      "SELECT id, version, payload_json FROM jobs WHERE id = $1 AND job_type = $2",
      [positionId, JOB_TYPE],
    );
    if (result.rowCount !== 1 || result.rows[0] === undefined)
      throw new InvariantViolationError("Position worker checkpoint was not found");
    const checkpoint = checkpointFromRow(result.rows[0]);
    if (checkpoint.positionId !== positionId)
      throw new InvariantViolationError("Loaded checkpoint belongs to a different position");
    return checkpoint;
  }

  public async saveTransition(
    input: SavePositionWorkerTransition,
  ): Promise<PositionWorkerCheckpoint> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const payload = serializePayload(input);
      const updated = await client.query<JobRow>(
        `UPDATE jobs
         SET payload_json = $3::jsonb, state = 'available', available_at = now(),
             lease_owner = NULL, lease_expires_at = NULL, updated_at = now(), version = version + 1
         WHERE id = $1 AND job_type = $2 AND version = $4
           AND (payload_json -> 'pendingAction') = 'null'::jsonb
         RETURNING id, version, payload_json`,
        [input.positionId, JOB_TYPE, JSON.stringify(payload), input.expectedRevision.toString()],
      );
      if (updated.rowCount !== 1 || updated.rows[0] === undefined)
        throw new InvariantViolationError("Position checkpoint concurrency conflict");
      for (const event of input.emittedEvents) {
        if (event.positionId !== input.positionId)
          throw new InvariantViolationError("Position event targets a different checkpoint");
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('position-worker', 0))");
        const previous = await client.query<{ readonly after_hash: string }>(
          `SELECT after_hash FROM audit_events
           WHERE actor_type = 'worker' AND actor_id = 'position-worker'
           ORDER BY created_at DESC, id DESC LIMIT 1`,
        );
        const beforeHash = previous.rows[0]?.after_hash ?? "0".repeat(64);
        const afterHash = eventHash(beforeHash, event);
        await client.query(
          `INSERT INTO audit_events
             (id, occurred_at, actor_type, actor_id, event_type, entity_type, entity_id,
              cause_id, before_hash, after_hash, details_json)
           VALUES ($1, $2, 'worker', 'position-worker', $3, 'position', $4, $5, $6, $7, $8::jsonb)`,
          [
            event.eventId,
            event.occurredAt,
            event.type,
            event.positionId,
            input.pendingAction.actionId,
            beforeHash,
            afterHash,
            JSON.stringify(encode(event)),
          ],
        );
      }
      await client.query("COMMIT");
      return checkpointFromRow(updated.rows[0]);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async acknowledgeAction(
    input: AcknowledgePositionAction,
  ): Promise<PositionWorkerCheckpoint> {
    const runtimeState = restorePositionRuntimeState(input.runtimeState);
    if (runtimeState.lifecycle.position?.id !== input.positionId)
      throw new InvariantViolationError("Acknowledged runtime targets a different position");
    const payload = serializePayload({
      positionId: input.positionId,
      runtimeState,
      pendingAction: null,
    });
    const result = await this.database.query<JobRow>(
      `UPDATE jobs
       SET payload_json = $5::jsonb,
           state = 'completed', updated_at = now(), version = version + 1
       WHERE id = $1 AND job_type = $2 AND version = $3
         AND payload_json #>> '{pendingAction,deliveryId}' = $4
       RETURNING id, version, payload_json`,
      [
        input.positionId,
        JOB_TYPE,
        input.expectedRevision.toString(),
        input.deliveryId,
        JSON.stringify(payload),
      ],
    );
    if (result.rowCount !== 1 || result.rows[0] === undefined)
      throw new InvariantViolationError("Position action acknowledgement conflict");
    return checkpointFromRow(result.rows[0]);
  }
}
