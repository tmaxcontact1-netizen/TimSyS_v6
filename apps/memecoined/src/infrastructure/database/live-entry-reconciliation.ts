import type { Pool } from "pg";
import type {
  EntryTrackedWalletBaseline,
  LiveEntryReconciliationWork,
} from "../../application/services/live-entry-reconciliation.js";
import { asRawAmount, asUuid, type OrderId, type TokenId, type WalletAddress } from "../../domain/shared/types.js";
import { asMintAddress } from "../../domain/token/token.js";

interface WorkRow extends Record<string, unknown> {
  order_id: string; token_id: string; wallet_address: string; mint_address: string;
  signature: string; minimum_output_amount: string; confirmation: "tier_a" | "two_tier_b";
  candidate_id: string;
}
interface WalletRow extends Record<string, unknown> {
  address: string; current_tier: "tier_a" | "tier_b"; independent_group_id: string | null;
}

export class PostgresLiveEntryReconciliationSource {
  public constructor(private readonly database: Pick<Pool, "query">) {}

  public async nextBatch(limit = 25): Promise<readonly LiveEntryReconciliationWork[]> {
    const work = await this.database.query<WorkRow>(
      `SELECT o.id::text AS order_id,c.token_id::text,c.mint_address,o.wallet_address,
              a.signature,(g.snapshot_json->'entryQuote'->>'minimumOutputAmount') AS minimum_output_amount,
              wc.confirmation,c.id::text AS candidate_id
         FROM orders o
         JOIN entry_submission_attempts a ON a.order_id=o.id AND a.state='submitted'
         JOIN entry_gate_evaluations g ON g.order_id=o.id AND g.approved=true
         JOIN signals s ON s.id=o.signal_id JOIN candidates c ON c.id=s.candidate_id
         JOIN jobs j ON j.id=o.id AND j.job_type='entry_reconciliation' AND j.state='available'
         JOIN LATERAL (SELECT confirmation FROM wallet_confirmations
                       WHERE candidate_id=c.id ORDER BY evaluated_at DESC LIMIT 1) wc ON true
        WHERE o.state='submitted' AND wc.confirmation IN ('tier_a','two_tier_b')
        ORDER BY j.available_at,o.id LIMIT $1`,
      [limit],
    );
    const result: LiveEntryReconciliationWork[] = [];
    for (const row of work.rows) {
      const wallets = await this.database.query<WalletRow>(
        `SELECT DISTINCT w.address,w.current_tier,w.independent_group_id
           FROM tracked_wallet_purchase_valuations v
           JOIN tracked_wallet_purchase_observations o ON o.id=v.observation_id
           JOIN tracked_wallets w ON w.id=o.wallet_id
          WHERE v.candidate_id=$1 AND w.current_tier IN ('tier_a','tier_b')
          ORDER BY w.current_tier,w.address`,
        [row.candidate_id],
      );
      result.push(Object.freeze({
        orderId: asUuid<OrderId>(row.order_id),
        tokenId: asUuid<TokenId>(row.token_id),
        wallet: row.wallet_address as WalletAddress,
        mint: asMintAddress(row.mint_address),
        signature: row.signature,
        minimumOutputAmount: asRawAmount(BigInt(row.minimum_output_amount)),
        walletConfirmation: row.confirmation,
        trackedWallets: Object.freeze(wallets.rows.map((wallet): EntryTrackedWalletBaseline => Object.freeze({
          wallet: wallet.address as WalletAddress,
          tier: wallet.current_tier,
          independentGroupId: wallet.independent_group_id,
        }))),
      }));
    }
    return Object.freeze(result);
  }
}
