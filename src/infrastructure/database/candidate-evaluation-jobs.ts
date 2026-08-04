import type { PoolClient } from "pg";

import type {
  CandidateEvaluationLease,
  CandidateEvaluationWorkQueue,
} from "../../application/ports/repositories.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import { asUuid, type CandidateId, type Timestamp } from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

interface LeaseRow extends Record<string, unknown> {
  readonly id: string;
  readonly attempts: number;
  readonly mint_address: string;
}

function requireText(value: string, label: string): void {
  if (value.trim().length === 0) throw new InvariantViolationError(`${label} is required`);
}

function requireLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 1_000)
    throw new InvariantViolationError(
      "Candidate evaluation claim limit must be between 1 and 1000",
    );
}

/** Claims and hydrates candidate identity in one transaction without fabricating evaluation facts. */
export class PostgresCandidateEvaluationWorkQueue implements CandidateEvaluationWorkQueue {
  public constructor(private readonly database: DatabasePort) {}

  public async claim(input: {
    readonly ownerId: string;
    readonly now: Timestamp;
    readonly leaseExpiresAt: Timestamp;
    readonly limit: number;
  }): Promise<readonly CandidateEvaluationLease[]> {
    requireText(input.ownerId, "Candidate evaluation owner");
    requireLimit(input.limit);
    if (input.leaseExpiresAt <= input.now)
      throw new InvariantViolationError("Candidate evaluation lease must expire in the future");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<LeaseRow>(
        `WITH claimable AS (
           SELECT job.id FROM jobs AS job
           JOIN candidates AS candidate ON candidate.id=job.id
           WHERE job.job_type='candidate_evaluation' AND job.state='available' AND job.available_at <= $1
           ORDER BY job.available_at, job.id FOR UPDATE OF job SKIP LOCKED LIMIT $2
         ), leased AS (
           UPDATE jobs AS job SET state='leased', lease_owner=$3, lease_expires_at=$4,
             updated_at=$1, version=version+1
           FROM claimable WHERE job.id=claimable.id
           RETURNING job.id, job.attempts
         )
         SELECT leased.id, leased.attempts, candidate.mint_address
         FROM leased JOIN candidates AS candidate ON candidate.id=leased.id
         ORDER BY leased.id`,
        [input.now, input.limit, input.ownerId, input.leaseExpiresAt],
      );
      await client.query("COMMIT");
      return Object.freeze(
        result.rows.map((row) => {
          if (!Number.isSafeInteger(row.attempts) || row.attempts < 0)
            throw new InvariantViolationError(
              "Persisted candidate evaluation attempts are invalid",
            );
          const candidateId = asUuid<CandidateId>(row.id);
          return Object.freeze({
            candidateId,
            mint: asMintAddress(row.mint_address),
            evaluationRunId: `candidate-evaluation:${candidateId}:${row.attempts + 1}`,
            leaseOwner: input.ownerId,
            failedAttempts: row.attempts,
          });
        }),
      );
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }

  public async retry(input: {
    readonly lease: CandidateEvaluationLease;
    readonly availableAt: Timestamp;
    readonly reason: string;
  }): Promise<void> {
    requireText(input.reason, "Candidate evaluation retry reason");
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `UPDATE jobs SET state='available', attempts=attempts+1, available_at=$3,
           lease_owner=NULL, lease_expires_at=NULL,
           last_error_json=$4::jsonb, last_error_at=$3, updated_at=$3, version=version+1
         WHERE id=$1 AND job_type='candidate_evaluation' AND state='leased' AND lease_owner=$2`,
        [
          input.lease.candidateId,
          input.lease.leaseOwner,
          input.availableAt,
          JSON.stringify({ reason: input.reason }),
        ],
      );
      if (result.rowCount !== 1)
        throw new InvariantViolationError("Candidate evaluation lease is no longer owned");
    } finally {
      client.release();
    }
  }
}
