import type { Pool } from "pg";

export interface DatabaseReadiness {
  readonly serverVersion: string;
  readonly schemaReady: true;
}

const requiredColumns = Object.freeze([
  "audit_events.id",
  "jobs.id",
  "jobs.payload_json",
  "jobs.state",
  "jobs.available_at",
  "jobs.version",
  "jobs.last_error_json",
  "jobs.last_error_at",
  "position_runtime_facts.id",
  "position_runtime_facts.position_id",
  "position_runtime_facts.checkpoint_revision",
  "position_runtime_facts.phase",
  "position_runtime_facts.payload_json",
  "position_observations.id",
  "position_observations.position_id",
  "position_observations.content_hash",
  "position_observations.payload_json",
  "position_runtime_fact_observations.runtime_fact_id",
  "position_runtime_fact_observations.observation_id",
  "position_runtime_contexts.position_id",
  "position_runtime_contexts.token_id",
  "position_runtime_contexts.wallet",
  "position_runtime_contexts.token_mint",
  "position_runtime_contexts.settlement_mint",
  "position_runtime_authority_snapshots.id",
  "position_runtime_authority_snapshots.position_id",
  "position_runtime_authority_snapshots.checkpoint_revision",
  "position_runtime_authority_snapshots.phase",
  "position_runtime_authority_snapshots.authority_kind",
  "position_runtime_authority_snapshots.payload_json",
  "position_runtime_authority_baselines.position_id",
  "position_runtime_authority_baselines.payload_json",
]);

/** Verifies connectivity and the exact runtime-owned schema without executing DDL. */
export async function verifyRuntimeDatabase(pool: Pick<Pool, "query">): Promise<DatabaseReadiness> {
  const version = await pool.query<{ readonly server_version: string }>("SHOW server_version");
  const columns = await pool.query<{ readonly table_name: string; readonly column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [
      [
        "jobs",
        "audit_events",
        "position_runtime_facts",
        "position_observations",
        "position_runtime_fact_observations",
        "position_runtime_contexts",
        "position_runtime_authority_snapshots",
        "position_runtime_authority_baselines",
      ],
    ],
  );
  const present = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = requiredColumns.filter((column) => !present.has(column));
  if (missing.length > 0)
    throw new Error(`Runtime database schema is incomplete: ${missing.join(", ")}`);
  const serverVersion = version.rows[0]?.server_version;
  if (serverVersion === undefined || serverVersion.trim().length === 0)
    throw new Error("Database did not report its server version");
  return Object.freeze({ serverVersion, schemaReady: true });
}
