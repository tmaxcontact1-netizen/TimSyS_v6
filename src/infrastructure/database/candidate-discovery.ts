import type { PoolClient } from "pg";

import type {
  CandidateDiscoveryRepository,
  CandidateDiscoveryResult,
} from "../../application/ports/repositories.js";
import type { Candidate, DiscoveredCandidateInput } from "../../domain/candidate/model.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

interface CandidateRow extends Record<string, unknown> {
  readonly id: string;
  readonly token_id: string;
  readonly mint_address: string;
  readonly active_dedup_key: string;
  readonly state: Candidate["state"];
  readonly first_seen_at: Date | string;
  readonly strategy_version_id: string;
}

function mapCandidate(row: CandidateRow): Candidate {
  return Object.freeze({
    id: row.id as Candidate["id"],
    tokenId: row.token_id as Candidate["tokenId"],
    mint: row.mint_address as Candidate["mint"],
    activeDedupKey: row.active_dedup_key,
    state: row.state,
    firstSeenAt: new Date(row.first_seen_at).toISOString() as Candidate["firstSeenAt"],
    strategyVersionId: row.strategy_version_id as Candidate["strategyVersionId"],
  });
}

export class PostgresCandidateDiscoveryRepository implements CandidateDiscoveryRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async recordDiscovery(input: DiscoveredCandidateInput): Promise<CandidateDiscoveryResult> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<CandidateRow>(
        `INSERT INTO candidates
           (id, token_id, mint_address, active_dedup_key, state, first_seen_at, strategy_version_id)
         VALUES ($1, $2, $3, $4, 'discovered', $5, $6)
         ON CONFLICT (active_dedup_key) DO NOTHING
         RETURNING id, token_id, mint_address, active_dedup_key, state, first_seen_at, strategy_version_id`,
        [
          input.id,
          input.tokenId,
          input.mint,
          input.activeDedupKey,
          input.firstSeenAt,
          input.strategyVersionId,
        ],
      );
      const candidateCreated = inserted.rowCount === 1;
      const selected = candidateCreated
        ? inserted
        : await client.query<CandidateRow>(
            `SELECT id, token_id, mint_address, active_dedup_key, state, first_seen_at,
                    strategy_version_id
             FROM candidates WHERE active_dedup_key = $1 FOR UPDATE`,
            [input.activeDedupKey],
          );
      const row = selected.rows[0];
      if (row === undefined)
        throw new Error("Candidate deduplication conflict could not be loaded");
      const source = await client.query(
        `INSERT INTO candidate_sources
           (candidate_id, provider_id, source_reference, observed_at, evidence_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (candidate_id, provider_id, source_reference) DO NOTHING`,
        [
          row.id,
          input.source.provider,
          input.source.sourceReference,
          input.source.observedAt,
          input.source.evidenceId,
        ],
      );
      if (candidateCreated)
        await client.query(
          `INSERT INTO jobs (id, job_type, idempotency_key, payload_json, state, available_at)
           VALUES ($1, 'candidate_evaluation', $2, $3::jsonb, 'available', $4)`,
          [
            row.id,
            `candidate_evaluation:${row.id}`,
            JSON.stringify({ candidateId: row.id }),
            input.firstSeenAt,
          ],
        );
      await client.query("COMMIT");
      return Object.freeze({
        candidate: mapCandidate(row),
        candidateCreated,
        sourceAdded: source.rowCount === 1,
      });
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
