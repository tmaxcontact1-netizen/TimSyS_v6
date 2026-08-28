import type { Pool } from "pg";
import type { PreparedEntryExecution } from "../../application/ports/repositories.js";
import { asUuid, type OrderId, type WalletAddress } from "../../domain/shared/types.js";

interface Row extends Record<string, unknown> {
  readonly order_id: string;
  readonly wallet_address: string;
  readonly transaction_fingerprint: string;
  readonly transaction_base64: string;
  readonly last_valid_block_height: string;
  readonly prioritization_fee_lamports: string;
  readonly intended_input_amount: string;
  readonly quote_fingerprint: string;
  readonly approval_id: string;
  readonly eligibility_hash: string;
}

/** Selects only human-approved, unexpired, quote-bound signing work. */
export class PostgresPreparedEntryExecutionSource {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async nextBatch(limit = 25): Promise<readonly PreparedEntryExecution[]> {
    const result = await this.database.query<Row>(
      `SELECT o.id::text AS order_id,o.wallet_address,o.transaction_fingerprint,
              o.transaction_base64,o.last_valid_block_height::text,
              o.prioritization_fee_lamports::text,o.intended_input_amount::text,
              o.quote_fingerprint,a.id::text AS approval_id,a.eligibility_hash
         FROM orders o
         JOIN jobs j ON j.id=o.id AND j.job_type='entry_signing'
         JOIN operator_approvals a ON a.action_type='entry' AND a.target_type='order'
           AND a.target_id=o.id::text AND a.quote_fingerprint=o.quote_fingerprint
        WHERE o.state='approved' AND j.state='available' AND j.available_at<=now()
          AND a.state='approved' AND a.expires_at>=now()
        ORDER BY j.available_at,o.id LIMIT $1`,
      [limit],
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      orderId: asUuid<OrderId>(row.order_id),
      wallet: row.wallet_address as WalletAddress,
      transactionFingerprint: row.transaction_fingerprint,
      serializedTransactionBase64: row.transaction_base64,
      lastValidBlockHeight: BigInt(row.last_valid_block_height),
      prioritizationFeeLamports: BigInt(row.prioritization_fee_lamports),
      intendedInputAmount: BigInt(row.intended_input_amount),
      quoteFingerprint: row.quote_fingerprint,
      approvalId: row.approval_id,
      approvalEligibilityHash: row.eligibility_hash,
    })));
  }
}
