import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

import type {
  OperatorApprovalRequest,
  OperatorApprovalStore,
} from "../../application/services/operator-approval.js";
import { InvariantViolationError } from "../../domain/shared/errors.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

function eventHash(parts: readonly (string | null)[]): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export class PostgresOperatorApprovalStore implements OperatorApprovalStore {
  public constructor(private readonly database: DatabasePort) {}

  public async request(input: OperatorApprovalRequest): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO operator_approvals
          (id,action_type,target_type,target_id,payload_hash,eligibility_hash,
           quote_fingerprint,nonce_hash,state,requested_by,requested_at,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10,$11) ON CONFLICT DO NOTHING`,
        [
          input.id,
          input.actionType,
          input.targetType,
          input.targetId,
          input.payloadHash,
          input.eligibilityHash,
          input.quoteFingerprint,
          input.nonceHash,
          input.requestedBy,
          input.requestedAt,
          input.expiresAt,
        ],
      );
      if (inserted.rowCount !== 1)
        throw new InvariantViolationError("An approval already exists for this exact action");
      await client.query(
        `INSERT INTO operator_approval_events
          (id,approval_id,event_type,actor_id,occurred_at,content_hash)
         VALUES ($1,$2,'requested',$3,$4,$5)`,
        [
          randomUUID(),
          input.id,
          input.requestedBy,
          input.requestedAt,
          eventHash([input.id, "requested", input.requestedBy, input.requestedAt, input.payloadHash]),
        ],
      );
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

  public async decide(input: Parameters<OperatorApprovalStore["decide"]>[0]): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const state = input.decision === "approve" ? "approved" : "rejected";
      const updated = await client.query(
        `UPDATE operator_approvals
            SET state=$3,decided_by=$4,decided_at=$5,reason=$6,version=version+1
          WHERE id=$1 AND nonce_hash=$2 AND state='pending' AND expires_at >= $5`,
        [input.id, input.nonceHash, state, input.actorId, input.decidedAt, input.reason],
      );
      if (updated.rowCount !== 1)
        throw new InvariantViolationError("Approval is absent, expired, replayed, or has changed");
      await client.query(
        `INSERT INTO operator_approval_events
          (id,approval_id,event_type,actor_id,occurred_at,content_hash)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          randomUUID(),
          input.id,
          state,
          input.actorId,
          input.decidedAt,
          eventHash([input.id, state, input.actorId, input.decidedAt, input.reason]),
        ],
      );
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

  public async consume(input: Parameters<OperatorApprovalStore["consume"]>[0]): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const updated = await client.query(
        `UPDATE operator_approvals
            SET state='consumed',consumed_at=$6,version=version+1
          WHERE id=$1 AND state='approved'
            AND payload_hash=$2 AND eligibility_hash=$3
            AND quote_fingerprint IS NOT DISTINCT FROM $4
            AND expires_at >= $5 AND decided_by IS NOT NULL`,
        [
          input.id,
          input.payloadHash,
          input.eligibilityHash,
          input.quoteFingerprint,
          input.consumedAt,
        ],
      );
      if (updated.rowCount !== 1)
        throw new InvariantViolationError(
          "Approval cannot be consumed because its authority is stale, mismatched, or already used",
        );
      await client.query(
        `INSERT INTO operator_approval_events
          (id,approval_id,event_type,actor_id,occurred_at,content_hash)
         VALUES ($1,$2,'consumed',$3,$4,$5)`,
        [
          randomUUID(),
          input.id,
          input.actorId,
          input.consumedAt,
          eventHash([input.id, "consumed", input.actorId, input.consumedAt, input.payloadHash]),
        ],
      );
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

  public async expireDue(at: Parameters<OperatorApprovalStore["expireDue"]>[0]): Promise<number> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const expired = await client.query<{ id: string; requested_by: string }>(
        `UPDATE operator_approvals SET state='expired',version=version+1
          WHERE state IN ('pending','approved') AND expires_at < $1
          RETURNING id::text,requested_by`,
        [at],
      );
      for (const row of expired.rows) {
        await client.query(
          `INSERT INTO operator_approval_events
            (id,approval_id,event_type,actor_id,occurred_at,content_hash)
           VALUES ($1,$2,'expired','system',$3,$4)`,
          [randomUUID(), row.id, at, eventHash([row.id, "expired", "system", at, null])],
        );
      }
      await client.query("COMMIT");
      return expired.rowCount ?? 0;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {}
      throw error;
    } finally {
      client.release();
    }
  }
}
