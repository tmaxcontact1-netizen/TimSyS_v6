import type { PoolClient } from "pg";

import type {
  RiskEvaluationLease,
  RiskEvaluationWorkQueue,
} from "../../application/services/risk-evaluation-work.js";
import { deterministicRiskRunId } from "../../application/services/risk-evaluation-work.js";
import { asTimestamp, asUuid, type SignalId } from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresRiskEvaluationWorkQueue implements RiskEvaluationWorkQueue {
  public constructor(private readonly database: DatabasePort) {}

  public async claim(input: {
    readonly ownerId: string;
    readonly now: ReturnType<typeof asTimestamp>;
    readonly leaseExpiresAt: ReturnType<typeof asTimestamp>;
    readonly limit: number;
  }): Promise<readonly RiskEvaluationLease[]> {
    if (input.ownerId.trim().length === 0) throw new TypeError("Risk lease owner is required");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ signal_id: string; mint_address: string }>(
        `WITH claimable AS (
           SELECT j.id
           FROM jobs j
           JOIN signals s ON s.id=j.id AND s.state='eligible'
           JOIN candidates c ON c.id=s.candidate_id
           WHERE j.job_type='risk_evaluation'
             AND ((j.state='available' AND j.available_at <= $1)
               OR (j.state='leased' AND j.lease_expires_at <= $1))
           ORDER BY j.available_at, j.id
           FOR UPDATE OF j SKIP LOCKED
           LIMIT $2
         )
         UPDATE jobs j
         SET state='leased', lease_owner=$3, lease_expires_at=$4,
             attempts=j.attempts+1, updated_at=$1, version=j.version+1
         FROM claimable q, signals s, candidates c
         WHERE j.id=q.id AND s.id=j.id AND c.id=s.candidate_id
         RETURNING j.id::text AS signal_id, c.mint_address`,
        [input.now, input.limit, input.ownerId, input.leaseExpiresAt],
      );
      await client.query("COMMIT");
      return Object.freeze(
        result.rows.map((row) => {
          const signalId = asUuid<SignalId>(row.signal_id);
          return Object.freeze({
            signalId,
            mint: asMintAddress(row.mint_address),
            leaseOwner: input.ownerId,
            riskRunId: deterministicRiskRunId(signalId),
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
    readonly lease: RiskEvaluationLease;
    readonly availableAt: ReturnType<typeof asTimestamp>;
    readonly reason: string;
  }): Promise<void> {
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `UPDATE jobs SET state='available', lease_owner=NULL, lease_expires_at=NULL,
           available_at=$3, last_error_json=$4::jsonb, last_error_at=$3,
           updated_at=$3, version=version+1
         WHERE id=$1 AND job_type='risk_evaluation' AND state='leased' AND lease_owner=$2`,
        [
          input.lease.signalId,
          input.lease.leaseOwner,
          input.availableAt,
          JSON.stringify({ message: input.reason }),
        ],
      );
      if (result.rowCount !== 1) throw new Error("Risk retry requires the active lease");
    } finally {
      client.release();
    }
  }
}
