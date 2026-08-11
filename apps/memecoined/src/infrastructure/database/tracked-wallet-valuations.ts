import type { PoolClient } from "pg";

import type {
  TrackedWalletPurchaseValuation,
  TrackedWalletValuationRepository,
} from "../../application/services/tracked-wallet-valuations.js";
import {
  asRawAmount,
  type CandidateId,
  type MintAddress,
  type WalletAddress,
} from "../../domain/shared/types.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresTrackedWalletValuationRepository implements TrackedWalletValuationRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async loadUnvalued(limit: number) {
    const client = await this.database.connect();
    try {
      const result = await client.query<{
        observation_id: string;
        candidate_id: string;
        wallet: string;
        mint: string;
        acquired_amount_raw: string;
        token_decimals: number;
      }>(
        `SELECT o.id AS observation_id, c.id AS candidate_id, w.address AS wallet,
                o.mint, o.acquired_amount_raw, o.token_decimals
           FROM tracked_wallet_purchase_observations o
           JOIN tracked_wallets w ON w.id=o.wallet_id AND w.current_tier IN ('tier_a','tier_b')
           JOIN candidates c ON c.mint_address=o.mint AND c.state IN ('discovered','normalizing','evaluating')
           LEFT JOIN tracked_wallet_purchase_valuations v ON v.observation_id=o.id
          WHERE v.observation_id IS NULL
            AND o.token_decimals IS NOT NULL
          ORDER BY o.purchased_at, o.id LIMIT $1`,
        [limit],
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            observationId: BigInt(row.observation_id),
            candidateId: row.candidate_id as CandidateId,
            wallet: row.wallet as WalletAddress,
            mint: row.mint as MintAddress,
            acquiredAmountRaw: asRawAmount(BigInt(row.acquired_amount_raw)),
            tokenDecimals: row.token_decimals,
          }),
        ),
      );
    } finally {
      client.release();
    }
  }

  public async save(valuation: TrackedWalletPurchaseValuation): Promise<boolean> {
    const client = await this.database.connect();
    try {
      const result = await client.query(
        `INSERT INTO tracked_wallet_purchase_valuations
           (observation_id,candidate_id,valued_at,price_usd,liquidity_usd,purchase_value_usd,
            acquired_amount_raw,retained_amount_raw,retained_percentage,market_evidence_json,balance_evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
         ON CONFLICT (observation_id) DO NOTHING`,
        [
          valuation.purchase.observationId.toString(),
          valuation.purchase.candidateId,
          valuation.valuedAt,
          valuation.priceUsd.toString(),
          valuation.liquidityUsd.toString(),
          valuation.purchaseValueUsd.toString(),
          valuation.purchase.acquiredAmountRaw.toString(),
          valuation.retainedAmountRaw.toString(),
          valuation.retainedPercentage.toString(),
          JSON.stringify(valuation.marketEvidence, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
          JSON.stringify(valuation.balanceEvidence, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        ],
      );
      return (result.rowCount ?? 0) === 1;
    } finally {
      client.release();
    }
  }
}
