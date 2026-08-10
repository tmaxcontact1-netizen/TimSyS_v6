import type { Pool } from "pg";
import type { OperatingMode } from "../config/load-config.js";

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

const paperRequiredColumns = Object.freeze([
  "paper_accounts.wallet",
  "paper_accounts.initial_cash_raw",
  "paper_cash_events.event_type",
  "paper_cash_events.amount_raw",
  "paper_fills.id",
  "paper_fills.side",
  "paper_position_lots.current_amount_raw",
  "paper_position_lots.remaining_cost_raw",
  "paper_entry_executions.risk_run_id",
  "paper_position_work.available_at",
  "paper_position_work.last_error",
  "paper_realized_performance.realized_pnl_raw",
  "paper_exit_evaluations.evaluated_at",
  "paper_position_close_requests.state",
  "paper_operator_control_audit.action",
]);

const dashboardRequiredColumns = Object.freeze([
  "dashboard_watchlists.version",
  "dashboard_watchlist_tokens.token_mint",
  "dashboard_mutation_audit.action",
  "dashboard_trading_configurations.version",
  "dashboard_trading_configurations.entry_slippage_bps",
  "dashboard_trading_configuration_audit.action",
]);

/** Verifies connectivity and the exact runtime-owned schema without executing DDL. */
export async function verifyRuntimeDatabase(
  pool: Pick<Pool, "query">,
  mode?: OperatingMode,
  dashboard = false,
): Promise<DatabaseReadiness> {
  const expected =
    mode === "paper"
      ? [
          ...requiredColumns,
          ...paperRequiredColumns,
          ...(dashboard ? dashboardRequiredColumns : []),
        ]
      : requiredColumns;
  const tables = [...new Set(expected.map((column) => column.split(".")[0]))];
  const version = await pool.query<{ readonly server_version: string }>("SHOW server_version");
  const columns = await pool.query<{ readonly table_name: string; readonly column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [tables],
  );
  const present = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = expected.filter((column) => !present.has(column));
  if (missing.length > 0)
    throw new Error(`Runtime database schema is incomplete: ${missing.join(", ")}`);
  const serverVersion = version.rows[0]?.server_version;
  if (serverVersion === undefined || serverVersion.trim().length === 0)
    throw new Error("Database did not report its server version");
  return Object.freeze({ serverVersion, schemaReady: true });
}
