import type { PoolClient } from "pg";
import type {
  PersistRiskDecision,
  RiskDecisionRepository,
} from "../../application/ports/repositories.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

function json(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item));
}

export class PostgresRiskDecisionRepository implements RiskDecisionRepository {
  public constructor(private readonly database: DatabasePort) {}
  public async saveRiskDecision(input: PersistRiskDecision): Promise<void> {
    const client = await this.database.connect();
    const approved = input.sizing.eligible && input.breakers.entryAllowed;
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO risk_decisions (risk_run_id, signal_id, approved, position_size_sol, sizing_json, breakers_json, evaluated_at)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
        [
          input.riskRunId,
          input.signalId,
          approved,
          approved ? (input.sizing.positionSizeSol?.toString() ?? null) : null,
          json(input.sizing),
          json(input.breakers),
          input.evaluatedAt,
        ],
      );
      const signal = await client.query(
        `UPDATE signals SET state=$2 WHERE id=$1 AND state='eligible'`,
        [input.signalId, approved ? "approval_pending" : "expired"],
      );
      if (signal.rowCount !== 1) throw new Error("Risk decision requires one eligible signal");
      if (approved)
        await client.query(
          `INSERT INTO entry_plans (signal_id, risk_run_id, position_size_sol, state, created_at) VALUES ($1,$2,$3,'planned',$4)`,
          [
            input.signalId,
            input.riskRunId,
            input.sizing.positionSizeSol?.toString(),
            input.evaluatedAt,
          ],
        );
      if (approved)
        await client.query(
          `INSERT INTO jobs (id, job_type, idempotency_key, payload_json, state, available_at)
         VALUES ($1,'entry_planning',$2,$3::jsonb,'available',$4)`,
          [
            input.signalId,
            `entry_planning:${input.signalId}`,
            JSON.stringify({ signalId: input.signalId }),
            input.evaluatedAt,
          ],
        );
      const completed = await client.query(
        `UPDATE jobs SET state='completed', lease_owner=NULL, lease_expires_at=NULL,
                         updated_at=$2, version=version+1
         WHERE id=$1 AND job_type='risk_evaluation'
           AND ($3::text IS NULL OR (state='leased' AND lease_owner=$3))`,
        [input.signalId, input.evaluatedAt, input.leaseOwner ?? null],
      );
      if (input.leaseOwner !== undefined && completed.rowCount !== 1)
        throw new Error("Risk decision completion requires the active lease");
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
