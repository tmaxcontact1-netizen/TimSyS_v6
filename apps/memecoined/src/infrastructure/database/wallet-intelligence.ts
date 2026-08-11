import type { PoolClient } from "pg";

import type { WalletIntelligenceRepository } from "../../application/services/wallet-intelligence.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

async function transaction(
  database: DatabasePort,
  operation: (client: Pick<PoolClient, "query">) => Promise<void>,
) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await operation(client);
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

/** Stores reconstructed wallet authority and candidate confirmation as immutable evidence. */
export class PostgresWalletIntelligenceRepository implements WalletIntelligenceRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async saveQualification(
    input: Parameters<WalletIntelligenceRepository["saveQualification"]>[0],
  ): Promise<void> {
    await transaction(this.database, async (client) => {
      await client.query(
        `INSERT INTO wallet_qualification_runs
           (wallet_id, wallet_address, evaluated_at, tier, eligible, metrics_json, reasons_json, evidence_json)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
         ON CONFLICT (wallet_id, evaluated_at) DO NOTHING`,
        [
          input.snapshot.walletId,
          input.snapshot.address,
          input.snapshot.evaluatedAt,
          input.qualification.tier,
          input.qualification.eligible,
          JSON.stringify(input.snapshot, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
          JSON.stringify(input.qualification.reasons),
          JSON.stringify(input.qualification.evidence),
        ],
      );
      await client.query(
        `INSERT INTO tracked_wallets (id, address, independent_group_id, current_tier, qualified_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$5)
         ON CONFLICT (id) DO UPDATE SET address=EXCLUDED.address, current_tier=EXCLUDED.current_tier,
           independent_group_id=EXCLUDED.independent_group_id,
           qualified_at=EXCLUDED.qualified_at, updated_at=EXCLUDED.updated_at`,
        [
          input.snapshot.walletId,
          input.snapshot.address,
          input.snapshot.independentGroupId,
          input.qualification.tier,
          input.snapshot.evaluatedAt,
        ],
      );
    });
  }

  public async saveConfirmation(
    input: Parameters<WalletIntelligenceRepository["saveConfirmation"]>[0],
  ): Promise<void> {
    await transaction(this.database, async (client) => {
      await client.query(
        `INSERT INTO wallet_confirmations
           (id, candidate_id, evaluated_at, confirmation, facts_json)
         VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (id) DO NOTHING`,
        [
          input.confirmationId,
          input.candidateId,
          input.facts.evaluatedAt,
          input.confirmation,
          JSON.stringify(input.facts, (_key, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        ],
      );
    });
  }
}
