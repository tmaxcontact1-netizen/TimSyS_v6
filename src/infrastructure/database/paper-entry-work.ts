import type { PoolClient } from "pg";

import type {
  PaperEntryLease,
  PaperEntryWorkQueue,
} from "../../application/services/paper-execution.js";
import type { PaperFill } from "../../application/services/paper-accounting.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";
import type { Timestamp } from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

function positionSizeLamports(value: string): bigint {
  if (!/^\d+(\.\d+)?$/.test(value))
    throw new InvariantViolationError("Paper entry position size is invalid");
  const [whole = "0", fraction = ""] = value.split(".");
  if (fraction.length > 9 && /[1-9]/.test(fraction.slice(9)))
    throw new InvariantViolationError("Paper entry position size exceeds lamport precision");
  const lamports = BigInt(whole) * 1_000_000_000n + BigInt((fraction + "000000000").slice(0, 9));
  if (lamports <= 0n) throw new InvariantViolationError("Paper entry size must be positive");
  return lamports;
}

export class PostgresPaperEntryWorkQueue implements PaperEntryWorkQueue {
  public constructor(private readonly database: DatabasePort) {}

  public async claim(input: {
    ownerId: string;
    now: Timestamp;
    leaseExpiresAt: Timestamp;
    limit: number;
  }): Promise<readonly PaperEntryLease[]> {
    if (input.ownerId.trim().length === 0)
      throw new TypeError("Paper entry lease owner is required");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        signal_id: string;
        risk_run_id: string;
        mint_address: string;
        position_size_sol: string;
      }>(
        `WITH claimable AS (
           SELECT j.id FROM jobs j
           JOIN entry_plans ep ON ep.signal_id=j.id AND ep.state='planned'
           WHERE j.job_type='entry_planning'
             AND ((j.state='available' AND j.available_at <= $1)
               OR (j.state='leased' AND j.lease_expires_at <= $1))
           ORDER BY j.available_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT $2
         )
         UPDATE jobs j SET state='leased',lease_owner=$3,lease_expires_at=$4,
           attempts=j.attempts+1,updated_at=$1,version=j.version+1
         FROM claimable q,entry_plans ep,signals s,candidates c
         WHERE j.id=q.id AND ep.signal_id=j.id AND s.id=j.id AND c.id=s.candidate_id
         RETURNING j.id::text AS signal_id,ep.risk_run_id,c.mint_address,
                   ep.position_size_sol::text`,
        [input.now, input.limit, input.ownerId, input.leaseExpiresAt],
      );
      await client.query("COMMIT");
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            signalId: row.signal_id,
            riskRunId: row.risk_run_id,
            tokenMint: asMintAddress(row.mint_address),
            inputAmountRaw: positionSizeLamports(row.position_size_sol),
            leaseOwner: input.ownerId,
          }),
        ),
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

  public async complete(input: { lease: PaperEntryLease; fill: PaperFill }): Promise<void> {
    if (
      input.fill.side !== "buy" ||
      input.fill.tokenMint !== input.lease.tokenMint ||
      input.fill.settlementAmountRaw !== input.lease.inputAmountRaw
    )
      throw new InvariantViolationError("Paper entry fill does not match its approval lease");
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO paper_entry_executions
          (signal_id,risk_run_id,fill_id,executed_at)
         VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [input.lease.signalId, input.lease.riskRunId, input.fill.id, input.fill.filledAt],
      );
      const plan = await client.query(
        `UPDATE entry_plans SET state='opened'
         WHERE signal_id=$1 AND risk_run_id=$2 AND state='planned'`,
        [input.lease.signalId, input.lease.riskRunId],
      );
      if (plan.rowCount !== 1) throw new Error("Paper entry completion requires one planned entry");
      const signal = await client.query(
        "UPDATE signals SET state='converted' WHERE id=$1 AND state='approval_pending'",
        [input.lease.signalId],
      );
      if (signal.rowCount !== 1)
        throw new Error("Paper entry completion requires one approved signal");
      const job = await client.query(
        `UPDATE jobs SET state='completed',lease_owner=NULL,lease_expires_at=NULL,
           updated_at=$3,version=version+1
         WHERE id=$1 AND job_type='entry_planning' AND state='leased' AND lease_owner=$2`,
        [input.lease.signalId, input.lease.leaseOwner, input.fill.filledAt],
      );
      if (job.rowCount !== 1) throw new Error("Paper entry completion requires the active lease");
      await client.query("COMMIT");
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
    lease: PaperEntryLease;
    availableAt: Timestamp;
    reason: string;
  }): Promise<void> {
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `UPDATE jobs SET state='available',lease_owner=NULL,lease_expires_at=NULL,
           available_at=$3,last_error_json=$4::jsonb,last_error_at=$3,
           updated_at=$3,version=version+1
         WHERE id=$1 AND job_type='entry_planning' AND state='leased' AND lease_owner=$2`,
        [
          input.lease.signalId,
          input.lease.leaseOwner,
          input.availableAt,
          JSON.stringify({ message: input.reason }),
        ],
      );
      if (result.rowCount !== 1) throw new Error("Paper entry retry requires the active lease");
    } finally {
      client.release();
    }
  }
}
