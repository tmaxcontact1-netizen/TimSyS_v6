import type { PoolClient } from "pg";

import type { EvidenceReference } from "../../domain/shared/evidence.js";
import {
  asNonNegativeDecimal,
  asPercentage,
  asTimestamp,
  asUuid,
  type CandidateId,
  type EvidenceId,
  type WalletId,
} from "../../domain/shared/types.js";
import type { ConfirmingPurchase } from "../../domain/wallet/model.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

function evidence(value: unknown): readonly EvidenceReference[] {
  const values = Array.isArray(value) ? value : [value];
  return Object.freeze(
    values.map((item) => {
      if (item === null || typeof item !== "object")
        throw new Error("Wallet evidence is malformed");
      const row = item as Record<string, unknown>;
      const id = row.evidenceId ?? row.id;
      if (
        typeof id !== "string" ||
        typeof row.provider !== "string" ||
        (typeof row.respondedAt !== "string" && typeof row.observedAt !== "string") ||
        typeof row.sourceKey !== "string"
      )
        throw new Error("Wallet evidence provenance is incomplete");
      return Object.freeze({
        id: asUuid<EvidenceId>(id),
        provider: row.provider as EvidenceReference["provider"],
        observedAt: asTimestamp((row.respondedAt ?? row.observedAt) as string),
        sourceKey: row.sourceKey,
        ...(typeof row.contentHash === "string" ? { contentHash: row.contentHash } : {}),
      });
    }),
  );
}

/** Reconstructs only purchases backed by immutable valuation and explicit wallet authority. */
export class PostgresCandidateWalletPurchaseSource {
  public constructor(private readonly database: DatabasePort) {}

  public async load(candidateId: CandidateId): Promise<readonly ConfirmingPurchase[]> {
    const client = await this.database.connect();
    try {
      const result = await client.query<{
        wallet_id: string;
        current_tier: "tier_a" | "tier_b";
        independent_group_id: string | null;
        purchased_at: string;
        valued_at: string;
        purchase_value_usd: string;
        retained_percentage: string;
        price_usd: string;
        purchase_evidence: unknown;
        market_evidence: unknown;
        balance_evidence: unknown;
      }>(
        `SELECT o.wallet_id,w.current_tier,w.independent_group_id,o.purchased_at,v.valued_at,
                v.purchase_value_usd,v.retained_percentage,v.price_usd,
                o.evidence_json AS purchase_evidence,v.market_evidence_json AS market_evidence,
                v.balance_evidence_json AS balance_evidence
           FROM tracked_wallet_purchase_valuations v
           JOIN tracked_wallet_purchase_observations o ON o.id=v.observation_id
           JOIN tracked_wallets w ON w.id=o.wallet_id
          WHERE v.candidate_id=$1
            AND (w.current_tier='tier_a' OR
                 (w.current_tier='tier_b' AND w.independent_group_id IS NOT NULL))
          ORDER BY o.purchased_at,o.wallet_id,o.id`,
        [candidateId],
      );
      return Object.freeze(
        result.rows.map((row) =>
          Object.freeze({
            walletId: asUuid<WalletId>(row.wallet_id),
            tier: row.current_tier,
            purchasedAt: asTimestamp(row.purchased_at),
            observedAt: asTimestamp(row.valued_at),
            purchaseValueUsd: asNonNegativeDecimal(row.purchase_value_usd),
            retainedPercentage: asPercentage(row.retained_percentage),
            entryPriceUsd: asNonNegativeDecimal(row.price_usd),
            independentGroupId: row.independent_group_id ?? `tier-a:${row.wallet_id}`,
            evidence: Object.freeze([
              ...evidence(row.purchase_evidence),
              ...evidence(row.market_evidence),
              ...evidence(row.balance_evidence),
            ]),
          }),
        ),
      );
    } finally {
      client.release();
    }
  }
}
