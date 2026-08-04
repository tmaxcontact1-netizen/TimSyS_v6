import type { PoolClient } from "pg";
import type {
  EntrySubmissionRepository,
  PersistEntrySigning,
  PersistEntrySubmission,
} from "../../application/ports/repositories.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresEntrySubmissionRepository implements EntrySubmissionRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async recordSigning(input: PersistEntrySigning): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const order = await client.query(
        `UPDATE orders SET state='signing',updated_at=$2,version=version+1
         WHERE id=$1 AND state='approved'`,
        [input.orderId, input.signedAt],
      );
      await client.query(
        `INSERT INTO entry_submission_attempts
         (order_id,delivery_id,state,unsigned_fingerprint,signed_fingerprint,signature,signed_transaction_base64,created_at)
         VALUES ($1,$2,'signed',$3,$4,$5,$6,$7)
         ON CONFLICT (order_id) DO NOTHING`,
        [
          input.orderId,
          input.deliveryId,
          input.signedTransaction.unsignedTransactionFingerprint,
          input.signedTransaction.signedTransactionFingerprint,
          input.signedTransaction.signature,
          input.signedTransaction.serializedTransactionBase64,
          input.signedAt,
        ],
      );
      const bound = await client.query<{ readonly matches: boolean }>(
        `SELECT delivery_id=$2 AND unsigned_fingerprint=$3 AND signed_fingerprint=$4
          AND signature=$5 AND signed_transaction_base64=$6 AS matches
         FROM entry_submission_attempts WHERE order_id=$1`,
        [
          input.orderId,
          input.deliveryId,
          input.signedTransaction.unsignedTransactionFingerprint,
          input.signedTransaction.signedTransactionFingerprint,
          input.signedTransaction.signature,
          input.signedTransaction.serializedTransactionBase64,
        ],
      );
      if ((order.rowCount !== 1 && order.rowCount !== 0) || bound.rows[0]?.matches !== true)
        throw new Error("Entry signing replay conflicts with durable authority");
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

  public async recordSubmission(input: PersistEntrySubmission): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const attempt = await client.query(
        `UPDATE entry_submission_attempts SET state='submitted',provider=$3,acknowledged_at=$4
         WHERE order_id=$1 AND delivery_id=$2 AND signature=$5 AND state='signed'`,
        [
          input.orderId,
          input.deliveryId,
          input.receipt.provider,
          input.submittedAt,
          input.receipt.signature,
        ],
      );
      const order = await client.query(
        `UPDATE orders SET state='submitted',updated_at=$2,version=version+1
         WHERE id=$1 AND state='signing'`,
        [input.orderId, input.submittedAt],
      );
      if (attempt.rowCount === 0 && order.rowCount === 0) {
        const replay = await client.query<{ readonly matches: boolean }>(
          `SELECT attempt.state='submitted' AND attempt.delivery_id=$2
            AND attempt.provider=$3 AND attempt.signature=$4
            AND attempt.acknowledged_at=$5 AND orders.state='submitted' AS matches
           FROM entry_submission_attempts AS attempt
           JOIN orders ON orders.id=attempt.order_id WHERE attempt.order_id=$1`,
          [
            input.orderId,
            input.deliveryId,
            input.receipt.provider,
            input.receipt.signature,
            input.submittedAt,
          ],
        );
        if (replay.rows[0]?.matches !== true)
          throw new Error("Entry submission replay conflicts with durable acknowledgement");
        await client.query("COMMIT");
        return;
      }
      if (attempt.rowCount !== 1 || order.rowCount !== 1)
        throw new Error("Entry submission requires one durably signed order");
      const completed = await client.query(
        `UPDATE jobs SET state='completed',updated_at=$2,version=version+1
         WHERE id=$1 AND job_type='entry_signing' AND state='available'`,
        [input.orderId, input.submittedAt],
      );
      if (completed.rowCount !== 1)
        throw new Error("Entry submission requires available signing work");
      await client.query(
        `INSERT INTO jobs (id,job_type,idempotency_key,payload_json,state,available_at)
         VALUES ($1,'entry_reconciliation',$2,$3::jsonb,'available',$4)`,
        [
          input.orderId,
          `entry_reconciliation:${input.orderId}`,
          JSON.stringify({ orderId: input.orderId }),
          input.submittedAt,
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
}
