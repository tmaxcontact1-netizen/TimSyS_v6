import type { PoolClient } from "pg";

import type {
  ReconciliationJobFailure,
  ReconciliationJobLease,
  ReconciliationJobStore,
} from "../../application/ports/runtime.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { PositionId, Timestamp } from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

interface JobStateRow extends Record<string, unknown> {
  readonly attempts: number;
  readonly state: string;
  readonly available_at: Date | string;
}

const JOB_TYPE = "position_runtime";
const LOCK_NAMESPACE = "position-reconciliation";

function lockKey(positionId: PositionId): string {
  return `${LOCK_NAMESPACE}:${positionId}`;
}

function requireLease(lease: ReconciliationJobLease): void {
  if (lease.ownerId.trim().length === 0)
    throw new InvariantViolationError("Lease owner is required");
  if (!Number.isSafeInteger(lease.failedAttempts) || lease.failedAttempts < 0)
    throw new InvariantViolationError("Lease attempt count is invalid");
}

/** Holds a PostgreSQL session advisory lock for the complete reconciliation cycle. */
export class PostgresReconciliationJobStore implements ReconciliationJobStore {
  private readonly sessions = new Map<
    string,
    Readonly<{
      client: Pick<PoolClient, "query" | "release">;
      positionId: PositionId;
      failedAttempts: number;
    }>
  >();

  public constructor(private readonly database: DatabasePort) {}

  public async tryAcquire(input: {
    readonly positionId: PositionId;
    readonly ownerId: string;
    readonly now: Timestamp;
  }): Promise<ReconciliationJobLease | null> {
    if (input.ownerId.trim().length === 0)
      throw new InvariantViolationError("Lease owner is required");
    if (this.sessions.has(input.ownerId))
      throw new InvariantViolationError("Worker owner already holds a reconciliation lease");
    const client = await this.database.connect();
    try {
      const locked = await client.query<{ readonly locked: boolean }>(
        "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked",
        [lockKey(input.positionId)],
      );
      if (locked.rows[0]?.locked !== true) {
        client.release();
        return null;
      }
      const job = await client.query<JobStateRow>(
        `SELECT attempts, state, available_at FROM jobs
         WHERE id = $1 AND job_type = $2`,
        [input.positionId, JOB_TYPE],
      );
      const row = job.rows[0];
      const due =
        row !== undefined && new Date(row.available_at).getTime() <= new Date(input.now).getTime();
      if (row === undefined || row.state === "failed" || !due) {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
          lockKey(input.positionId),
        ]);
        client.release();
        return null;
      }
      if (!Number.isSafeInteger(row.attempts) || row.attempts < 0)
        throw new InvariantViolationError("Persisted reconciliation attempts are invalid");
      this.sessions.set(
        input.ownerId,
        Object.freeze({ client, positionId: input.positionId, failedAttempts: row.attempts }),
      );
      return Object.freeze({
        positionId: input.positionId,
        ownerId: input.ownerId,
        failedAttempts: row.attempts,
      });
    } catch (error) {
      try {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
          lockKey(input.positionId),
        ]);
      } catch {}
      client.release();
      throw error;
    }
  }

  private async finish(
    lease: ReconciliationJobLease,
    state: "available" | "completed" | "failed",
    availableAt: Timestamp | null,
    failure: ReconciliationJobFailure | null,
  ): Promise<void> {
    requireLease(lease);
    const session = this.sessions.get(lease.ownerId);
    if (session === undefined)
      throw new InvariantViolationError("Reconciliation lease is not held");
    const { client } = session;
    try {
      if (
        session.positionId !== lease.positionId ||
        session.failedAttempts !== lease.failedAttempts
      )
        throw new InvariantViolationError("Reconciliation lease does not match the held lock");
      const result = await client.query(
        `UPDATE jobs
         SET state = $3,
             attempts = attempts + $4,
             available_at = COALESCE($5::timestamptz, available_at),
             last_error_json = $7::jsonb,
             last_error_at = CASE WHEN $7::jsonb IS NULL THEN NULL ELSE $8::timestamptz END,
             updated_at = now()
         WHERE id = $1 AND job_type = $2 AND attempts = $6`,
        [
          lease.positionId,
          JOB_TYPE,
          state,
          failure === null ? 0 : 1,
          availableAt,
          lease.failedAttempts,
          failure === null ? null : JSON.stringify(failure),
          failure?.occurredAt ?? null,
        ],
      );
      if (result.rowCount !== 1)
        throw new InvariantViolationError("Reconciliation job concurrency conflict");
    } finally {
      this.sessions.delete(lease.ownerId);
      try {
        await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
          lockKey(lease.positionId),
        ]);
      } finally {
        client.release();
      }
    }
  }

  public complete(lease: ReconciliationJobLease): Promise<void> {
    return this.finish(lease, "completed", null, null);
  }

  public retry(
    lease: ReconciliationJobLease,
    availableAt: Timestamp,
    failure: ReconciliationJobFailure,
  ): Promise<void> {
    return this.finish(lease, "available", availableAt, failure);
  }

  public fail(lease: ReconciliationJobLease, failure: ReconciliationJobFailure): Promise<void> {
    return this.finish(lease, "failed", null, failure);
  }
}
