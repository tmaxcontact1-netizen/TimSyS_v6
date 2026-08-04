import type { PoolClient } from "pg";
import type {
  EntryPreparationRepository,
  PersistEntryPreparation,
} from "../../application/ports/repositories.js";
interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}
function json(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}
export class PostgresEntryPreparationRepository implements EntryPreparationRepository {
  public constructor(private readonly database: DatabasePort) {}
  public async saveEntryPreparation(input: PersistEntryPreparation): Promise<void> {
    const client = await this.database.connect();
    const approved = input.decision.eligible;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO entry_gate_evaluations (order_id, signal_id, approved, snapshot_json, decision_json, evaluated_at)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)`,
        [
          input.orderId,
          input.signalId,
          approved,
          json(input.snapshot),
          json(input.decision),
          input.evaluatedAt,
        ],
      );
      if (approved) {
        const quote = input.snapshot.entryQuote;
        const swap = input.constructedSwap;
        if (quote === null || swap === null)
          throw new Error("Approved entry preparation is incomplete");
        await client.query(
          `INSERT INTO orders (id,signal_id,side,state,intended_input_amount,quote_fingerprint,transaction_fingerprint,
           transaction_base64,last_valid_block_height,prioritization_fee_lamports,wallet_address,created_at,updated_at)
           VALUES ($1,$2,'buy','approved',$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
          [
            input.orderId,
            input.signalId,
            quote.inputAmount.toString(),
            quote.fingerprint,
            swap.fingerprint,
            swap.serializedTransactionBase64,
            swap.lastValidBlockHeight.toString(),
            swap.prioritizationFeeLamports.toString(),
            swap.wallet,
            input.evaluatedAt,
          ],
        );
        await client.query(
          "UPDATE entry_plans SET state='quoting' WHERE signal_id=$1 AND state='planned'",
          [input.signalId],
        );
        await client.query(
          `INSERT INTO jobs (id,job_type,idempotency_key,payload_json,state,available_at)
           VALUES ($1,'entry_signing',$2,$3::jsonb,'available',$4)`,
          [
            input.orderId,
            `entry_signing:${input.orderId}`,
            JSON.stringify({ orderId: input.orderId }),
            input.evaluatedAt,
          ],
        );
      } else {
        await client.query(
          "UPDATE entry_plans SET state='cancelled' WHERE signal_id=$1 AND state='planned'",
          [input.signalId],
        );
        await client.query(
          "UPDATE signals SET state='expired' WHERE id=$1 AND state='approval_pending'",
          [input.signalId],
        );
      }
      const completed = await client.query(
        "UPDATE jobs SET state='completed',updated_at=$2,version=version+1 WHERE id=$1 AND job_type='entry_planning' AND state='available'",
        [input.signalId, input.evaluatedAt],
      );
      if (completed.rowCount !== 1) throw new Error("Entry preparation requires one available job");
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
