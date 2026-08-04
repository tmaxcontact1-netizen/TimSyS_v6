import type { PoolClient } from "pg";

import type { TrackedWalletObservationRepository } from "../../application/services/tracked-wallet-observations.js";
import { asTimestamp } from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresTrackedWalletObservationRepository implements TrackedWalletObservationRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async loadTrackedWallets() {
    const client = await this.database.connect();
    try {
      const result = await client.query<{
        id: string;
        address: string;
        last_signature: string | null;
      }>(`SELECT w.id, w.address, c.last_signature FROM tracked_wallets w
          LEFT JOIN tracked_wallet_cursors c ON c.wallet_id=w.id
          WHERE w.current_tier IN ('tier_a','tier_b') ORDER BY w.id`);
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            walletId: row.id as never,
            wallet: row.address as never,
            afterSignature: row.last_signature,
          }),
        ),
      );
    } finally {
      client.release();
    }
  }

  public async recordPurchases(
    input: Parameters<TrackedWalletObservationRepository["recordPurchases"]>[0],
  ): Promise<number> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      let inserted = 0;
      for (const item of input.observations) {
        const result = await client.query(
          `INSERT INTO tracked_wallet_purchase_observations
             (wallet_id,signature,mint,purchased_at,observed_at,slot,acquired_amount_raw,native_spent_lamports,evidence_json)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
           ON CONFLICT (wallet_id,signature,mint) DO NOTHING`,
          [
            item.walletId,
            item.signature,
            item.mint,
            item.purchasedAt,
            item.observedAt,
            item.slot.toString(),
            item.acquiredAmountRaw.toString(),
            item.nativeSpentLamports.toString(),
            JSON.stringify(item.trace, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
          ],
        );
        inserted += result.rowCount ?? 0;
      }
      const newest = input.observations[0]?.signature ?? null;
      await client.query(
        `INSERT INTO tracked_wallet_cursors (wallet_id,last_signature,observed_at)
         VALUES ($1,$2,$3) ON CONFLICT (wallet_id) DO UPDATE
         SET last_signature=COALESCE(EXCLUDED.last_signature,tracked_wallet_cursors.last_signature), observed_at=EXCLUDED.observed_at`,
        [input.walletId, newest, asTimestamp(input.observedAt)],
      );
      await client.query("COMMIT");
      return inserted;
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
