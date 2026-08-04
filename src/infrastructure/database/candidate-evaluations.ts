import type { PoolClient } from "pg";
import type {
  CandidateEvaluationRepository,
  PersistCandidateEvaluation,
} from "../../application/ports/repositories.js";

interface DatabasePort {
  connect(): Promise<Pick<PoolClient, "query" | "release">>;
}

export class PostgresCandidateEvaluationRepository implements CandidateEvaluationRepository {
  public constructor(private readonly database: DatabasePort) {}

  public async saveEvaluation(input: PersistCandidateEvaluation): Promise<void> {
    const client = await this.database.connect();
    try {
      await client.query("BEGIN");
      for (const result of input.decision.results) {
        await client.query(
          `INSERT INTO rule_evaluations
             (candidate_id, evaluation_run_id, rule_id, outcome, reason, measurements_json, evidence_json, evaluated_at)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)`,
          [
            input.candidateId,
            input.evaluationRunId,
            result.ruleId,
            result.outcome,
            result.reason,
            JSON.stringify(result.measurements, (_key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
            JSON.stringify(result.evidence, (_key, value) =>
              typeof value === "bigint" ? value.toString() : value,
            ),
            input.evaluatedAt,
          ],
        );
      }
      await client.query(
        `INSERT INTO score_breakdowns (candidate_id, evaluation_run_id, breakdown_json, total_score, evaluated_at)
         VALUES ($1,$2,$3::jsonb,$4,$5)`,
        [
          input.candidateId,
          input.evaluationRunId,
          JSON.stringify(input.decision.score),
          input.decision.score.total,
          input.evaluatedAt,
        ],
      );
      if (input.decision.eligible) {
        if (input.signalId === null)
          throw new TypeError("Eligible evaluation requires a signal ID");
        await client.query(
          `INSERT INTO signals (id, candidate_id, state, strategy_version_id, created_at, eligibility_hash)
           SELECT $1, id, 'eligible', strategy_version_id, $3, $2 FROM candidates WHERE id=$4`,
          [input.signalId, input.evaluationRunId, input.evaluatedAt, input.candidateId],
        );
      } else {
        for (const ruleId of input.decision.failedRuleIds)
          await client.query(
            `INSERT INTO rejections (candidate_id, evaluation_run_id, rule_id, rejected_at) VALUES ($1,$2,$3,$4)`,
            [input.candidateId, input.evaluationRunId, ruleId, input.evaluatedAt],
          );
      }
      await client.query(
        `UPDATE candidates SET state=$2, last_evaluated_at=$3, updated_at=$3, version=version+1 WHERE id=$1`,
        [input.candidateId, input.decision.eligible ? "eligible" : "rejected", input.evaluatedAt],
      );
      await client.query(
        `UPDATE jobs SET state='completed', updated_at=$2, version=version+1 WHERE id=$1 AND job_type='candidate_evaluation'`,
        [input.candidateId, input.evaluatedAt],
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
